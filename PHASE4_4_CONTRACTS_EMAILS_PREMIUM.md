# Phase 4.4 — Contract PDF upload · Booking emails · First-20 launch premium

Backend/launch workflow features. Adds **two migrations** (contracts + launch premium), a private storage
bucket, provider/admin contract UI, and expiry-aware premium. **Booking confirmation emails were already
fully implemented** in `lib/email/notify.ts` — verified, not rebuilt (details below). No homepage redesign,
no public commission wording, no provider contact exposed publicly.

---

## Files changed

```
NEW:
- db/23_provider_contracts.sql              contract table + private bucket + RLS + storage policies
- db/24_launch_premium.sql                  premium expiry/source fields + view + award/expire functions
- app/admin/contracts/page.tsx              admin contract review (list, approve/reject, view)
- app/admin/contracts/actions.ts            reviewContract server action (admin-only)
- app/admin/contracts/[id]/download/route.ts  admin-only short-lived signed-URL download

MODIFIED:
- lib/storage/paths.ts                      + providerContracts bucket + CONTRACT_* (PDF, 10 MB)
- lib/public/catalog.ts                     premium filter now excludes EXPIRED premium
- app/provider/verification/actions.ts      + uploadContract (PDF only, own business)
- app/provider/verification/page.tsx        fetch latest contract, pass to client
- app/provider/verification/client.tsx      contract section (status, upload, re-upload on reject)
- lib/dashboard/metrics.ts                  + contract & launch-premium metrics (admin + provider)
- app/admin/page.tsx                        + contracts/premium alert row + quick link
- app/provider/page.tsx                     + contract & premium status cards

DELETED: none
```

## 1. Provider contract PDF upload
- **Migration `db/23`** creates `provider_contracts` (business_id, storage_path, original_filename,
  mime_type, size_bytes, `status` = `contract_status` enum pending/approved/rejected, admin_note,
  uploaded_at, reviewed_at, reviewed_by, created_at, updated_at) + an `updated_at` trigger.
- **Private bucket `provider-contracts`** (`public = false`) with storage policies mirroring the existing
  pattern: object path is `<business_id>/<ts>-<name>.pdf`; providers read/insert/update only their own
  folder; admin (or the service role, used only server-side for download) can read all; **no anon/public
  policy exists**.
- **RLS on the table:** provider selects/inserts/updates own (via business ownership); admin full; no
  public.
- **Provider UI** (`/provider/verification`): a "Signed contract agreement (PDF)" section shows status
  (not uploaded / pending / approved / rejected + admin note) and an **upload form accepting PDF only**;
  re-upload is offered when rejected and hidden once approved. Server action validates **PDF + ≤10 MB**.
- **Admin UI** (`/admin/contracts`): pending queue + reviewed list, **approve / reject with note**, and a
  secure **View PDF** link. Download goes through `/admin/contracts/[id]/download`, which checks
  `requireRole('admin')` and returns a **60-second signed URL generated server-side** — never rendered in
  a page or exposed publicly.

## 2. Booking confirmation emails — already implemented (verified)
`createBooking` (`app/listings/[slug]/book/actions.ts`) already calls `notifyBookingCreated(bookingId)`
**after** the insert, which sends **client + provider + admin** emails via `lib/email/notify.ts`:
- **No-op safe:** if `RESEND_API_KEY` is missing it logs `[email:noop]` and returns — never crashes.
- **Server-side only**, using the service-role admin client for recipient resolution (clients/providers
  can't read each other's rows); templates in `lib/email/templates.ts` enforce the contact-leak rules.
- **No duplicates on refresh:** the send fires inside the server action on creation, not on render.
- Logged to `email_events` (from Phase 1.8). Client email includes reference/listing/date/status + support
  contact; provider email includes booking details + dashboard link; admin email includes operational
  details + admin link.

No change was needed here. To go live, just set the env vars (Vercel checklist below).

## 3. First-20 launch-free Premium Ads automation
- **Migration `db/24`** adds to `listings`: `premium_source` (`manual`/`paid`/`launch_free`),
  `premium_started_at`, `premium_expires_at`, `premium_awarded_at`, `premium_award_rank`; and recreates
  `listings_public` to expose `premium_source` + `premium_expires_at` (still name-only, no contact).
- **Automation:** a trigger on `listings` (insert/update of status) calls `award_launch_premium()` when a
  listing becomes **published**. The function awards **1-month free premium** to the first **20** listings
  (`premium_source='launch_free'`, sets started/expires/awarded/rank), is **capped at 20** and
  **idempotent** per listing.
- **Expiry respected publicly:** `searchListings({ premium: '1' })` now filters
  `is_premium = true AND (premium_expires_at IS NULL OR premium_expires_at > now())`, so expired launch-free
  premium **never shows** in Premium Ads — even before any sweep. `expire_launch_premium()` is provided to
  flip the stale `is_premium` flag (safe to run anytime or wire to the existing cron).
- **Visibility:** admin dashboard shows `launch-free premium X/20` + "expiring ≤ 7 days"; provider dashboard
  shows a **Premium ads** card with Active + expiry date. Paid/manual premium (null expiry) is unaffected.
- `searchListings` signature and existing callers are unchanged.

## 4/5. Dashboard updates (cards only — not rebuilt)
Admin: alert row for **contracts to review / missing contracts / rejected contracts** + a **launch-free
premium X/20** card, and a "Provider contracts" quick link. Provider: **Contract** status card (links to
verification) + **Premium ads** status/expiry card.

