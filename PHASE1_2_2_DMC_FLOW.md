# Phase 1.2.2 — Taxi / DMC Flow Cleanup

Adds the client quote-confirmation step, keeps request/assignment statuses in
sync, restricts assignment to transport providers, and requires a positive final
price. Database-first; minimal client UI included for testing. No homepage/design.

---

## Files changed / added

**Database**
- `db/09_taxi_dmc_flow_cleanup.sql` — **new**

**Admin**
- `app/admin/transfers/requests/actions.ts` — **changed** — requires positive final price, passes `override`
- `app/admin/transfers/requests/page.tsx` — **changed** — provider dropdown filtered to transport categories; final price required; "override quote" checkbox

**Client (foundation UI)**
- `app/client/quotes/page.tsx` — **new** — client sees quotes and accepts/declines
- `app/client/quotes/actions.ts` — **new** — calls `client_respond_quote`
- `app/client/page.tsx` — **changed** — links to quotes + request-transfer

---

## What changed in the flow

New `transfer_request_status` values: `quote_pending_client`, `quote_accepted`,
`quote_rejected` (added with `add value if not exists`).

End-to-end:
1. Client submits request → `new`.
2. Admin quotes (`admin_quote_transfer`) → **`quote_pending_client`**.
3. Client accepts/declines (`client_respond_quote`) → **`quote_accepted`** / `quote_rejected`.
4. Admin assigns (`admin_assign_transfer`) — allowed only when `quote_accepted`,
   **unless** the admin ticks "override quote". Requires a verified **transport**
   provider and a **positive final price** → request becomes `assigned`.
5. Provider responds (`provider_respond_assignment`), which now syncs the parent:
   - accepted → request **`confirmed`**
   - rejected → request **`reviewing`** (admin can reassign using override)
   - completed → request **`completed`**

> Design choice: on provider rejection the request returns to `reviewing` (a clean
> neutral state, as you suggested). To reassign from there the admin uses the
> "override quote" checkbox, since the request is no longer in `quote_accepted`.

`job_details` remains **contact-free** — drivers get pickup/dropoff, date/time,
passengers, luggage, flight number, and needs; never client name/email/WhatsApp.

---

## Exact SQL to run

After `01`–`08`:
```
db/09_taxi_dmc_flow_cleanup.sql
```
The migration sets `check_function_bodies = off` at the top so the new enum
labels can be referenced by the functions created in the same run. Idempotent.

## Exact local commands
```bash
npm install
npx tsc --noEmit
npm run build
npm run dev
```

---

## Test checklist (a–f)

Set up ids:
```sql
select id from profiles where role='provider' limit 1;        -- :provider_uid
select id from businesses where owner_id=':provider_uid';     -- :transport_business_id (must be taxi/airport category & verified)
select id from profiles where role='client' limit 1;          -- :client_uid
```

Make a clean test request as the client, then drive it as admin/provider.

### (a) Provider acceptance updates request → confirmed
```sql
-- As admin (postgres context in the editor): quote then accept then assign.
update transfer_requests set status='quote_accepted' where id=':request_id';
select admin_assign_transfer(':request_id', ':transport_business_id', 'suv', 3000, false); -- :assignment_id

-- As the provider:
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', ':provider_uid', 'role', 'authenticated')::text, true);
select provider_respond_assignment(':assignment_id', 'accepted', null);
reset role;

select status from transfer_requests where id=':request_id';   -- expect: confirmed
```

### (b) Provider completion updates request → completed
```sql
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', ':provider_uid', 'role', 'authenticated')::text, true);
select provider_respond_assignment(':assignment_id', 'completed', 'Done');
reset role;
select status from transfer_requests where id=':request_id';   -- expect: completed
```

### (c) Provider rejection lets admin reassign
```sql
-- New assignment on a fresh request:
update transfer_requests set status='quote_accepted' where id=':request2_id';
select admin_assign_transfer(':request2_id', ':transport_business_id', 'sedan', 2000, false); -- :assignment2_id

set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', ':provider_uid', 'role', 'authenticated')::text, true);
select provider_respond_assignment(':assignment2_id', 'rejected', 'Unavailable');
reset role;
select status from transfer_requests where id=':request2_id';  -- expect: reviewing

-- Admin reassigns from 'reviewing' using override:
select admin_assign_transfer(':request2_id', ':transport_business_id', 'sedan', 2000, true); -- succeeds
```

### (d) Final price is required for assignment
```sql
-- ERROR expected: Final price is required and must be greater than 0.
select admin_assign_transfer(':request_id', ':transport_business_id', 'suv', null, true);
select admin_assign_transfer(':request_id', ':transport_business_id', 'suv', 0, true);
```
And in the UI, `app/admin/transfers/requests/actions.ts` rejects an empty/<=0
price before calling the RPC.

### (e) Non-transport providers cannot be assigned
```sql
-- :villa_business_id = a verified business in a non-transport category
-- ERROR expected: Selected provider is not a taxi/transfer/transport provider.
select admin_assign_transfer(':request_id', ':villa_business_id', 'suv', 3000, true);
```
The admin dropdown also only lists businesses whose category slug is
`taxi-private-transfers` or `airport-transfer`.

### (f) Provider still cannot see client contact
```sql
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', ':provider_uid', 'role', 'authenticated')::text, true);

-- job_details has only job facts, no client name/email/whatsapp:
select job_details from transfer_assignments where id=':assignment_id';
-- and the requests table itself is unreadable to the provider:
select full_name, email, whatsapp from transfer_requests;   -- expect 0 rows
reset role;
```

### Bonus — client quote acceptance path
```sql
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', ':client_uid', 'role', 'authenticated')::text, true);
-- only works while status = quote_pending_client and the request is yours:
select client_respond_quote(':my_request_id', 'accept');
reset role;
```
