# Phase 1.7.2 — Build Completion + Review Reply Privacy Cleanup

Removes the last build-time data hooks and locks down direct reads of the raw `review_replies`
table.

---

## Files changed
- `db/19_review_reply_privacy_build_fix.sql` — **new**
- `app/listings/[slug]/page.tsx` — async `generateMetadata` → **static `metadata`** + empty `generateStaticParams`
- `app/listings/[slug]/book/page.tsx` — empty `generateStaticParams`
- `app/auth/callback/route.ts`, `app/auth/confirm/route.ts`, `app/api/cloudinary/sign/route.ts` —
  explicit `export const dynamic = 'force-dynamic'` + `runtime = 'nodejs'`

---

## 1) Build "Collecting page data" — what I found and changed
I scanned the whole app for build-time executors. Findings:
- **All pages** carry `export const dynamic = 'force-dynamic'`, and the **root layout**
  (`app/layout.tsx`) also sets it, which cascades app-wide.
- **No** `sitemap.ts` / `robots.ts` / `manifest.ts` / `opengraph-image` / `icon` files (these run
  at build).
- **No** `generateStaticParams` that fetched, **no** top-level `await`, **no** module-scope Supabase
  client creation, **no** `fetch()` in pages, **no** layout imports Supabase. `createAdminClient`
  is used only inside server actions (never at build).

The one remaining function Next executes during **"Collecting page data"** was the **async
`generateMetadata`** on the dynamic `/listings/[slug]` route. Even though it no longer fetched, an
async metadata function on a dynamic segment is exactly what this phase evaluates. I:
- replaced it with a **static `export const metadata`** (no function call at build), and
- added **`export async function generateStaticParams() { return []; }`** to `/listings/[slug]` and
  `/listings/[slug]/book`, which tells Next to prerender **nothing** and do zero data collection for
  those segments, and
- marked the three **route handlers** explicitly dynamic + Node runtime so they're never evaluated
  for static collection.

After this there is **no async metadata, no generateStaticParams that fetches, and nothing
statically generated** anywhere — "Collecting page data" has no work that can block.

> Honest note: I can't run `npm run build` in this sandbox (no registry/Supabase access), so I
> can't watch it finish here. If it still stalls after this, it is almost certainly one specific
> route — use the diagnostic below to pinpoint it and tell me which one.

### Diagnostic if it still stalls
```bash
# 1) See exactly where it stops / get more detail:
next build --debug

# 2) Confirm it's the public listing route by temporarily excluding it:
mv "app/listings/[slug]" /tmp/_slug && npm run build ; mv /tmp/_slug "app/listings/[slug]"

# 3) Rule out env: ensure .env.local is present for the build, then:
NEXT_TELEMETRY_DISABLED=1 npm run build
```
Whichever route is printed last before the stall is the culprit — send me that line.

## 2) Raw `review_replies` locked down
`rr_public_read` (which let anon/public select raw reply rows) is **dropped**. New explicit
`rr_read` allows **admin or the owning business** only. Public reply display continues through
`reviews_public.reply_body`, and provider display through `provider_reviews_safe` — both are
owner-owned views that bypass table RLS, so they keep working. `rr_owner_write` (create/update own
reply) and the ownership + contact-leak triggers are unchanged.

---

## SQL to run
After `01`–`18`:
```
db/19_review_reply_privacy_build_fix.sql
```
Idempotent (drop/recreate policies only).

## Local commands
```bash
npm install
npx tsc --noEmit
npm run build
```

---

## Test checklist (a–h)

### (a) tsc passes
`npx tsc --noEmit` — clean (the `Metadata` import is used by the static `metadata` export;
`getListingDetail` is still used in the page body).

### (b) npm run build completes
No async metadata, no fetching `generateStaticParams`, all routes dynamic → "Collecting page data"
has no blocking work. (If it still stalls, run the diagnostic above and report the last route.)

### (c) anon cannot select raw review_replies
```sql
set local role anon;
select set_config('request.jwt.claims', json_build_object('role','anon')::text, true);
select * from review_replies limit 1;     -- 0 rows (no anon read policy)
reset role;
```

### (d) public still sees the reply through reviews_public.reply_body
```sql
set local role anon;
select set_config('request.jwt.claims', json_build_object('role','anon')::text, true);
select reply_body from reviews_public where listing_id=':lid' and reply_body is not null;  -- visible
reset role;
```

### (e) provider still sees own reply through provider_reviews_safe
```sql
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub',':provider','role','authenticated')::text, true);
select id, listing_title, reply_body from provider_reviews_safe;   -- own listings, reply visible
reset role;
```

### (f) provider cannot access client/reviewer identity
```sql
select column_name from information_schema.columns
where table_name in ('provider_reviews_safe')
  and column_name in ('client_id','booking_id','email','whatsapp');  -- 0 rows
```

### (g) provider cannot reply to another business's review
```sql
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub',':provider','role','authenticated')::text, true);
-- review belongs to a different business's listing:
insert into review_replies (review_id, business_id, body) values (':other_review', ':my_business', 'hi');
-- ERROR: You can only reply to reviews on your own listings. (enforce_review_reply_ownership)
reset role;
```

### (h) contact details blocked in replies
```sql
-- via the provider reply flow / direct insert -> ERROR (guard_contact_leak_review_reply)
insert into review_replies (review_id, business_id, body)
values (':my_review', ':my_business', 'whatsapp me +230 5 506 8119');
```
