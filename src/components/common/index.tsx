// Reusable building blocks shared by every module.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, Download, Inbox, Search, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useApp } from "@/stores/app";

// ---------------------------------------------------------------- PageHeader
export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <div className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-primary">{eyebrow}</div>
        )}
        <h1 className="text-2xl font-semibold text-foreground md:text-[1.7rem]">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

// ---------------------------------------------------------------- KpiCard
type Tone = "default" | "primary" | "success" | "warning" | "danger" | "info";
const toneIcon: Record<Tone, string> = {
  default: "bg-muted text-foreground",
  primary: "bg-primary-soft text-primary",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning-foreground",
  danger: "bg-destructive-soft text-destructive",
  info: "bg-info-soft text-info",
};

export function KpiCard({
  label,
  value,
  icon: Icon,
  tone = "default",
  hint,
  delta,
  onClick,
}: {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  tone?: Tone;
  hint?: ReactNode;
  delta?: number; // percent
  onClick?: () => void;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={cn(
        "group relative flex flex-col gap-3 overflow-hidden rounded-xl border bg-card p-4 text-left shadow-card transition-all animate-fade-up",
        onClick && "cursor-pointer hover:-translate-y-0.5 hover:border-primary/40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        {Icon && (
          <span className={cn("grid size-8 place-items-center rounded-lg", toneIcon[tone])}>
            <Icon className="size-4" />
          </span>
        )}
      </div>
      <div className="font-display text-2xl font-semibold tabular text-foreground">{value}</div>
      {(hint || delta != null) && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {delta != null && (
            <span className={cn("font-semibold", delta >= 0 ? "text-success" : "text-destructive")}>
              {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}%
            </span>
          )}
          {hint}
        </div>
      )}
    </Comp>
  );
}

// ---------------------------------------------------------------- StatusBadge
type BadgeVariant = "success" | "warning" | "info" | "danger" | "muted" | "primary";
const STATUS: Record<string, [BadgeVariant, string]> = {
  // generic
  pending: ["warning", "Pending"],
  processing: ["info", "Processing"],
  completed: ["success", "Completed"],
  failed: ["danger", "Failed"],
  cancelled: ["muted", "Cancelled"],
  approved: ["success", "Approved"],
  rejected: ["danger", "Rejected"],
  paid: ["success", "Paid"],
  unpaid: ["warning", "Unpaid"],
  draft: ["muted", "Draft"],
  active: ["success", "Active"],
  inactive: ["muted", "Inactive"],
  open: ["warning", "Open"],
  closed: ["muted", "Closed"],
  // orders
  pending_payment: ["warning", "Awaiting payment"],
  partially_paid: ["info", "Partially paid"],
  refunded: ["muted", "Refunded"],
  // kitchen
  new: ["primary", "New"],
  preparing: ["info", "Preparing"],
  ready: ["success", "Ready"],
  // shifts
  pending_review: ["warning", "Manager review"],
  // recon
  incoming: ["info", "Incoming"],
  matched: ["success", "Matched"],
  unmatched: ["warning", "Unmatched"],
  exception: ["danger", "Exception"],
  // attendance
  present: ["success", "Present"],
  late: ["warning", "Late"],
  absent: ["danger", "Absent"],
  clocked_out: ["muted", "Clocked out"],
  on_leave: ["info", "On leave"],
  verified: ["success", "Verified"],
  low_confidence: ["warning", "Low confidence"],
  manual: ["info", "Manual"],
  // biometric
  not_enrolled: ["muted", "Not enrolled"],
  in_progress: ["info", "In progress"],
  enrolled: ["success", "Enrolled"],
  disabled: ["danger", "Disabled"],
  // procurement / inventory
  submitted: ["info", "Submitted"],
  reviewed: ["info", "Reviewed"],
  sent: ["primary", "Sent"],
  received: ["success", "Received"],
  converted: ["success", "Converted to PO"],
  in_transit: ["info", "In transit"],
  posted: ["success", "Posted"],
  ok: ["success", "In stock"],
  low: ["warning", "Low stock"],
  out: ["danger", "Out of stock"],
  suspended: ["danger", "Suspended"],
  terminated: ["muted", "Terminated"],
};

