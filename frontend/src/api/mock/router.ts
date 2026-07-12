// The in-browser mock backend. Same Response interface as fetch, same status
// codes and 409 bodies the real gateway will produce, per the phase briefs —
// so screens are written once and the toggle is one env flag.

import { getDb, saveDb, nextId, resetMockDb, type MockDb, type MockUser } from "./db";
import { mockBus } from "./bus";
import { overlaps } from "../../lib/overlap";
import type {
  Allocation,
  Asset,
  AssetStatus,
  AuditItem,
  Booking,
  BookingStatus,
  Employee,
  NotificationItem,
  Role,
  TransferRequest,
} from "../types";

const ACCESS_TTL = 15 * 60_000;
const REFRESH_TTL = 7 * 86_400_000;

// ---- plumbing -----------------------------------------------------------------

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const ok = (body: unknown) => json(200, body);
const noContent = () => new Response(null, { status: 204 });
const bad = (message: string) => json(400, { message });
const unauthorized = (message = "Not authenticated") => json(401, { message });
const forbidden = (message = "You don't have access to this action") => json(403, { message });
const notFound = (message = "Not found") => json(404, { message });
const conflict = (body: Record<string, unknown>) => json(409, body);

const delay = () => new Promise((r) => setTimeout(r, 120 + Math.random() * 200));

const t = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
const d = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

interface Ctx {
  db: MockDb;
  user: MockUser;
  role: Role;
  emp: Omit<Employee, "role">;
}

function authenticate(db: MockDb, init: RequestInit): Ctx | null {
  const headers = new Headers(init.headers);
  const raw = headers.get("Authorization") ?? "";
  const token = raw.startsWith("Bearer ") ? raw.slice(7) : null;
  if (!token) return null;
  const parts = token.split(".");
  if (parts[0] !== "mock" || parts.length < 4) return null;
  const userId = Number(parts[1]);
  const role = parts[2] as Role;
  const exp = Number(parts[3]);
  if (!userId || !exp || Date.now() > exp) return null;
  const user = db.users.find((u) => u.id === userId && u.isActive);
  const emp = db.employees.find((e) => e.userId === userId);
  if (!user || !emp) return null;
  return { db, user, role, emp };
}

function issueTokens(db: MockDb, user: MockUser) {
  const access = `mock.${user.id}.${user.role}.${Date.now() + ACCESS_TTL}.${Math.random().toString(36).slice(2)}`;
  const refresh = `r.${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now()}`;
  db.refreshTokens.push({ token: refresh, userId: user.id, expiresAt: Date.now() + REFRESH_TTL, revoked: false });
  return { access, refresh };
}

// ---- lookups & enrichment -------------------------------------------------------

const empName = (db: MockDb, id: number | null | undefined) =>
  db.employees.find((e) => e.id === id)?.name ?? "Unknown";
const deptName = (db: MockDb, id: number | null | undefined) =>
  db.departments.find((x) => x.id === id)?.name ?? "Unknown";
const assetRef = (db: MockDb, id: number) => {
  const a = db.assets.find((x) => x.id === id);
  return a ? { id: a.id, assetTag: a.assetTag, name: a.name } : { id, assetTag: "?", name: "Unknown" };
};
const activeAlloc = (db: MockDb, assetId: number) =>
  db.allocations.find((a) => a.assetId === assetId && a.status === "ACTIVE");
const holderName = (db: MockDb, a: Allocation) =>
  a.holderEmployeeId ? empName(db, a.holderEmployeeId) : `${deptName(db, a.holderDepartmentId)} (department)`;
const holderDeptId = (db: MockDb, a: Allocation): number | null =>
  a.holderDepartmentId ?? db.employees.find((e) => e.id === a.holderEmployeeId)?.departmentId ?? null;

function enrichAsset(db: MockDb, a: Asset): Asset {
  const act = activeAlloc(db, a.id);
  return {
    ...a,
    categoryName: db.categories.find((c) => c.id === a.categoryId)?.name,
    currentHolder: act
      ? {
          type: act.holderEmployeeId ? "EMPLOYEE" : "DEPARTMENT",
          id: (act.holderEmployeeId ?? act.holderDepartmentId)!,
          name: holderName(db, act),
          since: act.allocatedAt,
        }
      : null,
  };
}

const enrichAllocation = (db: MockDb, a: Allocation): Allocation => ({
  ...a,
  asset: assetRef(db, a.assetId),
  holderName: holderName(db, a),
  allocatedByName: empName(db, a.allocatedBy),
});

function enrichTransfer(db: MockDb, tr: TransferRequest): TransferRequest {
  const from = tr.fromAllocationId ? db.allocations.find((a) => a.id === tr.fromAllocationId) : activeAlloc(db, tr.assetId);
  return {
    ...tr,
    asset: assetRef(db, tr.assetId),
    fromHolderName: from ? holderName(db, from) : undefined,
    requestedByName: empName(db, tr.requestedBy),
    toName: tr.toEmployeeId ? empName(db, tr.toEmployeeId) : `${deptName(db, tr.toDepartmentId)} (department)`,
    decidedByName: tr.decidedBy ? empName(db, tr.decidedBy) : undefined,
    departmentId: from ? holderDeptId(db, from) : null,
  };
}

function bookingStatus(b: Booking): BookingStatus {
  if (b.status === "CANCELLED") return "CANCELLED";
  const now = Date.now();
  if (now < +new Date(b.start)) return "UPCOMING";
  if (now >= +new Date(b.end)) return "COMPLETED";
  return "ONGOING";
}

const enrichBooking = (db: MockDb, b: Booking): Booking => ({
  ...b,
  status: bookingStatus(b),
  resource: assetRef(db, b.resourceId),
  bookedByName: empName(db, b.bookedBy),
});

const liveBooking = (b: Booking) => {
  const s = bookingStatus(b);
  return s === "UPCOMING" || s === "ONGOING";
};

// ---- side effects ---------------------------------------------------------------

function notify(db: MockDb, recipientId: number, type: string, message: string, refType: NotificationItem["refType"], refId: number | null) {
  db.notifications.push({
    id: nextId(db), recipientId, type, message, refType, refId,
    isRead: false, createdAt: new Date().toISOString(),
  });
  setTimeout(() => mockBus.emit("notification"), 30);
}

const notifyManagers = (db: MockDb, type: string, message: string, refType: NotificationItem["refType"], refId: number | null, excludeEmp?: number) => {
  for (const u of db.users) {
    if (u.role !== "ASSET_MANAGER" && u.role !== "ADMIN") continue;
    const emp = db.employees.find((e) => e.userId === u.id);
    if (emp && emp.id !== excludeEmp) notify(db, emp.id, type, message, refType, refId);
  }
};

const act = (db: MockDb, actorId: number, action: string, entityType: string, entityId: number, detail: string) =>
  db.activity.push({ id: nextId(db), actorId, action, entityType, entityId, detail, createdAt: new Date().toISOString() });

const hist = (db: MockDb, assetId: number, eventType: string, detail: string, actorId: number) =>
  db.history.push({ id: nextId(db), assetId, eventType, detail, actorId, occurredAt: new Date().toISOString() });

// ---- asset state machine (phase-3 transition table) -------------------------------

const TRANSITIONS: Partial<Record<AssetStatus, Partial<Record<string, AssetStatus>>>> = {
  AVAILABLE: { ALLOCATE: "ALLOCATED", RESERVE: "RESERVED", START_MAINTENANCE: "UNDER_MAINTENANCE", MARK_LOST: "LOST", RETIRE: "RETIRED" },
  ALLOCATED: { RETURN: "AVAILABLE", START_MAINTENANCE: "UNDER_MAINTENANCE", MARK_LOST: "LOST" },
  RESERVED: { ALLOCATE: "ALLOCATED", RELEASE_RESERVATION: "AVAILABLE", MARK_LOST: "LOST" },
  UNDER_MAINTENANCE: { RESOLVE_MAINTENANCE: "AVAILABLE" },
  RETIRED: { DISPOSE: "DISPOSED" },
};

/** Returns the new status, or null if the transition is illegal. */
function transition(asset: Asset, event: string): AssetStatus | null {
  const to = TRANSITIONS[asset.status]?.[event];
  if (!to) return null;
  asset.status = to;
  return to;
}

const statusLabel = (s: AssetStatus) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ");

// ---- scoping helpers --------------------------------------------------------------

const isManager = (role: Role) => role === "ASSET_MANAGER" || role === "ADMIN";
const empDept = (db: MockDb, empId: number | null) =>
  db.employees.find((e) => e.id === empId)?.departmentId ?? null;

function allocationVisible(ctx: Ctx, a: Allocation): boolean {
  if (isManager(ctx.role)) return true;
  if (ctx.role === "DEPARTMENT_HEAD") return holderDeptId(ctx.db, a) === ctx.emp.departmentId || a.holderEmployeeId === ctx.emp.id;
  return a.holderEmployeeId === ctx.emp.id;
}

