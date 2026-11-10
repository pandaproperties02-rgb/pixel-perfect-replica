import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  AlertTriangle,
  Banknote,
  Building2,
  CalendarCheck,
  ChefHat,
  ClipboardCheck,
  Clock,
  MonitorSmartphone,
  PackageX,
  Receipt,
  ShoppingBag,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { KpiCard, PageHeader, Section, StatusBadge, inBranch, useBranchFilter, useNow, EmptyState } from "@/components/common";
import { BarsChart, DonutChart, TrendChart } from "@/components/dashboard/charts";
import { stockLevel, stockTotal } from "@/lib/calc";
import { duration, isoDate, kes, minutesSince, paymentMethodLabel, time } from "@/lib/format";
import { pageHead } from "@/lib/head";
import { NAV_GROUPS, ROLE_LABELS } from "@/lib/roles";
import { BRANCHES } from "@/lib/seed";
import type { PaymentMethod, Role } from "@/lib/types";
import { useCurrentUser } from "@/stores/app";
import { useOps } from "@/stores/ops";
import { usePeople } from "@/stores/people";
import { useSupply } from "@/stores/supply";

export const Route = createFileRoute("/_console/")({
  head: () => pageHead("Command Center", "Live revenue, orders, shifts, kitchen, stock and attendance across every branch."),
  component: Dashboard,
});

const EXEC: Role[] = ["super_admin", "business_owner", "branch_manager", "auditor", "accountant"];

function greeting(now: number) {
  const h = new Date(now).getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function useMetrics() {
  const branch = useBranchFilter();
  const orders = useOps((s) => s.orders);
  const shifts = useOps((s) => s.shifts);
  const txns = useOps((s) => s.mpesaTxns);
  const history = useOps((s) => s.salesHistory);
  const products = useOps((s) => s.products);
  const items = useSupply((s) => s.items);
  const stores = useSupply((s) => s.stores);
  const pos = useSupply((s) => s.purchaseOrders);
  const expenses = useSupply((s) => s.expenses);
  const attendance = usePeople((s) => s.attendance);
  const employees = usePeople((s) => s.employees);
  const leave = usePeople((s) => s.leave);

  return useMemo(() => {
    const today = isoDate(Date.now());
    const bOrders = orders.filter((o) => inBranch(branch, o.branchId) && isoDate(o.createdAt) === today);
    const paid = bOrders.filter((o) => o.status === "paid");
    const revenue = paid.reduce((s, o) => s + o.total, 0);
    const openShifts = shifts.filter((s) => s.status === "open" && inBranch(branch, s.branchId));
    const pendingPayments =
      bOrders.filter((o) => o.status === "pending_payment" || o.status === "partially_paid").length +
      txns.filter((t) => t.status === "incoming").length;
    const branchStores = stores.filter((s) => inBranch(branch, s.branchId)).map((s) => s.id);
    const scopedItems = items.map((i) => ({ ...i, stock: Object.fromEntries(Object.entries(i.stock).filter(([k]) => branchStores.includes(k))) }));
    const lowStock = scopedItems.filter((i) => stockLevel(i) !== "ok");
    const empIds = new Set(employees.filter((e) => inBranch(branch, e.branchId)).map((e) => e.id));
    const todayAtt = attendance.filter((a) => a.date === today && empIds.has(a.employeeId));
    const present = todayAtt.filter((a) => a.status === "present" || a.status === "late").length;
    const approvals =
      pos.filter((p) => p.status === "submitted" || p.status === "reviewed").length +
      expenses.filter((e) => e.status === "pending").length +
      leave.filter((l) => l.status === "pending").length +
      shifts.filter((s) => s.status === "pending_review").length;

    // charts
    const trendMap = new Map<string, number>();
    history.filter((h) => inBranch(branch, h.branchId)).forEach((h) => trendMap.set(h.date, (trendMap.get(h.date) ?? 0) + h.revenue));
    trendMap.set(today, revenue);
    const trend = [...trendMap.entries()].map(([d, v]) => ({ label: d.slice(5), value: v }));

    const byBranch = BRANCHES.filter((b) => inBranch(branch, b.id)).map((b) => ({
      label: b.name,
      value: orders.filter((o) => o.branchId === b.id && o.status === "paid" && isoDate(o.createdAt) === today).reduce((s, o) => s + o.total, 0),
    }));

    const methodTotals = new Map<PaymentMethod, number>();
    paid.flatMap((o) => o.payments).filter((p) => p.status === "completed").forEach((p) => methodTotals.set(p.method, (methodTotals.get(p.method) ?? 0) + p.amount));
    const methods = [...methodTotals.entries()].map(([m, v]) => ({ label: paymentMethodLabel[m], value: v }));

    const productQty = new Map<string, number>();
    paid.forEach((o) => o.items.forEach((i) => productQty.set(i.name, (productQty.get(i.name) ?? 0) + i.qty)));
    const best = [...productQty.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, value]) => ({ label, value }));

    const hours = new Map<number, number>();
    paid.forEach((o) => {
      const h = new Date(o.createdAt).getHours();
      hours.set(h, (hours.get(h) ?? 0) + o.total);
    });
    const hourly = [...hours.entries()].sort((a, b) => a[0] - b[0]).map(([h, v]) => ({ label: `${String(h).padStart(2, "0")}:00`, value: v }));

    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const weekly = Array.from({ length: 7 }, (_, i) => {
      const thisDate = isoDate(Date.now() - (6 - i) * 86400000);
      const lastDate = isoDate(Date.now() - (13 - i) * 86400000);
      const sum = (d: string) => (d === today ? revenue : history.filter((h) => h.date === d && inBranch(branch, h.branchId)).reduce((s, h) => s + h.revenue, 0));
      return { label: days[new Date(thisDate).getDay()]!, thisWeek: sum(thisDate), lastWeek: sum(lastDate) };
    });

    const yesterday = trend.at(-2)?.value ?? 0;
    return {
      revenue,
      orderCount: bOrders.filter((o) => o.status !== "cancelled").length,
      aov: paid.length ? revenue / paid.length : 0,
      openShifts,
      pendingPayments,
      lowStock,
      present,
      totalEmployees: empIds.size,
      approvals,
      trend,
      byBranch,
      methods,
      best,
      hourly,
      weekly,
      delta: yesterday ? ((revenue - yesterday) / yesterday) * 100 : undefined,
      kitchen: bOrders.filter((o) => o.kitchenStatus !== "completed" && o.status !== "cancelled"),
      incoming: txns.filter((t) => t.status === "incoming" || t.status === "exception"),
      todayAtt,
      products,
    };
  }, [branch, orders, shifts, txns, history, products, items, stores, pos, expenses, attendance, employees, leave]);
}

