// Seed data: one account per role, ~28 assets across every lifecycle state,
// live bookings around now (incl. tomorrow 09:00–10:00 on Conference Room B2 —
// the overlap boundary demo), an overdue allocation, in-flight maintenance and
// an open audit cycle. Dates are relative to seed time.

import type { MockDb } from "./db";
import { SEED_VERSION } from "./db";
import type { Asset, AssetCondition, AssetStatus, Booking } from "../types";

const DAY = 86_400_000;

// Deterministic PRNG (mulberry32) for the synthetic history that feeds reports.
function rng(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

/** Local date at hour:minute, offset by days — keeps calendar slots readable. */
function at(daysFromToday: number, hour: number, minute = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

export function buildSeed(): MockDb {
  const now = Date.now();
  const r = rng(42);
  const ago = (days: number) => iso(now - days * DAY);
  const dateOnly = (days: number) => new Date(now - days * DAY).toISOString().slice(0, 10);

  const db: MockDb = {
    version: SEED_VERSION,
    seq: { id: 1000, tag: 29 },
    users: [],
    employees: [],
    departments: [],
    categories: [],
    assets: [],
    history: [],
    allocations: [],
    transfers: [],
    bookings: [],
    maintenance: [],
    auditCycles: [],
    auditItems: [],
    notifications: [],
    activity: [],
    refreshTokens: [],
    resetTokens: [],
  };

  db.departments = [
    { id: 1, name: "Engineering", parentDepartmentId: null, headEmployeeId: 3, status: "ACTIVE" },
    { id: 2, name: "Design", parentDepartmentId: null, headEmployeeId: 7, status: "ACTIVE" },
    { id: 3, name: "Operations", parentDepartmentId: null, headEmployeeId: null, status: "ACTIVE" },
    { id: 4, name: "Platform", parentDepartmentId: 1, headEmployeeId: null, status: "ACTIVE" },
    { id: 5, name: "Finance", parentDepartmentId: null, headEmployeeId: null, status: "ACTIVE" },
  ];

  db.categories = [
    { id: 1, name: "Laptops", customFields: { warrantyMonths: "number", cpu: "string", ramGb: "number" }, isActive: true },
    { id: 2, name: "Monitors", customFields: { sizeInch: "number", panel: "string" }, isActive: true },
    { id: 3, name: "Meeting rooms", customFields: { capacity: "number", videoConferencing: "boolean" }, isActive: true },
    { id: 4, name: "AV equipment", customFields: {}, isActive: true },
    { id: 5, name: "Vehicles", customFields: { plate: "string", fuel: "string" }, isActive: true },
    { id: 6, name: "Furniture", customFields: {}, isActive: true },
    { id: 7, name: "Tablets", customFields: {}, isActive: true },
  ];

  // [id, name, email, role, departmentId]
  const people: Array<[number, string, string, MockDb["users"][number]["role"], number]> = [
    [1, "Aditi Rao", "admin@assetflow.dev", "ADMIN", 3],
    [2, "Rohan Mehta", "manager@assetflow.dev", "ASSET_MANAGER", 3],
    [3, "Priya Sharma", "head@assetflow.dev", "DEPARTMENT_HEAD", 1],
    [4, "Dev Patel", "employee@assetflow.dev", "EMPLOYEE", 1],
    [5, "Mira Iyer", "mira@assetflow.dev", "EMPLOYEE", 2],
    [6, "Sanjay Kumar", "sanjay@assetflow.dev", "EMPLOYEE", 1],
    [7, "Lena Fischer", "lena@assetflow.dev", "DEPARTMENT_HEAD", 2],
    [8, "Arjun Nair", "arjun@assetflow.dev", "EMPLOYEE", 3],
    [9, "Tanvi Desai", "tanvi@assetflow.dev", "EMPLOYEE", 5],
  ];
  for (const [id, name, email, role, dept] of people) {
    db.users.push({ id, email, password: "password123", role, isActive: true });
    db.employees.push({ id, userId: id, name, email, departmentId: dept, status: "ACTIVE" });
  }

  // [id, name, catId, status, location, bookable, serial, cost, condition, customValues]
  type Row = [number, string, number, AssetStatus, string, boolean, string | null, number | null, AssetCondition, Record<string, string | number | boolean>];
  const laptops = (cpu: string, ram: number) => ({ warrantyMonths: 24, cpu, ramGb: ram });
  const rows: Row[] = [
    [1, 'MacBook Pro 14" M3', 1, "ALLOCATED", "Floor 2 · Engineering", false, "SN-MBP14-2201", 2400, "GOOD", laptops("Apple M3", 16)],
    [2, 'MacBook Air 13" M2', 1, "ALLOCATED", "Floor 1 · Design studio", false, "SN-MBA13-1877", 1400, "GOOD", laptops("Apple M2", 16)],
    [3, 'MacBook Pro 16" M3 Max', 1, "ALLOCATED", "Floor 2 · Engineering", false, "SN-MBP16-0412", 3900, "NEW", laptops("Apple M3 Max", 36)],
    [4, "ThinkPad X1 Carbon G11", 1, "ALLOCATED", "Floor 2 · Engineering", false, "SN-X1C-5520", 1900, "FAIR", laptops("Core i7-1365U", 32)],
    [5, "Dell XPS 15", 1, "AVAILABLE", "Storage B", false, "SN-XPS15-3301", 2100, "GOOD", laptops("Core i9-13900H", 32)],
    [6, "ThinkPad T14s", 1, "AVAILABLE", "Floor 2 · Engineering", false, "SN-T14S-8907", 1500, "GOOD", laptops("Ryzen 7 PRO", 16)],
    [7, "Dell Latitude 7440", 1, "ALLOCATED", "Floor 2 · Engineering", false, "SN-LAT-1204", 1600, "GOOD", laptops("Core i7-1355U", 16)],
    [8, 'MacBook Air 15"', 1, "AVAILABLE", "Storage B", false, "SN-MBA15-6543", 1700, "NEW", laptops("Apple M3", 24)],
    [9, "ThinkPad P1 Gen 6", 1, "ALLOCATED", "Floor 3 · Finance", false, "SN-P1G6-7801", 3200, "GOOD", laptops("Core i9 + RTX 2000", 64)],
    [10, 'Dell U2723QE 27"', 2, "AVAILABLE", "Floor 2 · Engineering", false, "SN-U27-9917", 620, "GOOD", { sizeInch: 27, panel: "IPS Black" }],
    [11, 'LG UltraFine 32"', 2, "UNDER_MAINTENANCE", "Floor 1 · Design studio", false, "SN-LG32-4482", 1300, "FAIR", { sizeInch: 32, panel: "Nano IPS" }],
    [12, 'Dell U3423WE 34"', 2, "AVAILABLE", "Storage B", false, "SN-U34-2210", 900, "GOOD", { sizeInch: 34, panel: "IPS" }],
    [13, "BenQ PD2705U", 2, "AVAILABLE", "Floor 1 · Design studio", false, "SN-BQ27-1108", 540, "GOOD", { sizeInch: 27, panel: "IPS" }],
    [14, "Samsung ViewFinity S9", 2, "ALLOCATED", "Floor 1 · Design studio", false, "SN-VS9-3355", 1500, "NEW", { sizeInch: 27, panel: "5K IPS" }],
    [15, "Herman Miller Aeron", 6, "AVAILABLE", "Storage B", false, null, 1200, "GOOD", {}],
    [16, "Conference Room B2", 3, "AVAILABLE", "Floor 2 · West wing", true, null, null, "GOOD", { capacity: 8, videoConferencing: true }],
    [17, "Conference Room A1", 3, "AVAILABLE", "Floor 1 · East wing", true, null, null, "GOOD", { capacity: 4, videoConferencing: true }],
    [18, "Focus Booth F3", 3, "AVAILABLE", "Floor 3 · Quiet zone", true, null, null, "NEW", { capacity: 1, videoConferencing: false }],
    [19, "Sony A7 IV camera kit", 4, "AVAILABLE", "Studio", true, "SN-A7IV-0031", 3100, "GOOD", {}],
    [20, "Epson EB-L200 projector", 4, "AVAILABLE", "Studio", true, "SN-EPL2-7742", 1100, "GOOD", {}],
    [21, "Rode podcast rig", 4, "RESERVED", "Studio", true, "SN-RODE-5150", 850, "GOOD", {}],
    [22, "Toyota Innova (fleet)", 5, "AVAILABLE", "Fleet garage", false, "SN-FLT-0007", 28000, "GOOD", { plate: "KA-01-MJ-4821", fuel: "Diesel" }],
    [23, "Jarvis standing desk", 6, "AVAILABLE", "Floor 2 · Engineering", false, null, 700, "GOOD", {}],
    [24, 'iPad Pro 12.9"', 7, "AVAILABLE", "Floor 1 · Design studio", false, "SN-IPP-8823", 1300, "GOOD", {}],
    [25, "Cisco desk phone 8845", 4, "LOST", "Studio", false, "SN-CIS-2290", 300, "FAIR", {}],
    [26, "Dell OptiPlex 7010", 1, "RETIRED", "Storage B", false, "SN-OPT-0119", 800, "POOR", laptops("Core i5-3470", 8)],
    [27, "HP LaserJet 4200 (legacy)", 4, "DISPOSED", "Storage B", false, "SN-HPL-9910", 450, "POOR", {}],
    [28, "Logitech Rally Bar", 4, "UNDER_MAINTENANCE", "Floor 2 · West wing", false, "SN-RLY-6674", 2700, "GOOD", {}],
  ];
  db.assets = rows.map(([id, name, categoryId, status, location, isBookable, serialNumber, acquisitionCost, condition, customValues]): Asset => ({
    id,
    assetTag: `AF-${String(id).padStart(4, "0")}`,
    name,
    categoryId,
    serialNumber,
    acquisitionDate: dateOnly(Math.floor(100 + r() * 300)),
    acquisitionCost,
    condition,
    location,
    isBookable,
    status,
    customValues,
    photoUrl: null,
    createdAt: ago(Math.floor(100 + r() * 300)),
  }));

  let hid = 1;
  const hist = (assetId: number, eventType: string, detail: string, actorId: number, occurredAt: string) =>
    db.history.push({ id: hid++, assetId, eventType, detail, actorId, occurredAt });
  for (const a of db.assets) hist(a.id, "REGISTERED", `Registered as ${a.assetTag}`, 2, a.createdAt!);

  // Active allocations. [id, assetId, holderEmp|null, holderDept|null, daysAgo, expectedInDays|null]
  const active: Array<[number, number, number | null, number | null, number, number | null]> = [
    [1, 1, 4, null, 40, 50],
    [2, 2, 5, null, 90, null],
    [3, 3, 3, null, 21, 30],   // Priya holds AF-0003 — the conflict demo
    [4, 4, 6, null, 60, 30],
    [5, 7, 6, null, 35, -5],   // OVERDUE: expected back 5 days ago
    [6, 9, 9, null, 25, 20],
    [7, 14, null, 2, 120, null],
  ];
  for (const [id, assetId, emp, dept, started, expected] of active) {
    db.allocations.push({
      id,
      assetId,
      holderEmployeeId: emp,
      holderDepartmentId: dept,
      allocatedBy: 2,
      allocatedAt: ago(started),
      expectedReturnAt: expected === null ? null : iso(now + expected * DAY),
      returnedAt: null,
      returnCondition: null,
      returnNotes: null,
      status: "ACTIVE",
    });
    const holder = emp ? db.employees.find((e) => e.id === emp)!.name : db.departments.find((d) => d.id === dept)!.name;
    hist(assetId, "ALLOCATED", `Allocated to ${holder}`, 2, ago(started));
  }

  // Historical (returned) allocations — feed utilization trend + most-used.
  const pool = [5, 6, 8, 10, 12, 13, 15, 22, 23, 24, 26];
  let aid = 8;
  for (let i = 0; i < 26; i++) {
    const assetId = pool[Math.floor(r() * pool.length)]!;
    const start = 8 + r() * 82; // 8–90 days ago
    const len = 3 + r() * 18;
    const end = Math.max(1, start - len);
    const emp = 1 + Math.floor(r() * 9);
    db.allocations.push({
      id: aid++,
      assetId,
      holderEmployeeId: emp,
      holderDepartmentId: null,
      allocatedBy: 2,
      allocatedAt: ago(start),
      expectedReturnAt: ago(end - 2),
      returnedAt: ago(end),
      returnCondition: "GOOD",
      returnNotes: null,
      status: "RETURNED",
    });
  }

  db.transfers = [
    {
      id: 1, assetId: 9, fromAllocationId: 6, requestedBy: 4, toEmployeeId: 4, toDepartmentId: null,
      reason: "Joining the data-platform project — needs the P1 for CUDA work",
      status: "REQUESTED", decidedBy: null, createdAt: ago(2), decidedAt: null,
    },
    {
      id: 2, assetId: 2, fromAllocationId: null, requestedBy: 5, toEmployeeId: 5, toDepartmentId: null,
      reason: "Previous holder moved to a desktop setup",
      status: "APPROVED", decidedBy: 2, createdAt: ago(92), decidedAt: ago(90),
    },
    {
      id: 3, assetId: 1, fromAllocationId: 1, requestedBy: 6, toEmployeeId: 6, toDepartmentId: null,
      reason: "Need a Mac for the iOS build",
      status: "REJECTED", decidedBy: 2, createdAt: ago(12), decidedAt: ago(10),
    },
  ];
  hist(2, "TRANSFERRED", "Transferred to Mira Iyer", 2, ago(90));

  // Bookings. Live ones around now + tomorrow's 09:00–10:00 anchor on B2 (id 16)
  // for the boundary demo (10:00–11:00 succeeds, 09:30–10:30 conflicts).
  let bid = 1;
  const book = (resourceId: number, bookedBy: number, start: string, end: string, status: Booking["status"] = "UPCOMING", dept: number | null = null) =>
    db.bookings.push({ id: bid++, resourceId, bookedBy, onBehalfOfDepartmentId: dept, start, end, status, createdAt: start });
  book(16, 3, at(-1, 15), at(-1, 16));
  book(16, 2, iso(now - 40 * 60_000), iso(now + 35 * 60_000)); // ongoing right now
  book(16, 4, at(0, new Date(now).getHours() + 3), at(0, new Date(now).getHours() + 4));
  book(16, 5, at(1, 9), at(1, 10)); // ← the demo anchor
  book(16, 7, at(1, 13), at(1, 14, 30), "UPCOMING", 2);
  book(16, 6, at(0, 11), at(0, 12), "CANCELLED");
  book(17, 9, at(1, 10), at(1, 11, 30));
  book(19, 5, at(2, 9), at(2, 17));

  // Historical bookings — the heatmap's raw material (weekday/hour patterns).
  const patterns: Array<[number, number, number[]]> = [
    [16, 0.85, [9, 10, 11, 14, 15, 16]],
    [17, 0.5, [10, 11, 15]],
    [18, 0.4, [9, 13, 16]],
    [19, 0.22, [9]],
    [20, 0.18, [14]],
  ];
  for (let d = 3; d <= 45; d++) {
    const day = new Date(now - d * DAY);
    const wd = day.getDay(); // 0 Sun .. 6 Sat
    if (wd === 0 || wd === 6) continue;
    const weight = wd === 2 || wd === 3 || wd === 4 ? 1 : 0.6; // Tue–Thu busier
    for (const [res, p, hours] of patterns) {
      if (r() < p * weight) {
        const h = hours[Math.floor(r() * hours.length)]!;
        const len = res === 19 ? 8 : r() < 0.3 ? 2 : 1;
        const s = new Date(day);
        s.setHours(h, 0, 0, 0);
        const e = new Date(s.getTime() + len * 3_600_000);
        book(res, 1 + Math.floor(r() * 9), s.toISOString(), e.toISOString(), "COMPLETED");
      }
    }
  }

  db.maintenance = [
    {
      id: 1, assetId: 4, raisedBy: 6, issue: "Battery drains from 100% to 20% within the hour — needs a replacement pack",
      priority: "MEDIUM", photoUrl: null, status: "PENDING",
      approvedBy: null, technicianId: null, resolutionNotes: null,
      createdAt: ago(1), approvedAt: null, resolvedAt: null,
    },
    {
      id: 2, assetId: 11, raisedBy: 5, issue: "Panel flickers at 120Hz over DisplayPort; stable at 60Hz",
      priority: "HIGH", photoUrl: null, status: "IN_PROGRESS",
      approvedBy: 2, technicianId: 8, resolutionNotes: null,
      createdAt: ago(6), approvedAt: ago(5), resolvedAt: null,
    },
    {
      id: 3, assetId: 28, raisedBy: 7, issue: "Camera won't pan during calls — motor clicks then stops",
      priority: "HIGH", photoUrl: null, status: "APPROVED",
      approvedBy: 2, technicianId: null, resolutionNotes: null,
      createdAt: ago(2), approvedAt: ago(1), resolvedAt: null,
    },
    {
      id: 4, assetId: 5, raisedBy: 4, issue: "Fan noise under light load",
      priority: "LOW", photoUrl: null, status: "RESOLVED",
      approvedBy: 2, technicianId: 8, resolutionNotes: "Cleaned heatsink, repasted CPU — thermals normal",
      createdAt: ago(30), approvedAt: ago(29), resolvedAt: ago(25),
    },
    {
      id: 5, assetId: 15, raisedBy: 8, issue: "Squeaks when reclining",
      priority: "LOW", photoUrl: null, status: "REJECTED",
      approvedBy: 2, technicianId: null, resolutionNotes: "Within normal wear — order felt pads instead",
      createdAt: ago(15), approvedAt: ago(14), resolvedAt: null,
    },
  ];
  hist(11, "MAINT_APPROVED", "Panel flickers at 120Hz over DisplayPort", 2, ago(5));
  hist(28, "MAINT_APPROVED", "Camera won't pan during calls", 2, ago(1));
  hist(5, "MAINT_RESOLVED", "Cleaned heatsink, repasted CPU — thermals normal", 8, ago(25));

  db.auditCycles = [
    {
      id: 1, name: "Q3 FY26 — Engineering floor audit", scopeDepartmentId: 1, scopeLocation: null,
      startDate: dateOnly(7), endDate: new Date(now + 7 * DAY).toISOString().slice(0, 10),
      status: "OPEN", createdBy: 1, createdAt: ago(7), closedAt: null, auditorIds: [3, 4],
    },
    {
      id: 2, name: "Q2 FY26 — Studio AV audit", scopeDepartmentId: null, scopeLocation: "Studio",
      startDate: dateOnly(90), endDate: dateOnly(76),
      status: "CLOSED", createdBy: 1, createdAt: ago(90), closedAt: ago(75), auditorIds: [8],
    },
  ];
  let iid = 1;
  const item = (cycleId: number, assetId: number, result: "VERIFIED" | "MISSING" | "DAMAGED" | null, auditorId: number | null, notes: string | null, daysAgoChecked: number | null) =>
    db.auditItems.push({ id: iid++, cycleId, assetId, result, auditorId, notes, checkedAt: daysAgoChecked === null ? null : ago(daysAgoChecked) });
  item(1, 1, "VERIFIED", 3, null, 2);
  item(1, 3, "VERIFIED", 3, null, 2);
  item(1, 4, null, null, null, null);
  item(1, 5, "VERIFIED", 4, null, 1);
  item(1, 6, null, null, null, null);
  item(1, 7, "MISSING", 4, "Not at the desk — Sanjay thinks it was left in a cab; investigating", 1);
  item(1, 10, "DAMAGED", 4, "Cracked bezel, panel itself OK", 1);
  item(2, 19, "VERIFIED", 8, null, 76);
  item(2, 20, "VERIFIED", 8, null, 76);
  item(2, 25, "MISSING", 8, "Confirmed missing after studio re-rack", 76);
  hist(25, "AUDIT_LOST", "Marked lost — Q2 FY26 Studio AV audit", 1, ago(75));
  hist(7, "AUDIT_MISSING", "Flagged missing in Q3 FY26 Engineering floor audit", 4, ago(1));

  let nid = 1;
  const notif = (recipientId: number, type: string, message: string, refType: MockDb["notifications"][number]["refType"], refId: number | null, daysAgoAt: number, isRead = false) =>
    db.notifications.push({ id: nid++, recipientId, type, message, refType, refId, isRead, createdAt: ago(daysAgoAt) });
  notif(2, "TRANSFER_REQUESTED", "Transfer requested: AF-0009 ThinkPad P1 → Dev Patel", "transfer", 1, 2);
  notif(2, "OVERDUE_RETURN", "Overdue return: AF-0007 Dell Latitude was due back 5 days ago (held by Sanjay Kumar)", "asset", 7, 0.2);
  notif(2, "MAINT_RAISED", "Maintenance raised for AF-0004 ThinkPad X1: battery drain (Medium)", "maintenance", 1, 1);
  notif(4, "ASSET_ASSIGNED", 'AF-0001 MacBook Pro 14" assigned to you', "asset", 1, 40, true);
  notif(4, "AUDIT_ASSIGNED", "You're an auditor on Q3 FY26 — Engineering floor audit", "audit", 1, 7, true);
  notif(5, "BOOKING_CONFIRMED", "Booking confirmed: Conference Room B2, tomorrow 09:00–10:00", "booking", 4, 0.5);
  notif(3, "AUDIT_ASSIGNED", "You're an auditor on Q3 FY26 — Engineering floor audit", "audit", 1, 7);
  notif(6, "OVERDUE_RETURN", "AF-0007 Dell Latitude is overdue — it was expected back 5 days ago", "asset", 7, 0.2);
  notif(1, "AUDIT_OPENED", "Audit cycle opened: Q3 FY26 — Engineering floor audit (7 assets in scope)", "audit", 1, 7, true);

  let actId = 1;
  const act = (actorId: number, action: string, entityType: string, entityId: number, detail: string, daysAgoAt: number) =>
    db.activity.push({ id: actId++, actorId, action, entityType, entityId, detail, createdAt: ago(daysAgoAt) });
  act(1, "ROLE_CHANGE", "employee", 2, "role EMPLOYEE → ASSET_MANAGER", 200);
  act(1, "ROLE_CHANGE", "employee", 3, "role EMPLOYEE → DEPARTMENT_HEAD", 180);
  act(2, "REGISTER_ASSET", "asset", 28, "Registered AF-0028 Logitech Rally Bar", 120);
  act(2, "ALLOCATE", "asset", 3, 'Allocated AF-0003 MacBook Pro 16" to Priya Sharma', 21);
  act(2, "ALLOCATE", "asset", 7, "Allocated AF-0007 Dell Latitude to Sanjay Kumar", 35);
  act(2, "TRANSFER_APPROVE", "transfer", 2, "AF-0002 → Mira Iyer", 90);
  act(2, "TRANSFER_REJECT", "transfer", 3, "AF-0001 → Sanjay Kumar (kept with Dev Patel)", 10);
  act(2, "MAINT_APPROVE", "maintenance", 2, "Approved: LG UltraFine flicker (High)", 5);
  act(8, "MAINT_START", "maintenance", 2, "Started work on AF-0011", 3);
  act(2, "MAINT_APPROVE", "maintenance", 3, "Approved: Rally Bar camera pan (High)", 1);
  act(1, "AUDIT_CREATE", "audit", 1, "Opened Q3 FY26 — Engineering floor audit (7 assets)", 7);
  act(1, "AUDIT_CLOSE", "audit", 2, "Closed Q2 FY26 — Studio AV audit (1 missing → Lost)", 75);
  act(6, "BOOKING_CANCEL", "booking", 6, "Cancelled Conference Room B2 today 11:00–12:00", 0.3);
  act(2, "RETURN", "asset", 5, "Returned by Dev Patel — condition Good", 25);

  return db;
}