function transferVisible(ctx: Ctx, tr: TransferRequest): boolean {
  if (isManager(ctx.role)) return true;
  if (tr.requestedBy === ctx.emp.id) return true;
  if (ctx.role === "DEPARTMENT_HEAD") {
    const from = tr.fromAllocationId ? ctx.db.allocations.find((a) => a.id === tr.fromAllocationId) : activeAlloc(ctx.db, tr.assetId);
    const dept = from ? holderDeptId(ctx.db, from) : null;
    return dept === ctx.emp.departmentId || tr.toDepartmentId === ctx.emp.departmentId;
  }
  return false;
}

function canDecideTransfer(ctx: Ctx, tr: TransferRequest): boolean {
  if (isManager(ctx.role)) return true;
  if (ctx.role !== "DEPARTMENT_HEAD") return false;
  const from = tr.fromAllocationId ? ctx.db.allocations.find((a) => a.id === tr.fromAllocationId) : activeAlloc(ctx.db, tr.assetId);
  return !!from && holderDeptId(ctx.db, from) === ctx.emp.departmentId;
}

// ---- CSV ---------------------------------------------------------------------------

const csv = (rows: (string | number)[][]) =>
  rows.map((r) => r.map((c) => (typeof c === "string" && /[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : String(c))).join(",")).join("\n");

const csvResponse = (text: string) => new Response(text, { status: 200, headers: { "Content-Type": "text/csv" } });

// ---- reports data (shared by JSON + export endpoints) ------------------------------

function utilizationData(db: MockDb) {
  const now = Date.now();
  const denom = Math.max(1, db.assets.filter((a) => !["RETIRED", "DISPOSED", "LOST"].includes(a.status)).length);
  const trend = Array.from({ length: 12 }, (_, i) => {
    const weekStart = now - (11 - i) * 7 * 86_400_000;
    const weekEnd = weekStart + 7 * 86_400_000;
    const activeCount = db.allocations.filter((a) => {
      const s = +new Date(a.allocatedAt);
      const e = a.returnedAt ? +new Date(a.returnedAt) : now;
      return s < weekEnd && e > weekStart;
    }).length;
    return { weekStart: new Date(weekStart).toISOString(), utilizationPct: Math.min(100, Math.round((100 * activeCount) / denom)) };
  });
  const byAsset = new Map<number, { n: number; days: number }>();
  for (const a of db.allocations) {
    const cur = byAsset.get(a.assetId) ?? { n: 0, days: 0 };
    cur.n += 1;
    cur.days += Math.max(1, Math.round(((a.returnedAt ? +new Date(a.returnedAt) : now) - +new Date(a.allocatedAt)) / 86_400_000));
    byAsset.set(a.assetId, cur);
  }
  const usage = (id: number) => {
    const u = byAsset.get(id) ?? { n: 0, days: 0 };
    const ref = assetRef(db, id);
    return { assetId: id, assetTag: ref.assetTag, name: ref.name, allocations: u.n, daysHeld: u.days };
  };
  const mostUsed = [...byAsset.entries()].sort((x, y) => y[1].n - x[1].n).slice(0, 5).map(([id]) => usage(id));
  const cutoff = now - 60 * 86_400_000;
  const idle = db.assets
    .filter((a) => a.status === "AVAILABLE" && !db.allocations.some((al) => al.assetId === a.id && +new Date(al.allocatedAt) > cutoff))
    .slice(0, 5)
    .map((a) => usage(a.id));
  return { trend, mostUsed, idle };
}

function maintFrequencyData(db: MockDb) {
  const byCat = new Map<string, { count: number; open: number }>();
  for (const m of db.maintenance) {
    const asset = db.assets.find((a) => a.id === m.assetId);
    const cat = db.categories.find((c) => c.id === asset?.categoryId)?.name ?? "Other";
    const cur = byCat.get(cat) ?? { count: 0, open: 0 };
    cur.count += 1;
    if (!["RESOLVED", "REJECTED"].includes(m.status)) cur.open += 1;
    byCat.set(cat, cur);
  }
  return [...byCat.entries()].map(([key, v]) => ({ key, count: v.count, openCount: v.open })).sort((a, b) => b.count - a.count);
}

function allocationSummaryData(db: MockDb) {
  return db.departments.map((dept) => {
    const rows = db.allocations.filter((a) => a.status === "ACTIVE" && holderDeptId(db, a) === dept.id);
    return {
      departmentId: dept.id,
      departmentName: dept.name,
      activeAllocations: rows.length,
      overdue: rows.filter((a) => a.expectedReturnAt && +new Date(a.expectedReturnAt) < Date.now()).length,
      assetsHeld: new Set(rows.map((a) => a.assetId)).size,
    };
  });
}

function heatmapData(db: MockDb) {
  const hours: number[][] = Array.from({ length: 24 }, () => Array(7).fill(0));
  for (const b of db.bookings) {
    if (b.status === "CANCELLED") continue;
    const s = new Date(b.start);
    const wd = (s.getDay() + 6) % 7; // Mon=0
    const span = Math.min(12, Math.max(1, Math.round((+new Date(b.end) - +s) / 3_600_000)));
    for (let i = 0; i < span; i++) {
      const h = s.getHours() + i;
      if (h < 24) hours[h]![wd] = (hours[h]![wd] ?? 0) + 1;
    }
  }
  const max = Math.max(1, ...hours.flat());
  return { hours, hourRange: [7, 20] as [number, number], max };
}

// ---- the router --------------------------------------------------------------------

export async function mockFetch(path: string, init: RequestInit = {}): Promise<Response> {
  await delay();
  const db = getDb();
  const method = (init.method ?? "GET").toUpperCase();
  const url = new URL(path, "http://mock.local");
  const p = url.pathname;
  const q = url.searchParams;
  const body: Record<string, unknown> = init.body ? JSON.parse(init.body as string) : {};

  try {
    const res = route(db, method, p, q, body, init);
    if (method !== "GET") saveDb();
    return res;
  } catch (e) {
    console.error("[mock] handler error", method, p, e);
    return json(500, { message: "Mock handler error — see console" });
  }
}

function route(db: MockDb, method: string, p: string, q: URLSearchParams, body: Record<string, unknown>, init: RequestInit): Response {
  const M = (re: RegExp) => p.match(re);
  let m: RegExpMatchArray | null;

  // ---------- auth ----------
  if (p === "/auth/login" && method === "POST") {
    const user = db.users.find((u) => u.email.toLowerCase() === String(body.email ?? "").toLowerCase());
    if (!user || user.password !== body.password || !user.isActive)
      return unauthorized("Incorrect email or password — check both and try again");
    return ok(issueTokens(db, user));
  }

  if (p === "/auth/signup" && method === "POST") {
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!body.name || !email || !body.password) return bad("Name, email and password are required");
    if (String(body.password).length < 8) return bad("Password must be at least 8 characters");
    if (db.users.some((u) => u.email.toLowerCase() === email))
      return conflict({ message: "An account with this email already exists — sign in instead" });
    const departmentId = Number(body.departmentId);
    if (!db.departments.some((x) => x.id === departmentId && x.status === "ACTIVE"))
      return bad("Pick a department");
    // Role is hardcoded EMPLOYEE — no request field can change it.
    const id = nextId(db);
    db.users.push({ id, email, password: String(body.password), role: "EMPLOYEE", isActive: true });
    db.employees.push({ id, userId: id, name: String(body.name).trim(), email, departmentId, status: "ACTIVE" });
    return json(201, {});
  }

  if (p === "/auth/refresh" && method === "POST") {
    const row = db.refreshTokens.find((r) => r.token === body.refresh);
    if (!row || row.revoked || row.expiresAt < Date.now()) return unauthorized("Session expired");
    row.revoked = true; // single-use, rotated
    const user = db.users.find((u) => u.id === row.userId && u.isActive);
    if (!user) return unauthorized("Session expired");
    saveDb();
    return ok(issueTokens(db, user));
  }

  if (p === "/auth/forgot" && method === "POST") {
    const user = db.users.find((u) => u.email.toLowerCase() === String(body.email ?? "").toLowerCase());
    if (user) {
      const token = `reset.${Math.random().toString(36).slice(2)}`;
      db.resetTokens.push({ token, userId: user.id, expiresAt: Date.now() + 3_600_000, used: false });
      saveDb();
      // Mock convenience: the real backend logs/emails this link instead.
      return ok({ resetToken: token });
    }
    return ok({}); // never reveal whether an email exists
  }

  if (p === "/auth/reset" && method === "POST") {
    const row = db.resetTokens.find((r) => r.token === body.token);
    if (!row || row.used || row.expiresAt < Date.now())
      return bad("This reset link has expired or was already used — request a new one");
    if (String(body.newPassword ?? "").length < 8) return bad("Password must be at least 8 characters");
    row.used = true;
    db.users.find((u) => u.id === row.userId)!.password = String(body.newPassword);
    return ok({});
  }

  // Public reference data: the signup form needs the department list pre-auth.
  if (p === "/api/departments" && method === "GET") return ok(db.departments);

  // Everything below requires a session.
  const ctx = authenticate(db, init);

  if (p === "/auth/logout" && method === "POST") {
    if (ctx) db.refreshTokens.forEach((r) => { if (r.userId === ctx.user.id) r.revoked = true; });
    return noContent();
  }

  if (!ctx) return unauthorized();

  if (p === "/auth/me" && method === "GET") {
    return ok({
      id: ctx.user.id,
      email: ctx.user.email,
      role: ctx.role,
      name: ctx.emp.name,
      employeeId: ctx.emp.id,
      departmentId: ctx.emp.departmentId,
    });
  }

  if (p === "/api/health") return ok({ status: "ok" });

  // ---------- departments ----------
  if (p === "/api/departments" && method === "POST") {
    if (ctx.role !== "ADMIN") return forbidden();
    const name = String(body.name ?? "").trim();
    if (!name) return bad("Department name is required");
    if (db.departments.some((x) => x.name.toLowerCase() === name.toLowerCase()))
      return conflict({ message: `A department named "${name}" already exists` });
    const dept = {
      id: nextId(db), name,
      parentDepartmentId: (body.parentDepartmentId as number) ?? null,
      headEmployeeId: (body.headEmployeeId as number) ?? null,
      status: "ACTIVE" as const,
    };
    db.departments.push(dept);
    act(db, ctx.emp.id, "DEPT_CREATE", "department", dept.id, `Created department ${name}`);
    return json(201, dept);
  }

  if ((m = M(/^\/api\/departments\/(\d+)$/)) && method === "PUT") {
    if (ctx.role !== "ADMIN") return forbidden();
    const dept = db.departments.find((x) => x.id === Number(m![1]));
    if (!dept) return notFound();
    const newParent = body.parentDepartmentId === undefined ? dept.parentDepartmentId : (body.parentDepartmentId as number | null);
    if (newParent !== null) {
      // Cycle guard — walk up from the proposed parent; reaching self = cycle.
      if (newParent === dept.id) return bad("A department cannot be its own parent");
      let cursor: number | null = newParent;
      let guard = 0;
      while (cursor !== null) {
        if (cursor === dept.id) return bad("Cyclic department hierarchy — pick a parent outside this department's subtree");
        if (++guard > 1000) return bad("Hierarchy too deep");
        cursor = db.departments.find((x) => x.id === cursor)?.parentDepartmentId ?? null;
      }
    }
    if (body.name !== undefined) dept.name = String(body.name).trim();
    dept.parentDepartmentId = newParent;
    if (body.headEmployeeId !== undefined) dept.headEmployeeId = body.headEmployeeId as number | null;
    act(db, ctx.emp.id, "DEPT_UPDATE", "department", dept.id, `Updated department ${dept.name}`);
    return ok(dept);
  }

  if ((m = M(/^\/api\/departments\/(\d+)\/status$/)) && method === "PATCH") {
    if (ctx.role !== "ADMIN") return forbidden();
    const dept = db.departments.find((x) => x.id === Number(m![1]));
    if (!dept) return notFound();
    const status = body.status as "ACTIVE" | "INACTIVE";
    if (status === "INACTIVE") {
      const members = db.employees.filter((e) => e.departmentId === dept.id && e.status === "ACTIVE").length;
      if (members > 0)
        return conflict({ message: `${members} active employee${members > 1 ? "s are" : " is"} in ${dept.name} — move them to another department first` });
    }
    dept.status = status;
    act(db, ctx.emp.id, "DEPT_STATUS", "department", dept.id, `${dept.name} → ${status}`);
    return ok(dept);
  }

  // ---------- categories ----------
  if (p === "/api/categories" && method === "GET") return ok(db.categories);

  if (p === "/api/categories" && method === "POST") {
    if (ctx.role !== "ADMIN") return forbidden();
    const name = String(body.name ?? "").trim();
    if (!name) return bad("Category name is required");
    if (db.categories.some((c) => c.name.toLowerCase() === name.toLowerCase()))
      return conflict({ message: `A category named "${name}" already exists` });
    const cat = { id: nextId(db), name, customFields: (body.customFields as Record<string, "string" | "number" | "date" | "boolean">) ?? {}, isActive: true };
    db.categories.push(cat);
    act(db, ctx.emp.id, "CATEGORY_CREATE", "category", cat.id, `Created category ${name}`);
    return json(201, cat);
  }

  if ((m = M(/^\/api\/categories\/(\d+)$/)) && method === "PUT") {
    if (ctx.role !== "ADMIN") return forbidden();
    const cat = db.categories.find((c) => c.id === Number(m![1]));
    if (!cat) return notFound();
    if (body.name !== undefined) cat.name = String(body.name).trim();
    if (body.customFields !== undefined) cat.customFields = body.customFields as typeof cat.customFields;
    act(db, ctx.emp.id, "CATEGORY_UPDATE", "category", cat.id, `Updated category ${cat.name}`);
    return ok(cat);
  }

  if ((m = M(/^\/api\/categories\/(\d+)\/status$/)) && method === "PATCH") {
    if (ctx.role !== "ADMIN") return forbidden();
    const cat = db.categories.find((c) => c.id === Number(m![1]));
    if (!cat) return notFound();
    cat.isActive = Boolean(body.isActive);
    return ok(cat);
  }

  // ---------- employees ----------
  if (p === "/api/employees" && method === "GET") {
    const withRole = (e: Omit<Employee, "role">): Employee => ({
      ...e,
      role: db.users.find((u) => u.id === e.userId)?.role ?? "EMPLOYEE",
    });
    let rows = db.employees.map(withRole);
    const qq = q.get("q")?.toLowerCase();
    if (qq) rows = rows.filter((e) => e.name.toLowerCase().includes(qq) || e.email.toLowerCase().includes(qq));
    if (q.get("department")) rows = rows.filter((e) => e.departmentId === Number(q.get("department")));
    if (q.get("role")) rows = rows.filter((e) => e.role === q.get("role"));
    return ok(rows);
  }

  if ((m = M(/^\/api\/employees\/(\d+)\/role$/)) && method === "PATCH") {
    if (ctx.role !== "ADMIN") return forbidden("Only admins can change roles");
    const emp = db.employees.find((e) => e.id === Number(m![1]));
    const user = emp && db.users.find((u) => u.id === emp.userId);
    if (!emp || !user) return notFound();
    const newRole = body.newRole as Role;
    if (!["EMPLOYEE", "DEPARTMENT_HEAD", "ASSET_MANAGER", "ADMIN"].includes(newRole)) return bad("Unknown role");
    if (user.role === "ADMIN" && newRole !== "ADMIN" && db.users.filter((u) => u.role === "ADMIN" && u.isActive).length <= 1)
      return conflict({ message: "Cannot demote the only remaining admin — promote someone else to Admin first" });
    const prev = user.role;
    user.role = newRole;
    act(db, ctx.emp.id, "ROLE_CHANGE", "employee", emp.id, `role ${prev} → ${newRole}`);
    return noContent();
  }

  if ((m = M(/^\/api\/employees\/(\d+)\/department$/)) && method === "PATCH") {
    if (ctx.role !== "ADMIN") return forbidden();
    const emp = db.employees.find((e) => e.id === Number(m![1]));
    if (!emp) return notFound();
    emp.departmentId = (body.departmentId as number) ?? null;
    act(db, ctx.emp.id, "DEPT_ASSIGN", "employee", emp.id, `${emp.name} → ${deptName(db, emp.departmentId)}`);
    return ok(emp);
  }

  if ((m = M(/^\/api\/employees\/(\d+)\/status$/)) && method === "PATCH") {
    if (ctx.role !== "ADMIN") return forbidden();
    const emp = db.employees.find((e) => e.id === Number(m![1]));
    if (!emp) return notFound();
    emp.status = body.status as "ACTIVE" | "INACTIVE";
    const user = db.users.find((u) => u.id === emp.userId);
    if (user) user.isActive = emp.status === "ACTIVE";
    act(db, ctx.emp.id, "EMPLOYEE_STATUS", "employee", emp.id, `${emp.name} → ${emp.status}`);
    return ok(emp);
  }

  // ---------- assets ----------
  if (p === "/api/assets" && method === "GET") {
    let rows = db.assets.slice();
    const f = (k: string) => q.get(k);
    if (f("q")) {
      const s = f("q")!.toLowerCase();
      rows = rows.filter((a) => a.name.toLowerCase().includes(s) || a.assetTag.toLowerCase().includes(s) || a.serialNumber?.toLowerCase().includes(s));
    }
    if (f("tag")) rows = rows.filter((a) => a.assetTag.toLowerCase().includes(f("tag")!.toLowerCase()));
    if (f("serial")) rows = rows.filter((a) => a.serialNumber?.toLowerCase().includes(f("serial")!.toLowerCase()));
    if (f("category")) rows = rows.filter((a) => a.categoryId === Number(f("category")));
    if (f("status")) rows = rows.filter((a) => a.status === f("status"));
    if (f("location")) rows = rows.filter((a) => a.location?.toLowerCase().includes(f("location")!.toLowerCase()));
    if (f("bookable")) rows = rows.filter((a) => a.isBookable === (f("bookable") === "true"));
    if (f("department")) {
      const deptId = Number(f("department"));
      rows = rows.filter((a) => {
        const al = activeAlloc(db, a.id);
        return al ? holderDeptId(db, al) === deptId : false;
      });
    }
    const [field = "assetTag", dir = "asc"] = (f("sort") ?? "assetTag,asc").split(",");
    const keyOf = (a: Asset): string | number => {
      switch (field) {
        case "name": return a.name.toLowerCase();
        case "status": return a.status;
        case "location": return a.location ?? "";
        case "acquisitionCost": return a.acquisitionCost ?? 0;
        case "acquisitionDate": return a.acquisitionDate ?? "";
        default: return a.assetTag;
      }
    };
    rows.sort((a, b) => (keyOf(a) < keyOf(b) ? -1 : keyOf(a) > keyOf(b) ? 1 : 0) * (dir === "desc" ? -1 : 1));
    const size = Math.max(1, Number(f("size") ?? 20));
    const page = Math.max(0, Number(f("page") ?? 0));
    const content = rows.slice(page * size, page * size + size).map((a) => enrichAsset(db, a));
    return ok({ content, totalElements: rows.length, totalPages: Math.max(1, Math.ceil(rows.length / size)), number: page, size });
  }

  if (p === "/api/assets" && method === "POST") {
    if (!isManager(ctx.role)) return forbidden("Only asset managers can register assets");
    if (!body.name || !body.categoryId) return bad("Name and category are required");
    if (body.serialNumber && db.assets.some((a) => a.serialNumber === body.serialNumber))
      return conflict({ message: `Serial ${body.serialNumber} is already registered — serials must be unique` });
    const tagN = db.seq.tag++;
    const asset: Asset = {
      id: nextId(db),
      assetTag: `AF-${String(tagN).padStart(4, "0")}`,
      name: String(body.name).trim(),
      categoryId: Number(body.categoryId),
      serialNumber: (body.serialNumber as string) || null,
      acquisitionDate: (body.acquisitionDate as string) || null,
      acquisitionCost: body.acquisitionCost != null && body.acquisitionCost !== "" ? Number(body.acquisitionCost) : null,
      condition: (body.condition as Asset["condition"]) ?? "GOOD",
      location: (body.location as string) || null,
      isBookable: Boolean(body.isBookable),
      status: "AVAILABLE",
      customValues: (body.customValues as Asset["customValues"]) ?? {},
      photoUrl: (body.photoUrl as string) || null,
      createdAt: new Date().toISOString(),
    };
    db.assets.push(asset);
    hist(db, asset.id, "REGISTERED", `Registered as ${asset.assetTag}`, ctx.emp.id);
    act(db, ctx.emp.id, "REGISTER_ASSET", "asset", asset.id, `Registered ${asset.assetTag} ${asset.name}`);
    return json(201, enrichAsset(db, asset));
  }

  if ((m = M(/^\/api\/assets\/(\d+)$/)) && method === "GET") {
    const asset = db.assets.find((a) => a.id === Number(m![1]));
    return asset ? ok(enrichAsset(db, asset)) : notFound("No such asset");
  }

  if ((m = M(/^\/api\/assets\/(\d+)$/)) && method === "PUT") {
    if (!isManager(ctx.role)) return forbidden();
    const asset = db.assets.find((a) => a.id === Number(m![1]));
    if (!asset) return notFound();
    for (const k of ["name", "categoryId", "serialNumber", "acquisitionDate", "acquisitionCost", "condition", "location", "isBookable", "customValues", "photoUrl"] as const) {
      if (body[k] !== undefined) (asset as unknown as Record<string, unknown>)[k] = body[k];
    }
    act(db, ctx.emp.id, "ASSET_UPDATE", "asset", asset.id, `Edited ${asset.assetTag}`);
    return ok(enrichAsset(db, asset));
  }

  if ((m = M(/^\/api\/assets\/(\d+)\/history$/)) && method === "GET") {
    const rows = db.history
      .filter((h) => h.assetId === Number(m![1]))
      .sort((a, b) => +new Date(b.occurredAt) - +new Date(a.occurredAt))
      .map((h) => ({ ...h, actorName: h.actorId ? empName(db, h.actorId) : null }));
    return ok(rows);
  }

  if ((m = M(/^\/api\/assets\/(\d+)\/(retire|dispose)$/))) {
    if (!isManager(ctx.role)) return forbidden();
    const asset = db.assets.find((a) => a.id === Number(m![1]));
    if (!asset) return notFound();
    const event = m[2] === "retire" ? "RETIRE" : "DISPOSE";
    const fromLabel = statusLabel(asset.status);
    if (!transition(asset, event))
      return conflict({
        message: m[2] === "retire"
          ? `Only available assets can be retired — ${asset.assetTag} is ${fromLabel}`
          : `Only retired assets can be disposed — ${asset.assetTag} is ${fromLabel}`,
      });
    hist(db, asset.id, event === "RETIRE" ? "RETIRED" : "DISPOSED", `${fromLabel} → ${statusLabel(asset.status)}`, ctx.emp.id);
    act(db, ctx.emp.id, event, "asset", asset.id, `${asset.assetTag} ${event.toLowerCase()}d`);
    return ok(enrichAsset(db, asset));
  }

  // ---------- allocations ----------
  if (p === "/api/allocations" && method === "GET") {
    let rows = db.allocations.filter((a) => allocationVisible(ctx, a));
    if (q.get("status")) rows = rows.filter((a) => a.status === q.get("status"));
    if (q.get("assetId")) rows = rows.filter((a) => a.assetId === Number(q.get("assetId")));
    if (q.get("mine") === "true") rows = rows.filter((a) => a.holderEmployeeId === ctx.emp.id);
    rows = rows.slice().sort((a, b) =>
      a.status === b.status ? +new Date(b.allocatedAt) - +new Date(a.allocatedAt) : a.status === "ACTIVE" ? -1 : 1,
    );
    return ok(rows.slice(0, 200).map((a) => enrichAllocation(db, a)));
  }

  if (p === "/api/allocations" && method === "POST") {
    if (!isManager(ctx.role)) return forbidden("Only asset managers can allocate assets");
    const asset = db.assets.find((a) => a.id === Number(body.assetId));
    if (!asset) return notFound("No such asset");
    const holderEmp = (body.holderEmployeeId as number) ?? null;
    const holderDept = (body.holderDepartmentId as number) ?? null;
    if ((holderEmp === null) === (holderDept === null)) return bad("Pick exactly one holder — an employee or a department");

    // The 409 the hero flow reads: who holds it + the transfer offer.
    const existing = activeAlloc(db, asset.id);
    if (existing) {
      return conflict({
        message: `${asset.assetTag} is already allocated`,
        currentHolder: holderName(db, existing),
        canRequestTransfer: true,
        heldSince: existing.allocatedAt,
        assetTag: asset.assetTag,
      });
    }
    if (!transition(asset, "ALLOCATE"))
      return conflict({
        message: `${asset.assetTag} can't be allocated while it's ${statusLabel(asset.status)}`,
        canRequestTransfer: false,
      });

    const alloc: Allocation = {
      id: nextId(db),
      assetId: asset.id,
      holderEmployeeId: holderEmp,
      holderDepartmentId: holderDept,
      allocatedBy: ctx.emp.id,
      allocatedAt: new Date().toISOString(),
      expectedReturnAt: (body.expectedReturnAt as string) || null,
      returnedAt: null,
      returnCondition: null,
      returnNotes: null,
      status: "ACTIVE",
    };
    db.allocations.push(alloc);
    hist(db, asset.id, "ALLOCATED", `Allocated to ${holderName(db, alloc)}`, ctx.emp.id);
    act(db, ctx.emp.id, "ALLOCATE", "asset", asset.id, `Allocated ${asset.assetTag} to ${holderName(db, alloc)}`);
    if (holderEmp) notify(db, holderEmp, "ASSET_ASSIGNED", `${asset.assetTag} ${asset.name} assigned to you`, "asset", asset.id);
    return json(201, enrichAllocation(db, alloc));
  }

  if ((m = M(/^\/api\/allocations\/(\d+)\/return$/)) && method === "PATCH") {
    const alloc = db.allocations.find((a) => a.id === Number(m![1]));
    if (!alloc) return notFound();
    const inScope =
      isManager(ctx.role) ||
      alloc.holderEmployeeId === ctx.emp.id ||
      (ctx.role === "DEPARTMENT_HEAD" && holderDeptId(db, alloc) === ctx.emp.departmentId);
    if (!inScope) return forbidden();
    if (alloc.status !== "ACTIVE") return conflict({ message: "This allocation was already returned" });
    const asset = db.assets.find((a) => a.id === alloc.assetId)!;
    if (asset.status === "ALLOCATED" && !transition(asset, "RETURN"))
      return conflict({ message: `${asset.assetTag} can't be returned right now (${statusLabel(asset.status)})` });
    alloc.status = "RETURNED";
    alloc.returnedAt = new Date().toISOString();
    alloc.returnCondition = (body.condition as Allocation["returnCondition"]) ?? "GOOD";
    alloc.returnNotes = (body.notes as string) || null;
    if (alloc.returnCondition === "DAMAGED" || alloc.returnCondition === "POOR") asset.condition = alloc.returnCondition;
    hist(db, asset.id, "RETURNED", `Returned by ${holderName(db, alloc)} — condition ${alloc.returnCondition}`, ctx.emp.id);
    act(db, ctx.emp.id, "RETURN", "asset", asset.id, `${asset.assetTag} returned — condition ${alloc.returnCondition}`);
    if (alloc.allocatedBy !== ctx.emp.id)
      notify(db, alloc.allocatedBy, "ASSET_RETURNED", `${asset.assetTag} returned by ${holderName(db, alloc)} — condition ${alloc.returnCondition?.toLowerCase()}`, "asset", asset.id);
    return ok(enrichAllocation(db, alloc));
  }

  // ---------- transfer requests ----------
  if (p === "/api/transfer-requests" && method === "GET") {
    let rows = db.transfers.filter((tr) => transferVisible(ctx, tr));
    if (q.get("status")) rows = rows.filter((tr) => tr.status === q.get("status"));
    if (q.get("mine") === "true") rows = rows.filter((tr) => tr.requestedBy === ctx.emp.id);
    rows = rows.slice().sort((a, b) =>
      a.status === b.status ? +new Date(b.createdAt) - +new Date(a.createdAt) : a.status === "REQUESTED" ? -1 : 1,
    );
    return ok(rows.map((tr) => enrichTransfer(db, tr)));
  }

  if (p === "/api/transfer-requests" && method === "POST") {
    const asset = db.assets.find((a) => a.id === Number(body.assetId));
    if (!asset) return notFound("No such asset");
    const from = activeAlloc(db, asset.id);
    if (!from)
      return conflict({ message: `${asset.assetTag} isn't currently allocated — ask an asset manager to allocate it directly` });
    if (db.transfers.some((tr) => tr.assetId === asset.id && tr.requestedBy === ctx.emp.id && tr.status === "REQUESTED"))
      return conflict({ message: "You already have a pending transfer request for this asset" });
    const toEmp = (body.toEmployeeId as number) ?? ((body.toDepartmentId as number) ? null : ctx.emp.id);
    const tr: TransferRequest = {
      id: nextId(db),
      assetId: asset.id,
      fromAllocationId: from.id,
      requestedBy: ctx.emp.id,
      toEmployeeId: toEmp,
      toDepartmentId: (body.toDepartmentId as number) ?? null,
      reason: (body.reason as string) || null,
      status: "REQUESTED",
      decidedBy: null,
      createdAt: new Date().toISOString(),
      decidedAt: null,
    };
    db.transfers.push(tr);
    const toName = tr.toEmployeeId ? empName(db, tr.toEmployeeId) : deptName(db, tr.toDepartmentId);
    act(db, ctx.emp.id, "TRANSFER_REQUEST", "transfer", tr.id, `${asset.assetTag} → ${toName}`);
    notifyManagers(db, "TRANSFER_REQUESTED", `Transfer requested: ${asset.assetTag} ${asset.name} → ${toName}`, "transfer", tr.id, ctx.emp.id);
    const headDept = holderDeptId(db, from);
    const head = db.departments.find((x) => x.id === headDept)?.headEmployeeId;
    if (head && head !== ctx.emp.id) notify(db, head, "TRANSFER_REQUESTED", `Transfer requested: ${asset.assetTag} → ${toName}`, "transfer", tr.id);
    return json(201, enrichTransfer(db, tr));
  }

  if ((m = M(/^\/api\/transfer-requests\/(\d+)\/(approve|reject)$/)) && method === "PATCH") {
    const tr = db.transfers.find((x) => x.id === Number(m![1]));
    if (!tr) return notFound();
    if (!canDecideTransfer(ctx, tr))
      return forbidden("Only asset managers, admins, or the holding department's head can decide transfers");
    if (tr.status !== "REQUESTED") return conflict({ message: "This request was already decided" });
    const asset = db.assets.find((a) => a.id === tr.assetId)!;
    const toName = tr.toEmployeeId ? empName(db, tr.toEmployeeId) : `${deptName(db, tr.toDepartmentId)} (department)`;

    if (m[2] === "reject") {
      tr.status = "REJECTED";
      tr.decidedBy = ctx.emp.id;
      tr.decidedAt = new Date().toISOString();
      act(db, ctx.emp.id, "TRANSFER_REJECT", "transfer", tr.id, `${asset.assetTag} → ${toName} rejected`);
      notify(db, tr.requestedBy, "TRANSFER_REJECTED", `Transfer request for ${asset.assetTag} was rejected`, "transfer", tr.id);
      return ok(enrichTransfer(db, tr));
    }

    // Approve: close the old allocation and open the new one in one step —
    // never two ACTIVE rows (mirrors the DB's partial unique index).
    const current = activeAlloc(db, asset.id);
    let oldHolderEmp: number | null = null;
    if (current) {
      oldHolderEmp = current.holderEmployeeId;
      current.status = "RETURNED";
      current.returnedAt = new Date().toISOString();
      current.returnNotes = "Transferred";
    } else if (!transition(asset, "ALLOCATE")) {
      return conflict({ message: `${asset.assetTag} is ${statusLabel(asset.status)} — it can't be transferred right now` });
    }
    const alloc: Allocation = {
      id: nextId(db),
      assetId: asset.id,
      holderEmployeeId: tr.toEmployeeId,
      holderDepartmentId: tr.toDepartmentId,
      allocatedBy: ctx.emp.id,
      allocatedAt: new Date().toISOString(),
      expectedReturnAt: null,
      returnedAt: null,
      returnCondition: null,
      returnNotes: null,
      status: "ACTIVE",
    };
    db.allocations.push(alloc);
    tr.status = "APPROVED";
    tr.decidedBy = ctx.emp.id;
    tr.decidedAt = new Date().toISOString();
    hist(db, asset.id, "TRANSFERRED", `Transferred to ${toName}`, ctx.emp.id);
    act(db, ctx.emp.id, "TRANSFER_APPROVE", "transfer", tr.id, `${asset.assetTag} → ${toName}`);
    notify(db, tr.requestedBy, "TRANSFER_APPROVED", `Transfer approved — ${asset.assetTag} is now held by ${toName}`, "transfer", tr.id);
    if (oldHolderEmp && oldHolderEmp !== tr.requestedBy)
      notify(db, oldHolderEmp, "TRANSFER_APPROVED", `${asset.assetTag} ${asset.name} was transferred to ${toName}`, "transfer", tr.id);
    return ok(enrichTransfer(db, tr));
  }

  // ---------- bookings ----------
  if (p === "/api/bookings" && method === "GET") {
    let rows = db.bookings.slice();
    if (q.get("resourceId")) rows = rows.filter((b) => b.resourceId === Number(q.get("resourceId")));
    if (q.get("mine") === "true") rows = rows.filter((b) => b.bookedBy === ctx.emp.id);
    const from = q.get("from");
    const to = q.get("to");
    if (from) rows = rows.filter((b) => +new Date(b.end) > +new Date(from));
    if (to) rows = rows.filter((b) => +new Date(b.start) < +new Date(to));
    rows.sort((a, b) => +new Date(a.start) - +new Date(b.start));
    return ok(rows.slice(0, 500).map((b) => enrichBooking(db, b)));
  }

  if (p === "/api/bookings" && method === "POST") {
    const resource = db.assets.find((a) => a.id === Number(body.resourceId));
    if (!resource) return notFound("No such resource");
    if (!resource.isBookable) return conflict({ message: `${resource.assetTag} isn't a bookable resource` });
    const start = String(body.start ?? "");
    const end = String(body.end ?? "");
    if (!start || !end || +new Date(start) >= +new Date(end)) return bad("Start must be before end");
    if (+new Date(start) < Date.now() - 60_000) return bad("That slot is in the past — pick an upcoming time");
    // [start, end) — same-boundary slots don't clash; overlapping ones do.
    const clash = db.bookings.find(
      (b) => b.resourceId === resource.id && liveBooking(b) && overlaps(+new Date(start), +new Date(end), +new Date(b.start), +new Date(b.end)),
    );
    if (clash)
      return conflict({
        message: `That slot overlaps an existing booking (${d(clash.start)} ${t(clash.start)}–${t(clash.end)}). Pick another time.`,
        conflict: { start: clash.start, end: clash.end },
      });
    const booking: Booking = {
      id: nextId(db),
      resourceId: resource.id,
      bookedBy: ctx.emp.id,
      onBehalfOfDepartmentId: (body.onBehalfOfDepartmentId as number) ?? null,
      start,
      end,
      status: "UPCOMING",
      createdAt: new Date().toISOString(),
    };
    db.bookings.push(booking);
    act(db, ctx.emp.id, "BOOK", "booking", booking.id, `${resource.assetTag} ${d(start)} ${t(start)}–${t(end)}`);
    notify(db, ctx.emp.id, "BOOKING_CONFIRMED", `Booking confirmed: ${resource.name}, ${d(start)} ${t(start)}–${t(end)}`, "booking", booking.id);
    return json(201, enrichBooking(db, booking));
  }

  if ((m = M(/^\/api\/bookings\/(\d+)\/cancel$/)) && method === "PATCH") {
    const booking = db.bookings.find((b) => b.id === Number(m![1]));
    if (!booking) return notFound();
    const allowed = booking.bookedBy === ctx.emp.id || isManager(ctx.role) ||
      (ctx.role === "DEPARTMENT_HEAD" && booking.onBehalfOfDepartmentId === ctx.emp.departmentId);
    if (!allowed) return forbidden("Only the booker or a manager can cancel this booking");
    if (!liveBooking(booking)) return conflict({ message: "Only upcoming or ongoing bookings can be cancelled" });
    booking.status = "CANCELLED";
    const resource = assetRef(db, booking.resourceId);
    act(db, ctx.emp.id, "BOOKING_CANCEL", "booking", booking.id, `${resource.assetTag} ${d(booking.start)} ${t(booking.start)}–${t(booking.end)}`);
    if (booking.bookedBy !== ctx.emp.id)
      notify(db, booking.bookedBy, "BOOKING_CANCELLED", `Booking cancelled: ${resource.name}, ${d(booking.start)} ${t(booking.start)}–${t(booking.end)}`, "booking", booking.id);
    return ok(enrichBooking(db, booking));
  }

  if ((m = M(/^\/api\/bookings\/(\d+)\/reschedule$/)) && method === "PATCH") {
    const booking = db.bookings.find((b) => b.id === Number(m![1]));
    if (!booking) return notFound();
    if (booking.bookedBy !== ctx.emp.id && !isManager(ctx.role)) return forbidden();
    if (bookingStatus(booking) !== "UPCOMING") return conflict({ message: "Only upcoming bookings can be rescheduled — cancel instead" });
    const start = String(body.start ?? "");
    const end = String(body.end ?? "");
    if (!start || !end || +new Date(start) >= +new Date(end)) return bad("Start must be before end");
    if (+new Date(start) < Date.now() - 60_000) return bad("That slot is in the past — pick an upcoming time");
    const clash = db.bookings.find(
      (b) => b.id !== booking.id && b.resourceId === booking.resourceId && liveBooking(b) &&
        overlaps(+new Date(start), +new Date(end), +new Date(b.start), +new Date(b.end)),
    );
    if (clash)
      return conflict({
        message: `That slot overlaps an existing booking (${d(clash.start)} ${t(clash.start)}–${t(clash.end)}). Pick another time.`,
        conflict: { start: clash.start, end: clash.end },
      });
    booking.start = start;
    booking.end = end;
    const resource = assetRef(db, booking.resourceId);
    act(db, ctx.emp.id, "BOOKING_RESCHEDULE", "booking", booking.id, `${resource.assetTag} → ${d(start)} ${t(start)}–${t(end)}`);
    notify(db, booking.bookedBy, "BOOKING_RESCHEDULED", `Booking moved: ${resource.name}, ${d(start)} ${t(start)}–${t(end)}`, "booking", booking.id);
    return ok(enrichBooking(db, booking));
  }

  // ---------- maintenance ----------
  if (p === "/api/maintenance" && method === "GET") {
    let rows = db.maintenance.slice();
    if (!isManager(ctx.role)) {
      rows = ctx.role === "DEPARTMENT_HEAD"
        ? rows.filter((r) => {
            const raiser = db.employees.find((e) => e.id === r.raisedBy);
            return raiser?.departmentId === ctx.emp.departmentId || r.technicianId === ctx.emp.id || r.raisedBy === ctx.emp.id;
          })
        : rows.filter((r) => r.raisedBy === ctx.emp.id || r.technicianId === ctx.emp.id);
    }
    if (q.get("asset")) rows = rows.filter((r) => r.assetId === Number(q.get("asset")));
    if (q.get("status")) rows = rows.filter((r) => r.status === q.get("status"));
    rows.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    return ok(rows.map((r) => ({
      ...r,
      asset: assetRef(db, r.assetId),
      raisedByName: empName(db, r.raisedBy),
      approvedByName: r.approvedBy ? empName(db, r.approvedBy) : undefined,
      technicianName: r.technicianId ? empName(db, r.technicianId) : undefined,
    })));
  }

  if (p === "/api/maintenance" && method === "POST") {
    const asset = db.assets.find((a) => a.id === Number(body.assetId));
    if (!asset) return notFound("No such asset");
    if (!body.issue) return bad("Describe the issue");
    const row = {
      id: nextId(db), assetId: asset.id, raisedBy: ctx.emp.id,
      issue: String(body.issue), priority: (body.priority as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL") ?? "MEDIUM",
      photoUrl: (body.photoUrl as string) || null, status: "PENDING" as const,
      approvedBy: null, technicianId: null, resolutionNotes: null,
      createdAt: new Date().toISOString(), approvedAt: null, resolvedAt: null,
    };
    db.maintenance.push(row);
    hist(db, asset.id, "MAINT_RAISED", row.issue, ctx.emp.id);
    act(db, ctx.emp.id, "MAINT_RAISE", "maintenance", row.id, `${asset.assetTag}: ${row.issue.slice(0, 60)}`);
    notifyManagers(db, "MAINT_RAISED", `Maintenance raised for ${asset.assetTag} ${asset.name} (${row.priority.toLowerCase()})`, "maintenance", row.id, ctx.emp.id);
    return json(201, row);
  }

  if ((m = M(/^\/api\/maintenance\/(\d+)\/(approve|reject|assign|start|resolve)$/)) && method === "PATCH") {
    const r = db.maintenance.find((x) => x.id === Number(m![1]));
    if (!r) return notFound();
    const action = m[2]!;
    const asset = db.assets.find((a) => a.id === r.assetId)!;
    const needsManager = action === "approve" || action === "reject" || action === "assign" || action === "resolve";
    if (needsManager && !isManager(ctx.role)) return forbidden("Only asset managers can do this");

    if (action === "approve") {
      if (r.status !== "PENDING") return conflict({ message: `Only pending requests can be approved — this one is ${r.status.toLowerCase().replace(/_/g, " ")}` });
      const wasAllocated = asset.status === "ALLOCATED";
      if (!transition(asset, "START_MAINTENANCE"))
        return conflict({ message: `${asset.assetTag} can't go under maintenance while it's ${statusLabel(asset.status)}` });
      if (wasAllocated) {
        const alloc = activeAlloc(db, asset.id);
        if (alloc) {
          alloc.status = "RETURNED";
          alloc.returnedAt = new Date().toISOString();
          alloc.returnNotes = "Taken in for maintenance";
        }
      }
      r.status = "APPROVED";
      r.approvedBy = ctx.emp.id;
      r.approvedAt = new Date().toISOString();
      hist(db, asset.id, "MAINT_APPROVED", r.issue, ctx.emp.id);
      act(db, ctx.emp.id, "MAINT_APPROVE", "maintenance", r.id, `${asset.assetTag}: approved`);
      notify(db, r.raisedBy, "MAINT_APPROVED", `Maintenance approved for ${asset.assetTag} — it's now under maintenance`, "maintenance", r.id);
    } else if (action === "reject") {
      if (r.status !== "PENDING") return conflict({ message: "Only pending requests can be rejected" });
      r.status = "REJECTED";
      r.resolutionNotes = (body.reason as string) || null;
      act(db, ctx.emp.id, "MAINT_REJECT", "maintenance", r.id, `${asset.assetTag}: rejected`);
      notify(db, r.raisedBy, "MAINT_REJECTED", `Maintenance request for ${asset.assetTag} was rejected${r.resolutionNotes ? ` — ${r.resolutionNotes}` : ""}`, "maintenance", r.id);
    } else if (action === "assign") {
      if (r.status !== "APPROVED") return conflict({ message: "Assign a technician after approval" });
      const tech = db.employees.find((e) => e.id === Number(body.technicianId));
      if (!tech) return bad("Pick a technician");
      r.status = "TECHNICIAN_ASSIGNED";
      r.technicianId = tech.id;
      act(db, ctx.emp.id, "MAINT_ASSIGN", "maintenance", r.id, `${asset.assetTag} → ${tech.name}`);
      notify(db, tech.id, "MAINT_ASSIGNED", `You're assigned to fix ${asset.assetTag} ${asset.name}`, "maintenance", r.id);
    } else if (action === "start") {
      if (r.technicianId !== ctx.emp.id && !isManager(ctx.role)) return forbidden("Only the assigned technician can start this");
      if (r.status !== "TECHNICIAN_ASSIGNED") return conflict({ message: "Work starts after a technician is assigned" });
      r.status = "IN_PROGRESS";
      act(db, ctx.emp.id, "MAINT_START", "maintenance", r.id, `${asset.assetTag}: work started`);
    } else {
      if (r.status !== "IN_PROGRESS") return conflict({ message: "Only in-progress work can be resolved" });
      if (!transition(asset, "RESOLVE_MAINTENANCE"))
        return conflict({ message: `${asset.assetTag} isn't under maintenance` });
      r.status = "RESOLVED";
      r.resolutionNotes = (body.notes as string) || null;
      r.resolvedAt = new Date().toISOString();
      hist(db, asset.id, "MAINT_RESOLVED", r.resolutionNotes ?? "Resolved", ctx.emp.id);
      act(db, ctx.emp.id, "MAINT_RESOLVE", "maintenance", r.id, `${asset.assetTag}: resolved`);
      notify(db, r.raisedBy, "MAINT_RESOLVED", `${asset.assetTag} is fixed and available again`, "maintenance", r.id);
    }
    return ok({
      ...r,
      asset: assetRef(db, r.assetId),
      raisedByName: empName(db, r.raisedBy),
      technicianName: r.technicianId ? empName(db, r.technicianId) : undefined,
    });
  }

  // ---------- audits ----------
  const cycleVisible = (c: MockDb["auditCycles"][number]) =>
    isManager(ctx.role) || c.auditorIds.includes(ctx.emp.id) || c.createdBy === ctx.emp.id;

  const enrichCycle = (c: MockDb["auditCycles"][number]) => {
    const items = db.auditItems.filter((i) => i.cycleId === c.id);
    return {
      ...c,
      scopeDepartmentName: c.scopeDepartmentId ? deptName(db, c.scopeDepartmentId) : undefined,
      createdByName: empName(db, c.createdBy),
      auditorNames: c.auditorIds.map((id) => empName(db, id)),
      progress: { checked: items.filter((i) => i.result !== null).length, total: items.length },
    };
  };

  const enrichItem = (i: AuditItem): AuditItem => {
    const a = db.assets.find((x) => x.id === i.assetId);
    return {
      ...i,
      asset: a ? { id: a.id, assetTag: a.assetTag, name: a.name, location: a.location, status: a.status } : undefined,
      auditorName: i.auditorId ? empName(db, i.auditorId) : undefined,
    };
  };

  if (p === "/api/audits" && method === "GET")
    return ok(db.auditCycles.filter(cycleVisible).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).map(enrichCycle));

  if (p === "/api/audits" && method === "POST") {
    if (ctx.role !== "ADMIN") return forbidden("Only admins can create audit cycles");
    if (!body.name || !body.startDate || !body.endDate) return bad("Name and date range are required");
    if (String(body.startDate) > String(body.endDate)) return bad("Start date must be on or before the end date");
    const scopeDept = (body.scopeDepartmentId as number) ?? null;
    const scopeLoc = ((body.scopeLocation as string) || "").trim() || null;
    const deptNameStr = scopeDept ? deptName(db, scopeDept).toLowerCase() : null;
    const inScope = db.assets.filter((a) => {
      if (a.status === "DISPOSED") return false;
      if (!scopeDept && !scopeLoc) return true;
      const al = activeAlloc(db, a.id);
      const byDept = scopeDept !== null &&
        ((al !== undefined && holderDeptId(db, al) === scopeDept) || (deptNameStr !== null && (a.location ?? "").toLowerCase().includes(deptNameStr)));
      const byLoc = scopeLoc !== null && (a.location ?? "").toLowerCase().includes(scopeLoc.toLowerCase());
      return byDept || byLoc;
    });
    if (inScope.length === 0) return bad("No assets match that scope — widen the department/location");
    const cycle = {
      id: nextId(db), name: String(body.name).trim(),
      scopeDepartmentId: scopeDept, scopeLocation: scopeLoc,
      startDate: String(body.startDate), endDate: String(body.endDate),
      status: "OPEN" as const, createdBy: ctx.emp.id,
      createdAt: new Date().toISOString(), closedAt: null, auditorIds: [] as number[],
    };
    db.auditCycles.push(cycle);
    for (const a of inScope)
      db.auditItems.push({ id: nextId(db), cycleId: cycle.id, assetId: a.id, result: null, auditorId: null, notes: null, checkedAt: null });
    act(db, ctx.emp.id, "AUDIT_CREATE", "audit", cycle.id, `Opened ${cycle.name} (${inScope.length} assets)`);
    return json(201, enrichCycle(cycle));
  }

  if ((m = M(/^\/api\/audits\/(\d+)$/)) && method === "GET") {
    const c = db.auditCycles.find((x) => x.id === Number(m![1]));
    if (!c) return notFound();
    if (!cycleVisible(c)) return forbidden("You're not assigned to this audit cycle");
    return ok(enrichCycle(c));
  }

  if ((m = M(/^\/api\/audits\/(\d+)\/auditors$/)) && method === "POST") {
    if (ctx.role !== "ADMIN") return forbidden();
    const c = db.auditCycles.find((x) => x.id === Number(m![1]));
    if (!c) return notFound();
    if (c.status === "CLOSED") return conflict({ message: "This cycle is closed" });
    const ids = (body.auditorIds as number[]) ?? [];
    const added = ids.filter((id) => !c.auditorIds.includes(id));
    c.auditorIds = ids;
    for (const id of added)
      notify(db, id, "AUDIT_ASSIGNED", `You're an auditor on ${c.name}`, "audit", c.id);
    act(db, ctx.emp.id, "AUDIT_ASSIGN", "audit", c.id, `Auditors: ${ids.map((i) => empName(db, i)).join(", ")}`);
    return ok(enrichCycle(c));
  }

  if ((m = M(/^\/api\/audits\/(\d+)\/items$/)) && method === "GET") {
    const c = db.auditCycles.find((x) => x.id === Number(m![1]));
    if (!c) return notFound();
    if (!cycleVisible(c)) return forbidden("You're not assigned to this audit cycle");
    return ok(db.auditItems.filter((i) => i.cycleId === c.id).map(enrichItem));
  }

  if ((m = M(/^\/api\/audits\/(\d+)\/items\/(\d+)$/)) && method === "PATCH") {
    const c = db.auditCycles.find((x) => x.id === Number(m![1]));
    if (!c) return notFound();
    if (c.status === "CLOSED") return conflict({ message: "This cycle is closed — results are locked" });
    if (!c.auditorIds.includes(ctx.emp.id)) return forbidden("Only assigned auditors can record results");
    const item = db.auditItems.find((i) => i.cycleId === c.id && i.assetId === Number(m![2]));
    if (!item) return notFound("That asset isn't in this cycle");
    const result = body.result as AuditItem["result"];
    if (!result || !["VERIFIED", "MISSING", "DAMAGED"].includes(result)) return bad("Pick a result");
    item.result = result;
    item.auditorId = ctx.emp.id;
    item.notes = (body.notes as string) || null;
    item.checkedAt = new Date().toISOString();
    hist(db, item.assetId, `AUDIT_${result}`, `${c.name}${item.notes ? ` — ${item.notes}` : ""}`, ctx.emp.id);
    return ok(enrichItem(item));
  }

  if ((m = M(/^\/api\/audits\/(\d+)\/discrepancies$/)) && method === "GET") {
    const c = db.auditCycles.find((x) => x.id === Number(m![1]));
    if (!c) return notFound();
    if (!cycleVisible(c)) return forbidden();
    return ok(db.auditItems.filter((i) => i.cycleId === c.id && (i.result === "MISSING" || i.result === "DAMAGED")).map(enrichItem));
  }

  if ((m = M(/^\/api\/audits\/(\d+)\/close$/)) && method === "PATCH") {
    if (ctx.role !== "ADMIN") return forbidden("Only admins can close audit cycles");
    const c = db.auditCycles.find((x) => x.id === Number(m![1]));
    if (!c) return notFound();
    if (c.status === "CLOSED") return conflict({ message: "This cycle is already closed" });
    let lost = 0;
    for (const item of db.auditItems.filter((i) => i.cycleId === c.id)) {
      const asset = db.assets.find((a) => a.id === item.assetId);
      if (!asset) continue;
      if (item.result === "MISSING") {
        // Only transition where the state machine permits; skip terminal states.
        if (transition(asset, "MARK_LOST")) {
          lost++;
          const alloc = activeAlloc(db, asset.id);
          if (alloc) {
            alloc.status = "RETURNED";
            alloc.returnedAt = new Date().toISOString();
            alloc.returnNotes = "Confirmed missing in audit";
          }
          hist(db, asset.id, "AUDIT_LOST", `Marked lost — ${c.name}`, ctx.emp.id);
          notifyManagers(db, "AUDIT_DISCREPANCY", `${asset.assetTag} ${asset.name} confirmed missing → marked Lost (${c.name})`, "audit", c.id, ctx.emp.id);
        }
      } else if (item.result === "DAMAGED") {
        asset.condition = "DAMAGED";
        hist(db, asset.id, "AUDIT_DAMAGED", `Condition set to damaged — ${c.name}`, ctx.emp.id);
      }
    }
    c.status = "CLOSED";
    c.closedAt = new Date().toISOString();
    act(db, ctx.emp.id, "AUDIT_CLOSE", "audit", c.id, `Closed ${c.name} (${lost} marked lost)`);
    return ok(enrichCycle(c));
  }

  // ---------- dashboard ----------
  if (p === "/api/dashboard" && method === "GET") {
    return ok(buildDashboard(ctx));
  }

  // ---------- notifications ----------
  if (p === "/api/notifications" && method === "GET") {
    const rows = db.notifications
      .filter((n) => n.recipientId === ctx.emp.id)
      .sort((a, b) => (a.isRead === b.isRead ? +new Date(b.createdAt) - +new Date(a.createdAt) : a.isRead ? 1 : -1))
      .slice(0, 60);
    return ok(rows);
  }

  if ((m = M(/^\/api\/notifications\/(\d+)\/read$/)) && method === "PATCH") {
    const n = db.notifications.find((x) => x.id === Number(m![1]) && x.recipientId === ctx.emp.id);
    if (!n) return notFound();
    n.isRead = true;
    return ok(n);
  }

  // ---------- activity ----------
  if (p === "/api/activity" && method === "GET") {
    if (!isManager(ctx.role)) return forbidden("You don't have access to the activity log");
    let rows = db.activity.slice().sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    if (q.get("actor")) rows = rows.filter((r) => r.actorId === Number(q.get("actor")));
    if (q.get("entity")) rows = rows.filter((r) => r.entityType === q.get("entity"));
    if (q.get("from")) rows = rows.filter((r) => r.createdAt >= new Date(q.get("from")!).toISOString());
    if (q.get("to")) rows = rows.filter((r) => r.createdAt <= new Date(new Date(q.get("to")!).getTime() + 86_399_000).toISOString());
    return ok(rows.slice(0, 200).map((r) => ({ ...r, actorName: r.actorId ? empName(db, r.actorId) : "System" })));
  }

  // ---------- reports ----------
  if (p.startsWith("/reports/")) {
    if (!isManager(ctx.role)) return forbidden("Reports are for asset managers and admins");
    if (p === "/reports/utilization") return ok(utilizationData(db));
    if (p === "/reports/maintenance-frequency") return ok(maintFrequencyData(db));
    if (p === "/reports/allocation-summary") return ok(allocationSummaryData(db));
    if (p === "/reports/booking-heatmap") return ok(heatmapData(db));
    if ((m = M(/^\/reports\/export\/([a-z-]+)$/))) {
      // Mock serves CSV for both fmt=csv and fmt=xlsx (the FastAPI service owns real XLSX).
      const report = m[1]!;
      if (report === "utilization") {
        const u = utilizationData(db);
        return csvResponse(csv([["week_start", "utilization_pct"], ...u.trend.map((r) => [r.weekStart.slice(0, 10), r.utilizationPct] as (string | number)[])]));
      }
      if (report === "maintenance-frequency")
        return csvResponse(csv([["category", "requests", "open"], ...maintFrequencyData(db).map((r) => [r.key, r.count, r.openCount] as (string | number)[])]));
      if (report === "allocation-summary")
        return csvResponse(csv([["department", "active_allocations", "overdue", "assets_held"], ...allocationSummaryData(db).map((r) => [r.departmentName, r.activeAllocations, r.overdue, r.assetsHeld] as (string | number)[])]));
      if (report === "booking-heatmap") {
        const h = heatmapData(db);
        const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
        const rows: (string | number)[][] = [["hour", ...days]];
        for (let hr = h.hourRange[0]; hr <= h.hourRange[1]; hr++) rows.push([`${hr}:00`, ...h.hours[hr]!]);
        return csvResponse(csv(rows));
      }
      return notFound("Unknown report");
    }
  }

  return notFound(`The mock doesn't implement ${method} ${p}`);
}

