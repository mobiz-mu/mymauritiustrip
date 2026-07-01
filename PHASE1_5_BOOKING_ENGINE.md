# Phase 1.5 — Booking Engine Foundation

End-to-end booking request flow: client requests → provider accept/reject/suggest-date →
confirmation → arrival/completion → commission invoice. Pay-on-arrival. All communication
stays on MyMauritiusTrip.com (dashboard + WhatsApp + email). No homepage/marketing design.

---

## Files added

**Database**
- `db/13_booking_engine.sql` — `date_suggested` status, `suggested_date`/`provider_note`
  columns, and four self-authorizing RPCs.

**Email foundation**
- `lib/email/notify.ts` — Resend wrapper (no-ops without `RESEND_API_KEY`) + booking
  notification helpers. Templates are a TODO.

**Booking creation**
- `app/listings/[slug]/book/page.tsx`, `booking-form.tsx`, `actions.ts`
- `app/listings/[slug]/page.tsx` — "Request to Book" now links to the form

**Client**
- `app/client/bookings/page.tsx`, `[id]/page.tsx`, `actions.ts`
- `lib/bookings/status.ts` — shared status labels/colours

**Provider**
- `app/provider/bookings/page.tsx`, `[id]/page.tsx`, `actions.ts`

**Admin**
- `app/admin/bookings/page.tsx`, `[id]/page.tsx`, `actions.ts`

**Changed:** client/provider/admin dashboards (nav links).

---

## Status lifecycle
```
pending ─accept→ confirmed ─arrived→ client_arrived ─completed→ completed
  │                                   (commission invoice auto-generated here)
  ├─reject→ provider_rejected
  └─suggest_date→ date_suggested ─client accept→ confirmed
                                  └client decline→ cancelled
client may cancel: pending | date_suggested | confirmed → cancelled
admin may override to any status.
```
- **Amounts are server-authoritative**: the client never sends a price. `bookings_enforce_integrity`
  derives `business_id` from the listing, computes `base_amount_mur` from listing price × units,
  and requires the listing to be `published`. `bookings_set_reference` assigns `MMT-YYYY-NNNN`.
- **Commission**: the existing `bookings_generate_commission` trigger creates the 15% invoice
  (15-day due) the moment a booking reaches `client_arrived`/`completed` — i.e. on arrival,
  matching pay-on-arrival.
- **Privileged transitions** go through SECURITY DEFINER RPCs that self-authorize on
  `auth.uid()` (provider owns the business / client owns the booking / admin). They run as
  owner, which bypasses `protect_booking_fields`, so the RPC body is the authorization boundary.

## Contact-safety
Provider contact is never shown to clients: the client booking pages display `business_name`
only (via `listings_public`) plus the platform WhatsApp/email CTAs. Client details on a booking
are visible to the provider hosting them (expected); no provider phone/email/WhatsApp/website is
ever surfaced to the client side.

## Email
`lib/email/notify.ts` sends plain-text transactional notes via Resend if `RESEND_API_KEY` is set,
else logs and no-ops (never blocks a booking). Sent best-effort on creation (client + provider)
and on provider status changes (client). **TODO:** real HTML templates, localisation, and an
admin/Edge-function sender for provider/admin notifications that shouldn't depend on a user session.

---

## Migration to run
After `01`–`12`:
```
db/13_booking_engine.sql
```
Adds one enum value, two columns, four RPCs. `check_function_bodies=off` so the functions can
reference the new `date_suggested` label in the same run. Idempotent.

## Environment (optional, for live email)
```
RESEND_API_KEY=...
EMAIL_FROM=MyMauritiusTrip <no-reply@mymauritiustrip.com>
```

## Exact local commands
```bash
npm install
npx tsc --noEmit
npm run build
```
Sandbox note: npm is blocked here, so fixes are by inspection; please run locally. No middleware
changes; all new pages are dynamic. Live email + the Cloudinary upload still need real
credentials to exercise end-to-end.

---

## Test checklist

Set up:
```sql
select id from profiles where role='client' limit 1;     -- :client
select id from profiles where role='provider' limit 1;    -- :provider
select id from businesses where owner_id=':provider';     -- :biz (verified)
-- a published listing for :biz with slug :slug, id :lid
```

### 1) Client can request a booking (server-authoritative amount)
UI: open `/listings/:slug` → **Request to Book** → submit. Expect redirect to
`/client/bookings/[id]` with a `MMT-YYYY-NNNN` reference. Then:
```sql
select reference, status, business_id, base_amount_mur, display_amount
from bookings order by created_at desc limit 1;
-- status='pending', business_id=:biz (trigger-derived), amount computed server-side
```

### 2) Provider accept → confirmed
```sql
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub',':provider','role','authenticated')::text, true);
select provider_respond_booking(':booking_id','accept');
select status, confirmed_at from bookings where id=':booking_id';  -- confirmed
reset role;
```

### 3) Provider reject / suggest-date
```sql
-- reject (on a fresh pending booking)
select provider_respond_booking(':b2','reject', null, 'Fully booked');
select status from bookings where id=':b2';                         -- provider_rejected
-- suggest a date (on another pending booking)
select provider_respond_booking(':b3','suggest_date', current_date + 5, 'Try Friday?');
select status, suggested_date from bookings where id=':b3';         -- date_suggested
```

### 4) Client responds to suggested date
```sql
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub',':client','role','authenticated')::text, true);
select client_respond_suggested_date(':b3','accept');
select status, arrival_date from bookings where id=':b3';           -- confirmed, arrival_date=suggested
reset role;
```

### 5) Provider cannot jump straight to completed from pending / cannot touch others
```sql
-- ERROR expected: This booking cannot be completed from its current status.
select provider_respond_booking(':pending_id','completed');
-- ERROR expected: does not belong to your business  (as a different provider)
```

### 6) Pay-on-arrival → commission invoice auto-generated
```sql
select provider_respond_booking(':confirmed_id','arrived');
select status from bookings where id=':confirmed_id';               -- client_arrived
select count(*) from commission_invoices where booking_id=':confirmed_id'; -- 1
select commission_amount_mur from commission_invoices where booking_id=':confirmed_id';
-- = round(base_amount_mur * 0.15, 2)
```

### 7) Client cancel
```sql
select client_cancel_booking(':pending_or_confirmed_id');           -- as the client
select status from bookings where id=':...';                         -- cancelled
```

### 8) Admin override + sees full info
UI `/admin/bookings/[id]`: shows client contact + provider business + commission invoice and
can override status. `admin_set_booking_status(:id,'completed')` works only for admin.

### 9) No provider contact leaks to the client
Client booking pages show `business_name` only (no provider phone/email/WhatsApp/website),
plus platform WhatsApp/email CTAs.

### 10) Build / type-check
- `npm install` — expected pass.
- `npx tsc --noEmit` — fixed by inspection; booking rows read as untyped and are explicitly
  cast where embedded relations are accessed.
- `npm run build` — unchanged middleware; new pages dynamic. Prior Edge warning is unrelated to TS.

---

## Carried-over / new TODOs
- Real email templates + an admin/Edge sender independent of a user session.
- Guest (non-logged-in) booking + the secure quote/booking token or account-claim flow.
- Provider→approved-category restriction; single-cover DB constraint (from 1.4).
- Live Cloudinary upload + live email need real credentials to verify end-to-end.
- Booking ↔ review link (leave a review after `completed`) is not built yet.
