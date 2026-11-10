import type { ReactNode } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AppPath } from "@/lib/roles";
import { cn } from "@/lib/utils";

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-xs font-semibold text-foreground">
        {label}
      </Label>
      {children}
      {error ? (
        <p className="text-xs font-medium text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function SimpleSelect({
  value,
  onChange,
  options,
  placeholder,
  className,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
  id?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} className={cn("h-10 bg-card", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Horizontal, scrollable module sub-navigation. */
export function SubNav({ items }: { items: { to: AppPath; label: string }[] }) {
  const { pathname } = useLocation();
  return (
    <div className="scrollbar-thin -mx-4 mb-6 overflow-x-auto px-4 md:mx-0 md:px-0">
      <div className="inline-flex min-w-full gap-1 rounded-xl border bg-card p-1 shadow-card md:min-w-0">
        {items.map((i) => {
          const active = pathname === i.to || (i.to !== items[0]!.to && pathname.startsWith(i.to));
          return (
            <Link
              key={i.to}
              to={i.to}
              className={cn(
                "whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {i.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function Stat({ label, value, className }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-lg bg-surface-2 px-3 py-2", className)}>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-semibold tabular">{value}</div>
    </div>
  );
}

export function errMsg(e: unknown) {
  return e instanceof Error ? e.message : "Something went wrong";
}
