# Phase 3 — Launch Readiness Audit + Production Hardening

**Scope:** full-stack audit (frontend + backend) for production launch. No new features. This report
is grounded in a code inspection of the repository. Items that require a running build, a live
Supabase project, or the Vercel dashboard are marked **VERIFY** because they cannot be executed inside
the build sandbox — exact commands/SQL are provided so you can confirm each in minutes.

Legend: ✅ ready · ⚠️ verify / minor · ❌ blocker (fixed in this zip) · 🔧 recommended (non-blocking)

---

## 1. Verdict

The application is **close to launch-ready**. The core product (auth, listings, media, bookings,
transfers/DMC, commissions, reviews, email, newsletter) is implemented with privacy hardening and
build-safety already in place from earlier phases. The gaps found were **infrastructure/SEO/config**,
not product logic. All **critical launch blockers were infra-level and are patched in this zip.**
Remaining work is operational setup (env values, Supabase dashboard settings, Vercel cron) plus a few
recommended polish items — none of which are code blockers.

---

## 2. Critical blockers — FIXED in this zip

| # | Blocker | Fix included |
|---|---------|--------------|
| B1 | No `robots.txt` → crawlers had no guidance; protected areas indexable | `app/robots.ts` (allow public, disallow `/client`,`/provider`,`/admin`,`/api`, links sitemap) |
| B2 | No sitemap → poor SEO discovery | `app/sitemap.ts` (all public routes, build-safe, no Supabase read) |
| B3 | No `metadataBase` → OpenGraph/canonical URLs break in prod (Next warns) | `app/layout.tsx` sets `metadataBase` from `NEXT_PUBLIC_SITE_URL` |
| B4 | Commission-reminder cron had no scheduler → would never run in prod | `vercel.json` daily cron `0 6 * * *` → `/api/cron/commission-reminders` |
| B5 | `CRON_SECRET` and `ADMIN_NOTIFICATION_EMAIL` used in code but undocumented | added to `.env.local.example` with guidance |

These are additive/config only — no backend, auth, DB, or business logic was touched.

## 3. Critical blockers — YOU must complete (operational, no code)

| # | Action | How |
|---|--------|-----|
| O1 | Set all production env vars in Vercel | see §6 |
| O2 | Configure Supabase Auth Site URL + redirect allowlist | see §7 |
| O3 | Set `CRON_SECRET` in Vercel so the cron authorizes | see §8 |
| O4 | Create the first admin user | see §9 |
| O5 | Run migration `db/22_newsletter_subscribers.sql` (from Phase 2.3) if not yet applied | Supabase SQL editor |
| O6 | Replace placeholder legal pages with real Terms/Privacy before public launch | §5, item 23 |
| O7 | Replace placeholder logo/banner/scene art with real assets | `public/home/` |

---

## 4. Full audit (29 areas)

