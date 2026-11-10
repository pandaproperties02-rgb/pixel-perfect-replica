// Shared domain model for Savora Cafeteria OS. Every store and page uses these types.

export type Role =
  | "super_admin"
  | "business_owner"
  | "branch_manager"
  | "pos_manager"
  | "cashier"
  | "kitchen_manager"
  | "kitchen_staff"
  | "store_manager"
  | "storekeeper"
  | "procurement_officer"
  | "accountant"
  | "hr_manager"
  | "employee"
  | "auditor";

export interface Branch {
  id: string;
  name: string;
  location: string;
}

export interface DemoUser {
  id: string;
  name: string;
  role: Role;
  branchId: string;
  employeeId?: string;
}

// ---------- POS ----------
export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  sku: string;
  barcode: string;
  image?: string; // key into productImages
  available: boolean;
  favorite: boolean;
  prepMinutes: number;
}

export interface CartItem {
  productId: string;
  qty: number;
  note?: string;
}

export type OrderType = "dine_in" | "takeaway" | "delivery" | "staff_meal";

export type PaymentMethod =
  | "cash"
  | "mpesa_stk"
  | "paybill"
  | "till"
  | "card"
  | "bank"
  | "complimentary";

export type PaymentStatus = "pending" | "processing" | "completed" | "failed" | "cancelled";

export interface Payment {
  id: string;
  method: PaymentMethod;
  amount: number;
  status: PaymentStatus;
  reference?: string;
  phone?: string;
  tendered?: number; // cash handed over (for change)
  createdAt: number;
  note?: string;
}

export type OrderStatus = "pending_payment" | "partially_paid" | "paid" | "cancelled" | "refunded";
export type KitchenStatus = "new" | "preparing" | "ready" | "completed";

export interface OrderItem {
  productId: string;
  name: string;
  price: number;
  qty: number;
  note?: string;
}

export interface Order {
  id: string;
  number: string;
  branchId: string;
  cashierId: string;
  cashierName: string;
  shiftId?: string;
  register: string;
  customer: string;
  orderType: OrderType;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  tax: number; // VAT portion included in total
  total: number;
  status: OrderStatus;
  kitchenStatus: KitchenStatus;
  kitchenAcceptedAt?: number;
  kitchenStartedAt?: number;
  kitchenReadyAt?: number;
  kitchenCompletedAt?: number;
  priority: "normal" | "rush";
  payments: Payment[];
  notes?: string;
  createdAt: number;
  paidAt?: number;
}

// ---------- Shifts ----------
export interface CashMovement {
  id: string;
  type: "in" | "out";
  amount: number;
  reason: string;
  at: number;
}

export interface Refund {
  id: string;
  orderId: string;
  amount: number;
  method: PaymentMethod;
  reason: string;
  at: number;
}

export type ShiftStatus = "open" | "closed" | "pending_review" | "approved";

export interface Shift {
  id: string;
  cashierId: string;
  cashierName: string;
  register: string;
  branchId: string;
  openingCash: number;
  openedAt: number;
  closedAt?: number;
  status: ShiftStatus;
  cashMovements: CashMovement[];
  refunds: Refund[];
  countedCash?: number;
  expectedCash?: number;
  variance?: number;
  varianceReason?: string;
  reviewNote?: string;
  notes?: string;
}

// ---------- M-Pesa reconciliation ----------
export type ReconStatus = "incoming" | "matched" | "unmatched" | "exception" | "rejected";

export interface MpesaTxn {
  id: string;
  reference: string;
  phone: string;
  payerName: string;
  amount: number;
  at: number;
  channel: "paybill" | "till";
  accountRef?: string;
  suggestedOrderId?: string;
  confidence: number; // 0..100
  status: ReconStatus;
  matchedOrderId?: string;
  note?: string;
}

// ---------- HR & attendance ----------
export type BiometricStatus = "not_enrolled" | "in_progress" | "enrolled" | "disabled";

export interface Employee {
  id: string;
  number: string;
  name: string;
  department: string;
  position: string;
  branchId: string;
  phone: string;
  email: string;
  hireDate: string; // YYYY-MM-DD
  salary: number; // monthly basic, KES
  status: "active" | "on_leave" | "suspended" | "terminated";
  biometric: BiometricStatus;
  biometricEnrolledAt?: number;
  idNumber: string;
  gender: "Male" | "Female";
  dob: string;
  documents: { id: string; name: string; uploadedAt: number }[];
}

export interface Department {
  id: string;
  name: string;
  managerId?: string;
}

export interface Position {
  id: string;
  title: string;
  department: string;
  minSalary: number;
  maxSalary: number;
}