function Dashboard() {
  const user = useCurrentUser();
  const now = useNow(60000);
  const isExec = EXEC.includes(user.role);
  return (
    <div>
      <PageHeader
        eyebrow={ROLE_LABELS[user.role]}
        title={`${greeting(now)}, ${user.name.split(" ")[0]}`}
        description={isExec ? "Here's what's happening across your cafeterias right now." : "Your workspace for today."}
        actions={
          <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-pulse-ring rounded-full bg-success" />
              <span className="relative inline-flex size-2 rounded-full bg-success" />
            </span>
            Live · {time(now)}
          </span>
        }
      />
      {isExec ? <CommandCenter /> : <RoleHome role={user.role} />}
    </div>
  );
}

function CommandCenter() {
  const m = useMetrics();
  const now = useNow(30000);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <KpiCard label="Today's revenue" value={kes(m.revenue)} icon={TrendingUp} tone="primary" delta={m.delta} hint="vs yesterday" />
        <KpiCard label="Today's orders" value={m.orderCount} icon={ShoppingBag} tone="info" />
        <KpiCard label="Avg order value" value={kes(m.aov)} icon={Receipt} />
        <KpiCard label="Branches" value={BRANCHES.length} icon={Building2} />
        <KpiCard label="Active cashiers" value={new Set(m.openShifts.map((s) => s.cashierId)).size} icon={Users} tone="success" />
        <KpiCard label="Open shifts" value={m.openShifts.length} icon={Clock} />
        <KpiCard label="Pending payments" value={m.pendingPayments} icon={Wallet} tone={m.pendingPayments ? "warning" : "default"} />
        <KpiCard label="Low stock alerts" value={m.lowStock.length} icon={PackageX} tone={m.lowStock.length ? "danger" : "default"} />
        <KpiCard label="Employees present" value={`${m.present}/${m.totalEmployees}`} icon={UserCheck} tone="success" />
        <KpiCard label="Pending approvals" value={m.approvals} icon={ClipboardCheck} tone={m.approvals ? "warning" : "default"} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Section title="Sales trend" description="Last 28 days + today" className="xl:col-span-2">
          <TrendChart data={m.trend} />
        </Section>
        <Section title="Payment methods" description="Today, completed payments">
          {m.methods.length ? <DonutChart data={m.methods} /> : <EmptyState title="No payments yet today" />}
        </Section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Section title="Revenue by branch" description="Today">
          <BarsChart data={m.byBranch} height={240} />
        </Section>
        <Section title="Best-selling products" description="Units sold today">
          {m.best.length ? <BarsChart data={m.best} horizontal money={false} height={240} /> : <EmptyState title="No sales yet" />}
        </Section>
        <Section title="Hourly sales" description="Today">
          {m.hourly.length ? <BarsChart data={m.hourly} height={240} /> : <EmptyState title="No sales yet" />}
        </Section>
      </div>

      <Section title="Weekly comparison" description="This week vs last week">
        <BarsChart data={m.weekly} height={240} series={[{ key: "lastWeek", name: "Last week" }, { key: "thisWeek", name: "This week" }]} />
      </Section>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Section title="Active POS terminals" actions={<Button variant="ghost" size="sm" asChild><Link to="/shifts">Shifts</Link></Button>}>
          {m.openShifts.length === 0 ? (
            <EmptyState icon={MonitorSmartphone} title="No terminals open" />
          ) : (
            <ul className="divide-y">
              {m.openShifts.map((s) => (
                <li key={s.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <div className="font-medium">{s.register} · {s.cashierName}</div>
                    <div className="text-xs text-muted-foreground">{BRANCHES.find((b) => b.id === s.branchId)?.name}</div>
                  </div>
                  <span className="rounded-full bg-success-soft px-2 py-0.5 text-xs font-semibold text-success">{duration(now - s.openedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section title="Kitchen in progress" actions={<Button variant="ghost" size="sm" asChild><Link to="/kitchen">Open KDS</Link></Button>}>
          {m.kitchen.length === 0 ? (
            <EmptyState icon={ChefHat} title="Kitchen is clear" />
          ) : (
            <ul className="divide-y">
              {m.kitchen.slice(0, 6).map((o) => {
                const mins = minutesSince(o.createdAt, now);
                return (
                  <li key={o.id} className="flex items-center justify-between py-2.5 text-sm">
                    <div>
                      <div className="font-medium">{o.number}</div>
                      <div className="text-xs text-muted-foreground">{o.items.length} items · {mins} min</div>
                    </div>
                    <StatusBadge status={o.kitchenStatus} />
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
        <Section title="Payment verification" actions={<Button variant="ghost" size="sm" asChild><Link to="/payments/reconciliation">Reconcile</Link></Button>}>
          {m.incoming.length === 0 ? (
            <EmptyState icon={Banknote} title="Nothing to verify" />
          ) : (
            <ul className="divide-y">
              {m.incoming.slice(0, 6).map((t) => (
                <li key={t.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <div className="font-mono text-xs font-medium">{t.reference}</div>
                    <div className="text-xs text-muted-foreground">{t.payerName} · {time(t.at)}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold tabular">{kes(t.amount)}</div>
                    <StatusBadge status={t.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section title="Low-stock products" actions={<Button variant="ghost" size="sm" asChild><Link to="/inventory">Inventory</Link></Button>} className="xl:col-span-2">
          {m.lowStock.length === 0 ? (
            <EmptyState icon={PackageX} title="Stock levels healthy" />
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {m.lowStock.slice(0, 8).map((i) => (
                <div key={i.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                  <div>
                    <div className="font-medium">{i.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {stockTotal(i)} {i.unit} · reorder at {i.reorderLevel}
                    </div>
                  </div>
                  <StatusBadge status={stockLevel(i)} />
                </div>
              ))}
            </div>
          )}
        </Section>
        <Section title="Attendance today" actions={<Button variant="ghost" size="sm" asChild><Link to="/attendance">Details</Link></Button>}>
          <AttendanceMini records={m.todayAtt} total={m.totalEmployees} />
        </Section>
      </div>
    </div>
  );
}

function AttendanceMini({ records, total }: { records: { status: string }[]; total: number }) {
  const count = (s: string) => records.filter((r) => r.status === s).length;
  const rows = [
    { label: "Present", value: count("present"), cls: "bg-success" },
    { label: "Late", value: count("late"), cls: "bg-warning" },
    { label: "Clocked out", value: count("clocked_out"), cls: "bg-info" },
    { label: "On leave", value: count("on_leave"), cls: "bg-chart-5" },
    { label: "Absent / not in", value: Math.max(0, total - records.filter((r) => r.status !== "absent").length), cls: "bg-destructive" },
  ];
  return (
    <div className="space-y-3">
      <div className="flex h-3 overflow-hidden rounded-full bg-muted">
        {rows.map((r) => (
          <div key={r.label} className={r.cls} style={{ width: `${(r.value / Math.max(1, total)) * 100}%` }} />
        ))}
      </div>
      <ul className="space-y-1.5 text-sm">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span className={`size-2 rounded-full ${r.cls}`} /> {r.label}
            </span>
            <span className="font-semibold tabular">{r.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RoleHome({ role }: { role: Role }) {
  const m = useMetrics();
  const links = NAV_GROUPS.flatMap((g) => g.items).filter((i) => i.roles.includes(role) && i.to !== "/");
  const kpis: Partial<Record<Role, { label: string; value: string | number; icon: typeof Users; tone?: "primary" | "warning" | "danger" | "success" | "info" }[]>> = {
    pos_manager: [
      { label: "Today's revenue", value: kes(m.revenue), icon: TrendingUp, tone: "primary" },
      { label: "Open shifts", value: m.openShifts.length, icon: Clock },
      { label: "Pending payments", value: m.pendingPayments, icon: Wallet, tone: "warning" },
    ],
    cashier: [
      { label: "Orders today", value: m.orderCount, icon: ShoppingBag, tone: "primary" },
      { label: "Pending payments", value: m.pendingPayments, icon: Wallet, tone: "warning" },
    ],
    kitchen_manager: [
      { label: "In the kitchen", value: m.kitchen.length, icon: ChefHat, tone: "primary" },
      { label: "Low stock", value: m.lowStock.length, icon: PackageX, tone: "danger" },
    ],
    kitchen_staff: [{ label: "In the kitchen", value: m.kitchen.length, icon: ChefHat, tone: "primary" }],
    store_manager: [
      { label: "Low stock", value: m.lowStock.length, icon: PackageX, tone: "danger" },
      { label: "Pending approvals", value: m.approvals, icon: ClipboardCheck, tone: "warning" },
    ],
    storekeeper: [{ label: "Low stock", value: m.lowStock.length, icon: PackageX, tone: "danger" }],
    procurement_officer: [{ label: "Low stock", value: m.lowStock.length, icon: AlertTriangle, tone: "warning" }],
    hr_manager: [
      { label: "Present today", value: `${m.present}/${m.totalEmployees}`, icon: UserCheck, tone: "success" },
      { label: "Pending approvals", value: m.approvals, icon: ClipboardCheck, tone: "warning" },
    ],
    employee: [],
  };
  return (
    <div className="space-y-6">
      {(kpis[role]?.length ?? 0) > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {kpis[role]!.map((k) => (
            <KpiCard key={k.label} label={k.label} value={k.value} icon={k.icon} tone={k.tone} />
          ))}
        </div>
      )}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Your modules</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="group flex items-center gap-3 rounded-xl border bg-card p-4 shadow-card transition-all hover:-translate-y-0.5 hover:border-primary/40"
            >
              <span className="grid size-10 place-items-center rounded-lg bg-primary-soft text-primary">
                <CalendarCheck className="size-5" />
              </span>
              <span className="font-semibold">{l.label}</span>
              <span className="ml-auto text-muted-foreground transition-transform group-hover:translate-x-1">→</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
