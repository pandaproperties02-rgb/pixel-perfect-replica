// Sales operations: products, cart, orders, payments, shifts, kitchen, M-Pesa reconciliation.
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { cartTotals, shiftCashSummary, shiftVariance, splitSummary } from "@/lib/calc";
import { uid } from "@/lib/format";
import {
  seedMpesaTxns,
  seedOrders,
  seedProducts,
  seedSalesHistory,
  seedShifts,
  type DailySales,
} from "@/lib/seed";
import type {
  CartItem,
  DemoUser,
  KitchenStatus,
  MpesaTxn,
  Order,
  OrderType,
  Payment,
  PaymentMethod,
  Product,
  Shift,
} from "@/lib/types";
import { useSupply } from "./supply";

export interface CartState {
  items: CartItem[];
  customer: string;
  orderType: OrderType;
  discount: number;
  notes: string;
}

const emptyCart = (): CartState => ({
  items: [],
  customer: "Walk-in",
  orderType: "dine_in",
  discount: 0,
  notes: "",
});

interface OpsState {
  seeded: boolean;
  products: Product[];
  orders: Order[];
  shifts: Shift[];
  mpesaTxns: MpesaTxn[];
  salesHistory: DailySales[];
  cart: CartState;
  orderSeq: number;

  seed: (now: number) => void;

  // cart
  addToCart: (productId: string) => void;
  setQty: (productId: string, qty: number) => void;
  setItemNote: (productId: string, note: string) => void;
  removeFromCart: (productId: string) => void;
  setCartMeta: (patch: Partial<Omit<CartState, "items">>) => void;
  clearCart: () => void;

  // products
  toggleAvailability: (productId: string) => void;
  toggleFavorite: (productId: string) => void;

  // orders & payments
  createOrderFromCart: (user: DemoUser, shift: Shift) => Order;
  addPayment: (orderId: string, p: Omit<Payment, "id" | "createdAt"> & { id?: string }) => Payment;
  updatePayment: (orderId: string, paymentId: string, patch: Partial<Payment>) => void;
  removePayment: (orderId: string, paymentId: string) => void;
  cancelOrder: (orderId: string) => void;
  refundOrder: (orderId: string, amount: number, method: PaymentMethod, reason: string) => void;

  // kitchen
  setKitchenStatus: (orderId: string, status: KitchenStatus) => void;
  togglePriority: (orderId: string) => void;

  // shifts
  openShift: (input: { user: DemoUser; register: string; branchId: string; openingCash: number; notes?: string }) => Shift;
  addCashMovement: (shiftId: string, type: "in" | "out", amount: number, reason: string) => void;
  closeShift: (shiftId: string, counted: number, reason?: string) => Shift | undefined;
  reviewShift: (shiftId: string, approve: boolean, note: string) => void;

  // reconciliation
  confirmMatch: (txnId: string, orderId: string) => void;
  rejectTxn: (txnId: string, note: string) => void;
  flagTxn: (txnId: string, note: string) => void;
  addIncomingTxn: (t: Omit<MpesaTxn, "id">) => void;
}

function recomputeOrder(o: Order): Order {
  if (o.status === "cancelled" || o.status === "refunded") return o;
  const s = splitSummary(o.total, o.payments);
  const status = s.isFullyPaid ? "paid" : s.completed > 0 ? "partially_paid" : "pending_payment";
  return { ...o, status, paidAt: status === "paid" ? (o.paidAt ?? Date.now()) : undefined };
}