// ---- dashboard builder --------------------------------------------------------------

function buildDashboard(ctx: Ctx) {
  const { db } = ctx;
  const now = Date.now();
  const week = now + 7 * 86_400_000;
  const scope = isManager(ctx.role) ? "ORG" : ctx.role === "DEPARTMENT_HEAD" ? "DEPARTMENT" : "SELF";

  const inScope = (a: Allocation) =>
    scope === "ORG" ? true : scope === "DEPARTMENT" ? holderDeptId(db, a) === ctx.emp.departmentId : a.holderEmployeeId === ctx.emp.id;
  const activeAllocs = db.allocations.filter((a) => a.status === "ACTIVE" && inScope(a));
  const myBookings = db.bookings.filter((b) => {
    if (!liveBooking(b)) return false;
    if (scope === "ORG") return true;
    if (scope === "DEPARTMENT") return db.employees.find((e) => e.id === b.bookedBy)?.departmentId === ctx.emp.departmentId;
    return b.bookedBy === ctx.emp.id;
  });
  const pendingTransfers = db.transfers.filter((tr) => tr.status === "REQUESTED" && (scope === "ORG" ? true : transferVisible(ctx, tr)));
  const overdue = activeAllocs.filter((a) => a.expectedReturnAt && +new Date(a.expectedReturnAt) < now);
  const upcoming = activeAllocs.filter((a) => a.expectedReturnAt && +new Date(a.expectedReturnAt) >= now && +new Date(a.expectedReturnAt) <= week);

  const kpis = {
    assetsAvailable: db.assets.filter((a) => a.status === "AVAILABLE").length,
    assetsAllocated: scope === "ORG" ? db.assets.filter((a) => a.status === "ALLOCATED").length : activeAllocs.length,
    maintenanceToday: db.maintenance.filter((r) => ["APPROVED", "TECHNICIAN_ASSIGNED", "IN_PROGRESS"].includes(r.status)).length,
    activeBookings: myBookings.length,
    pendingTransfers: pendingTransfers.length,
    upcomingReturns: upcoming.length,
    overdueReturns: overdue.length,
  };

  const attention: Array<{ id: string; kind: string; message: string; detail?: string; href: string; at: string | null }> = [];
  for (const a of overdue.slice(0, 4)) {
    const ref = assetRef(db, a.assetId);
    const days = Math.max(1, Math.floor((now - +new Date(a.expectedReturnAt!)) / 86_400_000));
    attention.push({
      id: `ov-${a.id}`, kind: "OVERDUE",
      message: `${ref.assetTag} ${ref.name} — ${days} day${days > 1 ? "s" : ""} overdue`,
      detail: `Held by ${holderName(db, a)}`,
      href: "/allocations", at: a.expectedReturnAt,
    });
  }
  if (isManager(ctx.role) || ctx.role === "DEPARTMENT_HEAD") {
    for (const tr of pendingTransfers.slice(0, 3)) {
      const ref = assetRef(db, tr.assetId);
      attention.push({
        id: `tr-${tr.id}`, kind: "TRANSFER_PENDING",
        message: `Transfer awaiting approval: ${ref.assetTag} → ${tr.toEmployeeId ? empName(db, tr.toEmployeeId) : deptName(db, tr.toDepartmentId)}`,
        detail: `Requested by ${empName(db, tr.requestedBy)}`,
        href: "/allocations?tab=transfers", at: tr.createdAt,
      });
    }
  }
  if (isManager(ctx.role)) {
    for (const r of db.maintenance.filter((x) => x.status === "PENDING").slice(0, 3)) {
      const ref = assetRef(db, r.assetId);
      attention.push({
        id: `mt-${r.id}`, kind: "MAINT_PENDING",
        message: `Maintenance awaiting approval: ${ref.assetTag} (${r.priority.toLowerCase()})`,
        detail: r.issue.slice(0, 80),
        href: "/maintenance", at: r.createdAt,
      });
    }
  }
  const nextBooking = db.bookings
    .filter((b) => b.bookedBy === ctx.emp.id && bookingStatus(b) === "UPCOMING" && +new Date(b.start) < now + 86_400_000)
    .sort((a, b) => +new Date(a.start) - +new Date(b.start))[0];
  if (nextBooking) {
    const ref = assetRef(db, nextBooking.resourceId);
    attention.push({
      id: `bk-${nextBooking.id}`, kind: "BOOKING_SOON",
      message: `Your booking: ${ref.name}, ${d(nextBooking.start)} ${t(nextBooking.start)}–${t(nextBooking.end)}`,
      href: "/bookings", at: nextBooking.start,
    });
  }
  for (const c of db.auditCycles.filter((c) => c.status === "OPEN" && c.auditorIds.includes(ctx.emp.id))) {
    const items = db.auditItems.filter((i) => i.cycleId === c.id);
    const left = items.filter((i) => i.result === null).length;
    if (left > 0)
      attention.push({ id: `au-${c.id}`, kind: "AUDIT_OPEN", message: `${c.name}: ${left} asset${left > 1 ? "s" : ""} left to check`, href: `/audits/${c.id}`, at: c.endDate });
  }

  return { scope, kpis, needsAttention: attention.slice(0, 8) };
}

export { resetMockDb };
