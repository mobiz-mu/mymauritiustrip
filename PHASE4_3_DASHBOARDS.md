# Phase 4.3 — Enterprise admin + provider dashboards (KPIs)

Rebuilds the admin and provider dashboards into enterprise KPI dashboards using **only real existing
data**. No migration, no secrets, no public-frontend changes, no Phase 4.4 work.

---

## Files changed

```
NEW:
- lib/dashboard/metrics.ts          server-only metrics (admin + provider); count-only queries, RLS-aware
- components/dashboard/kpi.tsx       dashboard UI primitives (StatCard, StatGrid, SectionCard, AlertCard,
                                     StatusBadge, QuickLinks, MiniBars, AnalyticsCard) — no chart library

MODIFIED:
- app/admin/page.tsx                 placeholder -> enterprise KPI dashboard
- app/provider/page.tsx              basic status -> enterprise KPI dashboard

DELETED: none
DATABASE MIGRATIONS: none
ENV VARS ADDED: none (Analytics card reuses NEXT_PUBLIC_GTM_ID / NEXT_PUBLIC_GA_ID from Phase 4.1)
```

## Admin dashboard (`/admin`)
KPI summary (customers, providers, businesses, listings) · **action alerts** (pending verifications,
payment proofs, reviews to moderate, overdue commissions) · **bookings** overview with a CSS mini-bar
breakdown (pending/confirmed/completed/cancelled) · **listings** (published/pending/premium) ·
**commissions & payments** (unpaid/overdue) · **community & growth** (reviews, to-moderate, newsletter,
transfers + open) · **recent activity** (latest businesses + latest listings with status badges) ·
**analytics** provision card · **quick links** to every admin tool.

All figures come from real tables via `getAdminMetrics()`. Statuses mirror the real enums exactly
(`listing_status`, `booking_status`, `provider_status`, `invoice_status`, `review_status`,
`transfer_request_status`). Nothing is invented; empty data shows 0 and honest empty lists.

## Provider dashboard (`/provider`)
Business header with **status badge** + premium flag · verification lock banner when not verified ·
KPI row (listings/published/pending/avg rating) · **bookings** overview + mini-bars
(pending/accepted/completed/cancelled) · **next-steps checklist** driven by real state (verify → create
listing → publish → respond to bookings) · **commission alerts** (unpaid/overdue) · **recent booking
requests** · **quick links** (manage listings, media, bookings, verification, commissions, reviews,
transfers).

## Data model & performance
- `getAdminMetrics()` / `getProviderMetrics(ownerId)` in `lib/dashboard/metrics.ts` — `import 'server-only'`,
  build-guarded via `isBuildPhase()`.
- Every KPI is a **`head:true` / `count:'exact'` query** (no row payload) run with **`Promise.all`** —
  ~24 tiny parallel counts for admin, ~12 for provider. No N+1.
- **No chart dependency** — the only "chart" is a pure CSS `MiniBars` component. Bundle unchanged.
- Provider **review count/avg** use the **denormalized `listings.review_count` / `rating_avg`**, so the
  provider never queries the RLS-restricted raw `reviews` table.

## Security & privacy
- `/admin` stays behind `requireRole('admin')`; `/provider` behind `requireRole('provider')` — middleware
  untouched.
- All queries use the normal **RLS-aware** server client (`@/lib/supabase/server`). **No service-role key**
  and **no server-only client** is imported into any client component. `metrics.ts` is `server-only`.
- Provider queries are additionally **scoped by `business_id`** (defense in depth); the provider sees only
  its own listings/bookings/commissions and **no customer PII** (only booking reference/status/date).
- If any admin count were ever blocked by RLS it degrades to **0** (never crashes).
- **No public commission wording** was added; commission figures appear only inside the admin/provider
  dashboards, as allowed.

## Migration & env
- **Migration:** none — all data comes from existing tables (`profiles`, `businesses`, `listings`,
  `bookings`, `commission_invoices`, `business_verification_payments`, `reviews`,
  `newsletter_subscribers`, `transfer_requests`).
- **Env:** none added. The Analytics card reads the Phase 4.1 vars and shows "Enabled" when set, otherwise
  a clear message that GA is enabled by configuring `NEXT_PUBLIC_GTM_ID` / `NEXT_PUBLIC_GA_ID`.

---

## PowerShell merge
```powershell
$src = "$env:USERPROFILE\Downloads\mymauritiustrip\mymauritiustrip"   # adjust to your extract path
$dst = "C:\Dev\mymauritiustrip"

robocopy "$src\lib\dashboard" "$dst\lib\dashboard" /E
robocopy "$src\components\dashboard" "$dst\components\dashboard" /E
Copy-Item "$src\app\admin\page.tsx"    "$dst\app\admin\page.tsx" -Force
Copy-Item "$src\app\provider\page.tsx" "$dst\app\provider\page.tsx" -Force
Copy-Item "$src\PHASE4_3_DASHBOARDS.md" "$dst\PHASE4_3_DASHBOARDS.md" -Force
```
`.env.local`, `node_modules`, `.next` untouched; nothing deleted.

## Commands
```bash
npm install
npx tsc --noEmit
npm run build
npm run dev
```

## Build / type-check status
Inspection-verified here (no `node_modules`/network in sandbox): brace + paren balance on all four files;
import/export parity (every `kpi` primitive imported exists; metrics exports match); all dashboard links
resolve to real `app/admin/*` and `app/provider/*` routes; `metrics.ts` is `server-only`; no service-role
usage and no client component imports server code; statuses match the DB enums exactly. Please run the
commands above to confirm green.

## Known warnings (unchanged, non-blocking)
- `@supabase/ssr` Edge `process.version` warning.
- Occasional webpack "big string" cache warning.

## No-404 checklist
No routes added/removed. `/admin` and `/provider` still render for their roles and **redirect to
`/login` when logged out** (middleware unchanged). All Phase 4.1/4.2 routes intact. Re-run
`scripts/smoke-routes.*`.

## Manual QA
Logged-out `/admin` and `/provider` redirect; admin dashboard shows real counts/alerts/recent lists;
provider dashboard shows own business KPIs, checklist, and recent bookings; empty data shows 0 / empty
states (no crash); no hydration or console errors; mobile layout has no horizontal overflow (grids
collapse to 2-up).

## Follow-ups for Phase 4.4
Provider contract-PDF upload (migration + private storage + RLS + admin/provider UI); booking
confirmation emails (client/provider/admin, no-op safe); first-20-free-premium **automation** (migration +
admin fields + expiry); any deeper Maps/TripAdvisor API embeds.
