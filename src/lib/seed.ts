// Deterministic demo data. Every generator takes `now` so nothing runs at module scope.
import { cartTotals, payrollDeductions, matchConfidence } from "./calc";
import { isoDate } from "./format";
import type {
  AttendanceException,
  AttendanceRecord,
  Branch,
  Department,
  DemoUser,
  Employee,
  Expense,
  KitchenStatus,
  LeaveRequest,
  MpesaTxn,
  Order,
  Payment,
  PaymentMethod,
  PayrollRun,
  Position,
  Product,
  PurchaseOrder,
  PurchaseRequest,
  Recipe,
  Shift,
  StockItem,
  StockMovement,
  Store,
  Supplier,
  SupplierInvoice,
  Transfer,
} from "./types";

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export const BRANCHES: Branch[] = [
  { id: "b1", name: "Westlands HQ", location: "Westlands, Nairobi" },
  { id: "b2", name: "Upper Hill", location: "Upper Hill, Nairobi" },
  { id: "b3", name: "Industrial Area", location: "Enterprise Rd, Nairobi" },
];

export const REGISTERS = ["Till 01", "Till 02", "Till 03", "Express Counter"];

export const PRODUCT_CATEGORIES = [
  "Breakfast",
  "Mains",
  "Sides",
  "Snacks",
  "Hot Drinks",
  "Cold Drinks",
];

export function seedProducts(): Product[] {
  const raw: [string, string, number, string | undefined, boolean, number][] = [
    ["Full Breakfast", "Breakfast", 450, "breakfast", true, 8],
    ["Mandazi (2pc)", "Breakfast", 60, undefined, false, 1],
    ["Pancakes & Honey", "Breakfast", 250, undefined, false, 6],
    ["Spanish Omelette", "Breakfast", 220, undefined, false, 6],
    ["Chicken Pilau", "Mains", 480, "pilau", true, 4],
    ["Beef Stew & Chapati", "Mains", 420, "beef-stew", true, 4],
    ["Ugali, Sukuma & Beef", "Mains", 380, "ugali-sukuma", true, 4],
    ["Chicken Biryani", "Mains", 550, "biryani", false, 5],
    ["Grilled Tilapia & Rice", "Mains", 650, "fish", false, 12],
    ["Githeri & Avocado", "Mains", 250, "githeri", false, 3],
    ["Chicken & Chips", "Mains", 520, "chicken-chips", true, 10],
    ["Vegetable Curry & Rice", "Mains", 320, undefined, false, 4],
    ["Chapati", "Sides", 40, undefined, false, 2],
    ["Plain Rice", "Sides", 120, undefined, false, 1],
    ["Kachumbari", "Sides", 80, undefined, false, 2],
    ["Masala Chips", "Sides", 220, undefined, false, 7],
    ["Beef Samosa (2pc)", "Snacks", 120, "samosa", true, 2],
    ["Sausage", "Snacks", 70, undefined, false, 3],
    ["Smokie Pasua", "Snacks", 80, undefined, false, 2],
    ["Kenyan Chai", "Hot Drinks", 80, "chai", true, 2],
    ["Cappuccino", "Hot Drinks", 250, "coffee", false, 3],
    ["Black Coffee", "Hot Drinks", 150, undefined, false, 2],
    ["Mango Passion Juice", "Cold Drinks", 200, "juice", true, 3],
    ["Soda 500ml", "Cold Drinks", 100, undefined, false, 0],
    ["Mineral Water 500ml", "Cold Drinks", 70, undefined, false, 0],
  ];
  return raw.map(([name, category, price, image, favorite, prep], i) => ({
    id: `p${i + 1}`,
    name,
    category,
    price,
    sku: `SKU-${String(1001 + i)}`,
    barcode: `61610${String(100000 + i * 37).padStart(7, "0")}`,
    image,
    available: i !== 8 && i !== 18, // two items sold out for realism
    favorite,
    prepMinutes: prep,
  }));
}

export const DEPARTMENTS_SEED: Department[] = [
  { id: "d1", name: "Management" },
  { id: "d2", name: "Front of House" },
  { id: "d3", name: "Kitchen" },
  { id: "d4", name: "Stores" },
  { id: "d5", name: "Finance" },
  { id: "d6", name: "Human Resources" },
  { id: "d7", name: "Procurement" },
];

export const POSITIONS_SEED: Position[] = [
  { id: "ps1", title: "General Manager", department: "Management", minSalary: 180000, maxSalary: 300000 },
  { id: "ps2", title: "Branch Manager", department: "Management", minSalary: 110000, maxSalary: 160000 },
  { id: "ps3", title: "POS Supervisor", department: "Front of House", minSalary: 55000, maxSalary: 80000 },
  { id: "ps4", title: "Cashier", department: "Front of House", minSalary: 28000, maxSalary: 40000 },
  { id: "ps5", title: "Waiter", department: "Front of House", minSalary: 22000, maxSalary: 32000 },
  { id: "ps6", title: "Head Chef", department: "Kitchen", minSalary: 90000, maxSalary: 140000 },
  { id: "ps7", title: "Line Cook", department: "Kitchen", minSalary: 30000, maxSalary: 45000 },
  { id: "ps8", title: "Kitchen Assistant", department: "Kitchen", minSalary: 20000, maxSalary: 28000 },
  { id: "ps9", title: "Store Manager", department: "Stores", minSalary: 70000, maxSalary: 95000 },
  { id: "ps10", title: "Storekeeper", department: "Stores", minSalary: 32000, maxSalary: 45000 },
  { id: "ps11", title: "Accountant", department: "Finance", minSalary: 75000, maxSalary: 110000 },
  { id: "ps12", title: "HR Manager", department: "Human Resources", minSalary: 90000, maxSalary: 130000 },
  { id: "ps13", title: "Procurement Officer", department: "Procurement", minSalary: 60000, maxSalary: 85000 },
  { id: "ps14", title: "Internal Auditor", department: "Finance", minSalary: 80000, maxSalary: 120000 },
];

