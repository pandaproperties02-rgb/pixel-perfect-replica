import { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Banknote, Building, CheckCircle2, CreditCard, Gift, Hash, Smartphone, Store, Trash2, TriangleAlert, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Field, errMsg } from "@/components/common/forms";
import { StatusBadge } from "@/components/common";
import { splitSummary } from "@/lib/calc";
import { kes, paymentMethodLabel } from "@/lib/format";
import { getMpesaMode } from "@/lib/mpesa.functions";
import { can } from "@/lib/roles";
import type { Order, PaymentMethod } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/stores/app";
import { useOps } from "@/stores/ops";
import { StkPushFlow } from "./StkPushFlow";

const METHODS: { id: PaymentMethod; icon: LucideIcon; hint: string }[] = [
  { id: "cash", icon: Banknote, hint: "Notes & coins" },
  { id: "mpesa_stk", icon: Smartphone, hint: "Prompt on phone" },
  { id: "paybill", icon: Building, hint: "Customer-initiated" },
  { id: "till", icon: Store, hint: "Buy Goods" },
  { id: "card", icon: CreditCard, hint: "PDQ terminal" },
  { id: "bank", icon: Hash, hint: "Transfer / EFT" },
  { id: "complimentary", icon: Gift, hint: "Manager approval" },
];

