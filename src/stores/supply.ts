// Inventory, recipes, procurement and expenses.
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { round2 } from "@/lib/calc";
import { isoDate, uid } from "@/lib/format";
import {
  STORES_SEED,
  SUPPLIERS_SEED,
  seedExpenses,
  seedInvoices,
  seedMovements,
  seedPurchaseOrders,
  seedPurchaseRequests,
  seedRecipes,
  seedStockItems,
  seedTransfers,
} from "@/lib/seed";
import type {
  Expense,
  MovementType,
  Order,
  POStatus,
  PurchaseOrder,
  PurchaseRequest,
  Recipe,
  StockItem,
  StockMovement,
  StockTake,
  Store,
  Supplier,
  SupplierInvoice,
  Transfer,
} from "@/lib/types";

/** Which store each branch's kitchen draws from when food is sold. */
export const BRANCH_KITCHEN_STORE: Record<string, string> = { b1: "s2", b2: "s3", b3: "s4" };

const PO_FLOW: POStatus[] = ["draft", "submitted", "reviewed", "approved", "sent", "received"];

export function nextPoStatus(status: POStatus): POStatus | undefined {
  const i = PO_FLOW.indexOf(status);
  return i >= 0 && i < PO_FLOW.length - 1 ? PO_FLOW[i + 1] : undefined;
}

interface SupplyState {
  seeded: boolean;
  stores: Store[];
  items: StockItem[];
  movements: StockMovement[];
  transfers: Transfer[];
  stockTakes: StockTake[];
  recipes: Recipe[];
  suppliers: Supplier[];
  requests: PurchaseRequest[];
  purchaseOrders: PurchaseOrder[];
  invoices: SupplierInvoice[];
  expenses: Expense[];
  seq: number;

  seed: (now: number) => void;

  // stock
  moveStock: (input: { itemId: string; storeId: string; type: MovementType; qty: number; ref?: string; by: string; note?: string }) => void;
  adjustStock: (itemId: string, storeId: string, newQty: number, reason: string, by: string) => void;
  recordWastage: (itemId: string, storeId: string, qty: number, reason: string, by: string) => void;
  upsertItem: (item: Omit<StockItem, "id" | "stock"> & { id?: string; stock?: Record<string, number> }) => void;
  consumeForOrder: (order: Order) => void;

  // transfers
  createTransfer: (from: string, to: string, lines: { itemId: string; qty: number }[], by: string) => Transfer;
  dispatchTransfer: (id: string, by: string) => void;
  receiveTransfer: (id: string, by: string) => void;
  cancelTransfer: (id: string) => void;

  // stock take
  startStockTake: (storeId: string) => StockTake;
  setCount: (takeId: string, itemId: string, counted: number | undefined) => void;
  postStockTake: (takeId: string, by: string) => void;

  // recipes
  upsertRecipe: (r: Omit<Recipe, "id"> & { id?: string }) => Recipe;
  deleteRecipe: (id: string) => void;

  // procurement
  upsertSupplier: (s: Omit<Supplier, "id"> & { id?: string }) => void;
  createRequest: (r: Omit<PurchaseRequest, "id" | "number" | "status" | "createdAt">) => PurchaseRequest;
  decideRequest: (id: string, approve: boolean) => void;
  createPO: (input: { supplierId: string; storeId: string; lines: { itemId: string; qty: number; unitCost: number }[]; expectedDate: string; by: string; fromRequestId?: string }) => PurchaseOrder;
  advancePO: (id: string, by: string, note?: string) => void;
  cancelPO: (id: string, by: string, note?: string) => void;
  receivePO: (id: string, received: Record<string, number>, by: string, invoiceNumber?: string) => void;
  payInvoice: (id: string) => void;

  // expenses
  createExpense: (e: Omit<Expense, "id" | "status" | "createdAt">) => Expense;
  decideExpense: (id: string, approve: boolean, by: string) => void;
  markExpensePaid: (id: string) => void;
}

