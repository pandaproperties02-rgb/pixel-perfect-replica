// HR, attendance, leave and payroll.
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { lateMinutes, payrollDeductions } from "@/lib/calc";
import { isoDate, uid } from "@/lib/format";
import {
  DEPARTMENTS_SEED,
  POSITIONS_SEED,
  seedAttendance,
  seedAttendanceExceptions,
  seedEmployees,
  seedLeave,
  seedPayroll,
} from "@/lib/seed";
import type {
  AttendanceException,
  AttendanceRecord,
  BiometricStatus,
  Correction,
  Department,
  Employee,
  LeaveRequest,
  PayrollRun,
  Position,
  VerificationStatus,
} from "@/lib/types";

export const DUPLICATE_WINDOW_MIN = 2; // ignore repeat scans within 2 minutes
export const MATCH_THRESHOLD = 85; // % confidence needed for automatic acceptance

export type ClockResult =
  | { kind: "clock_in"; record: AttendanceRecord; late: number }
  | { kind: "clock_out"; record: AttendanceRecord }
  | { kind: "duplicate"; record: AttendanceRecord }
  | { kind: "held"; record: AttendanceRecord }
  | { kind: "rejected"; reason: string };

interface PeopleState {
  seeded: boolean;
  employees: Employee[];
  departments: Department[];
  positions: Position[];
  attendance: AttendanceRecord[];
  exceptions: AttendanceException[];
  leave: LeaveRequest[];
  payroll: PayrollRun[];

  seed: (now: number) => void;

  upsertEmployee: (e: Omit<Employee, "id" | "number" | "documents"> & { id?: string }) => Employee;
  setBiometric: (employeeId: string, status: BiometricStatus) => void;
  addDocument: (employeeId: string, name: string) => void;
  upsertDepartment: (d: Omit<Department, "id"> & { id?: string }) => void;
  upsertPosition: (p: Omit<Position, "id"> & { id?: string }) => void;

  /** Kiosk entry point: decides clock-in vs clock-out and raises exceptions. */
  clock: (employeeId: string, confidence: number, device: string) => ClockResult;
  raiseException: (e: Omit<AttendanceException, "id" | "status" | "notes">) => void;
  addExceptionNote: (id: string, by: string, text: string) => void;
  resolveException: (id: string, approve: boolean, by: string, correction?: Omit<Correction, "approver" | "at">) => void;

  requestLeave: (r: Omit<LeaveRequest, "id" | "status" | "createdAt">) => LeaveRequest;
  decideLeave: (id: string, approve: boolean, by: string) => void;
  cancelLeave: (id: string) => void;

  createPayrollRun: (period: string) => PayrollRun;
  setPayrollStatus: (id: string, status: PayrollRun["status"]) => void;
}