const PEOPLE: [string, string, string, number, "Male" | "Female"][] = [
  ["Amina Odhiambo", "Management", "General Manager", 240000, "Female"],
  ["David Kamau", "Management", "General Manager", 280000, "Male"],
  ["Grace Wanjiru", "Management", "Branch Manager", 135000, "Female"],
  ["Peter Otieno", "Front of House", "POS Supervisor", 68000, "Male"],
  ["Faith Muthoni", "Front of House", "Cashier", 34000, "Female"],
  ["Head Chef Joseph Mwangi", "Kitchen", "Head Chef", 115000, "Male"],
  ["Brian Kiprono", "Kitchen", "Line Cook", 38000, "Male"],
  ["Lucy Achieng", "Stores", "Store Manager", 82000, "Female"],
  ["Samuel Njoroge", "Stores", "Storekeeper", 39000, "Male"],
  ["Esther Chebet", "Procurement", "Procurement Officer", 72000, "Female"],
  ["Michael Onyango", "Finance", "Accountant", 92000, "Male"],
  ["Mercy Nyambura", "Human Resources", "HR Manager", 110000, "Female"],
  ["John Doe", "Front of House", "Waiter", 26000, "Male"],
  ["Ruth Wairimu", "Finance", "Internal Auditor", 98000, "Female"],
  ["Kevin Mutua", "Front of House", "Cashier", 32000, "Male"],
  ["Mary Akinyi", "Front of House", "Cashier", 33000, "Female"],
  ["James Kariuki", "Kitchen", "Line Cook", 36000, "Male"],
  ["Ann Wambui", "Kitchen", "Kitchen Assistant", 24000, "Female"],
  ["Daniel Kibet", "Kitchen", "Kitchen Assistant", 23000, "Male"],
  ["Purity Jeptoo", "Front of House", "Waiter", 25000, "Female"],
  ["George Ouma", "Stores", "Storekeeper", 37000, "Male"],
  ["Catherine Njeri", "Front of House", "Cashier", 31000, "Female"],
  ["Victor Langat", "Kitchen", "Line Cook", 35000, "Male"],
  ["Beatrice Moraa", "Front of House", "Waiter", 24000, "Female"],
  ["Stephen Macharia", "Management", "Branch Manager", 128000, "Male"],
  ["Irene Atieno", "Kitchen", "Kitchen Assistant", 22000, "Female"],
  ["Collins Wekesa", "Front of House", "POS Supervisor", 61000, "Male"],
  ["Janet Kerubo", "Human Resources", "HR Manager", 96000, "Female"],
];

export function seedEmployees(): Employee[] {
  const r = rng(42);
  return PEOPLE.map(([name, department, position, salary, gender], i) => {
    const clean = name.replace("Head Chef ", "");
    const bio = i % 9 === 4 ? "not_enrolled" : i % 13 === 7 ? "disabled" : i === 20 ? "in_progress" : "enrolled";
    return {
      id: `e${i + 1}`,
      number: `EMP-${String(1001 + i)}`,
      name: clean,
      department,
      position,
      branchId: BRANCHES[i % 3]!.id,
      phone: `07${String(10000000 + Math.floor(r() * 89999999)).slice(0, 8)}`,
      email: `${clean.toLowerCase().replace(/[^a-z]+/g, ".")}@savora.co.ke`,
      hireDate: `20${18 + (i % 7)}-${String(1 + (i % 12)).padStart(2, "0")}-${String(1 + (i % 27)).padStart(2, "0")}`,
      salary,
      status: i === 19 ? "on_leave" : "active",
      biometric: bio as Employee["biometric"],
      idNumber: String(20000000 + Math.floor(r() * 9999999)),
      gender,
      dob: `19${80 + (i % 18)}-${String(1 + ((i * 5) % 12)).padStart(2, "0")}-${String(1 + ((i * 7) % 27)).padStart(2, "0")}`,
      documents: [
        { id: `doc${i}a`, name: "National ID.pdf", uploadedAt: 0 },
        { id: `doc${i}b`, name: "Employment Contract.pdf", uploadedAt: 0 },
      ],
    };
  });
}

