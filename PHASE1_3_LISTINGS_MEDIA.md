# Phase 1.3 — Verified Provider Listing Creation + Cloudinary Media Pipeline

Verified providers create listings (draft → pending_review), upload optimized
media to Cloudinary (admin-approved), and admin publishes/rejects/hides/flags.
No homepage/design work. Build note: the sandbox blocks npm, so run the build
commands locally; code is corrected by inspection.

---

## Files added

**Database**
- `db/10_listing_media_pipeline.sql`

**Cloudinary**
- `lib/cloudinary/sign.ts` — server-only SHA-1 signing
- `lib/cloudinary/urls.ts` — optimized card/gallery/full/thumb/poster URL builders
- `app/api/cloudinary/sign/route.ts` — authorizes the provider + enforces counts, returns signed params

**Validation**
- `lib/validation/attribute-ui.ts` — per-category UI field descriptors + `collectAttributes()`

**Provider**
- `app/provider/listings/page.tsx` — list with X/7 counter, statuses, submit-for-review
- `app/provider/listings/actions.ts` — create / update / submit
- `app/provider/listings/listing-form.tsx` — shared form with dynamic category attributes
- `app/provider/listings/new/page.tsx`
- `app/provider/listings/[id]/edit/page.tsx`
- `app/provider/listings/[id]/media/page.tsx`
- `app/provider/listings/[id]/media/manager.tsx` — signed direct-upload client
- `app/provider/listings/[id]/media/actions.ts` — saveMedia / deleteMedia / setCover

**Admin**
- `app/admin/listings/page.tsx` — queue (pending first)
- `app/admin/listings/[id]/page.tsx` — detail, private provider info, media approval, decisions
- `app/admin/listings/actions.ts` — status / flags / media status / cover (via RPCs)

**Changed:** `app/provider/page.tsx`, `app/admin/page.tsx` (nav links).

---

## What migration 10 adds
- `price_unit` gains `half_day`, `full_day`.
- `listing_media` gains `thumbnail_url`, `width`, `height`, `bytes`, `format`, `duration_seconds`
  (existing `cloudinary_id`=public_id, `url`=secure_url, `position`=sort_order, `type`=media_type).
- `enforce_media_limits` trigger: max 12 photos / 3 videos per listing.
- RPCs (SECURITY DEFINER, audited): `provider_submit_listing`, `admin_set_listing_status`,
  `admin_set_listing_flags`, `admin_set_media_status`, `admin_set_cover_media`.

Enforcement that already existed (re-used here): verified-only create + 7-cap +
publish gate (`enforce_listing_rules`), provider limited to draft/pending_review and
admin-only featured/premium/rating/rejected (`protect_listing_fields`), admin-only media
status (`protect_listing_media_fields`), contact-leak guards on title/description/caption/alt.

---

## Cloudinary env variables

```
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret   # server-only, used for signing
```
No unsigned upload preset is needed — uploads are **signed** server-side. Files go
straight from the browser to Cloudinary (signed), so large videos never pass through
the app server. The original is never served directly; delivery uses
`f_auto,q_auto` transformed URLs (card/gallery/full/thumb, video poster).

---

## Exact SQL to run
After `01`–`09`:
```
db/10_listing_media_pipeline.sql
```
Idempotent (`add value if not exists`, `add column if not exists`, guarded triggers).

## Exact local commands
```bash
npm install
npx tsc --noEmit
npm run build
npm run dev
```

---

## Test checklist (a–h)

Provider/admin ids:
```sql
select id from profiles where role='provider' limit 1;            -- :provider_uid
select id from businesses where owner_id=':provider_uid';         -- :business_id
select id from categories where slug='villas';                    -- :villas_cat
```
Enter provider context:
```sql
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', ':provider_uid', 'role', 'authenticated')::text, true);
```

### (a) Unverified provider cannot create a listing
```sql
update businesses set status='pending_verification' where id=':business_id';
-- ERROR expected: Only verified providers can create listings...
insert into listings (business_id, category_id, title, slug, description, base_price_mur)
values (':business_id', ':villas_cat', 'Test', 'test-'||floor(random()*1e6)::text, 'desc', 5000);
```