export const usePeople = create<PeopleState>()(
  persist(
    (set, get) => ({
      seeded: false,
      employees: [],
      departments: [],
      positions: [],
      attendance: [],
      exceptions: [],
      leave: [],
      payroll: [],

      seed: (now) => {
        const employees = seedEmployees();
        set({
          seeded: true,
          employees,
          departments: DEPARTMENTS_SEED.map((d, i) => ({ ...d, managerId: ["e1", "e3", "e6", "e8", "e11", "e12", "e10"][i] })),
          positions: POSITIONS_SEED,
          attendance: seedAttendance(now, employees),
          exceptions: seedAttendanceExceptions(now),
          leave: seedLeave(now),
          payroll: seedPayroll(now, employees),
        });
      },

      upsertEmployee: (e) => {
        if (e.id) {
          const updated = { ...get().employees.find((x) => x.id === e.id)!, ...e } as Employee;
          set((s) => ({ employees: s.employees.map((x) => (x.id === e.id ? updated : x)) }));
          return updated;
        }
        const n = get().employees.length;
        const emp: Employee = { ...e, id: uid("e"), number: `EMP-${1001 + n}`, documents: [] } as Employee;
        set((s) => ({ employees: [...s.employees, emp] }));
        return emp;
      },
      setBiometric: (employeeId, status) =>
        set((s) => ({
          employees: s.employees.map((e) =>
            e.id === employeeId ? { ...e, biometric: status, biometricEnrolledAt: status === "enrolled" ? Date.now() : e.biometricEnrolledAt } : e,
          ),
        })),
      addDocument: (employeeId, name) =>
        set((s) => ({
          employees: s.employees.map((e) =>
            e.id === employeeId ? { ...e, documents: [...e.documents, { id: uid("doc"), name, uploadedAt: Date.now() }] } : e,
          ),
        })),
      upsertDepartment: (d) =>
        set((s) => ({
          departments: d.id ? s.departments.map((x) => (x.id === d.id ? ({ ...x, ...d } as Department) : x)) : [...s.departments, { ...d, id: uid("d") }],
        })),
      upsertPosition: (p) =>
        set((s) => ({
          positions: p.id ? s.positions.map((x) => (x.id === p.id ? ({ ...x, ...p } as Position) : x)) : [...s.positions, { ...p, id: uid("ps") }],
        })),

      clock: (employeeId, confidence, device) => {
        const emp = get().employees.find((e) => e.id === employeeId);
        if (!emp) return { kind: "rejected", reason: "Employee not found" };
        if (emp.biometric !== "enrolled") return { kind: "rejected", reason: "Face not enrolled — see HR" };
        if (emp.status !== "active") return { kind: "rejected", reason: "Employee is not active" };
        const now = Date.now();
        const date = isoDate(now);
        const verification: VerificationStatus = confidence >= MATCH_THRESHOLD ? "verified" : "low_confidence";
        const today = get().attendance.find((a) => a.employeeId === employeeId && a.date === date);

        const lastEvent = today ? Math.max(today.clockIn ?? 0, today.clockOut ?? 0) : 0;
        if (today && now - lastEvent < DUPLICATE_WINDOW_MIN * 60000) {
          get().raiseException({ employeeId, type: "duplicate_attempt", at: now, detail: `Repeat scan within ${DUPLICATE_WINDOW_MIN} minutes at ${device}`, recordId: today.id });
          return { kind: "duplicate", record: today };
        }

        if (!today || !today.clockIn) {
          const late = lateMinutes(now);
          const record: AttendanceRecord = {
            id: today?.id ?? uid("att"),
            employeeId,
            date,
            clockIn: now,
            status: late > 0 ? "late" : "present",
            verification,
            confidence,
            device,
          };
          set((s) => ({ attendance: today ? s.attendance.map((a) => (a.id === today.id ? record : a)) : [...s.attendance, record] }));
          if (verification === "low_confidence") {
            get().raiseException({ employeeId, type: "low_confidence", at: now, detail: `Match confidence ${confidence}% (threshold ${MATCH_THRESHOLD}%) — clock-in held for review`, recordId: record.id });
            return { kind: "held", record };
          }
          if (late > 0) get().raiseException({ employeeId, type: "late_attendance", at: now, detail: `Clocked in ${late} minutes after shift start`, recordId: record.id });
          return { kind: "clock_in", record, late };
        }

        if (today.clockOut) {
          get().raiseException({ employeeId, type: "duplicate_attempt", at: now, detail: "Already clocked out today", recordId: today.id });
          return { kind: "duplicate", record: today };
        }

        const record: AttendanceRecord = { ...today, clockOut: now, status: "clocked_out", verification: verification === "low_confidence" ? "low_confidence" : today.verification };
        set((s) => ({ attendance: s.attendance.map((a) => (a.id === today.id ? record : a)) }));
        if (verification === "low_confidence") {
          get().raiseException({ employeeId, type: "low_confidence", at: now, detail: `Clock-out confidence ${confidence}% — held for review`, recordId: record.id });
          return { kind: "held", record };
        }
        return { kind: "clock_out", record };
      },
      raiseException: (e) =>
        set((s) => ({ exceptions: [{ ...e, id: uid("ex"), status: "open", notes: [] }, ...s.exceptions] })),
      addExceptionNote: (id, by, text) =>
        set((s) => ({
          exceptions: s.exceptions.map((x) => (x.id === id ? { ...x, notes: [...x.notes, { by, text, at: Date.now() }] } : x)),
        })),
      resolveException: (id, approve, by, correction) =>
        set((s) => {
          const ex = s.exceptions.find((x) => x.id === id);
          const full: Correction | undefined = correction ? { ...correction, approver: by, at: Date.now() } : undefined;
          let attendance = s.attendance;
          if (approve && ex?.recordId) {
            attendance = attendance.map((a) => (a.id === ex.recordId && a.verification === "low_confidence" ? { ...a, verification: "manual" } : a));
          }
          return {
            attendance,
            exceptions: s.exceptions.map((x) => (x.id === id ? { ...x, status: approve ? "approved" : "rejected", correction: full ?? x.correction } : x)),
          };
        }),

      requestLeave: (r) => {
        const req: LeaveRequest = { ...r, id: uid("lv"), status: "pending", createdAt: Date.now() };
        set((s) => ({ leave: [req, ...s.leave] }));
        return req;
      },
      decideLeave: (id, approve, by) =>
        set((s) => ({
          leave: s.leave.map((l) => (l.id === id ? { ...l, status: approve ? "approved" : "rejected", decidedBy: by, decidedAt: Date.now() } : l)),
        })),
      cancelLeave: (id) => set((s) => ({ leave: s.leave.filter((l) => !(l.id === id && l.status === "pending")) })),

      createPayrollRun: (period) => {
        if (get().payroll.some((p) => p.period === period)) throw new Error(`Payroll for ${period} already exists`);
        const run: PayrollRun = {
          id: uid("pay"),
          period,
          status: "draft",
          createdAt: Date.now(),
          lines: get()
            .employees.filter((e) => e.status !== "terminated")
            .map((e) => {
              const allowances = Math.round(e.salary * 0.1);
              const gross = e.salary + allowances;
              const deductions = payrollDeductions(gross).total;
              return { employeeId: e.id, basic: e.salary, allowances, overtime: 0, deductions, net: Math.round(gross - deductions) };
            }),
        };
        set((s) => ({ payroll: [run, ...s.payroll] }));
        return run;
      },
      setPayrollStatus: (id, status) => set((s) => ({ payroll: s.payroll.map((p) => (p.id === id ? { ...p, status } : p)) })),
    }),
    {
      name: "savora-people-v1",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    },
  ),
);