/** One demo user per role, each tied to an employee record. */
export const DEMO_USERS: DemoUser[] = [
  { id: "u1", name: "Amina Odhiambo", role: "super_admin", branchId: "b1", employeeId: "e1" },
  { id: "u2", name: "David Kamau", role: "business_owner", branchId: "b1", employeeId: "e2" },
  { id: "u3", name: "Grace Wanjiru", role: "branch_manager", branchId: "b1", employeeId: "e3" },
  { id: "u4", name: "Peter Otieno", role: "pos_manager", branchId: "b1", employeeId: "e4" },
  { id: "u5", name: "Faith Muthoni", role: "cashier", branchId: "b1", employeeId: "e5" },
  { id: "u6", name: "Joseph Mwangi", role: "kitchen_manager", branchId: "b1", employeeId: "e6" },
  { id: "u7", name: "Brian Kiprono", role: "kitchen_staff", branchId: "b1", employeeId: "e7" },
  { id: "u8", name: "Lucy Achieng", role: "store_manager", branchId: "b1", employeeId: "e8" },
  { id: "u9", name: "Samuel Njoroge", role: "storekeeper", branchId: "b1", employeeId: "e9" },
  { id: "u10", name: "Esther Chebet", role: "procurement_officer", branchId: "b1", employeeId: "e10" },
  { id: "u11", name: "Michael Onyango", role: "accountant", branchId: "b1", employeeId: "e11" },
  { id: "u12", name: "Mercy Nyambura", role: "hr_manager", branchId: "b1", employeeId: "e12" },
  { id: "u13", name: "John Doe", role: "employee", branchId: "b1", employeeId: "e13" },
  { id: "u14", name: "Ruth Wairimu", role: "auditor", branchId: "b1", employeeId: "e14" },
];

// ---------- Sales ----------
export interface DailySales {
  date: string;
  branchId: string;
  revenue: number;
  orders: number;
}

export function seedSalesHistory(now: number): DailySales[] {
  const r = rng(7);
  const out: DailySales[] = [];
  for (let d = 28; d >= 1; d--) {
    const date = isoDate(now - d * DAY);
    const dow = new Date(now - d * DAY).getDay();
    const weekend = dow === 0 || dow === 6;
    BRANCHES.forEach((b, bi) => {
      const base = [148000, 112000, 86000][bi]! * (weekend ? 0.62 : 1);
      const revenue = Math.round(base * (0.85 + r() * 0.3));
      out.push({ date, branchId: b.id, revenue, orders: Math.round(revenue / (330 + r() * 60)) });
    });
  }
  return out;
}

const CASHIERS = [
  { id: "e15", name: "Kevin Mutua", branchId: "b1", register: "Till 02" },
  { id: "e16", name: "Mary Akinyi", branchId: "b2", register: "Till 01" },
  { id: "e22", name: "Catherine Njeri", branchId: "b3", register: "Till 01" },
];

export function seedShifts(now: number): Shift[] {
  return [
    ...CASHIERS.map((c, i) => ({
      id: `sh_seed_${i + 1}`,
      cashierId: c.id,
      cashierName: c.name,
      register: c.register,
      branchId: c.branchId,
      openingCash: 5000,
      openedAt: now - (5 + i) * HOUR,
      status: "open" as const,
      cashMovements:
        i === 0
          ? [{ id: "cm1", type: "out" as const, amount: 1500, reason: "Gas refill petty cash", at: now - 2 * HOUR }]
          : [],
      refunds: [],
    })),
    {
      id: "sh_seed_prev",
      cashierId: "e5",
      cashierName: "Faith Muthoni",
      register: "Till 01",
      branchId: "b1",
      openingCash: 5000,
      openedAt: now - DAY - 9 * HOUR,
      closedAt: now - DAY,
      status: "pending_review",
      cashMovements: [{ id: "cm2", type: "in", amount: 2000, reason: "Float top-up", at: now - DAY - 6 * HOUR }],
      refunds: [],
      expectedCash: 41250,
      countedCash: 40450,
      variance: -800,
      varianceReason: "Possible wrong change given during lunch rush",
    },
    {
      id: "sh_seed_prev2",
      cashierId: "e15",
      cashierName: "Kevin Mutua",
      register: "Till 02",
      branchId: "b1",
      openingCash: 5000,
      openedAt: now - 2 * DAY - 9 * HOUR,
      closedAt: now - 2 * DAY,
      status: "approved",
      cashMovements: [],
      refunds: [],
      expectedCash: 36820,
      countedCash: 36820,
      variance: 0,
    },
  ];
}

const CUSTOMERS = ["Walk-in", "Walk-in", "Walk-in", "Staff — Finance", "Table 4", "Table 9", "Walk-in", "Corporate — KCB"];

