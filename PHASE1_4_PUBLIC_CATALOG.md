# Phase 1.4 — Public Catalog, Search & Contact-Safe Listing Detail

A clean, mobile-first public marketplace foundation (search, category landings,
listing detail). Every public read goes through contact-safe views and only ever
surfaces **published listings + approved media + approved reviews**. No final
homepage/marketing design — just the secure browsing foundation.

---

## Files added

**Database**
- `db/11_public_catalog.sql` — `listing_media_public` + `reviews_public` views, grants

**Query layer / config**
- `lib/public/catalog.ts` — server-only search, cover-media, and detail queries
- `lib/public/filter-config.ts` — per-category filter descriptors + landing→category map

**Components**
- `components/public/ui.tsx` — price format, badges, stars
- `components/public/ListingCard.tsx` — contact-safe card (Cloudinary card image)
- `components/public/Filters.tsx` — client filters (core + per-category attributes)
- `components/public/Gallery.tsx` — client gallery; videos load only on click
- `components/public/PublicHeader.tsx` — header + WhatsApp/email CTAs
- `components/public/CatalogPage.tsx` — shared server page (query + filters + grid + pagination)

**Pages**
- `app/search/page.tsx`
- `app/listings/[slug]/page.tsx`
- 13 landing routes: `/car-rental-mauritius`, `/scooter-rental-mauritius`,
  `/airport-transfer-mauritius`, `/taxi-service-mauritius`, `/private-driver-mauritius`,
  `/catamaran-cruise-mauritius`, `/boat-trips-mauritius`, `/villas-mauritius`,
  `/apartments-mauritius`, `/studios-mauritius`, `/holiday-homes-mauritius`,
  `/restaurants-mauritius`, `/things-to-do-mauritius`

No changes to middleware (public routes were already open; only `/client`, `/provider`,
`/admin` require auth).

---

## How contact-safety is guaranteed
- `listings_public` (existing): published only, `business_name` but **no** phone/WhatsApp/
  email/website/social/owner-name.
- `listing_media_public` (new): `status='approved' AND listing published`. The view is
  owner-owned so it bypasses table RLS — the WHERE clause is the boundary. This also closes
  the one edge case where a logged-in provider's *own pending* media could otherwise appear
  in a public query via the table's owner RLS clause.
- `reviews_public` (new): `status='approved' AND listing published`, and deliberately omits
  reviewer identity (no client_id/name/email).
- The catalog query layer only ever reads these three views + the public `categories`/
  `locations` tables. No public code path touches `businesses` contact columns.

## Cloudinary delivery
Cards use `imageVariants(public_id).card` (640×480, `f_auto,q_auto`), detail galleries use
`.gallery`/`.full`, and videos use `videoVariants(public_id).poster` with the playable
`.preview` only fetched after the user clicks. The heavy original `secure_url` is never
rendered.

## Filters
Core: keyword, category, location, price min/max, rating, featured, premium, sort.
Per-category (from `filter-config.ts`): transport (vehicle type, pickup region, seats,
airport/full-day/half-day/group), accommodation (guests, bedrooms, pool, sea view,
beachfront), car rental (transmission, seats, vehicle type, airport delivery), boat/
catamaran (shared/private, capacity, food, pickup), restaurants (cuisine, budget, halal,
vegetarian, sea view). JSONB is queried safely: booleans/enums via `@>` containment, array
membership via containment, cuisine via `ilike` on the text path, and numeric minimums
(seats/guests/etc.) post-filtered in the server (a JSONB text path can't be compared
numerically in PostgREST). Foundation pagination is in-memory over the first 300 matches.

---

## Migration to run
After `01`–`10`:
```
db/11_public_catalog.sql
```
Two views + grants. Idempotent (`create or replace view`).

