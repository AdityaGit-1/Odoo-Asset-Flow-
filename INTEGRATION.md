# Frontend ↔ Backend Integration

Status and run instructions for wiring the Next.js frontend to the Spring backend.

## Run the wired stack

**1. Database** (the backend expects Postgres with role `postgres` / `123Milan@`):

```bash
docker run -d --name af-pg \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD='123Milan@' -e POSTGRES_DB=assetflow \
  -p 55432:5432 postgres:16-alpine
```

(Port 55432 avoids a clash with other local Postgres instances. Use 5432 if free.)

**2. Backend** (Java 21+). Port 8082 because 8080 is taken here; use 8080 if free:

```bash
cd backend
SERVER_PORT=8082 \
SPRING_DATASOURCE_URL="jdbc:postgresql://127.0.0.1:55432/assetflow" \
APP_FRONTEND_ORIGIN="http://localhost:3000" \
./mvnw -DskipTests spring-boot:run
```

On first start it seeds roles, departments, categories, one account per role, and
8 assets. Accounts (password `password123`): `admin@`, `manager@`, `head@`,
`employee@assetflow.dev`.

**3. Frontend** — set `frontend/.env.local`:

```bash
NEXT_PUBLIC_API_BASE=http://localhost:8082
NEXT_PUBLIC_USE_MOCKS=0
cd frontend && npm run dev
```

Verify the wiring without a browser:

```bash
cd frontend && BACKEND=http://localhost:8082 npx tsx scripts/verify-backend.ts
```

## What's wired (verified end-to-end against the live backend)

Auth (login/refresh/`/me`/logout), Dashboard, Assets directory, Org Setup
(departments, categories, employees + role change with last-admin guard),
Audit (create → assign auditors → mark → discrepancies → close → assets go LOST),
Notifications, Activity log. RBAC is enforced server-side (employees get 403 on
admin writes; no self-elevation).

The frontend talks only to the backend origin; a single adapter
(`src/api/adapter.ts`) reconciles the differences from the frontend's canonical
contract: the `APIResponse<T>` envelope, `/api/auth/*` paths, `/api/transfers`,
`{accessToken,refreshToken}` token names, signup→register field mapping, and the
asset list → `Page<T>` wrap. Flip `NEXT_PUBLIC_USE_MOCKS=1` and everything runs on
the in-browser mock with zero backend.

## Backend changes made to reach this

- **Fixed a startup crash**: two `Notification` entities mapped the same table
  (`created_at` duplicate) — deleted the dead one.
- **Built the 4 missing controllers** the frontend needs: `/api/departments`,
  `/api/categories`, `/api/employees` (+ role change), `/api/audits` — returning
  the exact shapes the frontend expects.
- **Added** `/api/auth/me`, CORS for the frontend origin, and a dev data seeder
  (also creates the `employee_code_seq` sequence that signup needs but nothing
  created).
- **Fixed a shared bug**: several controllers parsed the JWT subject (an email) as
  a numeric user id — corrected to read the id off the authenticated principal.
- **Rewrote** the dashboard KPI endpoint against the real schema (the shipped raw
  SQL targeted brief-era table names like `bookings`/`allocations`) and the
  activity query (its `:param IS NULL` filter broke on null params).
- **Made the generic exception handler log** — 500s were previously silent.

## Not yet wired — remaining backend work

The **allocation, booking, maintenance, and transfer** controllers ship with only
write endpoints (no `GET` list), so those four screens have nothing to read from
the backend and stay on the mock (`NEXT_PUBLIC_USE_MOCKS=1`). Completing them means
adding the list endpoints **and** — for the two hero flows — verifying the backend's
allocation POST returns the `409 { currentHolder, canRequestTransfer }` conflict body
and the booking POST enforces the `[start, end)` overlap rejection. Those flows work
fully on the mock today; wiring them to the real backend is the natural next step.
