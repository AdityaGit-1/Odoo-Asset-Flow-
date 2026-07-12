# AssetFlow — Frontend

Next.js (App Router) + TypeScript + Tailwind v4 + TanStack Query. All ten screens,
both hero flows, one typed API client, one status system.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
```

Works with **zero backend** out of the box: `.env.local` ships with
`NEXT_PUBLIC_USE_MOCKS=1`, which serves every endpoint from an in-browser mock
(seeded, persisted to localStorage, same status codes and 409 bodies as the real
gateway). Point at the real gateway by setting:

```bash
NEXT_PUBLIC_API_BASE=http://localhost:8080   # the gateway — never a service port
NEXT_PUBLIC_USE_MOCKS=0
```

### Demo accounts (mock mode, password `password123`)

| Role | Email |
|---|---|
| Admin | `admin@assetflow.dev` |
| Asset manager | `manager@assetflow.dev` |
| Department head | `head@assetflow.dev` (Priya — holds AF-0003) |
| Employee | `employee@assetflow.dev` |

User menu → **Reset demo data** reseeds the mock DB.

## The two hero flows (demo these)

1. **Allocation conflict → transfer.** Sign in as the manager → Allocation &
   transfer → Allocate asset → pick `AF-0003` (held by Priya). The 409 renders as
   *"Held by Priya Sharma since …"* with a **Request transfer** button → request
   shows Pending in the Transfer requests tab → Approve → holder updates and both
   parties are notified.
2. **Booking overlap boundary.** Bookings → Conference Room B2. Tomorrow has a
   seeded **09:00–10:00** slot. Book **10:00–11:00** → succeeds (end-exclusive
   `[start, end)`). Book **09:30–10:30** → clear directional overlap message with
   the conflicting range. Cancelling a booking frees its slot immediately.

## Checks

```bash
npm run typecheck                     # strict TS
node --test src/lib/overlap.test.ts   # the [start,end) boundary semantics
npx tsx scripts/smoke.ts              # end-to-end through the mock router:
                                      # auth + refresh rotation, 409 conflict body,
                                      # transfer approve → holder update, booking
                                      # boundary, maintenance flip, audit close→Lost, RBAC
npm run build
```

## Architecture notes

- **One origin.** Everything goes through `src/api/client.ts` →
  `NEXT_PUBLIC_API_BASE`. On a 401 it refreshes once (single shared in-flight
  promise), replays the request, and only then redirects to `/login`. `ApiError`
  preserves the parsed response body — the conflict flows read it.
- **Mock layer.** `src/api/mock/` implements the full contract behind the same
  `Response` interface (`router.ts` is the endpoint map, `seed.ts` the data).
  Swapping mock ↔ real is the env flag; no screen knows the difference.
- **Status system.** `src/lib/statusSystem.ts` is the single source of state
  color; every chip is driven by it. Overdue is an emphasis treatment (red left
  border + solid pill), not a status.
- **Roles.** Client-side gating (`src/lib/rbac.ts`, `RoleGate`) is UX only; server
  403s render as calm inline messages. Signup has no role field by design.
- **Tokens.** Access token in memory; refresh token in localStorage so a reload
  silently rehydrates (`/auth/refresh` → `/auth/me`). Swap to an httpOnly cookie
  when the gateway sets one.
- **Live notifications.** SSE (`/api/notifications/stream?token=…`) with a 20s
  polling fallback; in mock mode an in-page event bus stands in for the stream.

### Assumptions where the briefs leave shape open (adapter points if the backend differs)

- List enrichment: allocations/transfers/bookings/maintenance rows carry
  `asset {id, assetTag, name}` and holder/actor display names.
- `GET /api/dashboard` returns `{ scope, kpis, needsAttention }`
  (`src/api/types.ts` → `DashboardData`).
- Pagination is Spring's `Page<T>` shape; sorting via `sort=field,dir`.
- `GET /api/allocations` exists with `status/assetId` filters (the phase-4 brief
  implies but doesn't pin it).
- Booking rows expose `start`/`end` ISO strings (the DTO view of `during`).
- Mock XLSX exports serve CSV content — real XLSX belongs to the reports service.