export const useOps = create<OpsState>()(
  persist(
    (set, get) => ({
      seeded: false,
      products: [],
      orders: [],
      shifts: [],
      mpesaTxns: [],
      salesHistory: [],
      cart: emptyCart(),
      orderSeq: 2500,

      seed: (now) => {
        const products = seedProducts();
        const orders = seedOrders(now, products);
        set({
          seeded: true,
          products,
          orders,
          shifts: seedShifts(now),
          mpesaTxns: seedMpesaTxns(now, orders),
          salesHistory: seedSalesHistory(now),
          cart: emptyCart(),
          orderSeq: 2500,
        });
      },

      addToCart: (productId) =>
        set((s) => {
          const existing = s.cart.items.find((i) => i.productId === productId);
          const items = existing
            ? s.cart.items.map((i) => (i.productId === productId ? { ...i, qty: i.qty + 1 } : i))
            : [...s.cart.items, { productId, qty: 1 }];
          return { cart: { ...s.cart, items } };
        }),
      setQty: (productId, qty) =>
        set((s) => ({
          cart: {
            ...s.cart,
            items:
              qty <= 0
                ? s.cart.items.filter((i) => i.productId !== productId)
                : s.cart.items.map((i) => (i.productId === productId ? { ...i, qty } : i)),
          },
        })),
      setItemNote: (productId, note) =>
        set((s) => ({
          cart: { ...s.cart, items: s.cart.items.map((i) => (i.productId === productId ? { ...i, note } : i)) },
        })),
      removeFromCart: (productId) =>
        set((s) => ({ cart: { ...s.cart, items: s.cart.items.filter((i) => i.productId !== productId) } })),
      setCartMeta: (patch) => set((s) => ({ cart: { ...s.cart, ...patch } })),
      clearCart: () => set({ cart: emptyCart() }),

      toggleAvailability: (productId) =>
        set((s) => ({ products: s.products.map((p) => (p.id === productId ? { ...p, available: !p.available } : p)) })),
      toggleFavorite: (productId) =>
        set((s) => ({ products: s.products.map((p) => (p.id === productId ? { ...p, favorite: !p.favorite } : p)) })),

      createOrderFromCart: (user, shift) => {
        const { cart, products, orderSeq } = get();
        if (cart.items.length === 0) throw new Error("Cart is empty");
        const totals = cartTotals(cart.items, products, cart.discount);
        const order: Order = {
          id: uid("ord"),
          number: `ORD-${orderSeq}`,
          branchId: shift.branchId,
          cashierId: user.employeeId ?? user.id,
          cashierName: user.name,
          shiftId: shift.id,
          register: shift.register,
          customer: cart.customer || "Walk-in",
          orderType: cart.orderType,
          items: cart.items.map((it) => {
            const p = products.find((x) => x.id === it.productId)!;
            return { productId: p.id, name: p.name, price: p.price, qty: it.qty, note: it.note };
          }),
          ...totals,
          status: "pending_payment",
          kitchenStatus: "new",
          priority: "normal",
          payments: [],
          notes: cart.notes || undefined,
          createdAt: Date.now(),
        };
        set((s) => ({ orders: [order, ...s.orders], orderSeq: s.orderSeq + 1 }));
        return order;
      },

      addPayment: (orderId, p) => {
        const payment: Payment = { ...p, id: p.id ?? uid("pay"), createdAt: Date.now() };
        const before = get().orders.find((o) => o.id === orderId);
        set((s) => ({
          orders: s.orders.map((o) => (o.id === orderId ? recomputeOrder({ ...o, payments: [...o.payments, payment] }) : o)),
        }));
        const after = get().orders.find((o) => o.id === orderId);
        if (before && after && before.status !== "paid" && after.status === "paid") {
          useSupply.getState().consumeForOrder(after);
        }
        return payment;
      },
      updatePayment: (orderId, paymentId, patch) => {
        const before = get().orders.find((o) => o.id === orderId);
        set((s) => ({
          orders: s.orders.map((o) =>
            o.id === orderId
              ? recomputeOrder({ ...o, payments: o.payments.map((p) => (p.id === paymentId ? { ...p, ...patch } : p)) })
              : o,
          ),
        }));
        const after = get().orders.find((o) => o.id === orderId);
        if (before && after && before.status !== "paid" && after.status === "paid") {
          useSupply.getState().consumeForOrder(after);
        }
      },
      removePayment: (orderId, paymentId) =>
        set((s) => ({
          orders: s.orders.map((o) =>
            o.id === orderId ? recomputeOrder({ ...o, payments: o.payments.filter((p) => p.id !== paymentId) }) : o,
          ),
        })),
      cancelOrder: (orderId) =>
        set((s) => ({
          orders: s.orders.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  status: "cancelled",
                  payments: o.payments.map((p) =>
                    p.status === "pending" || p.status === "processing" ? { ...p, status: "cancelled" } : p,
                  ),
                }
              : o,
          ),
        })),
      refundOrder: (orderId, amount, method, reason) => {
        const order = get().orders.find((o) => o.id === orderId);
        if (!order) return;
        set((s) => ({
          orders: s.orders.map((o) => (o.id === orderId ? { ...o, status: "refunded" } : o)),
          shifts: s.shifts.map((sh) =>
            sh.id === order.shiftId
              ? { ...sh, refunds: [...sh.refunds, { id: uid("rf"), orderId, amount, method, reason, at: Date.now() }] }
              : sh,
          ),
        }));
      },

      setKitchenStatus: (orderId, status) =>
        set((s) => ({
          orders: s.orders.map((o) => {
            if (o.id !== orderId) return o;
            const now = Date.now();
            return {
              ...o,
              kitchenStatus: status,
              kitchenAcceptedAt: o.kitchenAcceptedAt ?? (status !== "new" ? now : undefined),
              kitchenStartedAt: status === "preparing" ? now : o.kitchenStartedAt,
              kitchenReadyAt: status === "ready" ? now : o.kitchenReadyAt,
              kitchenCompletedAt: status === "completed" ? now : o.kitchenCompletedAt,
            };
          }),
        })),
      togglePriority: (orderId) =>
        set((s) => ({
          orders: s.orders.map((o) => (o.id === orderId ? { ...o, priority: o.priority === "rush" ? "normal" : "rush" } : o)),
        })),

      openShift: ({ user, register, branchId, openingCash, notes }) => {
        const cashierId = user.employeeId ?? user.id;
        const existing = get().shifts.find((s) => s.cashierId === cashierId && s.status === "open");
        if (existing) throw new Error("You already have an open shift");
        const registerBusy = get().shifts.find((s) => s.register === register && s.branchId === branchId && s.status === "open");
        if (registerBusy) throw new Error(`${register} is already in use by ${registerBusy.cashierName}`);
        const shift: Shift = {
          id: uid("sh"),
          cashierId,
          cashierName: user.name,
          register,
          branchId,
          openingCash,
          openedAt: Date.now(),
          status: "open",
          cashMovements: [],
          refunds: [],
          notes,
        };
        set((s) => ({ shifts: [shift, ...s.shifts] }));
        return shift;
      },
      addCashMovement: (shiftId, type, amount, reason) =>
        set((s) => ({
          shifts: s.shifts.map((sh) =>
            sh.id === shiftId
              ? { ...sh, cashMovements: [...sh.cashMovements, { id: uid("cm"), type, amount, reason, at: Date.now() }] }
              : sh,
          ),
        })),
      closeShift: (shiftId, counted, reason) => {
        const shift = get().shifts.find((s) => s.id === shiftId);
        if (!shift) return undefined;
        const pendingOrders = get().orders.filter(
          (o) => o.shiftId === shiftId && (o.status === "pending_payment" || o.status === "partially_paid"),
        );
        if (pendingOrders.length > 0) throw new Error(`${pendingOrders.length} order(s) still awaiting payment`);
        const summary = shiftCashSummary(shift, get().orders);
        const v = shiftVariance(summary.expected, counted);
        if (v.hasVariance && !reason?.trim()) throw new Error("Explain the cash variance before closing");
        const closed: Shift = {
          ...shift,
          status: v.needsReview ? "pending_review" : "closed",
          closedAt: Date.now(),
          expectedCash: summary.expected,
          countedCash: counted,
          variance: v.variance,
          varianceReason: reason?.trim() || undefined,
        };
        set((s) => ({ shifts: s.shifts.map((sh) => (sh.id === shiftId ? closed : sh)) }));
        return closed;
      },
      reviewShift: (shiftId, approve, note) =>
        set((s) => ({
          shifts: s.shifts.map((sh) =>
            sh.id === shiftId ? { ...sh, status: approve ? "approved" : "pending_review", reviewNote: note } : sh,
          ),
        })),

      confirmMatch: (txnId, orderId) => {
        const txn = get().mpesaTxns.find((t) => t.id === txnId);
        if (!txn) return;
        const order = get().orders.find((o) => o.id === orderId);
        if (!order) throw new Error("Order not found");
        if (order.status === "paid") throw new Error(`${order.number} is already fully paid`);
        set((s) => ({
          mpesaTxns: s.mpesaTxns.map((t) =>
            t.id === txnId ? { ...t, status: "matched", matchedOrderId: orderId, suggestedOrderId: orderId } : t,
          ),
        }));
        get().addPayment(orderId, {
          method: txn.channel,
          amount: txn.amount,
          status: "completed",
          reference: txn.reference,
          phone: txn.phone,
        });
      },
      rejectTxn: (txnId, note) =>
        set((s) => ({ mpesaTxns: s.mpesaTxns.map((t) => (t.id === txnId ? { ...t, status: "rejected", note } : t)) })),
      flagTxn: (txnId, note) =>
        set((s) => ({ mpesaTxns: s.mpesaTxns.map((t) => (t.id === txnId ? { ...t, status: "exception", note } : t)) })),
      addIncomingTxn: (t) => set((s) => ({ mpesaTxns: [{ ...t, id: uid("mp") }, ...s.mpesaTxns] })),
    }),
    {
      name: "savora-ops-v1",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    },
  ),
);

/** Current user's open shift, if any. */
export function useMyOpenShift(user: DemoUser) {
  const cashierId = user.employeeId ?? user.id;
  return useOps((s) => s.shifts.find((sh) => sh.cashierId === cashierId && sh.status === "open"));
}