1. **Public pages** ✅ — Home + `/search` + 13 category pages + listing detail + booking + request-transfer + terms/privacy all render through the shared premium `SiteHeader`/`PublicFooter` (Phase 2.4). Build-safe via `force-dynamic` + `isBuildPhase()` guards.
2. **Auth pages** ⚠️ VERIFY — `/login`, `/client-signup`, `/provider-signup`, `/forgot-password`, `/reset-password` exist and load. They still use their own minimal layout (not the marketing shell) — acceptable for launch; optional polish later. Confirm the full email→confirm→session flow on the live project (§7).
3. **Client dashboard** ⚠️ VERIFY — `/client` protected (307 when logged out, confirmed by your test). Verify booking list/detail with a real client account.
4. **Provider dashboard** ⚠️ VERIFY — `/provider` protected. Verify listing CRUD, media, bookings, commissions with a verified provider.
5. **Admin dashboard** ✅/⚠️ — `/admin` protected; links to verification, transfers, listings, bookings, commissions, reviews, **newsletter** (Phase 2.3). Verify each sub-page with an admin account.
6. **Booking flow** ⚠️ VERIFY — request-to-book requires client login; privacy hardening migrations (13/14) in place. End-to-end test on live DB recommended.
7. **Transfer/DMC flow** ⚠️ VERIFY — `/request-transfer` + `transfer_requests` (08/09). Submit a request and confirm it appears in `/admin/transfers`.
8. **Listing creation/media flow** ⚠️ VERIFY — provider listing form + Cloudinary media (10). Test upload + cover selection; confirm images render from `res.cloudinary.com` (allowed in `next.config.mjs`).
9. **Commission invoice/payment-proof flow** ⚠️ VERIFY — dashboard (15/16) + proof storage. Confirm proof bucket is **private** (§8) and overdue flip via cron (§8).
10. **Review flow** ✅/⚠️ — reviews + privacy (17/18/19); `provider_reviews_safe` view and reply privacy. Verify a guest can review a completed booking.
11. **Newsletter flow** ✅ — section + server action + `/admin/newsletter`; migration 22 (public insert, admin read, no public select, trigger forces `status='active'`). Run O5 if not applied.
12. **Email no-op/live Resend flow** ✅ — `sendEmail` returns `sent|noop|failed`; logs `[email:noop]` when `RESEND_API_KEY` is unset (intentional). Set `RESEND_API_KEY` + verified `EMAIL_FROM` domain for live sending.
13. **Supabase RLS/security** ⚠️ VERIFY — RLS policies span migrations 03/05/11–19/22 with `acting_as_admin()`, column-protect triggers, and `contains_contact_info` checks. **Run the RLS check in §7** to confirm every public table has RLS enabled.
14. **Storage buckets private/public** ⚠️ VERIFY — buckets referenced in 07 (verification proofs) and 15 (commission proofs). **These must be private.** Run the bucket check in §8.
15. **Cloudinary signing/media** ✅ — signing in `app/api/cloudinary/sign/route.ts` + `lib/cloudinary/sign.ts` using server-only `CLOUDINARY_API_SECRET` (not `NEXT_PUBLIC`). Confirmed no secret is exposed with a `NEXT_PUBLIC_` prefix.
16. **No provider contact leakage** ✅ — grep across public components/pages is clean; only `business_name` + platform WhatsApp/email appear; listing detail states communication stays on-platform. `contains_contact_info`/`detect-contact-leak` guards exist server-side.
17. **No client contact leakage where restricted** ⚠️ VERIFY — booking-privacy migrations (14) restrict client PII to the booking's provider/admin. Confirm a provider only sees their own bookings' client info.
18. **Build & TypeScript** ⚠️ VERIFY (cannot run here) — earlier phases confirmed `tsc`/`build` green; Phase 2.2–2.4 changes are inspection-verified (brace balance, import/export parity, `useActionState` React 19, `force-dynamic` + guards intact). **Run §10 to confirm.**
19. **No-404 routes** ✅ — your last test passed; this phase added only `/robots.txt` + `/sitemap.xml` (both resolve). Full list in §11.
20. **Mobile responsiveness** ✅/⚠️ — homepage + public shell built mobile-first (announcement bar trims to 2 items, `<details>` menu, stacking grids, `aspect-[5/2]` banner). Spot-check auth/dashboard forms on a real device.
21. **SEO metadata** ⚠️/🔧 — root has title+description+`metadataBase` (now). Homepage has OG. 🔧 Recommended: per-listing `generateMetadata` on `/listings/[slug]` (currently a static title) and per-category titles/descriptions.
22. **Sitemap/robots** ✅ — added (B1/B2). 🔧 Optional: append per-listing URLs to the sitemap from `listings_public`.
23. **Legal pages** ❌→O6 — `/terms` and `/privacy` are **placeholders**. Publishing a marketplace that collects emails/PII with placeholder legal text is a compliance risk — replace with real content before public launch.
24. **Vercel deployment readiness** ✅/⚠️ — `next.config.mjs` sets Cloudinary image host + 10mb server-action limit; `vercel.json` cron added. Verify build on Vercel + env (§6).
25. **Env vars** ✅ — full list documented in `.env.local.example` (now incl. `CRON_SECRET`, `ADMIN_NOTIFICATION_EMAIL`). See §6. Note: `NEXT_PUBLIC_SUPPORT_WHATSAPP/EMAIL` are in the example but the code currently hardcodes the values in `components/public/PublicHeader.tsx` — harmless; wire to env or drop from the example (🔧).
26. **Supabase Auth redirect URL setup** ⚠️→O2 — must add production Site URL + redirect allowlist incl. the confirm route (§7).
27. **Cron setup** ✅/⚠️ — `vercel.json` schedules it; set `CRON_SECRET` (O3) so the route authorizes. Manual test in §8.
28. **Admin creation/bootstrap** ⚠️→O4 — no admin exists by default (signups are clients). Promote one via SQL (§9).
29. **Production checklist** ✅ — see §12.

---

## 5. Recommended (non-blocking) fixes 🔧

- Per-listing `generateMetadata` (title/description/OG from listing) for SEO on `/listings/[slug]`.
- Per-category metadata (title/description) on the 13 landing pages.
- Wire `NEXT_PUBLIC_SUPPORT_WHATSAPP/EMAIL` into `PublicHeader.tsx` (or remove from the env example) to avoid config drift.
- Apply the premium shell to the auth screens for full visual consistency.
- Add per-listing URLs to `sitemap.ts` once you have published listings.
- Consider a 500/error boundary page styled to match the brand.

---

## 6. Vercel environment variables (Project → Settings → Environment Variables)

Set for **Production** (and Preview if used):

