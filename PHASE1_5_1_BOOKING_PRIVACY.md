# Phase 1.5.1 — Booking Privacy & Cleanup Patch

Protects client contact at the database/API level (not just the UI), guards booking free text,
removes the obsolete booking actions, and bumps Next.js to a patched release.

---

## Files changed
- `db/14_booking_privacy_hardening.sql` — **new**
- `app/provider/bookings/page.tsx` — reads `provider_bookings_safe`
- `app/provider/bookings/[id]/page.tsx` — reads `provider_bookings_safe`
- `app/provider/bookings/actions.ts` — client email looked up via service-role client for notify
- `app/provider/actions.ts` — obsolete `acceptBooking`/`rejectBooking`/`suggestBookingChange` removed
- `package.json` — `next` bumped `15.1.0` → `^15.2.3`

## What the migration does
1. **Tightened `bookings_read`** — now `client_id = auth.uid() OR is_admin()`. Providers can no
   longer `SELECT` the bookings table at all, so client email/WhatsApp/country are unreadable to
   them via the API. The provider direct-update policy is replaced with an admin-only one
   (`bookings_admin_update`); every provider transition already goes through the
   `provider_respond_booking()` SECURITY DEFINER RPC.
2. **`provider_bookings_safe` view** — owner-scoped (filtered by `auth.uid()`), exposing only
   safe fields: id, reference, status, guest name, dates, people/quantity, amount, special
   request (contact-guarded), suggested date, provider note, listing title/slug, and commission
   status/amount/due. **No** email/WhatsApp/country/phone columns exist on it. Provider pages now
   read this view.
3. **Booking contact-leak guard** — `guard_contact_leak_booking` blocks phone/WhatsApp/email/URL/
   social/@handle in `special_request` and `provider_note` on insert/update, so neither party can
   smuggle direct contact into a booking note.

## Next.js security
`next@15.1.0` is affected by the middleware-authorization-bypass advisory (CVE-2025-29927). Bumped
to `^15.2.3`, the first 15.x line containing the fix. Recommended upgrade step:
```bash
npm install            # picks up next@^15.2.3
npx tsc --noEmit
npm run build
```
No structural changes were needed — the `next.config.mjs` keys (`experimental.serverActions.bodySizeLimit`)
are unchanged in 15.2.x. If you prefer a pinned version, set `"next": "15.2.4"` (or the latest
15.x) explicitly.

## Provider arrived/completed (documented)
Providers may still mark **arrived**/**completed**, which fires the commission invoice — this is
intended. **Admin can also override** any booking status via `admin_set_booking_status()`.
Commission generation is **idempotent**: `bookings_generate_commission` only inserts when no
invoice exists for the booking (`not exists (... where booking_id = new.id)`), so moving
`confirmed → client_arrived → completed` produces exactly **one** invoice. This must be re-tested
after any change to that trigger (see test (g)).

---

## SQL to run
After `01`–`13`:
```
db/14_booking_privacy_hardening.sql
```
Idempotent (drop/recreate policies, `create or replace view`, guarded trigger).

## Local commands
```bash
npm install
npx tsc --noEmit
npm run build
```
Sandbox note: npm is blocked here; fixes are by inspection. Please run locally to confirm the
Next bump installs cleanly.

---

## Test checklist (a–g)

### (a) Provider cannot read client email/WhatsApp from direct booking access
```sql
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub',':provider_uid','role','authenticated')::text, true);
select email, whatsapp, country from bookings;     -- expect 0 rows (no provider SELECT on bookings)
select count(*) from bookings;                       -- 0
reset role;
```

### (b) Provider still sees safe booking details via the view
```sql
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub',':provider_uid','role','authenticated')::text, true);
select id, reference, status, full_name, arrival_date, num_people, base_amount_mur,
       special_request, suggested_date, provider_note, listing_title,
       commission_status, commission_amount_mur
from provider_bookings_safe;                          -- rows for THIS provider only, no contact cols
-- and the view has no contact columns at all:
select column_name from information_schema.columns where table_name='provider_bookings_safe'
  and column_name in ('email','whatsapp','country');  -- 0 rows
reset role;
```

### (c) Client can still read their own booking
```sql
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub',':client_uid','role','authenticated')::text, true);
select reference, status, email from bookings;        -- own rows incl own contact
reset role;
```

### (d) Admin can still read full booking details
```sql
-- as admin profile:
select reference, full_name, email, whatsapp, country from bookings limit 5;  -- visible
```

### (e) Contact details blocked in special_request / provider_note
```sql
-- client insert with contact in special_request -> ERROR
insert into bookings (client_id, listing_id, full_name, email, special_request)
values (':client_uid', ':published_listing_id', 'Test', 'test@example.com', 'call me 5 506 8119');
-- provider note via RPC with contact -> ERROR
select provider_respond_booking(':booking_id','reject', null, 'whatsapp me at +230 5 123 4567');
-- both raise: Contact details are not allowed in the booking request / booking notes.
```

### (f) Old provider_accepted direct-action flow removed
```bash
grep -rn "provider_accepted" app/   # only a NOTE comment in app/provider/actions.ts; no setter
grep -rn "acceptBooking\|rejectBooking\|suggestBookingChange" app/   # no matches
```
Provider transitions now exist only via `provider_respond_booking()` (accept → `confirmed`).

### (g) Commission invoice generates exactly once
```sql
select provider_respond_booking(':confirmed_id','arrived');     -- -> client_arrived (invoice created)
select count(*) from commission_invoices where booking_id=':confirmed_id';  -- 1
select provider_respond_booking(':confirmed_id','completed');   -- -> completed
select count(*) from commission_invoices where booking_id=':confirmed_id';  -- still 1 (no duplicate)
```
