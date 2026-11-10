import type { PaymentMethod } from "./types";

export function kes(amount: number, opts: { decimals?: boolean } = {}) {
  const v = Number.isFinite(amount) ? amount : 0;
  return (
    "KES " +
    v.toLocaleString("en-KE", {
      minimumFractionDigits: opts.decimals ? 2 : 0,
      maximumFractionDigits: opts.decimals ? 2 : 0,
    })
  );
}

export function compactKes(amount: number) {
  if (Math.abs(amount) >= 1_000_000) return `KES ${(amount / 1_000_000).toFixed(1)}M`;
  if (Math.abs(amount) >= 1_000) return `KES ${(amount / 1_000).toFixed(1)}K`;
  return kes(amount);
}

export function time(ts?: number) {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" });
}

export function dateTime(ts?: number) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("en-KE", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function shortDate(d?: string | number) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" });
}

export function isoDate(ts: number) {
  const d = new Date(ts);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function duration(ms: number) {
  const mins = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function minutesSince(ts: number, now: number) {
  return Math.max(0, Math.floor((now - ts) / 60000));
}

export const paymentMethodLabel: Record<PaymentMethod, string> = {
  cash: "Cash",
  mpesa_stk: "M-Pesa STK",
  paybill: "Paybill",
  till: "Till",
  card: "Card",
  bank: "Bank",
  complimentary: "Complimentary",
};

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`;
}

/** Kenyan phone normaliser: 07XX / 01XX / +2547XX -> 2547XXXXXXXX. Returns null if invalid. */
export function normalizeKenyanPhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  let n = digits;
  if (n.startsWith("0") && n.length === 10) n = "254" + n.slice(1);
  else if ((n.startsWith("7") || n.startsWith("1")) && n.length === 9) n = "254" + n;
  if (!/^254(7|1)\d{8}$/.test(n)) return null;
  return n;
}

export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (typeof window === "undefined") return;
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]!);
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join(
    "\n",
  );
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
