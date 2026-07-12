// Proves the frontend's real-backend adapter (path remap + envelope unwrap +
// token/page normalization) produces the shapes screens expect, against the
// live Spring backend. Run: BACKEND=http://localhost:8082 npx tsx scripts/verify-backend.ts

import assert from "node:assert/strict";
import { remapPath, unwrapEnvelope, normalizeTokens, adaptResponse, adaptRequestBody } from "../src/api/adapter";

const BASE = process.env.BACKEND ?? "http://localhost:8082";

async function call(path: string, opts: { method?: string; token?: string; body?: unknown } = {}) {
  const realPath = remapPath(path);
  const res = await fetch(`${BASE}${realPath}`, {
    method: opts.method ?? "GET",
    headers: {
      ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  const parsed = text ? JSON.parse(text) : undefined;
  return { res, data: adaptResponse(path, unwrapEnvelope(res.status, parsed)) };
}

async function main() {
  // Path remap
  assert.equal(remapPath("/auth/login"), "/api/auth/login");
  assert.equal(remapPath("/auth/signup"), "/api/auth/register");
  assert.equal(remapPath("/api/transfer-requests?status=REQUESTED"), "/api/transfers?status=REQUESTED");
  assert.equal(remapPath("/api/assets"), "/api/assets");

  // Request-body adapt: signup name → firstName/lastName
  const adapted = adaptRequestBody("/auth/signup", { name: "Aditi Rao", email: "x@y.z", password: "password123", departmentId: 1 }) as Record<string, unknown>;
  assert.equal(adapted.firstName, "Aditi");
  assert.equal(adapted.lastName, "Rao");

  // Login → normalize tokens
  const login = await call("/auth/login", { method: "POST", body: { email: "admin@assetflow.dev", password: "password123" } });
  const tokens = normalizeTokens(login.data);
  assert.ok(tokens?.access && tokens?.refresh, "login yields access+refresh after normalize");

  // /auth/me → SessionUser shape
  const me = await call("/auth/me", { token: tokens!.access });
  const u = me.data as Record<string, unknown>;
  assert.equal(u.role, "ADMIN", "me role");
  assert.ok(u.email && u.name, "me has email+name");

  // Departments / categories / employees → arrays with expected keys
  const depts = (await call("/api/departments", { token: tokens!.access })).data as Array<Record<string, unknown>>;
  assert.ok(Array.isArray(depts) && depts.length > 0 && "status" in depts[0]!, "departments list");
  const cats = (await call("/api/categories", { token: tokens!.access })).data as Array<Record<string, unknown>>;
  assert.ok(Array.isArray(cats) && "isActive" in cats[0]! && "customFields" in cats[0]!, "categories list");
  const emps = (await call("/api/employees", { token: tokens!.access })).data as Array<Record<string, unknown>>;
  assert.ok(emps.some((e) => e.role === "ADMIN") && "departmentId" in emps[0]!, "employees list with roles");

  // Assets → page-wrapped
  const assets = (await call("/api/assets", { token: tokens!.access })).data as { content: unknown[]; totalElements: number };
  assert.ok(Array.isArray(assets.content) && typeof assets.totalElements === "number", "assets page-wrapped");

  // Business error (success:false) surfaces as a throw
  await assert.rejects(
    call("/api/departments", { method: "POST", token: tokens!.access, body: { name: "" } }),
    /required/i,
    "empty department name → ApiError from envelope",
  );

  console.log(`✓ backend wiring verified: remap, envelope unwrap, token+body+page normalize, error surfacing — all pass (${depts.length} depts, ${emps.length} employees, ${assets.totalElements} assets)`);
}

main().catch((e) => {
  console.error("✗ verify-backend failed:", e.message);
  process.exit(1);
});
