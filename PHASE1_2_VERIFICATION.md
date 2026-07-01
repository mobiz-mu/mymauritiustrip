# Phase 1.2 — Verification Hardening + Provider Verification & Admin Approval

Security-first, database-enforced. Two migrations (`06`, `07`) plus the
provider and admin verification UI. No homepage/design work.

---

## Files changed / added

**Database**
- `db/06_verification_hardening.sql` — **new** — four self-approval protections
- `db/07_verification_pipeline.sql` — **new** — private Storage buckets + RLS, and the audited RPCs

**Provider side**
- `app/provider/verification/page.tsx` — **rewritten** (was a placeholder) — server loader
- `app/provider/verification/client.tsx` — **new** — status, fee, uploads, submit, resubmit UI
- `app/provider/verification/actions.ts` — **new** — upload proof/document, submit for review
- `app/provider/page.tsx` — **changed** — adds a "Go to verification" link when unverified

**Admin side**
- `app/admin/verification/page.tsx` — **new** — review queue
- `app/admin/verification/[businessId]/page.tsx` — **new** — detail + private file viewing + decisions
- `app/admin/verification/actions.ts` — **new** — calls the audited RPCs
- `app/admin/page.tsx` — **changed** — adds a "verification queue" link

**Shared**
- `lib/storage/paths.ts` — **new** — bucket names, filename sanitization, path builder
- `next.config.mjs` — **changed** — `serverActions.bodySizeLimit = '10mb'` for uploads

---

## New database objects

**06 (triggers + functions):** `protect_document_fields`, `protect_listing_media_fields`,
`protect_payment_status`, `enforce_review_reply_ownership` — wired to triggers
`business_documents_protect`, `listing_media_protect`, `bvp_protect_status`,
`premium_protect_status`, `payments_protect_status`, `review_replies_ownership`.

**07 (storage + RPCs):** buckets `business-documents`, `payment-proofs` (private) with
owner/admin read + owner insert policies on `storage.objects`; RPCs
`submit_verification_request`, `admin_set_payment_status`, `admin_set_document_status`,
`admin_approve_provider`, `admin_reject_provider`, `admin_suspend_provider`
(all `SECURITY DEFINER`, self-checking `is_admin()`/ownership, all writing `audit_logs`).

---

## Exact SQL to run

In the Supabase SQL editor, after `01`–`05`:

```
db/06_verification_hardening.sql
db/07_verification_pipeline.sql
```

Both are idempotent. `07` creates the two private buckets; you do **not** need to
create them manually in the dashboard. Confirm under Storage that
`business-documents` and `payment-proofs` exist and are **not public**.

---

## Exact local commands

```bash
npm install        # no new dependencies
npm run dev
```

Make yourself admin (if not already):
```sql
update profiles set role = 'admin' where email = 'you@example.com';
```

---

## Provider / admin verification flow (walkthrough)

**Provider**
1. Sign up as a provider → business shell created as `pending_verification`;
   `/provider` shows the locked state with a "Go to verification" button.
2. `/provider/verification` shows three steps:
   - **Step 1 — Rs 499 fee:** pick method (Bank transfer / MCB Juice), upload proof
     (JPG/PNG/WEBP/PDF, ≤10 MB). The file goes to the private `payment-proofs`
     bucket; a `business_verification_payments` row is created as **submitted**.
   - **Step 2 — Documents:** upload BRN/ID/licence to the private
     `business-documents` bucket; each row is **pending**.
   - **Step 3 — Submit for review:** enabled once a proof exists. Calls
     `submit_verification_request()` → business moves to **under_review**.
3. Status badge updates live on this page. If admin rejects, the page shows the
   **reason** and the button becomes **Resubmit for review**.

**Admin**
1. `/admin/verification` lists every non-verified business (oldest first).
2. Open a business → `/admin/verification/{id}`:
   - Full business details **including private contact** (admin-only view).
   - **Payment proof** with a 60-second signed "View proof" link → Verify / Reject.
   - **Documents** with signed "View" links → Approve / Reject.
   - **Decision:** Approve provider (requires a verified payment → sets
     **verified**, unlocks listings), Reject with reason (→ **rejected**), or Suspend.
