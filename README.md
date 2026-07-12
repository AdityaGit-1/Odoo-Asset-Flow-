# AssetFlow — Architect-Mode Phase Briefs

Enterprise Asset & Resource Management System. This folder is the implementation
plan handed to Claude Code, one brief per phase. Each brief is self-contained:
objective, dependencies, schema, endpoint contracts, RBAC, verbatim code for the
security-critical and version-sensitive parts, known gotchas, and a definition of
done. Routine CRUD is described by contract, not dictated line-by-line — Claude
Code writes that. Verbatim code appears only where getting it wrong is expensive
(auth, the concurrency constraints, infra config).

---

## Architecture (locked)

Three deployables behind one gateway, one shared Postgres for the transactional
domain, optional Python service for analytics.

```
                    ┌───────────────────────┐
   Next.js (browser)│   API Gateway (SCG)   │  ← single origin, CORS configured ONCE here
   ───────────────► │   /auth/**  /api/**   │
                    │   /reports/**         │
                    └───────┬───────┬───────┘
                            │       │        │
            ┌───────────────┘       │        └────────────────┐
            ▼                       ▼                         ▼
   ┌─────────────────┐   ┌────────────────────┐   ┌────────────────────┐
   │  Auth Service   │   │   Core ERP Service │   │  Reports Service   │
   │  (Spring Boot)  │   │   (Spring Boot)    │   │  (FastAPI, OPT)    │
   │  issues JWT     │   │   the whole domain │   │  read-only agg     │
   └────────┬────────┘   └─────────┬──────────┘   └─────────┬──────────┘
            │                      │                        │
            └──────────┬───────────┘                        │
                       ▼                                     ▼
              ┌──────────────────┐                  ┌──────────────────┐
              │    PostgreSQL    │◄─────read────────│  read replica    │
              │  (btree_gist)    │                  │  (or same DB RO) │
              └──────────────────┘                  └──────────────────┘
                       ▲
                  ┌─────────┐
                  │  Redis  │  ← dashboard KPI cache
                  └─────────┘
```

### Why this shape (decision log)

- **Core is one service, one DB — deliberately.** The two hard problems in this
  spec are *no double-allocation of an asset* and *no overlapping bookings*. Both
  are concurrency invariants: two writers racing for the same row/slot. That is a
  consistency problem, not a throughput one. Keeping assets + allocations +
  bookings + maintenance + audit in a single Postgres makes each invariant a local
  ACID transaction with a DB-level guarantee. Splitting them across services would
  force distributed locks or sagas to get a *hard immediate "no"* — the wrong tool.
  (This is the opposite of Relay, which *wanted* eventual consistency.)

- **Auth is a separate deployable but SHARES the core Postgres.** This is the one
  place a split is clean (stateless token issuance, own bounded context), and it
  gives your teammate the "separate deployment" they asked for plus independent
  scaling. Sharing the DB means signup can create the user *and* the employee
  profile in one transaction, and role promotion writes one row read by both — **no
  cross-service sync, no distributed consistency for identity.** Core validates
  JWTs offline with the shared signing secret, so there is no per-request call to
  auth. *(Veto point: if you want true DB-per-service, see the note in Phase 1 — it
  costs you a sync dance for signup + role promotion and buys nothing at this scale.)*

- **Reports is FastAPI, read-only, and optional.** Screen 9 (utilization trends,
  maintenance frequency, booking heatmap, exports) is aggregation-heavy and
  read-only — pandas makes heatmaps and CSV/XLSX exports trivial, and pointing it
  at a read replica keeps analytical scans off the transactional primary. It owns
  nothing writable. **If time runs short, cut it** and let core serve basic report
  endpoints; the DDL supports both.

- **CORS lives at the gateway, not "between services."** CORS is a *browser*
  same-origin policy — backend-to-backend calls never touch it. The gateway gives
  the browser one origin so CORS is configured exactly once. (This corrects the
  "connect all using CORS" idea from the kickoff chat.)

- **Scaling is a paper story + cheap real parts.** At demo scale none of the
  horizontal scaling gets exercised, so we build the parts that are cheap *and*
  demo well — gateway, Redis KPI cache, read replica, DB-level constraints — and
  design the rest on a diagram. Latency (an internal staff tool cares about
  latency, not throughput) comes from caching, indexing, and killing N+1s, not from
  adding instances.

---

## Version pins (match your box + carry forward the hard-won fixes)

| Component        | Pin / note                                                                 |
|------------------|----------------------------------------------------------------------------|
| JDK              | 21 (both Spring services)                                                   |
| Spring Boot      | **3.5.x** — required for Spring Security 6 compatibility (Faraday lesson)   |
| Spring Cloud     | 2025.x train matching Boot 3.5 (for Spring Cloud Gateway)                   |
| PostgreSQL       | 16, with `btree_gist` extension (needed for the booking exclusion constraint)|
| Flyway           | 10.x — **add `flyway-database-postgresql`** explicitly (Relay lesson)      |
| Redis            | 7                                                                          |
| Node             | v24 (Next.js frontend)                                                      |
| Python / FastAPI | 3.11 / latest (reports service only)                                        |
| Password hashing | Argon2id via `Argon2PasswordEncoder` (needs Bouncy Castle on classpath)     |

---
## Phase map & team split

Phases are ordered by dependency, **not** by wall-clock. Fan the team out on the
parallel tracks once Phase 0–1 land.

| Phase | Brief                                        | Depends on | Parallelizable after deps |
|-------|----------------------------------------------|------------|---------------------------|
| 0     | Infrastructure & scaffolding                 | —          | —                         |
| 1     | Auth service (identity, JWT, RBAC primitives)| 0          | —                         |
| 2     | Master data (departments, categories, directory, role promotion) | 1 | ✅ track A |
| 3     | Assets & lifecycle (registration, tags, state machine, search)   | 2 | ✅ track A |
| 4     | **Concurrency core** — allocation, transfer, booking             | 3 | ✅ track B (the deep one) |
| 5     | Maintenance & audit workflows                | 3          | ✅ track C                 |
| 6     | Dashboard, notifications, reports            | 4, 5 (reads all)| partial — build cache/log scaffolding early |
| 7     | Frontend (Next.js) — all screens             | 1 (mock the rest) | ✅ full-time frontend dev from day one |

**Suggested 4-person split:** one owns Phase 0→1 then Phase 6; one owns the
Phase 2→3→4 spine (the scored crown jewel — give it your strongest backend dev);
one owns Phase 5 + notifications; one owns Phase 7 frontend end-to-end, mocking
endpoints until each backend phase lands.

---

## Definition of done (whole project)

- Every role can log in and sees a role-appropriate dashboard with live KPIs.
- Signup creates an **Employee only**; roles are assigned *only* from the Employee
  Directory by an Admin. No self-elevation path exists.
- Allocation and booking invariants hold under concurrent requests (prove it).
- Maintenance and audit run their full approval/verification workflows and flip
  asset states correctly.
- Overdue returns/bookings surface via scheduled job → notifications + dashboard.
- Activity log records who-did-what-when for admin/manager/employee actions.
