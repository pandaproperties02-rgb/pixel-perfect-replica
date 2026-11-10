import type { Role } from "./types";

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super Admin",
  business_owner: "Business Owner",
  branch_manager: "Branch Manager",
  pos_manager: "POS Manager",
  cashier: "Cashier",
  kitchen_manager: "Kitchen Manager",
  kitchen_staff: "Kitchen Staff",
  store_manager: "Store Manager",
  storekeeper: "Storekeeper",
  procurement_officer: "Procurement Officer",
  accountant: "Accountant",
  hr_manager: "HR Manager",
  employee: "Employee",
  auditor: "Auditor",
};

export const ALL_ROLES = Object.keys(ROLE_LABELS) as Role[];

const R = {
  exec: ["super_admin", "business_owner"] as Role[],
  mgmt: ["super_admin", "business_owner", "branch_manager"] as Role[],
};

export interface NavItem {
  to: string;
  label: string;
  icon: string; // lucide icon name, resolved in the sidebar
  roles: Role[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [{ to: "/", label: "Dashboard", icon: "LayoutDashboard", roles: ALL_ROLES }],
  },
  {
    label: "Sales",
    items: [
      { to: "/pos", label: "POS Terminal", icon: "ShoppingCart", roles: [...R.mgmt, "pos_manager", "cashier"] },
      { to: "/shifts", label: "Cashier Shifts", icon: "Timer", roles: [...R.mgmt, "pos_manager", "cashier", "accountant", "auditor"] },
      { to: "/orders", label: "Orders", icon: "ReceiptText", roles: [...R.mgmt, "pos_manager", "cashier", "accountant", "auditor"] },
      { to: "/payments/reconciliation", label: "Reconciliation", icon: "Scale", roles: [...R.mgmt, "pos_manager", "accountant", "auditor"] },
      { to: "/kitchen", label: "Kitchen Display", icon: "ChefHat", roles: [...R.mgmt, "pos_manager", "kitchen_manager", "kitchen_staff"] },
    ],
  },
  {
    label: "Stores",
    items: [
      { to: "/inventory", label: "Inventory", icon: "Warehouse", roles: [...R.mgmt, "store_manager", "storekeeper", "kitchen_manager", "procurement_officer", "auditor"] },
      { to: "/recipes", label: "Recipes & Costing", icon: "BookOpen", roles: [...R.mgmt, "kitchen_manager", "store_manager", "accountant"] },
      { to: "/procurement", label: "Procurement", icon: "Truck", roles: [...R.mgmt, "procurement_officer", "store_manager", "storekeeper", "accountant", "auditor"] },
    ],
  },
  {
    label: "People",
    items: [
      { to: "/attendance", label: "Attendance", icon: "ScanFace", roles: [...R.mgmt, "hr_manager", "auditor"] },
      { to: "/attendance/exceptions", label: "Exceptions", icon: "ShieldAlert", roles: [...R.mgmt, "hr_manager", "auditor"] },
      { to: "/attendance/me", label: "My Attendance", icon: "CalendarCheck", roles: ALL_ROLES },
      { to: "/hr/employees", label: "Employees", icon: "Users", roles: [...R.mgmt, "hr_manager"] },
      { to: "/hr/departments", label: "Departments", icon: "Building2", roles: [...R.exec, "hr_manager"] },
      { to: "/hr/leave", label: "Leave", icon: "Plane", roles: ALL_ROLES },
      { to: "/payroll", label: "Payroll", icon: "Wallet", roles: [...R.exec, "hr_manager", "accountant", "auditor"] },
    ],
  },
  {
    label: "Finance",
    items: [
      { to: "/expenses", label: "Expenses", icon: "Receipt", roles: [...R.mgmt, "accountant", "auditor"] },
      { to: "/reports", label: "Reports", icon: "BarChart3", roles: [...R.mgmt, "pos_manager", "accountant", "auditor", "store_manager", "hr_manager"] },
    ],
  },
  {
    label: "System",
    items: [
      { to: "/attendance/kiosk", label: "Attendance Kiosk", icon: "MonitorSmartphone", roles: [...R.mgmt, "hr_manager"] },
      { to: "/settings", label: "Settings", icon: "Settings", roles: R.exec },
    ],
  },
];

