// Pure business rules. Covered by src/test/calc.test.ts — keep these free of UI/store code.
import type {
  CartItem,
  Order,
  Payment,
  PaymentMethod,
  Product,
  Recipe,
  Shift,
  StockItem,
} from "./types";

export const VAT_RATE = 0.16; // Kenya VAT, prices are VAT-inclusive

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** Cart totals. Menu prices include VAT; tax is the VAT portion of the discounted total. */
export function cartTotals(items: CartItem[], products: Product[], discount = 0) {
  const subtotal = items.reduce((s, it) => {
    const p = products.find((x) => x.id === it.productId);
    return s + (p ? p.price * it.qty : 0);
  }, 0);
  const safeDiscount = Math.min(Math.max(0, discount), subtotal);
  const total = round2(subtotal - safeDiscount);
  const tax = round2((total * VAT_RATE) / (1 + VAT_RATE));
  return { subtotal: round2(subtotal), discount: round2(safeDiscount), tax, total };
}

export interface SplitSummary {
  total: number;
  allocated: number; // all non-failed, non-cancelled allocations
  completed: number; // confirmed money
  remaining: number; // still to allocate (never negative)
  outstanding: number; // still to collect (total - completed, never negative)
  overpaid: number; // allocation beyond total (non-cash only is a warning)
  change: number; // cash change due when cash tendered > cash allocation
  isFullyPaid: boolean;
}

/**
 * Split-payment math. Failed/cancelled payments never count. An order is only paid once
 * completed payments cover the total — a processing STK request is NOT money received.
 */
export function splitSummary(total: number, payments: Payment[]): SplitSummary {
  const live = payments.filter((p) => p.status !== "failed" && p.status !== "cancelled");
  const allocated = round2(live.reduce((s, p) => s + p.amount, 0));
  const completed = round2(
    payments.filter((p) => p.status === "completed").reduce((s, p) => s + p.amount, 0),
  );
  const change = round2(
    payments
      .filter((p) => p.method === "cash" && p.status === "completed" && p.tendered != null)
      .reduce((s, p) => s + Math.max(0, (p.tendered ?? 0) - p.amount), 0),
  );
  return {
    total: round2(total),
    allocated,
    completed,
    remaining: round2(Math.max(0, total - allocated)),
    outstanding: round2(Math.max(0, total - completed)),
    overpaid: round2(Math.max(0, allocated - total)),
    change,
    isFullyPaid: completed >= round2(total) - 0.001,
  };
}

const CASH_METHODS: PaymentMethod[] = ["cash"];

export function cashSalesForShift(shift: Shift, orders: Order[]) {
  return round2(
    orders
      .filter((o) => o.shiftId === shift.id)
      .flatMap((o) => o.payments)
      .filter((p) => p.status === "completed" && CASH_METHODS.includes(p.method))
      .reduce((s, p) => s + p.amount, 0),
  );
}

export function digitalSalesForShift(shift: Shift, orders: Order[]) {
  return round2(
    orders
      .filter((o) => o.shiftId === shift.id)
      .flatMap((o) => o.payments)
      .filter(
        (p) =>
          p.status === "completed" && !CASH_METHODS.includes(p.method) && p.method !== "complimentary",
      )
      .reduce((s, p) => s + p.amount, 0),
  );
}

/** Opening + Cash Sales + Cash In − Cash Refunds − Cash Out = Expected Cash */
export function shiftCashSummary(shift: Shift, orders: Order[]) {
  const cashSales = cashSalesForShift(shift, orders);
  const cashIn = round2(
    shift.cashMovements.filter((m) => m.type === "in").reduce((s, m) => s + m.amount, 0),
  );
  const cashOut = round2(
    shift.cashMovements.filter((m) => m.type === "out").reduce((s, m) => s + m.amount, 0),
  );
  const refunds = round2(
    shift.refunds.filter((r) => r.method === "cash").reduce((s, r) => s + r.amount, 0),
  );
  const allRefunds = round2(shift.refunds.reduce((s, r) => s + r.amount, 0));
  const expected = round2(shift.openingCash + cashSales + cashIn - refunds - cashOut);
  return {
    opening: shift.openingCash,
    cashSales,
    digital: digitalSalesForShift(shift, orders),
    cashIn,
    cashOut,
    refunds,
    allRefunds,
    expected,
  };
}

export const VARIANCE_REVIEW_THRESHOLD = 500; // KES — larger variances go to manager review

export function shiftVariance(expected: number, counted: number) {
  const variance = round2(counted - expected);
  return {
    variance,
    hasVariance: Math.abs(variance) >= 0.01,
    needsReview: Math.abs(variance) >= VARIANCE_REVIEW_THRESHOLD,
    kind: variance > 0 ? ("over" as const) : variance < 0 ? ("short" as const) : ("balanced" as const),
  };
}