export function seedOrders(now: number, products: Product[]): Order[] {
  const r = rng(99);
  const orders: Order[] = [];
  const count = 64;
  for (let i = 0; i < count; i++) {
    const cashier = CASHIERS[i % 3]!;
    const minutesAgo = Math.round(((count - i) / count) * 9 * 60 * (0.9 + r() * 0.1));
    const createdAt = now - minutesAgo * MIN;
    const nItems = 1 + Math.floor(r() * 3);
    const items = Array.from({ length: nItems }, () => {
      const p = products.filter((x) => x.available)[Math.floor(r() * 23)] ?? products[0]!;
      return { productId: p.id, qty: 1 + Math.floor(r() * 2) };
    });
    const totals = cartTotals(items, products, 0);
    const methodRoll = r();
    let method: PaymentMethod = methodRoll < 0.35 ? "cash" : methodRoll < 0.75 ? "mpesa_stk" : methodRoll < 0.88 ? "till" : "card";
    const recent = minutesAgo < 25;
    const pendingPayment = i === count - 2;
    if (i === count - 3) method = "paybill";
    const payments: Payment[] = pendingPayment
      ? []
      : [
          {
            id: `pay_seed_${i}`,
            method,
            amount: totals.total,
            status: "completed",
            reference: method === "cash" ? undefined : `S${String(Math.floor(r() * 1e9)).padStart(9, "0")}K`,
            phone: method === "mpesa_stk" ? "2547" + String(10000000 + Math.floor(r() * 89999999)) : undefined,
            createdAt: createdAt + MIN,
          },
        ];
    let kitchenStatus: KitchenStatus = "completed";
    if (recent) kitchenStatus = minutesAgo < 6 ? "new" : minutesAgo < 14 ? "preparing" : "ready";
    if (pendingPayment) kitchenStatus = "new";
    orders.push({
      id: `ord_seed_${i}`,
      number: `ORD-${String(2400 + i)}`,
      branchId: cashier.branchId,
      cashierId: cashier.id,
      cashierName: cashier.name,
      shiftId: `sh_seed_${(i % 3) + 1}`,
      register: cashier.register,
      customer: CUSTOMERS[Math.floor(r() * CUSTOMERS.length)]!,
      orderType: r() < 0.6 ? "dine_in" : "takeaway",
      items: items.map((it) => {
        const p = products.find((x) => x.id === it.productId)!;
        return { productId: p.id, name: p.name, price: p.price, qty: it.qty, note: r() < 0.12 ? "No onions" : undefined };
      }),
      subtotal: totals.subtotal,
      discount: 0,
      tax: totals.tax,
      total: totals.total,
      status: pendingPayment ? "pending_payment" : "paid",
      kitchenStatus,
      kitchenAcceptedAt: kitchenStatus !== "new" ? createdAt + 2 * MIN : undefined,
      kitchenStartedAt: kitchenStatus !== "new" ? createdAt + 3 * MIN : undefined,
      kitchenReadyAt: kitchenStatus === "ready" || kitchenStatus === "completed" ? createdAt + 12 * MIN : undefined,
      kitchenCompletedAt: kitchenStatus === "completed" ? createdAt + 15 * MIN : undefined,
      priority: r() < 0.1 ? "rush" : "normal",
      payments,
      createdAt,
      paidAt: pendingPayment ? undefined : createdAt + MIN,
    });
  }
  return orders;
}

export function seedMpesaTxns(now: number, orders: Order[]): MpesaTxn[] {
  const r = rng(5);
  const names = ["JANE W", "OMONDI P", "KIPCHUMBA E", "NJERI M", "HASSAN A", "WANJIKU L", "MUTISYA K", "ACHIENG R"];
  const unpaid = orders.find((o) => o.status === "pending_payment");
  const txns: MpesaTxn[] = [];
  for (let i = 0; i < 12; i++) {
    const at = now - (i * 23 + 4) * MIN;
    const amount = [480, 900, 1250, 420, 380, 2600, 550, 200, 760, 1500, 330, 640][i]!;
    let status: MpesaTxn["status"] = i < 4 ? "incoming" : i < 8 ? "matched" : i < 10 ? "unmatched" : "exception";
    let accountRef: string | undefined = i % 3 === 0 ? undefined : `ORD-${2400 + 60 - i}`;
    let suggestedOrderId: string | undefined;
    let confidence = 0;
    if (i === 0 && unpaid) {
      accountRef = unpaid.number;
      suggestedOrderId = unpaid.id;
      confidence = matchConfidence({ amount: unpaid.total, at, accountRef }, unpaid);
      txns.push({
        id: `mp_${i}`,
        reference: `SKL${String(Math.floor(r() * 1e7)).padStart(7, "0")}`,
        phone: `2547${String(10000000 + Math.floor(r() * 89999999))}`,
        payerName: names[i % names.length]!,
        amount: unpaid.total,
        at,
        channel: "paybill",
        accountRef,
        suggestedOrderId,
        confidence,
        status: "incoming",
      });
      continue;
    }
    const candidate = accountRef ? orders.find((o) => o.number === accountRef) : undefined;
    if (candidate) {
      suggestedOrderId = candidate.id;
      confidence = Math.min(95, 40 + Math.floor(r() * 50));
    } else {
      confidence = Math.floor(r() * 40);
    }
    if (status === "exception") accountRef = i === 10 ? "LUNCH" : "ORD-99X";
    txns.push({
      id: `mp_${i}`,
      reference: `SKL${String(Math.floor(r() * 1e7)).padStart(7, "0")}`,
      phone: `2547${String(10000000 + Math.floor(r() * 89999999))}`,
      payerName: names[i % names.length]!,
      amount,
      at,
      channel: i % 2 === 0 ? "paybill" : "till",
      accountRef,
      suggestedOrderId: status === "unmatched" || status === "exception" ? undefined : suggestedOrderId,
      confidence: status === "matched" ? Math.max(confidence, 85) : confidence,
      status,
      matchedOrderId: status === "matched" ? suggestedOrderId : undefined,
      note: status === "exception" ? (i === 10 ? "Amount matches 3 open orders — ambiguous" : "Account reference not found") : undefined,
    });
  }
  return txns;
}