/** Extra pages reachable from inside modules but not listed in the sidebar. */
const HIDDEN_ROUTES: { prefix: string; roles: Role[] }[] = [
  { prefix: "/hr/positions", roles: [...R.exec, "hr_manager"] },
  { prefix: "/hr/employees/", roles: [...R.mgmt, "hr_manager"] },
  { prefix: "/inventory/", roles: [...R.mgmt, "store_manager", "storekeeper", "kitchen_manager", "procurement_officer", "auditor"] },
  { prefix: "/recipes/", roles: [...R.mgmt, "kitchen_manager", "store_manager", "accountant"] },
  { prefix: "/procurement/", roles: [...R.mgmt, "procurement_officer", "store_manager", "storekeeper", "accountant", "auditor"] },
];

export function canAccessPath(role: Role, pathname: string) {
  const path = pathname.replace(/\/+$/, "") || "/";
  for (const h of HIDDEN_ROUTES) {
    if (path.startsWith(h.prefix)) return h.roles.includes(role);
  }
  const items = NAV_GROUPS.flatMap((g) => g.items);
  // longest matching nav prefix wins
  const match = items
    .filter((i) => (i.to === "/" ? path === "/" : path === i.to || path.startsWith(i.to + "/")))
    .sort((a, b) => b.to.length - a.to.length)[0];
  return match ? match.roles.includes(role) : true;
}

export type Permission =
  | "pos.sell"
  | "pos.discount"
  | "pos.refund"
  | "shift.review"
  | "recon.confirm"
  | "kitchen.operate"
  | "inventory.adjust"
  | "inventory.transfer"
  | "recipe.edit"
  | "procurement.create"
  | "procurement.approve"
  | "procurement.receive"
  | "expense.create"
  | "expense.approve"
  | "attendance.correct"
  | "biometric.enroll"
  | "employee.edit"
  | "leave.approve"
  | "payroll.approve"
  | "settings.manage";

const PERMS: Record<Permission, Role[]> = {
  "pos.sell": [...R.mgmt, "pos_manager", "cashier"],
  "pos.discount": [...R.mgmt, "pos_manager"],
  "pos.refund": [...R.mgmt, "pos_manager"],
  "shift.review": [...R.mgmt, "pos_manager", "accountant"],
  "recon.confirm": [...R.mgmt, "pos_manager", "accountant"],
  "kitchen.operate": [...R.mgmt, "kitchen_manager", "kitchen_staff", "pos_manager"],
  "inventory.adjust": [...R.mgmt, "store_manager", "storekeeper"],
  "inventory.transfer": [...R.mgmt, "store_manager", "storekeeper", "kitchen_manager"],
  "recipe.edit": [...R.mgmt, "kitchen_manager"],
  "procurement.create": [...R.mgmt, "procurement_officer", "store_manager"],
  "procurement.approve": [...R.mgmt],
  "procurement.receive": [...R.mgmt, "store_manager", "storekeeper"],
  "expense.create": [...R.mgmt, "accountant"],
  "expense.approve": [...R.exec, "branch_manager"],
  "attendance.correct": [...R.mgmt, "hr_manager"],
  "biometric.enroll": ["super_admin", "hr_manager"],
  "employee.edit": ["super_admin", "business_owner", "hr_manager"],
  "leave.approve": [...R.mgmt, "hr_manager"],
  "payroll.approve": [...R.exec],
  "settings.manage": [...R.exec],
};

export function can(role: Role, perm: Permission) {
  return PERMS[perm].includes(role);
}
