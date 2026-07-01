# MyMauritiusTrip.com — Phase 1 (Foundation: Auth + RLS)

This is the secure foundation: database schema, complete RLS, seed data, and
three-role authentication. **No homepage/UI design yet** — that's Phase 2.

## What's in this build

- Full database schema + every RLS policy (security-first)
- Seeded categories, locations, currency settings
- Supabase Auth: client signup, provider signup, login, forgot/reset password
- Email-verification + role-based redirects
- Auto profile creation on signup (and a business shell for providers)
- Provider posting locked until Rs 499 verification is approved by admin
- 7-listing-per-provider cap enforced in the database
- Provider contact details never exposed to clients/public

## Prerequisites

- Node.js 18.18+ (or 20+), npm
- A Supabase project
- (Later phases) Cloudinary, Resend accounts

## 1. Install

```bash
npm install
```

## 2. Environment

```bash
cp .env.local.example .env.local
```

Fill in from your Supabase project (Settings → API):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only; never expose)

`NEXT_PUBLIC_SITE_URL=http://localhost:3000` for local dev.

## 3. Run the database migrations (in order)

In the Supabase SQL editor, run each file top to bottom:

1. `db/01_schema.sql` — tables, enums, triggers, base RLS, base seed
2. `db/02_auth_profile_trigger.sql` — profile/business creation on signup
3. `db/03_rls_remaining_policies.sql` — remaining RLS + JSONB guard
4. `db/04_seed_locations.sql` — Mauritius locations
5. `db/05_security_hardening.sql` — Phase 1.1 column protection, contact-leak guards, booking integrity (see PHASE1_1_PATCH.md)
6. `db/06_verification_hardening.sql` — Phase 1.2 document/media/payment/review-reply protections
7. `db/07_verification_pipeline.sql` — private Storage buckets + RLS + verification RPCs (see PHASE1_2_VERIFICATION.md)
8. `db/08_taxi_transfer_dmc_module.sql` — Taxi & Private Transfers + DMC packages/requests/assignments (see PHASE1_2_1_TAXI_DMC.md)
9. `db/09_taxi_dmc_flow_cleanup.sql` — client quote confirmation + request/assignment status sync + assignment guards (see PHASE1_2_2_DMC_FLOW.md)
10. `db/10_listing_media_pipeline.sql` — price units, Cloudinary media metadata, media count limits, listing/media review RPCs (see PHASE1_3_LISTINGS_MEDIA.md)
11. `db/11_public_catalog.sql` — contact-safe public views (approved media, approved reviews) for the catalog (see PHASE1_4_PUBLIC_CATALOG.md)
12. `db/12_public_catalog_business_status_hardening.sql` — public views also require business.status=verified (see PHASE1_4_1_BUSINESS_STATUS.md)
13. `db/13_booking_engine.sql` — booking lifecycle RPCs + date-suggestion state (see PHASE1_5_BOOKING_ENGINE.md)
14. `db/14_booking_privacy_hardening.sql` — provider-safe booking view, tightened bookings RLS, booking contact-leak guard (see PHASE1_5_1_BOOKING_PRIVACY.md)
15. `db/15_commission_payment_dashboard.sql` — commission proofs bucket, provider-safe commission view, paid/reject/dispute/overdue RPCs (see PHASE1_6_COMMISSION_DASHBOARD.md)
16. `db/16_commission_security_build_cleanup.sql` — remove provider direct update on commission_invoices (admin-only) (see PHASE1_6_1_COMMISSION_SECURITY.md)
17. `db/17_reviews.sql` — reviews after completed bookings: insert eligibility, comment contact guard, one reply per review, admin moderation RPC (see PHASE1_7_REVIEWS.md)
18. `db/18_reviews_privacy_build_fix.sql` — lock raw reviews reads, provider_reviews_safe view, reply_body in reviews_public (see PHASE1_7_1_REVIEW_PRIVACY.md)
19. `db/19_review_reply_privacy_build_fix.sql` — lock raw review_replies public reads; root-layout force-dynamic build fix (see PHASE1_7_2_BUILD_REPLY_PRIVACY.md)
20. `db/20_email_reminders.sql` — commission reminder timestamps + email_events audit (see PHASE1_8_EMAIL.md)
21. `db/21_email_reliability.sql` — commission-invoice email idempotency + email_events status (see PHASE1_8_1_EMAIL_RELIABILITY.md)
22. `db/22_newsletter_subscribers.sql` — homepage newsletter signups: table + RLS (public insert, admin read) (see PHASE2_3_HOMEPAGE_MARKETPLACE.md)