// ---------- Attendance ----------
export function seedAttendance(now: number, employees: Employee[]): AttendanceRecord[] {
  const r = rng(11);
  const recs: AttendanceRecord[] = [];
  for (let d = 13; d >= 0; d--) {
    const dayTs = now - d * DAY;
    const date = isoDate(dayTs);
    const dow = new Date(dayTs).getDay();
    if (dow === 0) continue;
    const dayStart = new Date(dayTs);
    dayStart.setHours(8, 0, 0, 0);
    const base = d === 0 ? Math.min(dayStart.getTime(), now - 4 * HOUR) : dayStart.getTime();
    employees.forEach((e, i) => {
      if (e.status === "on_leave") {
        recs.push({ id: `att_${d}_${i}`, employeeId: e.id, date, status: "on_leave", verification: "pending", device: "—" });
        return;
      }
      const roll = r();
      if (roll < 0.06) {
        recs.push({ id: `att_${d}_${i}`, employeeId: e.id, date, status: "absent", verification: "pending", device: "—" });
        return;
      }
      const late = roll > 0.86;
      const clockIn = base - 20 * MIN + Math.floor(r() * 25) * MIN + (late ? 25 * MIN + Math.floor(r() * 40) * MIN : 0);
      const finished = d > 0 || (i % 7 === 0 && now - clockIn > 3 * HOUR);
      const clockOut = finished ? clockIn + (8 * HOUR + Math.floor(r() * 90) * MIN) : undefined;
      const lowConf = r() < 0.05;
      recs.push({
        id: `att_${d}_${i}`,
        employeeId: e.id,
        date,
        clockIn,
        clockOut: d > 0 && r() < 0.03 ? undefined : clockOut,
        status: d === 0 ? (finished ? "clocked_out" : late ? "late" : "present") : late ? "late" : "clocked_out",
        verification: lowConf ? "low_confidence" : "verified",
        confidence: lowConf ? 71 + Math.floor(r() * 8) : 92 + Math.floor(r() * 8),
        device: `Kiosk ${BRANCHES.find((b) => b.id === e.branchId)!.name}`,
      });
    });
  }
  return recs;
}

export function seedAttendanceExceptions(now: number): AttendanceException[] {
  const mk = (
    id: string,
    employeeId: string,
    type: AttendanceException["type"],
    hoursAgo: number,
    detail: string,
    status: AttendanceException["status"] = "open",
  ): AttendanceException => ({ id, employeeId, type, at: now - hoursAgo * HOUR, detail, status, notes: [] });
  return [
    mk("ex1", "e17", "failed_verification", 1.5, "Face not matched after 3 attempts at Kiosk Westlands HQ"),
    mk("ex2", "e18", "low_confidence", 3, "Match confidence 72% (threshold 85%) — clock-in held for review"),
    mk("ex3", "e21", "duplicate_attempt", 4, "Second clock-in attempt 4 minutes after the first"),
    mk("ex4", "e23", "missing_clock_out", 20, "No clock-out recorded yesterday — shift still open"),
    mk("ex5", "e24", "unauthorized_device", 26, "Clock-in from unregistered tablet (device ID TAB-77F2)"),
    mk("ex6", "e13", "late_attendance", 5, "Clocked in 42 minutes after shift start"),
    mk("ex7", "e7", "overtime", 30, "Worked 11h 20m — exceeds 10h overtime limit"),
    {
      ...mk("ex8", "e19", "missing_clock_out", 50, "Forgot to clock out", "approved"),
      correction: {
        field: "Clock out",
        original: "—",
        newValue: "17:05",
        reason: "Confirmed with supervisor and CCTV",
        approver: "Mercy Nyambura",
        at: now - 44 * HOUR,
      },
    },
  ];
}

export function seedLeave(now: number): LeaveRequest[] {
  const d = (offset: number) => isoDate(now + offset * DAY);
  return [
    { id: "lv1", employeeId: "e20", type: "annual", from: d(-3), to: d(4), days: 6, reason: "Family holiday", status: "approved", decidedBy: "Mercy Nyambura", decidedAt: now - 9 * DAY, createdAt: now - 12 * DAY },
    { id: "lv2", employeeId: "e13", type: "sick", from: d(2), to: d(3), days: 2, reason: "Dental procedure", status: "pending", createdAt: now - 1 * DAY },
    { id: "lv3", employeeId: "e17", type: "annual", from: d(10), to: d(16), days: 5, reason: "Wedding", status: "pending", createdAt: now - 2 * DAY },
    { id: "lv4", employeeId: "e26", type: "compassionate", from: d(-15), to: d(-13), days: 3, reason: "Bereavement", status: "approved", decidedBy: "Janet Kerubo", decidedAt: now - 16 * DAY, createdAt: now - 16 * DAY },
    { id: "lv5", employeeId: "e9", type: "annual", from: d(20), to: d(30), days: 9, reason: "Upcountry visit", status: "rejected", decidedBy: "Mercy Nyambura", decidedAt: now - 3 * DAY, createdAt: now - 5 * DAY },
    { id: "lv6", employeeId: "e5", type: "annual", from: d(25), to: d(27), days: 3, reason: "Graduation ceremony", status: "pending", createdAt: now - 6 * HOUR },
  ];
}

export const LEAVE_ENTITLEMENT: Record<LeaveRequest["type"], number> = {
  annual: 21,
  sick: 14,
  maternity: 90,
  paternity: 14,
  compassionate: 5,
  unpaid: 30,
};