export const useSupply = create<SupplyState>()(
  persist(
    (set, get) => ({
      seeded: false,
      stores: [],
      items: [],
      movements: [],
      transfers: [],
      stockTakes: [],
      recipes: [],
      suppliers: [],
      requests: [],
      purchaseOrders: [],
      invoices: [],
      expenses: [],
      seq: 100,

      seed: (now) =>
        set({
          seeded: true,
          stores: STORES_SEED,
          items: seedStockItems(),
          movements: seedMovements(now),
          transfers: seedTransfers(now),
          stockTakes: [],
          recipes: seedRecipes(),
          suppliers: SUPPLIERS_SEED,
          requests: seedPurchaseRequests(now),
          purchaseOrders: seedPurchaseOrders(now),
          invoices: seedInvoices(now),
          expenses: seedExpenses(now),
          seq: 100,
        }),

      moveStock: ({ itemId, storeId, type, qty, ref, by, note }) =>
        set((s) => ({
          items: s.items.map((i) =>
            i.id === itemId ? { ...i, stock: { ...i.stock, [storeId]: round2((i.stock[storeId] ?? 0) + qty) } } : i,
          ),
          movements: [
            { id: uid("mv"), itemId, storeId, type, qty, at: Date.now(), ref: ref ?? `${type.toUpperCase().slice(0, 3)}-${s.seq}`, by, note },
            ...s.movements,
          ],
          seq: s.seq + 1,
        })),
      adjustStock: (itemId, storeId, newQty, reason, by) => {
        const item = get().items.find((i) => i.id === itemId);
        if (!item) return;
        const diff = round2(newQty - (item.stock[storeId] ?? 0));
        if (diff === 0) return;
        get().moveStock({ itemId, storeId, type: "adjustment", qty: diff, by, note: reason, ref: `ADJ-${get().seq}` });
      },
      recordWastage: (itemId, storeId, qty, reason, by) => {
        const item = get().items.find((i) => i.id === itemId);
        if (!item) return;
        if (qty > (item.stock[storeId] ?? 0)) throw new Error("Wastage exceeds stock on hand");
        get().moveStock({ itemId, storeId, type: "wastage", qty: -qty, by, note: reason, ref: `WST-${get().seq}` });
      },
      upsertItem: (item) =>
        set((s) => {
          if (item.id) return { items: s.items.map((i) => (i.id === item.id ? { ...i, ...item, stock: item.stock ?? i.stock } : i)) };
          const stock = item.stock ?? Object.fromEntries(s.stores.map((st) => [st.id, 0]));
          return { items: [...s.items, { ...item, id: uid("it"), stock } as StockItem] };
        }),
      consumeForOrder: (order) => {
        const storeId = BRANCH_KITCHEN_STORE[order.branchId];
        if (!storeId) return;
        const { recipes } = get();
        for (const line of order.items) {
          const recipe = recipes.find((r) => r.productId === line.productId);
          if (!recipe) continue;
          for (const rl of recipe.lines) {
            const qty = round2((rl.qty / Math.max(1, recipe.yield)) * line.qty);
            if (qty <= 0) continue;
            get().moveStock({ itemId: rl.itemId, storeId, type: "sale", qty: -qty, by: order.cashierName, ref: order.number });
          }
        }
      },

      createTransfer: (from, to, lines, by) => {
        if (from === to) throw new Error("Choose two different stores");
        const items = get().items;
        for (const l of lines) {
          const it = items.find((i) => i.id === l.itemId);
          if (!it || (it.stock[from] ?? 0) < l.qty) throw new Error(`Not enough ${it?.name ?? "stock"} in source store`);
        }
        const t: Transfer = { id: uid("tr"), number: `TRF-${1042 + get().transfers.length}`, fromStoreId: from, toStoreId: to, lines, status: "pending", createdAt: Date.now(), createdBy: by };
        set((s) => ({ transfers: [t, ...s.transfers] }));
        return t;
      },
      dispatchTransfer: (id, by) => {
        const t = get().transfers.find((x) => x.id === id);
        if (!t || t.status !== "pending") return;
        for (const l of t.lines) get().moveStock({ itemId: l.itemId, storeId: t.fromStoreId, type: "transfer_out", qty: -l.qty, by, ref: t.number });
        set((s) => ({ transfers: s.transfers.map((x) => (x.id === id ? { ...x, status: "in_transit" } : x)) }));
      },
      receiveTransfer: (id, by) => {
        const t = get().transfers.find((x) => x.id === id);
        if (!t || t.status !== "in_transit") return;
        for (const l of t.lines) get().moveStock({ itemId: l.itemId, storeId: t.toStoreId, type: "transfer_in", qty: l.qty, by, ref: t.number });
        set((s) => ({ transfers: s.transfers.map((x) => (x.id === id ? { ...x, status: "received" } : x)) }));
      },
      cancelTransfer: (id) => {
        const t = get().transfers.find((x) => x.id === id);
        if (!t || t.status !== "pending") throw new Error("Only pending transfers can be cancelled");
        set((s) => ({ transfers: s.transfers.map((x) => (x.id === id ? { ...x, status: "cancelled" } : x)) }));
      },

      startStockTake: (storeId) => {
        const existing = get().stockTakes.find((t) => t.storeId === storeId && t.status === "in_progress");
        if (existing) return existing;
        const take: StockTake = {
          id: uid("st"),
          storeId,
          status: "in_progress",
          createdAt: Date.now(),
          lines: get().items.map((i) => ({ itemId: i.id, system: i.stock[storeId] ?? 0 })),
        };
        set((s) => ({ stockTakes: [take, ...s.stockTakes] }));
        return take;
      },
      setCount: (takeId, itemId, counted) =>
        set((s) => ({
          stockTakes: s.stockTakes.map((t) =>
            t.id === takeId ? { ...t, lines: t.lines.map((l) => (l.itemId === itemId ? { ...l, counted } : l)) } : t,
          ),
        })),
      postStockTake: (takeId, by) => {
        const take = get().stockTakes.find((t) => t.id === takeId);
        if (!take) return;
        const uncounted = take.lines.filter((l) => l.counted == null).length;
        if (uncounted > 0) throw new Error(`${uncounted} item(s) not counted yet`);
        for (const l of take.lines) {
          const diff = round2((l.counted ?? 0) - l.system);
          if (diff !== 0) get().moveStock({ itemId: l.itemId, storeId: take.storeId, type: "adjustment", qty: diff, by, note: "Stock take variance", ref: `STK-${take.id.slice(-4)}` });
        }
        set((s) => ({ stockTakes: s.stockTakes.map((t) => (t.id === takeId ? { ...t, status: "posted" } : t)) }));
      },

      upsertRecipe: (r) => {
        const recipe: Recipe = { ...r, id: r.id ?? uid("rc") } as Recipe;
        set((s) => ({
          recipes: r.id ? s.recipes.map((x) => (x.id === r.id ? recipe : x)) : [...s.recipes, recipe],
        }));
        return recipe;
      },
      deleteRecipe: (id) => set((s) => ({ recipes: s.recipes.filter((r) => r.id !== id) })),

      upsertSupplier: (sup) =>
        set((s) => ({
          suppliers: sup.id
            ? s.suppliers.map((x) => (x.id === sup.id ? ({ ...x, ...sup } as Supplier) : x))
            : [...s.suppliers, { ...sup, id: uid("sp") } as Supplier],
        })),
      createRequest: (r) => {
        const req: PurchaseRequest = { ...r, id: uid("pr"), number: `PR-${312 + get().requests.length}`, status: "pending", createdAt: Date.now() };
        set((s) => ({ requests: [req, ...s.requests] }));
        return req;
      },
      decideRequest: (id, approve) =>
        set((s) => ({ requests: s.requests.map((r) => (r.id === id ? { ...r, status: approve ? "approved" : "rejected" } : r)) })),
      createPO: ({ supplierId, storeId, lines, expectedDate, by, fromRequestId }) => {
        if (lines.length === 0) throw new Error("Add at least one line");
        const po: PurchaseOrder = {
          id: uid("po"),
          number: `PO-${2211 + get().purchaseOrders.length}`,
          supplierId,
          storeId,
          lines: lines.map((l) => ({ ...l, received: 0 })),
          status: "draft",
          history: [{ status: "draft", at: Date.now(), by }],
          expectedDate,
          createdAt: Date.now(),
        };
        set((s) => ({
          purchaseOrders: [po, ...s.purchaseOrders],
          requests: fromRequestId ? s.requests.map((r) => (r.id === fromRequestId ? { ...r, status: "converted" } : r)) : s.requests,
        }));
        return po;
      },
      advancePO: (id, by, note) =>
        set((s) => ({
          purchaseOrders: s.purchaseOrders.map((po) => {
            if (po.id !== id) return po;
            const next = nextPoStatus(po.status);
            if (!next || next === "received") return po; // receiving goes through receivePO
            return { ...po, status: next, history: [...po.history, { status: next, at: Date.now(), by, note }] };
          }),
        })),
      cancelPO: (id, by, note) =>
        set((s) => ({
          purchaseOrders: s.purchaseOrders.map((po) =>
            po.id === id ? { ...po, status: "cancelled", history: [...po.history, { status: "cancelled", at: Date.now(), by, note }] } : po,
          ),
        })),
      receivePO: (id, received, by, invoiceNumber) => {
        const po = get().purchaseOrders.find((p) => p.id === id);
        if (!po || po.status !== "sent") throw new Error("Only sent purchase orders can be received");
        for (const l of po.lines) {
          const qty = received[l.itemId] ?? 0;
          if (qty > 0) get().moveStock({ itemId: l.itemId, storeId: po.storeId, type: "receipt", qty, by, ref: `GRN-${po.number.slice(3)}` });
        }
        const lines = po.lines.map((l) => ({ ...l, received: l.received + (received[l.itemId] ?? 0) }));
        const amount = round2(lines.reduce((s, l) => s + l.received * l.unitCost, 0));
        set((s) => ({
          purchaseOrders: s.purchaseOrders.map((p) =>
            p.id === id ? { ...p, lines, status: "received", history: [...p.history, { status: "received", at: Date.now(), by }] } : p,
          ),
          invoices: [
            { id: uid("inv"), number: invoiceNumber?.trim() || `INV-${po.number.slice(3)}`, poId: id, supplierId: po.supplierId, amount, dueDate: isoDate(Date.now() + 30 * 86400000), status: "unpaid" },
            ...s.invoices,
          ],
        }));
      },
      payInvoice: (id) => set((s) => ({ invoices: s.invoices.map((i) => (i.id === id ? { ...i, status: "paid" } : i)) })),

      createExpense: (e) => {
        const exp: Expense = { ...e, id: uid("ex"), status: "pending", createdAt: Date.now() };
        set((s) => ({ expenses: [exp, ...s.expenses] }));
        return exp;
      },
      decideExpense: (id, approve, by) =>
        set((s) => ({ expenses: s.expenses.map((e) => (e.id === id ? { ...e, status: approve ? "approved" : "rejected", decidedBy: by } : e)) })),
      markExpensePaid: (id) =>
        set((s) => ({ expenses: s.expenses.map((e) => (e.id === id && e.status === "approved" ? { ...e, status: "paid" } : e)) })),
    }),
    {
      name: "savora-supply-v1",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    },
  ),
);
