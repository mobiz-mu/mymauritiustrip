# Phase 1.4.1 — Public Catalog Business-Status Hardening

All three public views now require the **owning business to be verified** in addition to the
listing being published (and media/reviews approved). A suspended, rejected, or
no-longer-verified business disappears from public search/detail immediately, even if its
listing rows are still `published`.

## Files
- `db/12_public_catalog_business_status_hardening.sql` — recreates `listings_public`,
  `listing_media_public`, `reviews_public` with `... AND business.status = 'verified'`.

## SQL to run
After `01`–`11`:
```
db/12_public_catalog_business_status_hardening.sql
```
Idempotent `create or replace view`; columns unchanged.

## Behaviour
| Scenario | Public visibility |
|---|---|
| Published listing + verified business | visible |
| Published listing + suspended business | hidden |
| Published listing + rejected business | hidden |
| Approved media + suspended/rejected business | hidden |
| Approved reviews + suspended/rejected business | hidden |

## Test checklist (a–f)
Pick a published listing whose business is verified, then flip the business status.
```sql
-- :biz = the listing's business id; :slug = the listing slug; :lid = listing id
```

### (a) Published + verified business appears publicly
```sql
update businesses set status='verified' where id=':biz';
select count(*) from listings_public where slug=':slug';          -- 1
```

### (b) Published + suspended business does NOT appear
```sql
update businesses set status='suspended' where id=':biz';
select count(*) from listings_public where slug=':slug';          -- 0
```

### (c) Media for suspended/rejected business is hidden
```sql
update businesses set status='rejected' where id=':biz';
select count(*) from listing_media_public where listing_id=':lid'; -- 0
```

### (d) Reviews for suspended/rejected business are hidden
```sql
select count(*) from reviews_public where listing_id=':lid';       -- 0  (while business not verified)
```

### (e) Public detail returns not found for a suspended business listing
With the business suspended/rejected, `getListingDetail(slug)` reads `listings_public`,
finds no row, and the page renders **404 / not found**. Restore:
```sql
update businesses set status='verified' where id=':biz';
select count(*) from listings_public where slug=':slug';          -- 1 again
```

### (f) No provider contact fields exposed
```sql
select column_name from information_schema.columns
where table_name='listings_public' order by 1;
-- business_name + business_status only; no phone/whatsapp/email/website/social/owner
```