### (b) Verified provider cannot exceed 7 listings
```sql
update businesses set status='verified', verification_paid=true, verified_at=now() where id=':business_id';
-- create 7 (run 7 times), then the 8th:
-- ERROR expected: Listing limit reached (max 7 per provider account).
insert into listings (business_id, category_id, title, slug, description, base_price_mur)
select ':business_id', ':villas_cat', 'L'||g, 'l-'||g||'-'||floor(random()*1e6)::text, 'd', 5000
from generate_series(1,8) g;
```

### (c) Provider cannot publish directly
```sql
-- :listing_id = one of your draft listings
-- ERROR expected: Providers cannot set listing status to "published"...
update listings set status='published' where id=':listing_id';
```

### (d) Provider cannot set featured/premium
```sql
-- ERROR expected: ...premium, featured, rating, or rejection fields...admin-controlled.
update listings set is_featured=true, is_premium=true where id=':listing_id';
```

### (e) Provider cannot approve media
```sql
-- ERROR expected: New media must start as pending...
insert into listing_media (listing_id, type, cloudinary_id, url, status)
values (':listing_id','image','x','https://x','approved');
-- create a pending one, then:
insert into listing_media (listing_id, type, cloudinary_id, url, status)
values (':listing_id','image','y','https://y','pending') returning id;  -- :media_id
-- ERROR expected: Only admin can change media status...
update listing_media set status='approved' where id=':media_id';
```

### (f) Listing with phone/email/website/social is blocked
```sql
-- each ERRORs: Contact details are not allowed in listing title or description.
update listings set description='call +230 5506 8119' where id=':listing_id';
update listings set description='mail me at a@b.com' where id=':listing_id';
update listings set description='see www.site.mu'    where id=':listing_id';
update listings set description='@myhandle on insta' where id=':listing_id';
reset role;
```

### (g) Media uploads save Cloudinary metadata correctly
After uploading a photo in `/provider/listings/[id]/media` (runtime), verify:
```sql
select cloudinary_id, url, thumbnail_url, width, height, bytes, format, status
from listing_media where listing_id=':listing_id' order by created_at desc limit 1;
-- expect: public_id + secure_url + thumbnail_url populated, status='pending'
```
(Admin approves it in `/admin/listings/[id]` before it can show publicly.)

### (h) Public/client views do not expose provider contact
```sql
set local role anon;
select set_config('request.jwt.claims', json_build_object('role','anon')::text, true);
select email, whatsapp, phone from businesses;        -- expect 0 rows
select * from listings_public limit 1;                -- business_name only, no contact columns
reset role;
```

---

## Item 13 — Guest quote acceptance (documented TODO, not built)

Today, DMC quote acceptance (`client_respond_quote`) requires a logged-in client
(`client_id = auth.uid()`). **Guest** transfer requests (submitted with
`client_id = null`) therefore cannot accept a quote yet. Before enabling guest
quote acceptance we need ONE of:

1. **Signed quote link/token** — email the guest a one-time, expiring token (store a
   hashed token on the request); a public `/quote/[token]` page verifies it and calls
   a token-scoped RPC to accept/reject. No login required.
2. **Account-claim / login-before-accept** — on quote, invite the guest to create or
   log into an account that is then linked to the request (claim by matching email via
   a secure verification), after which the existing `client_respond_quote` applies.

Recommendation: option 1 for conversion (no friction), with option 2 as a fallback.
This is intentionally **not** built in this phase.

---

## Notes / decisions for sign-off
- **Editing a non-draft listing resubmits it for review** (`updateListing` sets it back
  to `pending_review`), since providers can't hold a listing in `published` while editing.
  If you'd prefer live edits without re-moderation, that's a policy change.
- **First uploaded photo becomes the cover** automatically; provider/admin can change it.
- Public marketplace UI is still deferred; reads go through `listings_public` (contact-free).
