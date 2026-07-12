// In-browser mock database. Persisted to localStorage so sessions and demo
// state survive reloads (mirrors the real backend's behaviour). Reseed via
// resetMockDb() (user menu → "Reset demo data").

import type {
  ActivityEntry,
  Allocation,
  Asset,
  AssetHistoryEvent,
  AuditCycle,
  AuditItem,
  Booking,
  Category,
  Department,
  Employee,
  MaintenanceRequest,
  NotificationItem,
  Role,
  TransferRequest,
} from "../types";
import { buildSeed } from "./seed";

export interface MockUser {
  id: number;
  email: string;
  password: string;
  role: Role;
  isActive: boolean;
}

export interface RefreshRow {
  token: string;
  userId: number;
  expiresAt: number;
  revoked: boolean;
}

export interface ResetRow {
  token: string;
  userId: number;
  expiresAt: number;
  used: boolean;
}

export interface MockDb {
  version: number;
  seq: { id: number; tag: number };
  users: MockUser[];
  employees: Omit<Employee, "role">[];
  departments: Department[];
  categories: Category[];
  assets: Asset[];
  history: AssetHistoryEvent[];
  allocations: Allocation[];
  transfers: TransferRequest[];
  bookings: Booking[];
  maintenance: MaintenanceRequest[];
  auditCycles: (AuditCycle & { auditorIds: number[] })[];
  auditItems: AuditItem[];
  notifications: NotificationItem[];
  activity: ActivityEntry[];
  refreshTokens: RefreshRow[];
  resetTokens: ResetRow[];
}

export const SEED_VERSION = 3;
const KEY = "assetflow.mockdb";

let db: MockDb | null = null;

export function getDb(): MockDb {
  if (db) return db;
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as MockDb;
        if (parsed.version === SEED_VERSION) return (db = parsed);
      }
    } catch {
      /* corrupt store → reseed */
    }
  }
  db = buildSeed();
  saveDb();
  return db;
}

export function saveDb(): void {
  if (!db || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    /* quota — demo keeps working in-memory */
  }
}

export function resetMockDb(): void {
  db = buildSeed();
  saveDb();
}

export function nextId(d: MockDb): number {
  return d.seq.id++;
}