// ---------- Inventory ----------
export const STORES_SEED: Store[] = [
  { id: "s1", name: "Main Store — Westlands", branchId: "b1", type: "main" },
  { id: "s2", name: "Kitchen Store — Westlands", branchId: "b1", type: "kitchen" },
  { id: "s3", name: "Upper Hill Store", branchId: "b2", type: "main" },
  { id: "s4", name: "Industrial Area Store", branchId: "b3", type: "main" },
];

export function seedStockItems(): StockItem[] {
  const raw: [string, StockItem["kind"], string, string, number, number, number[]][] = [
    ["Basmati Rice", "ingredient", "Dry Goods", "kg", 210, 50, [180, 40, 60, 35]],
    ["Maize Flour", "ingredient", "Dry Goods", "kg", 75, 60, [220, 30, 90, 80]],
    ["Wheat Flour", "ingredient", "Dry Goods", "kg", 90, 50, [140, 25, 55, 40]],
    ["Beef (boneless)", "ingredient", "Meat", "kg", 720, 30, [45, 12, 20, 6]],
    ["Whole Chicken", "ingredient", "Meat", "pc", 650, 40, [60, 18, 25, 22]],
    ["Tilapia Fillet", "ingredient", "Fish", "kg", 850, 15, [0, 0, 4, 0]],
    ["Potatoes", "ingredient", "Produce", "kg", 70, 80, [300, 60, 120, 90]],
    ["Onions", "ingredient", "Produce", "kg", 90, 40, [35, 8, 15, 12]],
    ["Tomatoes", "ingredient", "Produce", "kg", 110, 40, [55, 14, 22, 18]],
    ["Sukuma Wiki", "ingredient", "Produce", "bunch", 30, 60, [120, 40, 50, 45]],
    ["Cooking Oil", "ingredient", "Dry Goods", "L", 320, 40, [80, 20, 30, 18]],
    ["Pilau Masala", "ingredient", "Spices", "kg", 1200, 3, [5, 1, 2, 1.5]],
    ["Milk", "ingredient", "Dairy", "L", 65, 60, [110, 30, 40, 35]],
    ["Tea Leaves", "ingredient", "Beverages", "kg", 480, 5, [12, 3, 4, 2]],
    ["Coffee Beans", "ingredient", "Beverages", "kg", 1800, 4, [3, 1, 1, 0.5]],
    ["Sugar", "ingredient", "Dry Goods", "kg", 160, 50, [200, 30, 60, 55]],
    ["Eggs", "ingredient", "Dairy", "tray", 420, 20, [40, 10, 15, 6]],
    ["Beans (Rosecoco)", "ingredient", "Dry Goods", "kg", 180, 30, [60, 15, 25, 20]],
    ["Maize Grain", "ingredient", "Dry Goods", "kg", 65, 30, [70, 10, 30, 25]],
    ["Avocado", "ingredient", "Produce", "pc", 25, 50, [80, 20, 40, 10]],
    ["Mango Pulp", "ingredient", "Produce", "L", 260, 20, [25, 6, 10, 8]],
    ["Sausages", "product", "Ready Items", "pc", 38, 100, [320, 80, 150, 120]],
    ["Soda 500ml", "product", "Beverages", "bottle", 55, 120, [480, 0, 200, 140]],
    ["Mineral Water 500ml", "product", "Beverages", "bottle", 28, 120, [600, 0, 180, 90]],
    ["Takeaway Box", "packaging", "Packaging", "pc", 12, 300, [1500, 200, 600, 250]],
    ["Paper Cups", "packaging", "Packaging", "pc", 6, 400, [250, 80, 150, 120]],
  ];
  return raw.map(([name, kind, category, unit, unitCost, reorderLevel, qtys], i) => ({
    id: `it${i + 1}`,
    name,
    sku: `ING-${String(301 + i)}`,
    kind,
    category,
    unit,
    unitCost,
    reorderLevel,
    stock: { s1: qtys[0]!, s2: qtys[1]!, s3: qtys[2]!, s4: qtys[3]! },
  }));
}

export function seedMovements(now: number): StockMovement[] {
  const r = rng(21);
  const types: StockMovement["type"][] = ["receipt", "issue", "issue", "sale", "wastage", "adjustment"];
  return Array.from({ length: 40 }, (_, i) => {
    const type = types[Math.floor(r() * types.length)]!;
    const qty = Math.round((1 + r() * 20) * 10) / 10;
    return {
      id: `mv${i}`,
      itemId: `it${1 + Math.floor(r() * 21)}`,
      storeId: `s${1 + Math.floor(r() * 4)}`,
      type,
      qty: type === "receipt" ? qty : -qty,
      at: now - i * 2.7 * HOUR,
      ref: type === "receipt" ? `GRN-${700 + i}` : type === "wastage" ? `WST-${300 + i}` : `ISS-${500 + i}`,
      by: ["Samuel Njoroge", "George Ouma", "Lucy Achieng"][i % 3]!,
      note: type === "wastage" ? ["Spoiled", "Expired", "Overcooked", "Dropped"][i % 4] : undefined,
    };
  });
}