## Security & privacy
- Contract bucket is **private**; provider sees only own contract (RLS + storage folder scoping); admin
  reads all. **Service-role client is used only in server files** (`route.ts`, `lib/supabase/admin.ts`,
  `lib/email/notify.ts`) — never in a `'use client'` component (verified by grep). **Resend key** is only
  read server-side. Middleware unchanged. No public commission wording; no provider contact on public
  pages.

---

## Supabase SQL order (run in the SQL editor, in this order)
```
db/23_provider_contracts.sql     -- table + RLS + private bucket 'provider-contracts' + storage policies
db/24_launch_premium.sql         -- premium fields + listings_public view + award/expire functions & triggers
```
- **Creates a bucket?** Yes — `provider-contracts` (`public = false`), idempotent (`on conflict do nothing`).
- **Creates storage policies?** Yes — read/insert/update on `storage.objects` scoped to the bucket +
  business-id folder (admin can read all).
- **Verify RLS:**
  ```sql
  select relname, relrowsecurity from pg_class where relname = 'provider_contracts'; -- rowsecurity = true
  select policyname, cmd, roles from pg_policies where tablename = 'provider_contracts';
  ```
- **Verify storage privacy:**
  ```sql
  select id, public from storage.buckets where id = 'provider-contracts';  -- public = false
  select policyname from pg_policies where schemaname='storage' and tablename='objects' and policyname like 'contracts%';
  ```
- **Rollback:** included as comments at the bottom of each migration file.

## Env vars
**None added.** Booking emails use the existing vars. **Vercel checklist (for live email):**
```
RESEND_API_KEY               (unset = safe no-op; set to send)
EMAIL_FROM                   e.g. "MyMauritiusTrip <info@mymauritiustrip.com>"
ADMIN_NOTIFICATION_EMAIL     admin inbox for booking notifications
NEXT_PUBLIC_SITE_URL         real domain (used in email links)
```

## PowerShell merge
```powershell
$src = "$env:USERPROFILE\Downloads\mymauritiustrip\mymauritiustrip"
$dst = "C:\Dev\mymauritiustrip"

# migrations
Copy-Item "$src\db\23_provider_contracts.sql" "$dst\db\23_provider_contracts.sql" -Force
Copy-Item "$src\db\24_launch_premium.sql"     "$dst\db\24_launch_premium.sql" -Force

# new admin contracts area
robocopy "$src\app\admin\contracts" "$dst\app\admin\contracts" /E

# modified files
Copy-Item "$src\lib\storage\paths.ts"                     "$dst\lib\storage\paths.ts" -Force
Copy-Item "$src\lib\public\catalog.ts"                    "$dst\lib\public\catalog.ts" -Force
Copy-Item "$src\lib\dashboard\metrics.ts"                 "$dst\lib\dashboard\metrics.ts" -Force
Copy-Item "$src\app\provider\verification\actions.ts"     "$dst\app\provider\verification\actions.ts" -Force
Copy-Item "$src\app\provider\verification\page.tsx"       "$dst\app\provider\verification\page.tsx" -Force
Copy-Item "$src\app\provider\verification\client.tsx"     "$dst\app\provider\verification\client.tsx" -Force
Copy-Item "$src\app\admin\page.tsx"                       "$dst\app\admin\page.tsx" -Force
Copy-Item "$src\app\provider\page.tsx"                    "$dst\app\provider\page.tsx" -Force
Copy-Item "$src\PHASE4_4_CONTRACTS_EMAILS_PREMIUM.md"     "$dst\PHASE4_4_CONTRACTS_EMAILS_PREMIUM.md" -Force
```

## Commands
```bash
npm install
npx tsc --noEmit
npm run build
npm run dev
```

## Build / type-check status
Inspection-verified (no `node_modules`/network in sandbox): brace + paren balance on every changed file;
SQL paren + `$$`/`$f$` dollar-quote balance on both migrations; import/export parity (`uploadContract`,
`reviewContract`, new metrics fields); new routes present (`/admin/contracts`,
`/admin/contracts/[id]/download`); service-role used only in server files; contract bucket `public=false`
and PDF-only enforced server-side. Metrics for the new columns/tables **degrade to 0 before the migration
is applied** (the Supabase client returns `{error}` rather than throwing), so dashboards never crash.
Please run the commands above to confirm green.

## Known warnings (unchanged, non-blocking)
- `@supabase/ssr` Edge `process.version` warning · webpack "big string" cache warning.

## No-404 checklist
Existing routes unchanged. New: `/admin/contracts` (admin-only → redirects logged-out) and the download
route (admin-only). Re-run `scripts/smoke-routes.*`.

## Manual tests
1. Apply `db/23` then `db/24`. 2. As a provider: upload a non-PDF (rejected), then a PDF (status pending);
try another provider's contract id in the download URL (blocked). 3. As admin at `/admin/contracts`:
View PDF (signed URL), approve/reject with note; provider sees updated status. 4. `select id,public from
storage.buckets where id='provider-contracts'` → false. 5. Booking without `RESEND_API_KEY` → `[email:noop]`
logs, no crash; with it set → three emails; refresh the confirmation page → no duplicate emails.
6. Publish 20+ listings → first 20 get launch-free premium; set one's `premium_expires_at` in the past →
it disappears from Premium Ads. 7. Admin + provider dashboards still load with the new cards.

## Follow-ups (optional)
Wire `expire_launch_premium()` into the daily cron (`vercel.json`) if you want the stale `is_premium` flag
cleared automatically (public display is already correct without it). Add a downloadable blank contract
template for providers to sign.
