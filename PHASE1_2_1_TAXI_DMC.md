# Phase 1.2.1 — Compile Cleanup + Taxi / Transfer / DMC Module

Two parts: (A) fix the TypeScript/build issues so the project compiles cleanly,
(B) add the Taxi & Private Transfers + DMC module (database, validation, provider
portal additions, admin pipeline, request flow). No homepage/design work.

---

## A. Compile cleanup — what was fixed

> Note: this sandbox has no npm registry access, so `npm install` / `tsc` /
> `npm run build` can't be executed here. Run the three commands locally; the
> code below was corrected by inspection to compile under `strict` mode.

1. **`app/provider/verification/client.tsx` useActionState types** — the action
   reducers now accept `Result | null` (new `PrevState` type), `Result` is
   exported, and the three hooks are annotated `useActionState<Result | null, FormData>`.
2. **`lib/supabase/server.ts` + `lib/supabase/middleware.ts` implicit any** — the
   `setAll(cookiesToSet)` callbacks are now typed with an explicit
   `CookieToSet` shape (`{ name; value; options? }`) using `CookieOptions` from
   `@supabase/ssr`; no implicit `any` remains.
3. **`next.config.mjs` bodySizeLimit** — verified: for Next 15.1, Server Actions
   are stable but `bodySizeLimit`/`allowedOrigins` still live under
   `experimental.serverActions`, so `experimental.serverActions.bodySizeLimit = '10mb'`
   is correct and won't error.
4. **`app/admin/verification/[businessId]/page.tsx`** — the signed-URL generation
   was rewritten to avoid a fragile union-typed destructure.

Run locally to confirm:
```bash
npm install
npx tsc --noEmit
npm run build
```

---

## B. Taxi / Transfer / DMC module

### Files added
- `db/08_taxi_transfer_dmc_module.sql`
- `app/request-transfer/{page.tsx,form.tsx,actions.ts}` — public "Request a custom plan"
- `app/admin/transfers/page.tsx` — hub
- `app/admin/transfers/packages/{page.tsx,actions.ts}` — package CRUD
- `app/admin/transfers/requests/{page.tsx,actions.ts}` — quote + assign
- `app/provider/transfers/{page.tsx,actions.ts}` — provider assignment inbox

### Files changed
- `lib/validation/listing-attributes.ts` — strict `taxi-private-transfers` schema
- `app/provider/verification/client.tsx` — taxi/vehicle document types added
- `app/admin/page.tsx`, `app/provider/page.tsx` — navigation links

### Database (migration 08)
- **Category seed:** `taxi-private-transfers` ("Taxi & Private Transfers").
- **Enums:** `vehicle_type` (luxury/family_car/suv/sedan/small_car/van/minibus/coach),
  `transfer_request_status`, `transfer_assignment_status`.
- **Tables:** `pickup_regions` (seeded), `transfer_packages`, `package_prices`,
  `route_prices`, `transfer_requests` (ref `TRF-2026-0001`), `transfer_assignments`
  (with a `job_details` snapshot that excludes client contact). `bookings` gains a
  `transfer_details` jsonb (server-authoritative; added to the booking-field guard).
- **RLS:** packages / package_prices / route_prices / pickup_regions are
  **public-read, admin-write only** (providers cannot write them). `transfer_requests`
  uses the anti-impersonation insert rule and is readable only by its owner/admin.
  `transfer_assignments` is admin-all + provider-read-own; providers have **no**
  direct insert/update — they act only through the RPC.
- **RPCs (SECURITY DEFINER, audited):** `admin_audit`, `admin_quote_transfer`,
  `admin_assign_transfer` (verified-provider-only, snapshots safe job details),
  `provider_respond_assignment` (ownership + transition checked: offered→accepted/
  rejected, accepted→completed).

### Updated listing-attributes validation
`taxi-private-transfers` is a `.strict()` schema (unknown keys rejected): `vehicle_type`,
`seats`, `luggage_capacity`, `pickup_regions[]`, `airport_transfer_available`,
`full_day_available`, `half_day_available`, `group_transfer_available`,
`min_group_size`, `max_group_size`, `driver_included`, `child_seat_available`,
`luxury_service`, and optional `price_airport_transfer_mur` / `price_half_day_mur` /
`price_full_day_mur` / `price_per_trip_mur`, with a min≤max group-size refinement.