export function seedTransfers(now: number): Transfer[] {
  return [
    { id: "tr1", number: "TRF-1041", fromStoreId: "s1", toStoreId: "s2", lines: [{ itemId: "it1", qty: 20 }, { itemId: "it7", qty: 40 }], status: "pending", createdAt: now - 2 * HOUR, createdBy: "Joseph Mwangi" },
    { id: "tr2", number: "TRF-1040", fromStoreId: "s1", toStoreId: "s4", lines: [{ itemId: "it5", qty: 10 }], status: "in_transit", createdAt: now - 6 * HOUR, createdBy: "Lucy Achieng" },
    { id: "tr3", number: "TRF-1039", fromStoreId: "s3", toStoreId: "s1", lines: [{ itemId: "it23", qty: 48 }], status: "received", createdAt: now - 2 * DAY, createdBy: "George Ouma" },
  ];
}

export function seedRecipes(): Recipe[] {
  return [
    { id: "rc1", name: "Chicken Pilau", productId: "p5", yield: 10, sellingPrice: 480, wastePct: 5, lines: [{ itemId: "it1", qty: 1.5 }, { itemId: "it5", qty: 2.5 }, { itemId: "it8", qty: 0.5 }, { itemId: "it12", qty: 0.05 }, { itemId: "it11", qty: 0.3 }, { itemId: "it9", qty: 0.4 }] },
    { id: "rc2", name: "Beef Stew & Chapati", productId: "p6", yield: 12, sellingPrice: 420, wastePct: 6, lines: [{ itemId: "it4", qty: 2.4 }, { itemId: "it3", qty: 1.8 }, { itemId: "it9", qty: 1 }, { itemId: "it8", qty: 0.6 }, { itemId: "it11", qty: 0.5 }, { itemId: "it7", qty: 1.5 }] },
    { id: "rc3", name: "Ugali, Sukuma & Beef", productId: "p7", yield: 10, sellingPrice: 380, wastePct: 4, lines: [{ itemId: "it2", qty: 2 }, { itemId: "it10", qty: 8 }, { itemId: "it4", qty: 1.8 }, { itemId: "it11", qty: 0.3 }, { itemId: "it8", qty: 0.4 }] },
    { id: "rc4", name: "Chicken & Chips", productId: "p11", yield: 8, sellingPrice: 520, wastePct: 8, lines: [{ itemId: "it5", qty: 2 }, { itemId: "it7", qty: 3 }, { itemId: "it11", qty: 1.2 }] },
    { id: "rc5", name: "Githeri & Avocado", productId: "p10", yield: 15, sellingPrice: 250, wastePct: 3, lines: [{ itemId: "it18", qty: 1.5 }, { itemId: "it19", qty: 2 }, { itemId: "it20", qty: 8 }, { itemId: "it8", qty: 0.5 }, { itemId: "it9", qty: 0.6 }] },
    { id: "rc6", name: "Kenyan Chai (urn)", productId: "p20", yield: 40, sellingPrice: 80, wastePct: 5, lines: [{ itemId: "it13", qty: 6 }, { itemId: "it14", qty: 0.25 }, { itemId: "it16", qty: 0.8 }] },
    { id: "rc7", name: "Mango Passion Juice", productId: "p23", yield: 10, sellingPrice: 200, wastePct: 2, lines: [{ itemId: "it21", qty: 2.5 }, { itemId: "it16", qty: 0.4 }] },
  ];
}

// ---------- Procurement ----------
export const SUPPLIERS_SEED: Supplier[] = [
  { id: "sp1", name: "Twiga Fresh Produce", contact: "Alice Mwende", phone: "0711 223 344", email: "orders@twigafresh.co.ke", category: "Produce", rating: 4.6, active: true },
  { id: "sp2", name: "Farmers Choice Meats", contact: "Tom Kiplagat", phone: "0722 556 677", email: "sales@farmerschoice.co.ke", category: "Meat", rating: 4.4, active: true },
  { id: "sp3", name: "Unga Ltd Wholesale", contact: "Hellen Auma", phone: "0733 889 900", email: "trade@unga.co.ke", category: "Dry Goods", rating: 4.1, active: true },
  { id: "sp4", name: "Brookside Dairy", contact: "Paul Ndirangu", phone: "0700 112 233", email: "b2b@brookside.co.ke", category: "Dairy", rating: 4.7, active: true },
  { id: "sp5", name: "Kericho Gold Teas", contact: "Sharon Rotich", phone: "0745 667 788", email: "orders@kerichogold.co.ke", category: "Beverages", rating: 4.5, active: true },
  { id: "sp6", name: "PackPro Kenya", contact: "Ibrahim Ali", phone: "0756 990 011", email: "hello@packpro.co.ke", category: "Packaging", rating: 3.9, active: false },
];

export function seedPurchaseRequests(now: number): PurchaseRequest[] {
  return [
    { id: "pr1", number: "PR-311", requestedBy: "Joseph Mwangi", storeId: "s2", lines: [{ itemId: "it6", qty: 20 }], reason: "Tilapia out of stock — weekend menu", status: "pending", createdAt: now - 3 * HOUR },
    { id: "pr2", number: "PR-310", requestedBy: "Lucy Achieng", storeId: "s1", lines: [{ itemId: "it8", qty: 50 }, { itemId: "it9", qty: 40 }], reason: "Below reorder level", status: "approved", createdAt: now - DAY },
    { id: "pr3", number: "PR-309", requestedBy: "George Ouma", storeId: "s4", lines: [{ itemId: "it4", qty: 30 }], reason: "Beef low at Industrial Area", status: "converted", createdAt: now - 3 * DAY },
  ];
}

