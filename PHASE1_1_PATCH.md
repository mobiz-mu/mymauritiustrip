# Phase 1.1 — Security Hardening Patch

Database-level hardening. No UI changes. Apply migration `db/05_security_hardening.sql`
on top of an environment that already has `01`–`04`.

## Files changed / added

**Added**
- `db/05_security_hardening.sql` — all hardening (items 1–9)
- `app/provider/actions.ts` — sanctioned provider write paths (accept/reject booking, suggest change, attach commission proof)

**Behaviour changed by the migration (no file rewrite needed)**
- `enforce_listing_rules()` — now blocks listing INSERT entirely unless the business is `verified` (previously only blocked publish)
- `generate_commission_invoice()` — now `SECURITY DEFINER`
- `refresh_listing_rating()` — now `SECURITY DEFINER`
- RLS insert policies `trip_requests_insert`, `support_insert`, `bm_insert` — tightened against UUID impersonation

**New database objects**
- Functions: `acting_as_admin()`, `protect_business_fields()`, `protect_listing_fields()`, `protect_booking_fields()`, `protect_commission_fields()`, `contains_contact_info()`, `guard_contact_leak_listing/_media/_booking_message/_review_reply()`, `enforce_booking_integrity()`
- Triggers: `businesses_protect_fields`, `listings_protect_fields`, `bookings_protect_fields`, `commission_protect_fields`, `listings_guard_contact`, `media_guard_contact`, `booking_messages_guard_contact`, `review_replies_guard_contact`, `bookings_enforce_integrity`

## How the privilege model works (read this first)

Column-protection triggers call `acting_as_admin()`, which returns true for:
1. an **admin profile** in an authenticated session (`is_admin()`),
2. the **service_role** server (admin pipeline / cron), and
3. **trusted internal `SECURITY DEFINER` functions** (they run as `postgres`).

Everyone else — including every provider and client — is blocked from the
protected columns. This is why `generate_commission_invoice()` and
`refresh_listing_rating()` are now `SECURITY DEFINER`: they legitimately write
protected columns on the user's behalf and must not be blocked by the guards.

## Exact SQL to run

In the Supabase SQL editor, run the whole file:

```
db/05_security_hardening.sql
```

It is idempotent (functions use `create or replace`; triggers use
`drop trigger if exists` then `create`), so re-running is safe.

## Exact local commands

No new dependencies. After pulling the updated files:

```bash
npm install        # unchanged deps, safe to run
npm run dev
```

---

## Test checklist (proves a–f)

Run these in the Supabase SQL editor. Replace the placeholder UUIDs with real
rows from your project. The pattern simulates an authenticated user by setting
the role and the JWT `sub` claim, then attempting a forbidden action and
expecting an **ERROR** (block) — except (f), which expects **no rows**.

Setup helpers (get some ids):
```sql
-- A provider user + their business + (later) a listing
select id, role from profiles where role = 'provider' limit 1;          -- :provider_uid
select id, owner_id, status from businesses limit 1;                    -- :business_id
```

### (a) Unverified provider CANNOT create a listing
```sql
-- Ensure the business is NOT verified for this test:
update businesses set status = 'pending_verification' where id = ':business_id';

set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', ':provider_uid', 'role', 'authenticated')::text, true);

-- Expect: ERROR "Only verified providers can create listings..."
insert into listings (business_id, category_id, title, slug, description, base_price_mur)
values (':business_id',
        (select id from categories where slug='villas'),
        'Test villa', 'test-villa-'||floor(random()*100000)::text,
        'A nice villa', 5000);
reset role;
```

### (b) Provider CANNOT self-verify (or touch premium/owner fields)
```sql
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', ':provider_uid', 'role', 'authenticated')::text, true);

-- Expect: ERROR "...verification, premium, or ownership fields...admin-controlled."
update businesses
  set status = 'verified', verification_paid = true, verified_at = now()
  where id = ':business_id';
reset role;
```

### (c) Provider CANNOT set premium/featured on a listing
First, as admin/postgres, verify the business and create a draft listing to edit:
```sql
update businesses set status='verified', verification_paid=true, verified_at=now()
  where id=':business_id';
insert into listings (business_id, category_id, title, slug, description, base_price_mur, status)
values (':business_id', (select id from categories where slug='villas'),
        'Editable villa', 'editable-villa', 'desc', 5000, 'draft')
returning id;   -- :listing_id
```
Then as the provider:
```sql
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', ':provider_uid', 'role', 'authenticated')::text, true);

-- Expect: ERROR "...premium, featured, rating, or rejection fields...admin-controlled."
update listings set is_featured = true, is_premium = true where id = ':listing_id';

-- Also expect ERROR: provider cannot self-publish
update listings set status = 'published' where id = ':listing_id';
reset role;
```

### (d) Provider CANNOT mark commission paid / change amounts
Create a commission invoice as admin/postgres first (or via a completed booking),
then attempt as provider:
```sql
-- as postgres (admin context). :booking_id must be a real bookings.id row.
insert into commission_invoices
  (booking_id, business_id, booking_total_mur, commission_amount_mur, due_date)
values (':booking_id', ':business_id', 10000, 1500, current_date + 15)
returning id;   -- :ci_id

set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', ':provider_uid', 'role', 'authenticated')::text, true);

-- Expect: ERROR "...only attach a payment proof...admin-controlled."
update commission_invoices
  set status = 'paid', paid_at = now(), commission_amount_mur = 0
  where id = ':ci_id';

-- This one SUCCEEDS (the only allowed provider write):
update commission_invoices set proof_path = 'proofs/test.jpg' where id = ':ci_id';
reset role;
```

### (e) Contact details are blocked in listing content
```sql
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', ':provider_uid', 'role', 'authenticated')::text, true);

-- Each of these should ERROR with a contact-not-allowed message:
update listings set description = 'Call me on +230 5506 8119' where id = ':listing_id';
update listings set description = 'email me at owner@gmail.com' where id = ':listing_id';
update listings set description = 'see www.mysite.mu for more'  where id = ':listing_id';
update listings set description = 'follow @myvilla on instagram' where id = ':listing_id';
reset role;
```

### (f) Client / public CANNOT see provider contact details
```sql
-- As an anonymous visitor:
set local role anon;
select set_config('request.jwt.claims', json_build_object('role','anon')::text, true);

-- Expect: 0 rows (no public/client SELECT policy on businesses).
select email, whatsapp, phone, owner_full_name from businesses;

-- Public catalog reads go through the contact-free view instead:
select * from listings_public limit 1;   -- has business_name only, no contact columns
reset role;
```

### Bonus — anti-impersonation (item 8)
```sql
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', ':provider_uid', 'role', 'authenticated')::text, true);

-- Expect: ERROR / violates RLS (cannot insert another user's UUID)
insert into trip_requests (client_id, full_name, email, needs)
values (gen_random_uuid(), 'X', 'x@x.com', 'spoof');
reset role;
```

> Note on contact detection: the DB regex errs toward caution (a long digit run
> can trip the phone rule). The TypeScript detector gives users a friendly
> message before submit; the DB guard is the backstop providers can't bypass.
> Admins (and trusted server jobs) are exempt and can override when needed.