export interface RecipeCostLine {
  itemId: string;
  name: string;
  unit: string;
  qty: number;
  unitCost: number;
  cost: number;
}

/** Ingredient cost is grossed up by the waste percentage. */
export function recipeCost(recipe: Recipe, items: StockItem[]) {
  const lines: RecipeCostLine[] = recipe.lines.map((l) => {
    const item = items.find((i) => i.id === l.itemId);
    const unitCost = item?.unitCost ?? 0;
    return {
      itemId: l.itemId,
      name: item?.name ?? "Unknown item",
      unit: item?.unit ?? "",
      qty: l.qty,
      unitCost,
      cost: round2(l.qty * unitCost),
    };
  });
  const ingredientCost = round2(lines.reduce((s, l) => s + l.cost, 0));
  const wasteCost = round2(ingredientCost * (recipe.wastePct / 100));
  const totalCost = round2(ingredientCost + wasteCost);
  const servings = Math.max(1, recipe.yield);
  const costPerServing = round2(totalCost / servings);
  const grossProfit = round2(recipe.sellingPrice - costPerServing);
  const marginPct = recipe.sellingPrice > 0 ? round2((grossProfit / recipe.sellingPrice) * 100) : 0;
  return { lines, ingredientCost, wasteCost, totalCost, costPerServing, grossProfit, marginPct };
}

export const WORK_START_HOUR = 8; // 08:00 start; clock-in after 08:10 is late
export const LATE_GRACE_MIN = 10;

export function lateMinutes(clockIn: number) {
  const d = new Date(clockIn);
  const start = new Date(d);
  start.setHours(WORK_START_HOUR, 0, 0, 0);
  const diff = Math.floor((clockIn - start.getTime()) / 60000);
  return diff > LATE_GRACE_MIN ? diff : 0;
}

export function workedMinutes(clockIn?: number, clockOut?: number, now = Date.now()) {
  if (!clockIn) return 0;
  return Math.max(0, Math.floor(((clockOut ?? now) - clockIn) / 60000));
}

export const STANDARD_DAY_MIN = 8 * 60;

export function overtimeMinutes(worked: number) {
  return Math.max(0, worked - STANDARD_DAY_MIN);
}

/** Reconciliation match confidence (0–100) between an incoming payment and an open order. */
export function matchConfidence(
  txn: { amount: number; at: number; accountRef?: string },
  order: { number: string; total: number; createdAt: number; payments: Payment[] },
) {
  const paid = order.payments
    .filter((p) => p.status === "completed")
    .reduce((s, p) => s + p.amount, 0);
  const due = Math.max(0, order.total - paid);
  let score = 0;
  if (txn.accountRef && txn.accountRef.toUpperCase().replace(/\s/g, "") === order.number.replace(/\s/g, ""))
    score += 60;
  if (Math.abs(txn.amount - due) < 0.01) score += 30;
  else if (Math.abs(txn.amount - order.total) < 0.01) score += 20;
  const minutes = Math.abs(txn.at - order.createdAt) / 60000;
  if (minutes <= 10) score += 10;
  else if (minutes <= 30) score += 5;
  return Math.min(100, score);
}

export function stockTotal(item: StockItem) {
  return Object.values(item.stock).reduce((s, q) => s + q, 0);
}

export function stockLevel(item: StockItem): "ok" | "low" | "out" {
  const total = stockTotal(item);
  if (total <= 0) return "out";
  if (total <= item.reorderLevel) return "low";
  return "ok";
}

/** Simplified Kenyan payroll deductions (demo): PAYE bands + NSSF + SHIF + housing levy. */
export function payrollDeductions(gross: number) {
  const nssf = Math.min(gross * 0.06, 4320);
  const shif = Math.max(gross * 0.0275, 300);
  const housing = gross * 0.015;
  const taxable = Math.max(0, gross - nssf);
  const bands: [number, number][] = [
    [24000, 0.1],
    [8333, 0.25],
    [467667, 0.3],
    [300000, 0.325],
    [Infinity, 0.35],
  ];
  let rest = taxable;
  let tax = 0;
  for (const [size, rate] of bands) {
    const chunk = Math.min(rest, size);
    tax += chunk * rate;
    rest -= chunk;
    if (rest <= 0) break;
  }
  const paye = Math.max(0, tax - 2400); // personal relief
  const total = round2(nssf + shif + housing + paye);
  return { nssf: round2(nssf), shif: round2(shif), housing: round2(housing), paye: round2(paye), total };
}