export function seedPurchaseOrders(now: number): PurchaseOrder[] {
  const h = (statuses: PurchaseOrder["status"][], startHoursAgo: number) =>
    statuses.map((status, i) => ({ status, at: now - (startHoursAgo - i * 4) * HOUR, by: i < 2 ? "Esther Chebet" : "Grace Wanjiru" }));
  return [
    { id: "po1", number: "PO-2207", supplierId: "sp2", storeId: "s4", lines: [{ itemId: "it4", qty: 30, unitCost: 700, received: 0 }], status: "sent", history: h(["draft", "submitted", "reviewed", "approved", "sent"], 30), expectedDate: isoDate(now + DAY), createdAt: now - 30 * HOUR },
    { id: "po2", number: "PO-2208", supplierId: "sp1", storeId: "s1", lines: [{ itemId: "it8", qty: 50, unitCost: 88, received: 0 }, { itemId: "it9", qty: 40, unitCost: 105, received: 0 }], status: "approved", history: h(["draft", "submitted", "reviewed", "approved"], 20), expectedDate: isoDate(now + 2 * DAY), createdAt: now - 20 * HOUR },
    { id: "po3", number: "PO-2209", supplierId: "sp4", storeId: "s1", lines: [{ itemId: "it13", qty: 100, unitCost: 62, received: 0 }], status: "submitted", history: h(["draft", "submitted"], 6), expectedDate: isoDate(now + 2 * DAY), createdAt: now - 6 * HOUR },
    { id: "po4", number: "PO-2210", supplierId: "sp5", storeId: "s1", lines: [{ itemId: "it14", qty: 10, unitCost: 470, received: 0 }, { itemId: "it15", qty: 5, unitCost: 1750, received: 0 }], status: "draft", history: h(["draft"], 2), expectedDate: isoDate(now + 4 * DAY), createdAt: now - 2 * HOUR },
    { id: "po5", number: "PO-2204", supplierId: "sp3", storeId: "s1", lines: [{ itemId: "it2", qty: 100, unitCost: 74, received: 100 }, { itemId: "it3", qty: 60, unitCost: 88, received: 60 }], status: "received", history: h(["draft", "submitted", "reviewed", "approved", "sent", "received"], 120), expectedDate: isoDate(now - 3 * DAY), createdAt: now - 120 * HOUR },
  ];
}

export function seedInvoices(now: number): SupplierInvoice[] {
  return [
    { id: "inv1", number: "UNG-88213", poId: "po5", supplierId: "sp3", amount: 12680, dueDate: isoDate(now + 10 * DAY), status: "unpaid" },
    { id: "inv2", number: "FCM-4410", poId: "po1", supplierId: "sp2", amount: 21000, dueDate: isoDate(now + 25 * DAY), status: "unpaid" },
  ];
}

// ---------- Expenses ----------
export const EXPENSE_CATEGORIES = [
  "Utilities",
  "Gas & Fuel",
  "Repairs & Maintenance",
  "Cleaning Supplies",
  "Transport",
  "Marketing",
  "Rent",
  "Licenses & Permits",
  "Staff Welfare",
  "Miscellaneous",
];

export function seedExpenses(now: number): Expense[] {
  const r = rng(31);
  const methods: PaymentMethod[] = ["cash", "bank", "mpesa_stk", "card"];
  const statuses: Expense["status"][] = ["pending", "approved", "paid", "paid", "rejected", "pending"];
  const desc = ["KPLC tokens", "LPG gas cylinder refill", "Fridge compressor repair", "Detergents & sanitizer", "Market run transport", "Flyers for lunch promo", "Monthly rent — Upper Hill", "County food handling permit", "Staff team lunch", "Pest control"];
  return Array.from({ length: 14 }, (_, i) => ({
    id: `ex_${i}`,
    category: EXPENSE_CATEGORIES[i % EXPENSE_CATEGORIES.length]!,
    branchId: BRANCHES[i % 3]!.id,
    amount: Math.round((1500 + r() * 38000) / 50) * 50,
    method: methods[i % 4]!,
    date: isoDate(now - Math.floor(i * 1.7) * DAY),
    description: desc[i % desc.length]!,
    receiptName: i % 3 === 0 ? undefined : `receipt-${1000 + i}.jpg`,
    status: statuses[i % statuses.length]!,
    submittedBy: ["Grace Wanjiru", "Michael Onyango", "Stephen Macharia"][i % 3]!,
    createdAt: now - i * 1.7 * DAY,
  }));
}

export function seedPayroll(now: number, employees: Employee[]): PayrollRun[] {
  const prev = new Date(now);
  prev.setMonth(prev.getMonth() - 1);
  const period = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
  return [
    {
      id: "pay1",
      period,
      status: "paid",
      createdAt: now - 12 * DAY,
      lines: employees.map((e, i) => {
        const allowances = Math.round(e.salary * 0.1);
        const overtime = i % 5 === 0 ? 3500 : 0;
        const gross = e.salary + allowances + overtime;
        const deductions = payrollDeductions(gross).total;
        return { employeeId: e.id, basic: e.salary, allowances, overtime, deductions, net: Math.round(gross - deductions) };
      }),
    },
  ];
}