### Two booking flows
- **Flow 1 (direct):** a taxi listing booked through the existing `bookings` table;
  transfer specifics ride in the new `transfer_details` jsonb (public booking UI is
  the later listing/search phase).
- **Flow 2 (DMC):** `/request-transfer` → `transfer_requests` → admin quotes and
  assigns a verified provider via `transfer_assignments` → provider accepts/completes.

---

## Exact SQL to run

After `01`–`07`, run:
```
db/08_taxi_transfer_dmc_module.sql
```
Idempotent (enum/table/policy creation guarded).

## Exact local commands
```bash
npm install
npx tsc --noEmit
npm run build
npm run dev
```

---

## Test checklist — taxi/DMC data protected & provider contact hidden

Provider context:
```sql
select id from profiles where role='provider' limit 1;   -- :provider_uid
select id from businesses where owner_id=':provider_uid'; -- :business_id
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', ':provider_uid', 'role', 'authenticated')::text, true);
```

**(1) Provider cannot create a package (admin-only)**
```sql
-- ERROR expected: violates row-level security policy
insert into transfer_packages (slug, title, base_price_mur)
values ('x-'||floor(random()*1e6)::text, 'x', 1000);
```

**(2) Provider cannot insert a route price (admin-only)**
```sql
-- ERROR expected: violates row-level security policy
insert into route_prices (from_region_id, to_region_id, vehicle_type, price_mur)
values ((select id from pickup_regions where slug='airport'),
        (select id from pickup_regions where slug='north'), 'suv', 2500);
```

**(3) Provider cannot self-assign / cannot insert assignments**
```sql
-- ERROR expected: Admin only.
select admin_assign_transfer(gen_random_uuid(), ':business_id', 'suv', 3000);
-- ERROR expected: violates row-level security policy
insert into transfer_assignments (business_id, status) values (':business_id','offered');
```

**(4) Provider cannot edit assignment financials directly**
```sql
-- ERROR expected: violates row-level security policy (no provider UPDATE policy)
update transfer_assignments set final_price_mur = 0 where business_id = ':business_id';
-- Sanctioned path only changes status, and only on your own assignment:
-- (replace :assignment_id with one assigned to another business)
-- ERROR expected: This assignment does not belong to your business.
select provider_respond_assignment(':assignment_id','accepted',null);
```

**(5) Provider cannot read client transfer requests**
```sql
-- expect 0 rows (read = admin or owning client only)
select id, full_name, email from transfer_requests;
reset role;
```

**(6) Client/public cannot see provider contact (regression)**
```sql
set local role anon;
select set_config('request.jwt.claims', json_build_object('role','anon')::text, true);
select email, whatsapp, phone from businesses;  -- expect 0 rows
-- packages/regions are public, but expose NO provider contact columns:
select title, base_price_mur from transfer_packages where is_active;
reset role;
```

**(7) Strict taxi attribute validation (app layer)**
```ts
import { validateAttributes } from '@/lib/validation/listing-attributes';
validateAttributes('taxi-private-transfers', { vehicle_type: 'suv', seats: 4,
  luggage_capacity: 3, pickup_regions: ['airport','north'] });          // success
validateAttributes('taxi-private-transfers', { vehicle_type: 'suv', seats: 4,
  luggage_capacity: 3, pickup_regions: ['airport'], hacker_field: 1 });  // error: unknown key
validateAttributes('taxi-private-transfers', { vehicle_type: 'spaceship', seats: 4,
  luggage_capacity: 3, pickup_regions: ['airport'] });                   // error: invalid vehicle_type
```

---

## SEO pages (build in the SEO phase)
Reserved routes: `/taxi-service-mauritius`, `/airport-transfer-mauritius`,
`/private-driver-mauritius`, `/luxury-transfer-mauritius`,
`/family-car-transfer-mauritius`, `/suv-transfer-mauritius`,
`/full-day-driver-mauritius`, `/half-day-driver-mauritius`,
`/group-transfer-mauritius`, `/coach-transfer-mauritius`,
`/mauritius-dmc-services`, `/mauritius-tour-planner`, and the airport→location
combinations. These render in Phase 12 (SEO/i18n) using the seeded category,
regions, and packages.

## Provider contact rule (unchanged, enforced)
No client/public surface selects provider phone/WhatsApp/email/website/social.
The assignment's `job_details` deliberately omits client contact too — drivers get
the job facts, not the client's personal details, unless an admin decides otherwise.
