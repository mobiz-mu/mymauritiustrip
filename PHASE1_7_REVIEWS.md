# Phase 1.7 — Reviews After Completed Bookings

Clients who completed a booking can leave one review; admin moderates; approved reviews update the
listing rating and appear publicly; providers can reply once per review on their own listings.
Review and reply text is contact-leak guarded. No homepage work.

---

## Files added/changed

**Database**
- `db/17_reviews.sql` — **new**

**Client**
- `app/client/bookings/actions.ts` — added `createReview`
- `app/client/bookings/[id]/review-form.tsx` — **new** star-rating form
- `app/client/bookings/[id]/page.tsx` — shows the review form (completed + not yet reviewed) or the existing review + its status

**Provider**
- `app/provider/reviews/page.tsx` — **new** approved reviews on own listings + reply box
- `app/provider/reviews/actions.ts` — **new** `replyToReview` (upsert)

**Admin**
- `app/admin/reviews/page.tsx` — **new** moderation (pending first, approve/reject)
- `app/admin/reviews/actions.ts` — **new** `setReviewStatus`

**Public**
- `lib/public/catalog.ts` — detail now loads provider replies for approved reviews
- `app/listings/[slug]/page.tsx` — renders the provider reply under each review

**Changed:** provider + admin dashboards (nav links).

---

## How each rule is enforced
- **Only clients with completed bookings can review** — `reviews_client_insert` now requires
  `client_id = auth.uid()`, a matching `bookings` row that is the client's own, for the same
  `listing_id`, with `status = 'completed'`, and the new review must be `pending`. The `createReview`
  action also re-checks completion.
- **One review per booking** — existing `unique(booking_id)` (duplicate → friendly “already
  reviewed”).
- **Status starts pending / client can't self-approve** — enforced by the insert policy
  (`status='pending'`); only admin can change it.
- **Admin approves/rejects** — `admin_set_review_status()` (audited); `reviews_admin_update` keeps
  direct updates admin-only, so **providers cannot approve**.
- **Approved reviews update rating/count** — the existing `refresh_listing_rating` trigger fires on
  the status change and recomputes `rating_avg`/`review_count` from approved reviews.
- **Provider replies only to their own listing's reviews** — `enforce_review_reply_ownership`
  (business must own the review's listing); one reply per review via new `unique(review_id)`; the
  reply form upserts.
- **Review + reply text blocks contact details** — new `guard_contact_leak_review` on
  `reviews.comment`; the existing `guard_contact_leak_review_reply` covers reply bodies.
- **Public shows only approved** — `reviews_public` view (approved + published + verified business);
  replies shown are read via `rr_public_read` (only for approved reviews).

## Privacy
The provider reviews page shows rating/comment/date + a reply box — it never exposes the
reviewer's identity or any client contact (reviewer shown as “Verified guest”).

---

## SQL to run
After `01`–`16`:
```
db/17_reviews.sql
```
Tightens one policy, adds one trigger + one guard function, one unique constraint, one audited RPC.
Idempotent.

## Local commands
```bash
npm install
npx tsc --noEmit
npm run build
```
Sandbox note: npm blocked here; fixed by inspection (RPC-parity, brace and privacy greps pass).

---

## Test checklist
Setup: a completed booking `:bk` owned by client `:client` for listing `:lid`; provider `:provider`
owns that listing's business.

### Only a completed booking can review; pending start; one per booking
```sql
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub',':client','role','authenticated')::text, true);

-- ok (status forced pending by policy):
insert into reviews (booking_id, listing_id, client_id, rating, comment, status)
values (':bk', ':lid', ':client', 5, 'Great stay', 'pending');

-- self-approve blocked (policy requires status='pending'):
insert into reviews (booking_id, listing_id, client_id, rating, status)
values (':bk2', ':lid', ':client', 5, 'approved');           -- ERROR / 0 rows

-- duplicate blocked (unique booking_id):
insert into reviews (booking_id, listing_id, client_id, rating, status)
values (':bk', ':lid', ':client', 4, 'pending');             -- ERROR 23505

-- non-completed booking blocked:
insert into reviews (booking_id, listing_id, client_id, rating, status)
values (':pending_bk', ':lid', ':client', 5, 'pending');     -- 0 rows (policy fails)
reset role;
```

### Contact details blocked in review/reply
```sql
-- review comment with contact -> ERROR
update reviews set comment='email me at a@b.com' where booking_id=':bk';
-- reply with contact -> ERROR (guard_contact_leak_review_reply)
```

### Provider cannot approve; admin can
```sql
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub',':provider','role','authenticated')::text, true);
update reviews set status='approved' where booking_id=':bk';   -- 0 rows (no provider update policy)
reset role;

select admin_set_review_status((select id from reviews where booking_id=':bk'), 'approved');  -- as admin
select status from reviews where booking_id=':bk';             -- approved
```

### Approved review updates listing rating
```sql
select rating_avg, review_count from listings where id=':lid';  -- reflects approved review(s)
```

### Provider reply only on own listing; one per review
```sql
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub',':provider','role','authenticated')::text, true);
insert into review_replies (review_id, business_id, body)
values ((select id from reviews where booking_id=':bk'), ':my_business', 'Thank you!');   -- ok
-- a second reply for the same review -> unique violation (upsert in UI updates instead)
-- a reply on a review for someone else's listing -> ERROR (enforce_review_reply_ownership)
reset role;
```

### Public shows only approved
```sql
set local role anon;
select set_config('request.jwt.claims', json_build_object('role','anon')::text, true);
select count(*) from reviews_public where listing_id=':lid';    -- only approved
reset role;
```
UI: the listing detail shows approved reviews and the provider's reply beneath each.

### Build / type-check
- `npm install` / `npx tsc --noEmit` — pass (by inspection here).
- `npm run build` — all new pages are `force-dynamic`; should complete.

---

## Next milestones
1. **Email templates** (booking lifecycle + commission due/overdue reminders + overdue cron).
2. **Premium homepage**.