## 4. Configure Supabase Auth

In the Supabase dashboard → Authentication:
- **URL Configuration → Site URL:** `http://localhost:3000`
- **Redirect URLs:** add `http://localhost:3000/auth/confirm` and
  `http://localhost:3000/auth/callback`
- **Email templates:** point the confirmation/recovery links at
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type={{ .Type }}`
  (recovery should append `&next=/reset-password`).
- For local testing you can keep "Confirm email" on; Supabase shows the link in
  the Auth logs, or disable confirmation temporarily to test faster.

## 5. Create your admin user

Admin can never be assigned via signup (by design). After signing up normally:

```sql
update profiles set role = 'admin' where email = 'you@example.com';
```

## 6. Start

```bash
npm run dev
```

Open http://localhost:3000.

## How to verify the security foundation

- Sign up as a **client** → confirm email → you're redirected to `/client`.
- Sign up as a **provider** → a `businesses` row is created as
  `pending_verification`; `/provider` shows the locked state; visiting any
  verified-only surface redirects to `/provider/verification`.
- Try to reach `/admin` as a client/provider → you're bounced to your own home.
- Confirm RLS: as a client, query `businesses` from the client — you get
  nothing (no client/public SELECT policy exists). Public listing reads go
  through the `listings_public` view, which omits all contact columns.

## To make a provider "verified" (for testing Phase 4 later)

```sql
update businesses set status = 'verified', verification_paid = true,
       verified_at = now() where business_name = 'Test Business';
```

Then the 7-listing cap and publish rules apply automatically.


## Phase 1.8 — Email & reminders (env + cron)

Add to `.env.local` (all optional — email no-ops cleanly if unset):

```
RESEND_API_KEY=...                     # enables real sending; without it, emails are logged only
EMAIL_FROM=MyMauritiusTrip <no-reply@mymauritiustrip.com>
ADMIN_NOTIFICATION_EMAIL=info@mymauritiustrip.com
NEXT_PUBLIC_SITE_URL=https://www.mymauritiustrip.com   # used for links/CTAs in emails
CRON_SECRET=<long-random-string>       # protects the reminder cron endpoint
```

Commission reminder cron — call once a day:

- **Vercel Cron** (`vercel.json`):
  ```json
  { "crons": [ { "path": "/api/cron/commission-reminders", "schedule": "0 8 * * *" } ] }
  ```
  Vercel sends `Authorization: Bearer $CRON_SECRET` automatically when `CRON_SECRET` is set.
- **Any scheduler / curl**:
  ```bash
  curl -X POST "$SITE/api/cron/commission-reminders" -H "Authorization: Bearer $CRON_SECRET"
  # or: curl "$SITE/api/cron/commission-reminders?key=$CRON_SECRET"
  ```
- **pg_cron alternative** (DB-only, flips overdue without emails; emails still need the route):
  ```sql
  select cron.schedule('mark-overdue-daily', '0 7 * * *', $$ select mark_commissions_overdue(); $$);
  ```


## Supabase Auth configuration (Phase 1.8.2)

Authentication → URL Configuration:
- Site URL (local): `http://localhost:3000`
- Redirect URLs:
  - `http://localhost:3000/auth/callback`
  - `http://localhost:3000/auth/confirm`
  - `http://localhost:3000/reset-password`

Email confirmation (Authentication → Providers → Email → "Confirm email"):
- OFF → signup logs in immediately (easiest for local dev).
- ON → signup shows a confirm message; `/auth/confirm` handles the `code`/`token_hash` link.

Quick fixes: confirm a user with
`update auth.users set email_confirmed_at = now() where email = '…';`
Full troubleshooting in PHASE1_8_2_AUTH.md.
