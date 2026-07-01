# Phase 1.6.1 — Commission Security + Build Cleanup

Three fixes: lock down provider writes to `commission_invoices`, retire the old proof helper, and
make `npm run build` complete (not just compile) by marking the remaining Supabase pages dynamic.

---

## Files changed
- `db/16_commission_security_build_cleanup.sql` — **new**
- `app/provider/actions.ts` — **deleted** (obsolete `attachCommissionProof`, unused)
- `export const dynamic = 'force-dynamic'` added to:
  - `app/admin/page.tsx`
  - `app/admin/transfers/page.tsx`
  - `app/provider/page.tsx`
  - `app/(auth)/provider-signup/page.tsx`
  - `app/client/page.tsx`

## 1) Provider can no longer update commission_invoices directly
The old `commission_provider_update` policy let providers update their own invoice row (with
`protect_commission_fields` limiting columns to `proof_path`). That direct path is removed:
- `commission_provider_update` is **dropped**.
- `commission_admin_update` (admin-only) is the only direct UPDATE policy.
- Providers submit proof **only** via `provider_submit_commission_proof(invoice_id, path)` — a
  SECURITY DEFINER RPC that checks ownership, writes an audit log, and sets status `submitted`.
  It still works after the policy change because DEFINER bypasses RLS.
- `commission_provider_read` is unchanged (the table holds no client contact).

Result: a provider cannot bypass the audit log, write an arbitrary `proof_path`, or touch
`status`/`amount`/`due_date`/`paid_at`/`marked_paid_by` by a direct table update.

## 2) Old helper retired
`app/provider/actions.ts` (containing `attachCommissionProof`, which did a direct
`update commission_invoices set proof_path`) is deleted. It was unused — proof upload goes through
`app/provider/commissions/actions.ts` → `provider_submit_commission_proof()`. (Its direct update
would now fail anyway, since providers have no update policy.)

## 3) Build / static-generation timeout
`npm run build` hung at "Collecting page data" because a few auth/Supabase server pages were still
being treated as static and tried to reach Supabase during the build. All Supabase-touching pages
now carry `export const dynamic = 'force-dynamic'` (full repo re-scan confirms none remain without
it). Route handlers (`route.ts`) are already dynamic by nature.

## 4) Phase 1.6 behaviour intact
No change to the commission UIs, the safe view, the proof bucket, signed URLs, admin actions, or
the overdue sweep — only the provider's *direct table update* path was removed (the RPC path is
unchanged).

---

## SQL to run
After `01`–`15`:
```
db/16_commission_security_build_cleanup.sql
```
Idempotent (drop/recreate policy only).

## Local commands
```bash
npm install
npx tsc --noEmit
npm run build      # should now COMPLETE through "Collecting page data"
```
Sandbox note: npm is blocked here; fixed by inspection. The dynamic markers are the standard
remedy for the build-data collection hang on auth/Supabase pages.

---

## Test checklist

### (a) Provider direct update is denied
```sql
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub',':provider_uid','role','authenticated')::text, true);
-- 0 rows affected (no provider UPDATE policy) — RLS silently blocks the row:
update commission_invoices set proof_path='hack/fake.pdf' where id=':inv';
select proof_path from provider_commissions_safe where id=':inv';   -- unchanged
reset role;
```

### (b) Provider RPC proof submission still works
```sql
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub',':provider_uid','role','authenticated')::text, true);
select provider_submit_commission_proof(':inv', ':biz/123-proof.pdf');   -- ok
select status, proof_path from provider_commissions_safe where id=':inv'; -- submitted, path set
reset role;
select action from audit_logs where entity='commission_invoice' and entity_id=':inv' order by created_at desc limit 1;
-- commission_proof_submitted
```

### (c) Provider cannot change status/amount/due/paid fields
```sql
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub',':provider_uid','role','authenticated')::text, true);
-- all blocked (no update policy → 0 rows; even if a policy existed, protect_commission_fields raises):
update commission_invoices set status='paid' where id=':inv';
update commission_invoices set commission_amount_mur=0 where id=':inv';
update commission_invoices set due_date=current_date+365 where id=':inv';
update commission_invoices set paid_at=now(), marked_paid_by=':provider_uid' where id=':inv';
select status, commission_amount_mur, paid_at from commission_invoices where id=':inv'; -- unchanged
reset role;
```

### (d) Admin can still mark paid/reject/dispute/cancel
```sql
select admin_set_commission_status(':inv','paid', null);       -- as admin
select admin_set_commission_status(':inv2','disputed','x');
select admin_set_commission_status(':inv3','pending','re-upload'); -- reject
select admin_set_commission_status(':inv4','cancelled', null);
select status, paid_at from commission_invoices where id=':inv'; -- paid + timestamp
```

### (e) Build completes
`npm run build` proceeds past "Collecting page data" to a successful finish.