3. Every payment/document/approval/rejection/suspension writes an `audit_logs` row
   with the acting admin's id.

**Status updates to the provider:** surfaced in-app on `/provider/verification`
(status badge + rejection reason) immediately after the admin acts. Branded email
notifications are wired in Phase 13; the in-app status is the source of truth now.

> Note: no client/public page exists that selects provider contact columns. Contact
> details are visible only on the admin detail page. Public catalog reads go through
> the `listings_public` view (Phase 3), which has no contact columns.

---

## Test checklist — providers cannot self-approve

Run in the Supabase SQL editor. Simulate the provider by setting role + JWT sub.
Replace placeholders with real ids.

```sql
select id from profiles where role='provider' limit 1;   -- :provider_uid
select id from businesses where owner_id=':provider_uid'; -- :business_id
```

Enter the provider's context:
```sql
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', ':provider_uid', 'role', 'authenticated')::text, true);
```

**(1) Cannot self-approve a document**
```sql
-- create as pending (allowed):
insert into business_documents (business_id, doc_type, storage_path, status)
values (':business_id','brn',':business_id/x.pdf','pending') returning id;  -- :doc_id
-- ERROR expected: only admin can change document status
update business_documents set status='approved' where id=':doc_id';
-- ERROR expected: new documents must start as pending
insert into business_documents (business_id, doc_type, storage_path, status)
values (':business_id','id',':business_id/y.pdf','approved');
```

**(2) Cannot self-approve listing media status**
```sql
-- ERROR expected: new media must start as pending (and provider needs a listing;
-- if no published listing yet, the listing-rules trigger blocks first — both are correct)
-- Demonstrate the status guard directly on an existing pending media row owned by you:
-- ERROR expected: only admin can change media status
update listing_media set status='approved'
where listing_id in (select id from listings where business_id=':business_id');
```

**(3) Cannot self-verify the Rs 499 payment**
```sql
-- ERROR expected: must start pending/submitted
insert into business_verification_payments (business_id, amount_mur, status)
values (':business_id', 499, 'verified');
-- allowed:
insert into business_verification_payments (business_id, amount_mur, status)
values (':business_id', 499, 'submitted') returning id;  -- :pay_id
-- ERROR expected: only admin can change payment status (RLS also blocks provider UPDATE)
update business_verification_payments set status='verified' where id=':pay_id';
-- ERROR expected: Admin only.
select admin_set_payment_status(':pay_id','verified');
```

**(4) Cannot self-activate a premium subscription**
```sql
-- ERROR expected: must start pending/submitted
insert into premium_subscriptions (business_id, amount_mur, period_end, status)
values (':business_id', 299, current_date + 30, 'verified');
```

**(5) Cannot approve own provider status**
```sql
-- ERROR expected: Admin only.
select admin_approve_provider(':business_id');
-- ERROR expected: ...verification/premium/ownership fields...admin-controlled (from 05)
update businesses set status='verified' where id=':business_id';
```

**(6) Cannot reply to another business's review**
```sql
-- :other_review_id = a review on a listing NOT owned by this provider
-- ERROR expected: you can only reply to reviews on your own listings
insert into review_replies (review_id, business_id, body)
values (':other_review_id', ':business_id', 'thanks');
-- ERROR expected: you can only reply on behalf of your own business
insert into review_replies (review_id, business_id, body)
values (':own_review_id', ':someone_elses_business_id', 'thanks');
```

Reset:
```sql
reset role;
```

**(7) Client/public cannot see provider contact (regression check)**
```sql
set local role anon;
select set_config('request.jwt.claims', json_build_object('role','anon')::text, true);
select email, whatsapp, phone from businesses;   -- expect 0 rows
reset role;
```

All ERROR lines above must raise; the "allowed" inserts must succeed. Admins (and
the service-role server) bypass these guards by design.