export function StatusBadge({ status, label, className }: { status: string; label?: string; className?: string }) {
  const [variant, text] = STATUS[status] ?? (["muted", status.replace(/_/g, " ")] as [BadgeVariant, string]);
  return (
    <Badge variant={variant} className={cn("whitespace-nowrap capitalize-first", className)}>
      {label ?? text}
    </Badge>
  );
}

// ---------------------------------------------------------------- Empty / Error / Loading
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-xl border border-dashed bg-surface px-6 py-12 text-center", className)}>
      <span className="mb-3 grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-5" />
      </span>
      <h3 className="text-base font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = "Something went wrong", description, onRetry }: { title?: string; description?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-destructive/30 bg-destructive-soft px-6 py-10 text-center">
      <AlertTriangle className="mb-2 size-6 text-destructive" />
      <h3 className="font-semibold text-destructive">{title}</h3>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-64" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-xl" />
    </div>
  );
}

// ---------------------------------------------------------------- Section card
export function Section({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("rounded-xl border bg-card shadow-card", className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
          <div>
            {title && <h2 className="text-sm font-semibold">{title}</h2>}
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </section>
  );
}

// ---------------------------------------------------------------- ConfirmDialog
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  destructive,
  onConfirm,
  children,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  children?: ReactNode;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className={cn(destructive && "bg-destructive text-destructive-foreground hover:bg-destructive/90")}
            onClick={onConfirm}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ---------------------------------------------------------------- FilterBar
export function FilterBar({
  search,
  onSearch,
  placeholder = "Search…",
  children,
  onExport,
}: {
  search?: string;
  onSearch?: (v: string) => void;
  placeholder?: string;
  children?: ReactNode;
  onExport?: () => void;
}) {
  return (
    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      {onSearch && (
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => onSearch(e.target.value)} placeholder={placeholder} className="h-10 pl-9" />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">{children}</div>
      {onExport && (
        <Button variant="outline" size="sm" className="h-10 sm:ml-auto" onClick={onExport}>
          <Download /> Export CSV
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- DataTable
export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
}

/** Table on md+, stacked cards on mobile. Client-side pagination. */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  mobileCard,
  pageSize = 10,
  empty,
  onRowClick,
  rowClassName,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  mobileCard?: (row: T) => ReactNode;
  pageSize?: number;
  empty?: ReactNode;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string | undefined;
}) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  useEffect(() => {
    if (page > pages - 1) setPage(0);
  }, [pages, page]);
  const slice = useMemo(() => rows.slice(page * pageSize, page * pageSize + pageSize), [rows, page, pageSize]);

  if (rows.length === 0) return <>{empty ?? <EmptyState title="Nothing here yet" description="Try adjusting your filters." />}</>;

  return (
    <div>
      <div className="hidden overflow-x-auto rounded-xl border bg-card shadow-card md:block">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    "px-4 py-3 font-semibold",
                    c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left",
                    c.className,
                  )}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {slice.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn("transition-colors hover:bg-surface-2/60", onRowClick && "cursor-pointer", rowClassName?.(row))}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn(
                      "px-4 py-3 align-middle",
                      c.align === "right" ? "text-right tabular" : c.align === "center" ? "text-center" : "",
                      c.className,
                    )}
                  >
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-2 md:hidden">
        {slice.map((row) => (
          <div
            key={rowKey(row)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={cn("rounded-xl border bg-card p-4 shadow-card", onRowClick && "cursor-pointer", rowClassName?.(row))}
          >
            {mobileCard ? (
              mobileCard(row)
            ) : (
              <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                {columns.map((c) => (
                  <div key={c.key} className="min-w-0">
                    <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{c.header}</dt>
                    <dd className="truncate">{c.cell(row)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        ))}
      </div>

      {pages > 1 && (
        <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {page * pageSize + 1}–{Math.min(rows.length, (page + 1) * pageSize)} of {rows.length}
          </span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" disabled={page === 0} onClick={() => setPage((p) => p - 1)} aria-label="Previous page">
              <ChevronLeft />
            </Button>
            <span className="px-2 tabular">
              {page + 1} / {pages}
            </span>
            <Button variant="outline" size="icon" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)} aria-label="Next page">
              <ChevronRight />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- hooks
/** Ticking clock for live timers. */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/** Current branch filter from the top bar ("all" or a branch id). */
export function useBranchFilter() {
  return useApp((s) => s.branchFilter);
}

export function inBranch(filter: string, branchId: string) {
  return filter === "all" || filter === branchId;
}