## Exact local commands
```bash
npm install
npx tsc --noEmit
npm run build
```
Sandbox note: npm is blocked here, so I fixed by inspection; please run locally. The build
timeout you saw previously was the Supabase Edge middleware warning at the final stage — this
phase doesn't change the middleware, and all new public pages are `dynamic = 'force-dynamic'`
(they use `searchParams`/`useSearchParams`), so they render on demand without static bailout.

---

## Test checklist (a–h)

Anon context for SQL checks:
```sql
set local role anon;
select set_config('request.jwt.claims', json_build_object('role','anon')::text, true);
```

### (a) Public search shows only published listings
```sql
select count(*) from listings_public;                              -- = published count
-- a draft/pending slug must not resolve publicly:
select count(*) from listings_public where slug=':a_draft_slug';   -- 0
```
UI: `/search` and every `/*-mauritius` page render only published listings.

### (b) Public search shows only approved media
```sql
select count(*) from listing_media_public;                         -- approved-on-published only
select count(*) from listing_media_public where id=':a_pending_media_id';  -- 0
```
UI: cards show a cover only when an approved image exists, else "No photo yet".

### (c) Public listing detail exposes no provider contact
```sql
-- view columns contain business_name + business_status only, no contact fields:
select column_name from information_schema.columns where table_name='listings_public'
order by 1;
-- expect: NO phone/whatsapp/email/website/social/owner columns
```
UI: detail page shows `business_name` + verified tick; contact happens only via the
platform WhatsApp/email CTAs.

### (d) Pending/rejected/hidden media never appears publicly
```sql
-- pick ids in each non-approved state, all must be absent from the public view:
select count(*) from listing_media_public
where id in (':pending_id', ':rejected_id', ':hidden_id');         -- 0
```

### (e) Category filters work
```sql
select count(*) from listings_public
where category_id=(select id from categories where slug='villas');
```
UI: `/villas-mauritius` shows only villas; `/search?category=car-rental` only car rentals.

### (f) Taxi / private-transfer filters work
```sql
select count(*) from listings_public
where category_id=(select id from categories where slug='taxi-private-transfers')
  and attributes @> '{"vehicle_type":"suv","airport_transfer_available":true}'
  and attributes @> '{"pickup_regions":["north"]}';
```
UI: `/taxi-service-mauritius?f_vehicle_type=suv&f_airport_transfer_available=1&f_pickup_regions=north`.

### (g) Cloudinary optimized URLs are used
Inspect a rendered card/detail image URL — it contains a transformation segment, e.g.
`/image/upload/c_fill,w_640,h_480,q_auto,f_auto/<public_id>` (card) or
`c_limit,w_1920,q_auto,f_auto` (full), and video posters use `so_0,...jpg`. The raw
`secure_url` is never emitted.

### (h) Build status
- `npm install` — expected to pass (worked in your last run).
- `npx tsc --noEmit` — fixed by inspection under strict mode; no new `any`-unsafe paths
  (public views read as untyped rows and are explicitly mapped to typed shapes).
- `npm run build` — unchanged middleware; new pages are dynamic. If the final-stage Edge
  warning recurs it's the pre-existing Supabase middleware note, not a TS failure.

---

## Item 9 — future hardening TODOs (documented, not built)
1. **Provider category restriction** — providers can currently pick any category when creating
   a listing. Eventually restrict each provider to their approved business category (or an
   admin-approved set), enforced in the DB.
2. **Single cover image per listing** — `is_cover` is set in app logic today; add a DB
   constraint/trigger so at most one media row per listing can be `is_cover=true`.
3. **Guest quote acceptance** — still needs a secure email token/link or an account-claim
   flow before a guest (non-logged-in) can accept a DMC quote (carried over from 1.3).
4. **Live Cloudinary upload test** — must be exercised against real Cloudinary credentials
   (the sandbox can't reach Cloudinary); verify signed upload + metadata save end-to-end.

---

## Notes
- Public pages reuse one `CatalogPage` component; landing pages just lock the category set.
- This is the catalog/search/detail foundation only — the marketing homepage is still deferred.
