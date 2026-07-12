// End-to-end smoke of the mock API — the same router the browser uses.
// Run: npx tsx scripts/smoke.ts
// Covers the demo-critical paths: auth + refresh rotation, the allocation 409
// conflict body, transfer approve → holder update, the booking [start,end)
// boundary case, maintenance approval flipping asset status, audit close → Lost,
// and RBAC 403s.

import assert from "node:assert/strict";
import { mockFetch } from "../src/api/mock/router";

interface Res {
  status: number;
  body: any;
}

async function call(path: string, opts: { method?: string; token?: string; body?: unknown } = {}): Promise<Res> {
  const res = await mockFetch(path, {
    method: opts.method ?? "GET",
    headers: opts.token ? { Authorization: `Bearer ${opts.token}` } : {},
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    /* 204 etc */
  }
  return { status: res.status, body };
}

const login = async (email: string) => {
  const r = await call("/auth/login", { method: "POST", body: { email, password: "password123" } });
  assert.equal(r.status, 200, `login ${email}`);
  return r.body as { access: string; refresh: string };
};

/** Tomorrow at local hour:minute, ISO — matches the seeded 09:00–10:00 anchor. */
function tomorrowAt(h: number, m = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

async function main() {
  // ---- auth ----
  const manager = await login("manager@assetflow.dev");
  const me = await call("/auth/me", { token: manager.access });
  assert.equal(me.body.role, "ASSET_MANAGER", "me() role");

  // Refresh rotates and the old token is single-use.
  const rotated = await call("/auth/refresh", { method: "POST", body: { refresh: manager.refresh } });
  assert.equal(rotated.status, 200, "refresh ok");
  const replay = await call("/auth/refresh", { method: "POST", body: { refresh: manager.refresh } });
  assert.equal(replay.status, 401, "old refresh token rejected after rotation");
  const mgrToken = rotated.body.access as string;

  // ---- HERO 1: allocation conflict → transfer → approve → holder updates ----
  const conflict = await call("/api/allocations", {
    method: "POST",
    token: mgrToken,
    body: { assetId: 3, holderEmployeeId: 4 },
  });
  assert.equal(conflict.status, 409, "allocating a held asset 409s");
  assert.equal(conflict.body.currentHolder, "Priya Sharma", "409 body carries currentHolder");
  assert.equal(conflict.body.canRequestTransfer, true, "409 body offers transfer");

  const trReq = await call("/api/transfer-requests", {
    method: "POST",
    token: mgrToken,
    body: { assetId: 3, toEmployeeId: 5, reason: "smoke test" },
  });
  assert.equal(trReq.status, 201, "transfer request created");
  const approved = await call(`/api/transfer-requests/${trReq.body.id}/approve`, { method: "PATCH", token: mgrToken });
  assert.equal(approved.status, 200, "transfer approved");
  const asset3 = await call("/api/assets/3", { token: mgrToken });
  assert.equal(asset3.body.currentHolder?.name, "Mira Iyer", "holder updated after approve");
  assert.equal(asset3.body.status, "ALLOCATED", "asset stays allocated through transfer");

  // ---- HERO 2: booking boundary — after 09:00–10:00, 10:00–11:00 OK, 09:30–10:30 blocked ----
  const backToBack = await call("/api/bookings", {
    method: "POST",
    token: mgrToken,
    body: { resourceId: 16, start: tomorrowAt(10), end: tomorrowAt(11) },
  });
  assert.equal(backToBack.status, 201, "10:00–11:00 after a 09:00–10:00 booking succeeds (end-exclusive)");
  const overlapping = await call("/api/bookings", {
    method: "POST",
    token: mgrToken,
    body: { resourceId: 16, start: tomorrowAt(9, 30), end: tomorrowAt(10, 30) },
  });
  assert.equal(overlapping.status, 409, "09:30–10:30 overlaps and is rejected");
  assert.match(overlapping.body.message, /overlaps an existing booking/, "overlap message is directional");
  assert.ok(overlapping.body.conflict?.start, "conflict body names the clashing range");

  // Cancelling frees the slot immediately.
  const cancelled = await call(`/api/bookings/${backToBack.body.id}/cancel`, { method: "PATCH", token: mgrToken });
  assert.equal(cancelled.status, 200, "cancel ok");
  const rebook = await call("/api/bookings", {
    method: "POST",
    token: mgrToken,
    body: { resourceId: 16, start: tomorrowAt(10), end: tomorrowAt(11) },
  });
  assert.equal(rebook.status, 201, "cancelled slot is bookable again");

  // ---- maintenance: approval flips the asset, resolve flips it back ----
  const approvedMaint = await call("/api/maintenance/1/approve", { method: "PATCH", token: mgrToken });
  assert.equal(approvedMaint.status, 200, "maintenance approved");
  const asset4 = await call("/api/assets/4", { token: mgrToken });
  assert.equal(asset4.body.status, "UNDER_MAINTENANCE", "asset flips to Under maintenance on approval");

  // ---- audit close: confirmed-missing → LOST ----
  const admin = await login("admin@assetflow.dev");
  const closed = await call("/api/audits/1/close", { method: "PATCH", token: admin.access });
  assert.equal(closed.status, 200, "cycle closed");
  const asset7 = await call("/api/assets/7", { token: admin.access });
  assert.equal(asset7.body.status, "LOST", "missing asset marked Lost on close");
  const lateMark = await call("/api/audits/1/items/6", { method: "PATCH", token: admin.access, body: { result: "VERIFIED" } });
  assert.equal(lateMark.status, 409, "closed cycle rejects further marks");

  // ---- RBAC: employee token is refused where the matrix says so ----
  const employee = await login("employee@assetflow.dev");
  const forbidden = await call("/api/assets", { method: "POST", token: employee.access, body: { name: "X", categoryId: 1 } });
  assert.equal(forbidden.status, 403, "employee cannot register assets");
  const noActivity = await call("/api/activity", { token: employee.access });
  assert.equal(noActivity.status, 403, "employee cannot read the activity log");
  const noRole = await call("/api/employees/4/role", { method: "PATCH", token: employee.access, body: { newRole: "ADMIN" } });
  assert.equal(noRole.status, 403, "employee cannot self-elevate");

  // Last-admin guard.
  const admins = await call("/api/employees", { token: admin.access });
  const lastAdmin = admins.body.find((e: { role: string }) => e.role === "ADMIN");
  const demote = await call(`/api/employees/${lastAdmin.id}/role`, { method: "PATCH", token: admin.access, body: { newRole: "EMPLOYEE" } });
  assert.equal(demote.status, 409, "cannot demote the only remaining admin");

  console.log("✓ smoke: auth+rotation, allocation-conflict→transfer→holder-update, booking boundary, maintenance flip, audit close→Lost, RBAC — all pass");
}

main().catch((e) => {
  console.error("✗ smoke failed:", e.message);
  process.exit(1);
});