```
NEXT_PUBLIC_SUPABASE_URL          = https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY     = <anon key>
SUPABASE_SERVICE_ROLE_KEY         = <service role key>   # server-only, do NOT prefix NEXT_PUBLIC
NEXT_PUBLIC_SITE_URL              = https://www.mymauritiustrip.com
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = <cloud name>
CLOUDINARY_API_KEY                = <key>
CLOUDINARY_API_SECRET             = <secret>             # server-only
RESEND_API_KEY                    = <resend key>
EMAIL_FROM                        = MyMauritiusTrip <info@mymauritiustrip.com>
ADMIN_NOTIFICATION_EMAIL          = admin@mymauritiustrip.com
CRON_SECRET                       = <long random string>
```

Generate a cron secret: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

---

## 7. Supabase checks (SQL editor)

**Auth redirect setup (Dashboard → Authentication → URL Configuration):**
- Site URL: `https://www.mymauritiustrip.com`
- Redirect allowlist: `https://www.mymauritiustrip.com/**` (and your Vercel preview domain if used).
  The confirm route `app/auth/confirm` handles both `?code=` (PKCE) and `?token_hash=`.

**Every public table has RLS enabled (should return zero rows):**
```sql
select c.relname
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity = false
order by 1;
```

**Newsletter policies exist and there is NO public select:**
```sql
select policyname, cmd, roles
from pg_policies
where schemaname = 'public' and tablename = 'newsletter_subscribers'
order by policyname;
-- expect: newsletter_insert_public (INSERT, anon/authenticated),
--         newsletter_select_admin (SELECT, authenticated). No anon SELECT.
```

**Confirm the admin helper is present:**
```sql
select proname from pg_proc where proname = 'acting_as_admin';
```

---

## 8. Storage buckets + cron

**Buckets must be private (Dashboard → Storage, or SQL):**
```sql
select id, name, public from storage.buckets order by id;
-- Verification proofs and commission payment proofs MUST show public = false.
```
If any sensitive bucket shows `public = true`, set it private and ensure access goes through signed
URLs / RLS.

**Cron manual test (after deploy + CRON_SECRET set):**
```bash
curl -i "https://www.mymauritiustrip.com/api/cron/commission-reminders?key=$CRON_SECRET"
# 200 = ran; 401 = secret missing/mismatch. Vercel’s scheduled call uses
# Authorization: Bearer $CRON_SECRET automatically once CRON_SECRET is set.
```
The schedule (`vercel.json`) is daily at 06:00 UTC.

---

## 9. Admin bootstrap

New signups are `client` by default (via `handle_new_user`). Promote your account to admin **after**
signing up:
```sql
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'you@yourdomain.com');
```
Then sign out/in and open `/admin`. (If your `role` column is an enum, `'admin'` must be a valid label
— it is used by `requireRole('admin')` and `acting_as_admin()`.)

---

## 10. Build / type-check (run locally before deploy)

```bash
npm install
npx tsc --noEmit
npm run build
npm run dev      # http://localhost:3000
```
**Sandbox note:** this environment has no `node_modules`/network, so I could not execute `tsc`/`build`
here. All Phase 3 patches are inspection-verified (valid JSON for `vercel.json`; brace balance and
`MetadataRoute` typing for `robots.ts`/`sitemap.ts`; `metadataBase` is a standard `URL`). Expect green;
send me any error text if not.

---

## 11. No-404 route checklist (re-test after deploy)

`/` · `/search` · `/client-signup` · `/provider-signup` · `/login` · `/forgot-password` ·
`/reset-password` · `/request-transfer` · all 13 category pages · `/listings/[slug]` (real slug) ·
`/terms` · `/privacy` · **`/robots.txt`** · **`/sitemap.xml`** · `/client` · `/provider` · `/admin` ·
`/admin/newsletter` (last four 307 when logged out).

---

## 12. Production go-live checklist

- [ ] `npx tsc --noEmit` and `npm run build` pass locally.
- [ ] All env vars set in Vercel (§6), secrets not `NEXT_PUBLIC_`.
- [ ] Migrations `db/01`→`db/22` applied in order (see `PHASE1_SETUP.md`).
- [ ] RLS check returns zero rows (§7); newsletter has no public select.
- [ ] Sensitive storage buckets are private (§8).
- [ ] Supabase Auth Site URL + redirect allowlist set (§7); confirm email flow works.
- [ ] `CRON_SECRET` set; cron manual test returns 200 (§8).
- [ ] First admin promoted (§9); `/admin` reachable.
- [ ] `RESEND_API_KEY` set + `EMAIL_FROM` domain verified; test one live email.
- [ ] Cloudinary env set; a test image uploads and renders.
- [ ] Real Terms/Privacy content published (O6).
- [ ] Real logo (`public/home/mmt-logo.png`) + banner/scene art in `public/home/`.
- [ ] `/robots.txt` and `/sitemap.xml` return correct absolute URLs (depends on `NEXT_PUBLIC_SITE_URL`).
- [ ] No-404 re-test (§11) passes on the production domain.
- [ ] Mobile spot-check on iPhone + Android.
