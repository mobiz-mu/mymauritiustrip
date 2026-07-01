# Phase 3.1 — Full Launch Readiness Closeout (Runbook)

A step-by-step runbook to close the operational launch blockers. Most items are actions in your
Supabase/Vercel dashboards or live tests that cannot be executed from this repo — each has exact
commands/SQL. The one code item that could be completed here (launch-ready legal content) **is done in
this zip**.

Status legend: ✅ done in this zip · ▶️ action for you (steps below)

```
CODE CHANGED IN THIS ZIP:
- app/terms/page.tsx      ✅ launch-ready Terms of Use content (was placeholder)
- app/privacy/page.tsx    ✅ launch-ready Privacy Policy content (was placeholder)
- PHASE3_1_LAUNCH_CLOSEOUT.md
```

---

## 1. ▶️ Rotate the leaked `SUPABASE_SERVICE_ROLE_KEY` (do this first)
A service-role key bypasses RLS, so a leaked one must be rotated **before** launch.
1. Supabase → Project → **Settings → API → Service role → Reset/roll** the `service_role` key.
2. Update `SUPABASE_SERVICE_ROLE_KEY` in Vercel (Production + Preview) and in your local `.env.local`.
3. Redeploy so server code picks up the new key.
4. Purge the old key from any logs, screenshots, chat history, or `.env` files committed anywhere.
5. Confirm `.env*` is git-ignored: `git check-ignore .env.local` should print the path.

## 2. ▶️ Confirm migration 22 is applied
```sql
select to_regclass('public.newsletter_subscribers') is not null as migration_22_applied;
```
If `false`, run `db/22_newsletter_subscribers.sql` in the Supabase SQL editor.

## 3. ▶️ Set Vercel production environment variables
Set all keys from `.env.local.example` in Vercel → Settings → Environment Variables (Production):
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`,
`CLOUDINARY_API_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `ADMIN_NOTIFICATION_EMAIL`, `CRON_SECRET`.
Secrets must **not** carry a `NEXT_PUBLIC_` prefix. Set `NEXT_PUBLIC_SITE_URL` to your real domain so
`metadataBase`, `/robots.txt`, and `/sitemap.xml` emit correct absolute URLs.

## 4. ▶️ Configure Supabase Auth Site URL + redirect allowlist
Supabase → Authentication → URL Configuration:
- **Site URL:** `https://www.mymauritiustrip.com`
- **Redirect allowlist:** `https://www.mymauritiustrip.com/**` (+ your Vercel preview domain if used).
The confirm route `app/auth/confirm` handles both `?code=` (PKCE) and `?token_hash=`.

## 5. ▶️ Set `CRON_SECRET` and test the cron
`vercel.json` schedules `/api/cron/commission-reminders` daily at 06:00 UTC. Vercel automatically sends
`Authorization: Bearer $CRON_SECRET` once `CRON_SECRET` is set. Manual test after deploy:
```bash
curl -i "https://www.mymauritiustrip.com/api/cron/commission-reminders?key=$CRON_SECRET"
# 200 = ran; 401 = secret missing/mismatch
```

## 6. ▶️ Promote the first admin user
Sign up normally (you'll be a `client`), then:
```sql
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'you@yourdomain.com');
```
Sign out/in and open `/admin`.

## 7. ▶️ Confirm RLS enabled on all public tables (expect zero rows)
```sql
select c.relname
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity = false
order by 1;
```
Also confirm newsletter has no public SELECT:
```sql
select policyname, cmd, roles from pg_policies
where schemaname='public' and tablename='newsletter_subscribers' order by policyname;
```

## 8. ▶️ Confirm sensitive Storage buckets are private
```sql
select id, name, public from storage.buckets order by id;
-- verification proofs and commission payment proofs MUST be public = false
```

## 9. ▶️ Test Cloudinary upload/signing
As a provider, upload listing media. Confirm the signing route returns a signature and the image
renders from `res.cloudinary.com` (already allowed in `next.config.mjs`). Confirm
`CLOUDINARY_API_SECRET` is server-only (no `NEXT_PUBLIC_`).

## 10. ▶️ Test Resend live email
Set `RESEND_API_KEY` and a verified `EMAIL_FROM` domain. Trigger one email (e.g. a booking request) and
confirm delivery. With no key, the app logs `[email:noop]` and does not fail — good for staging.

## 11–16. ▶️ End-to-end flow tests (on the live project)
- **Booking:** request → provider accepts → statuses update; client PII visible only to that booking's provider/admin.
- **Transfer/DMC:** submit `/request-transfer` → appears in `/admin/transfers` → quote/assign.
- **Provider listing/media:** create/edit listing, upload media, set cover, publish.
- **Commission payment proof:** provider uploads proof → admin reviews; overdue flips via cron.
- **Review:** completed booking → guest leaves review → appears on listing; provider reply respects privacy.
- **Newsletter:** subscribe on homepage → row appears in `/admin/newsletter` (admin only).

## 17. ✅ Terms/Privacy launch-ready content (done in this zip)
`/terms` and `/privacy` now contain structured, launch-ready content (definitions, bookings &
pay-on-arrival, on-platform communication, provider obligations, fees, reviews, IP, liability,
governing law = Mauritius; privacy: data collected, uses, sharing with Supabase/Cloudinary/Resend as
processors, retention, rights, contact). A visible banner advises a lawyer review and inserting your
registered legal-entity details before public launch. **Please complete that legal review.**

## 18. ▶️ SEO / robots / sitemap
Confirm on the live domain: `/robots.txt` (allows public, disallows `/client`,`/provider`,`/admin`,`/api`,
links sitemap) and `/sitemap.xml` (public routes, absolute URLs). Root `metadataBase` is set.
🔧 Optional later: per-listing `generateMetadata` and per-category titles/descriptions.

## 19. ▶️ Full no-404 test
`/` · `/search` · `/client-signup` · `/provider-signup` · `/login` · `/forgot-password` ·
`/reset-password` · `/request-transfer` · all 13 category pages · `/listings/<real-slug>` · `/terms` ·
`/privacy` · `/robots.txt` · `/sitemap.xml` · `/client` · `/provider` · `/admin` · `/admin/newsletter`
(last four `307` when logged out).

## 20. ▶️ Mobile QA
iPhone + Android widths: announcement bar (2 items) · hamburger menu · hero/search stack · banner
`aspect-[5/2]` (not too tall) · category/featured/marketplace grids 2-up · newsletter stacks · gradient
footer stacks. No horizontal overflow, clipped buttons, or overlapping text.

## 21. ▶️ Vercel deployment checklist
- [ ] `npx tsc --noEmit` + `npm run build` pass locally.
- [ ] All env vars set in Vercel (§3); secrets not `NEXT_PUBLIC_`.
- [ ] Service-role key rotated (§1) and old key purged.
- [ ] Migrations `db/01`→`db/22` applied in order.
- [ ] RLS zero-rows check (§7); storage buckets private (§8).
- [ ] Auth Site URL + redirect allowlist (§4); email confirm works.
- [ ] `CRON_SECRET` set; cron returns 200 (§5).
- [ ] First admin promoted (§6).
- [ ] Resend live email verified (§10); Cloudinary upload verified (§9).
- [ ] Flow tests pass (§11–16).
- [ ] Legal content lawyer-reviewed (§17); real logo + photos in `public/home/`.
- [ ] No-404 (§19) and mobile QA (§20) pass on production domain.

---

### Commands
```bash
npm install
npx tsc --noEmit
npm run build
npm run dev
```
