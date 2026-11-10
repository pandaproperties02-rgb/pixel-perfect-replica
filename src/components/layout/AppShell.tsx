import { useState, type ReactNode } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import * as Icons from "lucide-react";
import { Bell, ChevronsUpDown, LogOut, Menu, ShieldOff, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, PageSkeleton } from "@/components/common";
import { NAV_GROUPS, ROLE_LABELS, canAccessPath } from "@/lib/roles";
import { BRANCHES, DEMO_USERS } from "@/lib/seed";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useApp, useCurrentUser } from "@/stores/app";
import { usePeople } from "@/stores/people";
import { useOps } from "@/stores/ops";

function NavIcon({ name, className }: { name: string; className?: string }) {
  const Icon = (Icons as unknown as Record<string, Icons.LucideIcon>)[name] ?? Icons.Circle;
  return <Icon className={className} />;
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-4 py-5">
      <span className="grid size-9 place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-glow">
        <Sparkles className="size-4" />
      </span>
      <div className="leading-tight">
        <div className="font-display text-[15px] font-semibold text-sidebar-accent-foreground">Savora</div>
        <div className="text-[11px] text-sidebar-muted">Cafeteria OS</div>
      </div>
    </div>
  );
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const user = useCurrentUser();
  const { pathname } = useLocation();
  const openExceptions = usePeople((s) => s.exceptions.filter((e) => e.status === "open").length);
  const kitchenQueue = useOps((s) => s.orders.filter((o) => o.kitchenStatus === "new" && o.status !== "cancelled").length);
  const badges: Record<string, number> = { "/attendance/exceptions": openExceptions, "/kitchen": kitchenQueue };

  return (
    <nav className="scrollbar-thin flex-1 space-y-5 overflow-y-auto px-3 pb-6">
      {NAV_GROUPS.map((group) => {
        const items = group.items.filter((i) => i.roles.includes(user.role));
        if (items.length === 0) return null;
        return (
          <div key={group.label}>
            <div className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-muted">
              {group.label}
            </div>
            <ul className="space-y-0.5">
              {items.map((item) => {
                const active =
                  item.to === "/"
                    ? pathname === "/"
                    : pathname === item.to ||
                      (pathname.startsWith(item.to + "/") &&
                        !group.items.some((o) => o.to !== item.to && o.to.startsWith(item.to) && pathname.startsWith(o.to)));
                const badge = badges[item.to];
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      onClick={onNavigate}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                      )}
                    >
                      <NavIcon name={item.icon} className={cn("size-4", active && "text-sidebar-primary")} />
                      <span className="flex-1 truncate">{item.label}</span>
                      {badge ? (
                        <span className="rounded-full bg-sidebar-primary px-1.5 text-[10px] font-bold text-sidebar-primary-foreground">
                          {badge}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

function RoleSwitcher({ compact }: { compact?: boolean }) {
  const user = useCurrentUser();
  const setUser = useApp((s) => s.setUser);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex w-full items-center gap-3 rounded-xl text-left transition-colors",
            compact ? "p-1.5 hover:bg-accent" : "bg-sidebar-accent/70 p-2.5 hover:bg-sidebar-accent",
          )}
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-bold text-primary">
            {initials(user.name)}
          </span>
          {!compact && (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-sidebar-accent-foreground">{user.name}</span>
              <span className="block truncate text-[11px] text-sidebar-muted">{ROLE_LABELS[user.role]}</span>
            </span>
          )}
          {!compact && <ChevronsUpDown className="size-4 text-sidebar-muted" />}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-[70vh] w-64 overflow-y-auto">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Demo: switch role</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {DEMO_USERS.map((u) => (
          <DropdownMenuItem key={u.id} onClick={() => setUser(u.id)} className={cn(u.id === user.id && "bg-accent")}>
            <div className="flex flex-col">
              <span className="text-sm font-medium">{ROLE_LABELS[u.role]}</span>
              <span className="text-xs text-muted-foreground">{u.name}</span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Topbar({ onMenu }: { onMenu: () => void }) {
  const branch = useApp((s) => s.branchFilter);
  const setBranch = useApp((s) => s.setBranchFilter);
  const openExceptions = usePeople((s) => s.exceptions.filter((e) => e.status === "open").length);
  const pendingReview = useOps((s) => s.shifts.filter((x) => x.status === "pending_review").length);
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur md:px-6">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenu} aria-label="Open menu">
        <Menu className="size-5" />
      </Button>
      <Select value={branch} onValueChange={setBranch}>
        <SelectTrigger className="h-9 w-[190px] bg-card">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All branches</SelectItem>
          {BRANCHES.map((b) => (
            <SelectItem key={b.id} value={b.id}>
              {b.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="hidden items-center gap-1.5 rounded-full bg-warning-soft px-2.5 py-1 text-[11px] font-semibold text-warning-foreground sm:inline-flex">
        <span className="size-1.5 rounded-full bg-warning" /> Demo data
      </span>
      <div className="ml-auto flex items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
              <Bell className="size-5" />
              {openExceptions + pendingReview > 0 && (
                <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-primary" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuLabel>Needs attention</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/attendance/exceptions">{openExceptions} open attendance exceptions</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/shifts">{pendingReview} shifts awaiting manager review</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="lg:hidden">
          <RoleSwitcher compact />
        </div>
      </div>
    </header>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const hydrated = useApp((s) => s.hydrated);
  const user = useCurrentUser();
  const { pathname } = useLocation();
  const allowed = canAccessPath(user.role, pathname);

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-sidebar lg:flex">
        <Brand />
        <SidebarNav />
        <div className="border-t border-sidebar-border p-3">
          <RoleSwitcher />
        </div>
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="flex w-72 flex-col border-0 bg-sidebar p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Brand />
          <SidebarNav onNavigate={() => setMobileOpen(false)} />
          <div className="border-t border-sidebar-border p-3">
            <RoleSwitcher />
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenu={() => setMobileOpen(true)} />
        <main className="flex-1 px-4 py-6 md:px-6 lg:px-8">
          {!hydrated ? (
            <PageSkeleton />
          ) : allowed ? (
            children
          ) : (
            <EmptyState
              icon={ShieldOff}
              title="You don't have access to this page"
              description={`The ${ROLE_LABELS[user.role]} role can't open this module. Switch role from the menu, or go back to your dashboard.`}
              action={
                <Button asChild>
                  <Link to="/">
                    <LogOut className="rotate-180" /> Back to dashboard
                  </Link>
                </Button>
              }
            />
          )}
        </main>
      </div>
    </div>
  );
}