export function PaymentDialog({
  orderId,
  open,
  onOpenChange,
  onPaid,
}: {
  orderId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onPaid?: (order: Order) => void;
}) {
  const order = useOps((s) => s.orders.find((o) => o.id === orderId));
  return (
    <Dialog open={open && !!order} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95vh] max-w-4xl overflow-y-auto p-0 sm:rounded-2xl">
        {order && <PaymentBody order={order} onPaid={onPaid} onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function PaymentBody({ order, onPaid, onClose }: { order: Order; onPaid?: (o: Order) => void; onClose: () => void }) {
  const user = useCurrentUser();
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const sum = splitSummary(order.total, order.payments);
  const removePayment = useOps((s) => s.removePayment);
  const modeFn = useServerFn(getMpesaMode);
  const { data: mode } = useQuery({ queryKey: ["mpesa-mode"], queryFn: () => modeFn(), staleTime: 60_000 });
  const stkBusy = order.payments.some((p) => p.method === "mpesa_stk" && p.status === "processing");

  if (sum.isFullyPaid) {
    return <PaidState order={order} change={sum.change} onDone={() => (onPaid ? onPaid(order) : onClose())} />;
  }

  return (
    <div className="grid md:grid-cols-[1fr_320px]">
      <div className="p-5 md:p-6">
        <DialogHeader className="mb-4 text-left">
          <DialogTitle className="font-display text-xl">Take payment · {order.number}</DialogTitle>
          <DialogDescription>Choose a method. Add more than one to split the bill.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {METHODS.map((m) => (
            <button
              key={m.id}
              onClick={() => setMethod(m.id)}
              className={cn(
                "flex flex-col items-start gap-1.5 rounded-xl border-2 p-3 text-left transition-all",
                method === m.id ? "border-primary bg-primary-soft shadow-glow" : "border-border bg-card hover:border-primary/40",
              )}
            >
              <m.icon className={cn("size-5", method === m.id ? "text-primary" : "text-muted-foreground")} />
              <span className="text-sm font-semibold">{paymentMethodLabel[m.id]}</span>
              <span className="text-[11px] text-muted-foreground">
                {m.id === "mpesa_stk" && mode ? (mode.mode === "live" ? "Live · Daraja" : "Demo mode") : m.hint}
              </span>
            </button>
          ))}
        </div>
        <div className="mt-5 rounded-xl border bg-surface p-4">
          {sum.remaining <= 0 ? (
            <p className="text-sm text-muted-foreground">
              The full amount is allocated. Waiting for pending payments to complete — or remove one to change method.
            </p>
          ) : method === "mpesa_stk" ? (
            stkBusy ? (
              <p className="text-sm text-muted-foreground">An STK request is already in progress for this order.</p>
            ) : (
              <StkPushFlow key={order.payments.length} order={order} maxAmount={sum.remaining} onClose={() => setMethod("cash")} />
            )
          ) : (
            <MethodForm key={method + order.payments.length} method={method} order={order} remaining={sum.remaining} canComp={can(user.role, "pos.discount")} />
          )}
        </div>
      </div>

      <aside className="border-t bg-surface-2 p-5 md:border-l md:border-t-0 md:p-6">
        <div className="space-y-1">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Total payable</div>
          <div className="font-display text-3xl font-bold tabular">{kes(sum.total)}</div>
        </div>
        <Progress value={(sum.completed / Math.max(1, sum.total)) * 100} className="mt-4 h-2" />
        <dl className="mt-4 space-y-2 text-sm">
          <Row label="Amount paid" value={kes(sum.completed)} className="text-success" />
          <Row label="Allocated" value={kes(sum.allocated)} />
          <Row label="Remaining balance" value={kes(sum.outstanding)} className="text-lg font-bold" />
        </dl>
        {sum.overpaid > 0 && (
          <div className="mt-3 flex gap-2 rounded-lg bg-destructive-soft p-2 text-xs text-destructive">
            <TriangleAlert className="size-4 shrink-0" /> Over-allocated by {kes(sum.overpaid)}
          </div>
        )}
        <div className="mt-5">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Payment allocations</div>
          {order.payments.length === 0 ? (
            <p className="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">No payments yet</p>
          ) : (
            <ul className="space-y-2">
              {order.payments.map((p) => (
                <li key={p.id} className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="font-medium">{paymentMethodLabel[p.method]}</span>
                      <span className="font-semibold tabular">{kes(p.amount)}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <StatusBadge status={p.status} />
                      {p.reference && <span className="truncate font-mono text-[10px] text-muted-foreground">{p.reference}</span>}
                    </div>
                  </div>
                  {(p.status === "failed" || p.status === "cancelled" || p.status === "pending") && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Remove allocation"
                      onClick={() => {
                        removePayment(order.id, p.id);
                        toast("Allocation removed");
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}

function Row({ label, value, className }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("font-semibold tabular", className)}>{value}</dd>
    </div>
  );
}

function MethodForm({ method, order, remaining, canComp }: { method: PaymentMethod; order: Order; remaining: number; canComp: boolean }) {
  const addPayment = useOps((s) => s.addPayment);
  const [amount, setAmount] = useState(String(remaining));
  const [tendered, setTendered] = useState(String(remaining));
  const [reference, setReference] = useState("");
  const [error, setError] = useState("");
  const amt = Number(amount) || 0;
  const tend = Number(tendered) || 0;
  const over = amt > remaining + 0.001;

  useEffect(() => {
    if (method === "cash") setTendered(amount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount]);

  const submit = (status: "completed" | "pending" = "completed") => {
    setError("");
    if (amt <= 0) return setError("Enter an amount");
    if (over) return setError(`Amount exceeds the remaining ${kes(remaining)}`);
    if (method === "cash" && tend < amt) return setError("Cash tendered is less than the amount");
    if ((method === "card" || method === "bank") && !reference.trim()) return setError("Enter the approval / transfer reference");
    if ((method === "paybill" || method === "till") && !/^[A-Z0-9]{10}$/.test(reference.trim().toUpperCase()))
      return setError("Enter the 10-character M-Pesa code, e.g. SKL4X7T2QP");
    if (method === "complimentary" && !reference.trim()) return setError("Give a reason for the complimentary payment");
    try {
      addPayment(order.id, {
        method,
        amount: amt,
        status,
        tendered: method === "cash" ? tend : undefined,
        reference: method === "complimentary" ? undefined : reference.trim().toUpperCase() || undefined,
        note: method === "complimentary" ? reference.trim() : undefined,
      });
      toast.success(
        status === "pending"
          ? `${paymentMethodLabel[method]} payment sent to reconciliation`
          : `${paymentMethodLabel[method]} ${kes(amt)} recorded${method === "cash" && tend > amt ? ` · change ${kes(tend - amt)}` : ""}`,
      );
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  if (method === "complimentary" && !canComp) {
    return <p className="text-sm text-muted-foreground">Complimentary payments need a POS manager or branch manager.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Amount (KES)" htmlFor="pay-amount" hint={`Remaining ${kes(remaining)}`}>
          <Input id="pay-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} className={cn("h-12 text-lg tabular", over && "border-destructive")} />
        </Field>
        {method === "cash" && (
          <Field label="Cash tendered" htmlFor="pay-tendered" hint={tend > amt ? `Change due ${kes(tend - amt)}` : undefined}>
            <Input id="pay-tendered" inputMode="decimal" value={tendered} onChange={(e) => setTendered(e.target.value.replace(/[^\d.]/g, ""))} className="h-12 text-lg tabular" />
          </Field>
        )}
        {(method === "card" || method === "bank") && (
          <Field label={method === "card" ? "Approval code" : "Transfer reference"} htmlFor="pay-ref">
            <Input id="pay-ref" value={reference} onChange={(e) => setReference(e.target.value)} className="h-12" />
          </Field>
        )}
        {(method === "paybill" || method === "till") && (
          <Field label="M-Pesa transaction code" htmlFor="pay-ref" hint="From the customer's confirmation SMS">
            <Input id="pay-ref" value={reference} maxLength={10} onChange={(e) => setReference(e.target.value.toUpperCase())} className="h-12 font-mono uppercase" />
          </Field>
        )}
        {method === "complimentary" && (
          <Field label="Reason" htmlFor="pay-ref">
            <Input id="pay-ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. Service recovery, VIP guest" className="h-12" />
          </Field>
        )}
      </div>
      {method === "cash" && (
        <div className="flex flex-wrap gap-2">
          {[remaining, 500, 1000, 2000].filter((v, i, a) => a.indexOf(v) === i && v >= amt).map((v) => (
            <Button key={v} variant="outline" size="sm" onClick={() => setTendered(String(v))}>
              {v === remaining ? "Exact" : kes(v)}
            </Button>
          ))}
        </div>
      )}
      {error && <p className="text-sm font-medium text-destructive">{error}</p>}
      {over && !error && <p className="text-sm font-medium text-warning-foreground">Overpayment: amount is above the remaining balance.</p>}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="hero" size="lg" className="flex-1" onClick={() => submit("completed")}>
          Confirm {paymentMethodLabel[method]} {amt > 0 ? kes(amt) : ""}
        </Button>
        {(method === "paybill" || method === "till") && (
          <Button variant="outline" size="lg" onClick={() => submit("pending")}>
            Verify via reconciliation
          </Button>
        )}
      </div>
    </div>
  );
}

function PaidState({ order, change, onDone }: { order: Order; change: number; onDone: () => void }) {
  return (
    <div className="p-6 md:p-10">
      <div className="mx-auto max-w-md text-center animate-fade-up">
        <span className="mx-auto grid size-20 place-items-center rounded-full bg-success text-success-foreground shadow-elevated">
          <CheckCircle2 className="size-10" />
        </span>
        <DialogTitle className="mt-4 font-display text-2xl">Payment complete</DialogTitle>
        <DialogDescription>{order.number} has been sent to the kitchen.</DialogDescription>
        {change > 0 && (
          <div className="mt-4 rounded-xl bg-warning-soft p-4">
            <div className="text-xs uppercase tracking-wide text-warning-foreground">Change due</div>
            <div className="font-display text-3xl font-bold tabular text-warning-foreground">{kes(change)}</div>
          </div>
        )}
        <div className="mt-6 rounded-xl border bg-card p-4 text-left text-sm">
          <div className="mb-2 flex justify-between font-semibold"><span>Receipt</span><span>{order.number}</span></div>
          <ul className="space-y-1 border-b pb-2">
            {order.items.map((i) => (
              <li key={i.productId} className="flex justify-between"><span>{i.qty} × {i.name}</span><span className="tabular">{kes(i.qty * i.price)}</span></li>
            ))}
          </ul>
          {order.discount > 0 && <div className="flex justify-between pt-2 text-muted-foreground"><span>Discount</span><span>−{kes(order.discount)}</span></div>}
          <div className="flex justify-between pt-2 text-muted-foreground"><span>VAT (16% incl.)</span><span className="tabular">{kes(order.tax, { decimals: true })}</span></div>
          <div className="flex justify-between pt-1 text-base font-bold"><span>Total</span><span className="tabular">{kes(order.total)}</span></div>
          <ul className="mt-2 space-y-1 border-t pt-2 text-xs text-muted-foreground">
            {order.payments.filter((p) => p.status === "completed").map((p) => (
              <li key={p.id} className="flex justify-between"><span>{paymentMethodLabel[p.method]} {p.reference ? `· ${p.reference}` : ""}</span><span className="tabular">{kes(p.amount)}</span></li>
            ))}
          </ul>
        </div>
        <Button variant="hero" size="xl" className="mt-6 w-full" onClick={onDone}>
          New order
        </Button>
      </div>
    </div>
  );
}