export type AttendanceStatus = "present" | "late" | "absent" | "clocked_out" | "on_leave";
export type VerificationStatus = "verified" | "low_confidence" | "failed" | "manual" | "pending";

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: string; // YYYY-MM-DD
  clockIn?: number;
  clockOut?: number;
  status: AttendanceStatus;
  verification: VerificationStatus;
  confidence?: number;
  device: string;
}

export type ExceptionType =
  | "failed_verification"
  | "low_confidence"
  | "duplicate_attempt"
  | "missing_clock_out"
  | "unauthorized_device"
  | "late_attendance"
  | "overtime";

export interface Correction {
  field: string;
  original: string;
  newValue: string;
  reason: string;
  approver: string;
  at: number;
}

export interface AttendanceException {
  id: string;
  employeeId: string;
  type: ExceptionType;
  at: number;
  detail: string;
  status: "open" | "approved" | "rejected";
  notes: { by: string; text: string; at: number }[];
  correction?: Correction;
  recordId?: string;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  type: "annual" | "sick" | "maternity" | "paternity" | "compassionate" | "unpaid";
  from: string;
  to: string;
  days: number;
  reason: string;
  status: "pending" | "approved" | "rejected";
  decidedBy?: string;
  decidedAt?: number;
  createdAt: number;
}

// ---------- Inventory ----------
export interface Store {
  id: string;
  name: string;
  branchId: string;
  type: "main" | "kitchen" | "bar" | "dry";
}

export interface StockItem {
  id: string;
  name: string;
  sku: string;
  kind: "ingredient" | "product" | "packaging";
  category: string;
  unit: string;
  unitCost: number;
  reorderLevel: number;
  stock: Record<string, number>; // storeId -> qty
}

export type MovementType =
  | "receipt"
  | "issue"
  | "adjustment"
  | "transfer_in"
  | "transfer_out"
  | "wastage"
  | "sale";

export interface StockMovement {
  id: string;
  itemId: string;
  storeId: string;
  type: MovementType;
  qty: number; // signed
  at: number;
  ref: string;
  by: string;
  note?: string;
}

export interface Transfer {
  id: string;
  number: string;
  fromStoreId: string;
  toStoreId: string;
  lines: { itemId: string; qty: number }[];
  status: "pending" | "in_transit" | "received" | "cancelled";
  createdAt: number;
  createdBy: string;
}

export interface StockTake {
  id: string;
  storeId: string;
  status: "in_progress" | "submitted" | "posted";
  createdAt: number;
  lines: { itemId: string; system: number; counted?: number }[];
}

export interface Recipe {
  id: string;
  name: string;
  productId?: string;
  yield: number; // servings
  sellingPrice: number;
  wastePct: number;
  lines: { itemId: string; qty: number }[];
}

// ---------- Procurement ----------
export interface Supplier {
  id: string;
  name: string;
  contact: string;
  phone: string;
  email: string;
  category: string;
  rating: number;
  active: boolean;
}

export interface PurchaseRequest {
  id: string;
  number: string;
  requestedBy: string;
  storeId: string;
  lines: { itemId: string; qty: number }[];
  reason: string;
  status: "pending" | "approved" | "rejected" | "converted";
  createdAt: number;
}

export type POStatus =
  | "draft"
  | "submitted"
  | "reviewed"
  | "approved"
  | "sent"
  | "received"
  | "cancelled";

export interface PurchaseOrder {
  id: string;
  number: string;
  supplierId: string;
  storeId: string;
  lines: { itemId: string; qty: number; unitCost: number; received: number }[];
  status: POStatus;
  history: { status: POStatus; at: number; by: string; note?: string }[];
  expectedDate: string;
  createdAt: number;
}

export interface SupplierInvoice {
  id: string;
  number: string;
  poId: string;
  supplierId: string;
  amount: number;
  dueDate: string;
  status: "unpaid" | "paid";
}

// ---------- Expenses & payroll ----------
export interface Expense {
  id: string;
  category: string;
  branchId: string;
  amount: number;
  method: PaymentMethod;
  date: string;
  description: string;
  receiptName?: string;
  status: "pending" | "approved" | "rejected" | "paid";
  submittedBy: string;
  decidedBy?: string;
  createdAt: number;
}

export interface PayrollLine {
  employeeId: string;
  basic: number;
  allowances: number;
  overtime: number;
  deductions: number;
  net: number;
}

export interface PayrollRun {
  id: string;
  period: string; // YYYY-MM
  status: "draft" | "approved" | "paid";
  lines: PayrollLine[];
  createdAt: number;
}
