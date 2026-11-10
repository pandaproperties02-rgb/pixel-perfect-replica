import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, Lock, Smartphone, TriangleAlert, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/common/forms";
import { ConfirmDialog, useNow } from "@/components/common";
import { duration, kes, normalizeKenyanPhone } from "@/lib/format";
import { initiateStkPush, queryStkPush } from "@/lib/mpesa.functions";
import type { Order } from "@/lib/types";
import { useOps } from "@/stores/ops";

type Step = "form" | "sending" | "waiting" | "success" | "failed";
const TIMEOUT_MS = 90_000;

export function StkPushFlow({ order, maxAmount, onClose }: { order: Order; maxAmount: number; onClose: () => void }) {
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState(String(Math.round(maxAmount)));
  const [step, setStep] = useState<Step>("form");
  const [mode, setMode] = useState<"live" | "demo">("live");
  const [ref, setRef] = useState("");
  const [paymentId, setPaymentId] = useState("");
  const [message, setMessage] = useState("");
  const [startedAt, setStartedAt] = useState(0);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [errors, setErrors] = useState<{ phone?: string; amount?: string }>({});
  const now = useNow(1000);
  const init = useServerFn(initiateStkPush);
  const query = useServerFn(queryStkPush);
  const addPayment = useOps((s) => s.addPayment);
  const updatePayment = useOps((s) => s.updatePayment);
  const polling = useRef(false);
  const normalized = normalizeKenyanPhone(phone);

  const finish = (status: "completed" | "failed" | "cancelled", msg: string, reference?: string) => {
    updatePayment(order.id, paymentId, { status, reference: reference ?? ref, note: msg });
    setMessage(msg);
    setStep(status === "completed" ? "success" : "failed");
    if (status === "completed") toast.success(`M-Pesa payment of ${kes(Number(amount))} received`);
  };

  // Poll Daraja while waiting (live mode only).
  useEffect(() => {
    if (step !== "waiting" || mode !== "live" || !paymentId) return;
    const t = setInterval(async () => {
      if (polling.current) return;
      if (Date.now() - startedAt > TIMEOUT_MS) {
        finish("failed", "Request timed out — the customer did not respond");
        return;
      }
      polling.current = true;
      try {
        const r = await query({ data: { checkoutRequestId: ref } });
        if (r.status === "completed") finish("completed", r.message);
        else if (r.status === "failed") finish("failed", r.message);
        else if (r.status === "cancelled") finish("cancelled", r.message);
      } finally {
        polling.current = false;
      }
    }, 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, mode, paymentId, ref, startedAt]);

  const send = async () => {
    const amt = Math.round(Number(amount));
    const errs: typeof errors = {};
    if (!normalized) errs.phone = "Enter a valid Safaricom number, e.g. 0712 345 678";
    if (!amt || amt < 1) errs.amount = "Enter an amount";
    else if (amt > Math.round(maxAmount)) errs.amount = `Cannot exceed remaining ${kes(maxAmount)}`;
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setStep("sending");
    try {
      const r = await init({ data: { phone: normalized!, amount: amt, reference: order.number.replace("-", "").slice(0, 12) } });
      if (!r.ok) {
        setMessage(r.error);
        setStep("failed");
        return;
      }
      setMode(r.mode);
      setRef(r.checkoutRequestId);
      const p = addPayment(order.id, { method: "mpesa_stk", amount: amt, status: "processing", phone: normalized!, reference: r.checkoutRequestId });
      setPaymentId(p.id);
      setStartedAt(Date.now());
      setMessage(r.message);
      setStep("waiting");
    } catch {
      setMessage("Could not reach M-Pesa. Check the connection and try again.");
      setStep("failed");
    }
  };

  const retry = () => {
    setStep("form");
    setPaymentId("");
    setRef("");
    setMessage("");
  };

  if (step === "form") {
    return (
      <div className="space-y-4 animate-fade-up">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Customer phone number" htmlFor="stk-phone" error={errors.phone} hint={normalized ? `Will send to ${normalized}` : "07XX or 01XX number"}>
            <Input id="stk-phone" inputMode="tel" autoFocus value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0712 345 678" className="h-12 text-lg" />
          </Field>
          <Field label="Amount (KES)" htmlFor="stk-amount" error={errors.amount}>
            <Input id="stk-amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))} className="h-12 text-lg tabular" />
          </Field>
        </div>
        <Button variant="hero" size="xl" className="w-full" onClick={send}>
          <Smartphone /> Send STK push
        </Button>
      </div>
    );
  }

  if (step === "sending") {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center animate-fade-up">
        <Loader2 className="size-10 animate-spin text-primary" />
        <div className="font-display text-lg font-semibold">Sending payment request…</div>
        <p className="text-sm text-muted-foreground">Contacting M-Pesa for {normalized}</p>
      </div>
    );
  }

  if (step === "waiting") {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center animate-fade-up">
        {mode === "demo" && (
          <div className="flex w-full items-start gap-2 rounded-lg border border-warning/40 bg-warning-soft px-3 py-2 text-left text-xs text-warning-foreground">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            Demo mode — M-Pesa keys not connected; no request was sent to the phone. Use the buttons below to simulate the customer's response.
          </div>
        )}
        <div className="relative grid size-28 place-items-center">
          <span className="absolute inset-0 rounded-full bg-success/25 animate-pulse-ring" />
          <span className="absolute inset-3 rounded-full bg-success/20 animate-pulse-ring [animation-delay:0.6s]" />
          <span className="relative grid size-16 place-items-center rounded-full bg-success text-success-foreground shadow-elevated">
            <Lock className="size-7" />
          </span>
        </div>
        <div>
          <div className="font-display text-lg font-semibold">Waiting for customer to complete payment</div>
          <p className="text-sm text-muted-foreground">Ask the customer to enter their M-Pesa PIN</p>
        </div>
        <dl className="grid w-full grid-cols-2 gap-2 text-left text-sm sm:grid-cols-4">
          <div className="rounded-lg bg-surface-2 px-3 py-2"><dt className="text-[11px] uppercase text-muted-foreground">Phone</dt><dd className="font-semibold">{normalized}</dd></div>
          <div className="rounded-lg bg-surface-2 px-3 py-2"><dt className="text-[11px] uppercase text-muted-foreground">Amount</dt><dd className="font-semibold tabular">{kes(Number(amount))}</dd></div>
          <div className="col-span-2 rounded-lg bg-surface-2 px-3 py-2"><dt className="text-[11px] uppercase text-muted-foreground">Reference</dt><dd className="truncate font-mono text-xs font-semibold">{ref}</dd></div>
        </dl>
        <div className="text-xs text-muted-foreground tabular">Elapsed {duration(now - startedAt)} · auto-checking every 3s</div>
        <div className="flex w-full flex-col gap-2 sm:flex-row">
          {mode === "demo" && (
            <>
              <Button variant="success" size="lg" className="flex-1" onClick={() => finish("completed", "Simulated approval", `DEMO${Math.random().toString(36).slice(2, 8).toUpperCase()}`)}>
                Simulate customer approves
              </Button>
              <Button variant="outline" size="lg" className="flex-1" onClick={() => finish("failed", "Simulated decline: customer rejected the request")}>
                Simulate customer declines
              </Button>
            </>
          )}
          <Button variant="ghost" size="lg" className="text-destructive" onClick={() => setConfirmCancel(true)}>
            Cancel request
          </Button>
        </div>
        <ConfirmDialog
          open={confirmCancel}
          onOpenChange={setConfirmCancel}
          title="Cancel this M-Pesa request?"
          description="If the customer has already paid, the payment will show up in reconciliation instead."
          confirmLabel="Cancel request"
          destructive
          onConfirm={() => finish("cancelled", "Cancelled by cashier")}
        />
      </div>
    );
  }

  if (step === "success") {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center animate-fade-up">
        <span className="grid size-16 place-items-center rounded-full bg-success text-success-foreground shadow-elevated">
          <CheckCircle2 className="size-8" />
        </span>
        <div className="font-display text-2xl font-bold text-success">PAYMENT RECEIVED ✓</div>
        <dl className="grid w-full max-w-md grid-cols-3 gap-2 text-sm">
          <div className="rounded-lg bg-surface-2 px-3 py-2"><dt className="text-[11px] uppercase text-muted-foreground">Amount</dt><dd className="font-semibold tabular">{kes(Number(amount))}</dd></div>
          <div className="rounded-lg bg-surface-2 px-3 py-2"><dt className="text-[11px] uppercase text-muted-foreground">Order</dt><dd className="font-semibold">{order.number}</dd></div>
          <div className="rounded-lg bg-surface-2 px-3 py-2"><dt className="text-[11px] uppercase text-muted-foreground">Ref</dt><dd className="truncate font-mono text-xs font-semibold">{ref}</dd></div>
        </dl>
        <Button variant="outline" onClick={onClose}>Done</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center animate-fade-up">
      <span className="grid size-16 place-items-center rounded-full bg-destructive-soft text-destructive">
        <XCircle className="size-8" />
      </span>
      <div className="font-display text-lg font-semibold">Payment not completed</div>
      <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
      <div className="flex gap-2">
        <Button onClick={retry}>Try again</Button>
        <Button variant="outline" onClick={onClose}>Choose another method</Button>
      </div>
    </div>
  );
}
