# Phase 1.6 — Commission / Payment Dashboard

The full 15% commission flow: invoices are auto-created when a booking reaches the guest's
arrival, providers see what they owe and upload a private payment proof, and admins verify/reject/
dispute/cancel and mark paid. Overdue is handled by an admin sweep (cron TODO). No homepage work.

---

## Files added

**Database**
- `db/15_commission_payment_dashboard.sql`

**Provider**
- `app/provider/commissions/page.tsx` — invoice list + outstanding total
- `app/provider/commissions/[id]/page.tsx` — detail, due/overdue warning, proof upload, pay instructions
- `app/provider/commissions/actions.ts` — `uploadCommissionProof` (storage + RPC)

**Admin**
- `app/admin/commissions/page.tsx` — list + status filters + "Mark overdue now"
- `app/admin/commissions/[id]/page.tsx` — full booking/provider detail, signed proof URL, actions
- `app/admin/commissions/actions.ts` — `setCommissionStatus`, `refreshOverdue`

**Shared**
- `lib/commissions/status.ts` — invoice status labels/colours
- `lib/storage/paths.ts` — added `commissionProofs` bucket constant

**Changed:** provider + admin dashboards (nav links).

---

## What the migration does
- Adds `invoice_status` value **`submitted`** (proof uploaded, awaiting admin verification).
- Creates the **private `commission-proofs`** storage bucket with owner-insert / owner+admin-read
  policies (path convention `<business_id>/<timestamp>-<file>`). Not public.
- Creates **`provider_commissions_safe`** — an owner-scoped view (filtered by `auth.uid()`) that
  joins the invoice to its booking reference + listing title and computes `is_overdue`. It exposes
  **no client contact** (no email/WhatsApp/country anywhere).
- RPCs (SECURITY DEFINER, audited):
  - `provider_submit_commission_proof(invoice_id, path)` — owner-checked; sets `proof_path` +
    status `submitted`. (Status changes are otherwise admin-only via `protect_commission_fields`.)
  - `admin_set_commission_status(invoice_id, status, note)` — admin-only; sets status, and on
    `paid` records `paid_at` + `marked_paid_by`.
  - `mark_commissions_overdue()` — admin-only; flips `pending`→`overdue` where `due_date < today`;
    returns the count.

Reuses the existing `bookings_generate_commission` trigger (creates the 15% / due+15-days invoice,
**once**, when a booking hits `client_arrived`/`completed`) and `protect_commission_fields`
(providers may only attach a proof; amount/due/status/paid_at/marked_paid_by are admin-controlled).

## Privacy
Provider pages read **only** `provider_commissions_safe` — no path can surface client email/
WhatsApp/country. Proofs are private; both provider (own) and admin reach them through short-lived
(60s) signed URLs. Admin pages show full booking + provider detail (intended).

## Overdue / 15-day logic
`due_date` is set to `created + 15 days` at invoice generation. An invoice is overdue once
`due_date < today` while unpaid. Until a scheduled job exists, the admin list has a **"Mark overdue
now"** button (`mark_commissions_overdue()`), and the UI also shows an overdue badge for past-due
`pending` invoices even before the sweep. **TODO:** run `mark_commissions_overdue()` daily via
Supabase `pg_cron` or an Edge Function, and send reminder emails (templates pending — see below).

## Reminders
Email reminder templates are **not** built yet (carried with the Phase 1.5 email TODO). The hook
point is the overdue sweep / a daily cron; `lib/email/notify.ts` is the place to add a
`notifyCommissionDue`/`notifyCommissionOverdue` helper once templates are ready.

---

## SQL to run
After `01`–`14`:
```
db/15_commission_payment_dashboard.sql
```
One enum value, one bucket + 2 storage policies, one view, three RPCs. `check_function_bodies=off`
so functions can reference the new `submitted` label in the same run. Idempotent.

## Local commands
```bash
npm install
npx tsc --noEmit
npm run build
```
Sandbox note: npm is still blocked here, so this is fixed by inspection (RPC-parity, brace and
privacy greps all pass). Live storage upload + signed URLs need a real Supabase project to exercise.

---

## Test checklist (a–h)

Setup: a booking that has reached `client_arrived` (so an invoice exists).
```sql
select id, booking_id, business_id, status, due_date from commission_invoices order by created_at desc limit 1;
-- :inv (invoice id), :biz (business), provider owner :provider_uid
```

### (a) Provider sees only their own invoices
```sql
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub',':provider_uid','role','authenticated')::text, true);
select id, booking_reference, listing_title, commission_amount_mur, status, is_overdue
from provider_commissions_safe;          -- only this provider's invoices
reset role;
```

### (b) Provider cannot see client contact via commission views
```sql
select column_name from information_schema.columns
where table_name='provider_commissions_safe'
  and column_name in ('email','whatsapp','country','phone');   -- 0 rows
-- and the table itself is unreadable to providers (Phase 1.5.1):
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub',':provider_uid','role','authenticated')::text, true);
select email from bookings;               -- 0 rows
reset role;
```

### (c) Provider can upload proof only for their own invoice
- UI: `/provider/commissions/:inv` → upload a JPG/PNG/PDF (≤10 MB). Status becomes “Proof under review”.
```sql
-- a foreign invoice must be rejected by the RPC:
select provider_submit_commission_proof(':someone_elses_invoice', 'x/y.pdf');  -- ERROR: not your business
-- storage: insert into another business's folder is blocked by the bucket policy.
```

### (d) Provider cannot mark invoice paid / change protected fields
```sql
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub',':provider_uid','role','authenticated')::text, true);
-- ERROR: Providers can only attach a payment proof...
update commission_invoices set status='paid', paid_at=now() where id=':inv';
reset role;
```

### (e) Admin views proof via signed URL
UI `/admin/commissions/:inv` → "View proof (signed link, expires in 60s)". The bucket is private;
the link is generated server-side via `createSignedUrl(path, 60)`.

### (f) Admin can mark paid / reject / dispute / cancel
```sql
select admin_set_commission_status(':inv','paid', null);
select status, paid_at, marked_paid_by from commission_invoices where id=':inv';  -- paid, timestamped
select admin_set_commission_status(':inv2','disputed','mismatch');
select admin_set_commission_status(':inv3','pending','blurry proof, re-upload'); -- reject -> back to pending
-- audit:
select action from audit_logs where entity='commission_invoice' order by created_at desc limit 5;
```

### (g) Overdue works / is handled
```sql
-- make one past due, then sweep (admin):
update commission_invoices set due_date = current_date - 1 where id=':inv4';  -- (as admin/postgres)
select mark_commissions_overdue();        -- returns count; :inv4 -> overdue
select status from commission_invoices where id=':inv4';                       -- overdue
```
The provider/admin UIs also badge past-due `pending` invoices as Overdue before the sweep.

### (h) Invoice stays linked to the booking and is not duplicated
```sql
select count(*) from commission_invoices where booking_id=':booking_id';        -- exactly 1
-- moving client_arrived -> completed does not create a second invoice (trigger guard).
```

---

## Next milestones (as you outlined)
1. Reviews after completed bookings.
2. Email templates (incl. commission due/overdue reminders + the overdue cron).
3. Then the premium homepage.
