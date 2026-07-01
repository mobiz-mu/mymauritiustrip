-- =====================================================================
-- 12_public_catalog_business_status_hardening.sql  (Phase 1.4.1)
-- Public views must also require the owning business to be verified, so a
-- suspended/rejected/unverified provider's listings, media, and reviews vanish
-- from public pages immediately even if the listing row is still 'published'.
--
-- Boundary on all three views: listing.status='published' AND business.status='verified'.
-- Run AFTER 01–11. Idempotent (create or replace view; columns unchanged).
-- =====================================================================

create or replace view listings_public as
select
  l.id, l.slug, l.title, l.description, l.category_id, l.location_id,
  l.base_price_mur, l.price_unit, l.attributes, l.included, l.not_included,
  l.rules, l.cancellation_policy, l.is_premium, l.is_featured,
  l.rating_avg, l.review_count, l.seo_title, l.seo_description, l.seo_keywords,
  b.business_name,
  b.status as business_status,
  l.created_at
from listings l
join businesses b on b.id = l.business_id
where l.status = 'published'
  and b.status = 'verified';

create or replace view listing_media_public as
select
  m.id, m.listing_id, m.type, m.cloudinary_id, m.url,
  m.poster_url, m.thumbnail_url, m.alt_text, m.caption,
  m.position, m.is_cover, m.width, m.height, m.duration_seconds
from listing_media m
join listings l   on l.id = m.listing_id
join businesses b on b.id = l.business_id
where m.status = 'approved'
  and l.status = 'published'
  and b.status = 'verified';

create or replace view reviews_public as
select
  r.id, r.listing_id, r.rating, r.comment, r.created_at
from reviews r
join listings l   on l.id = r.listing_id
join businesses b on b.id = l.business_id
where r.status = 'approved'
  and l.status = 'published'
  and b.status = 'verified';

grant select on listings_public      to anon, authenticated;
grant select on listing_media_public to anon, authenticated;
grant select on reviews_public       to anon, authenticated;

-- End of 12_public_catalog_business_status_hardening.sql
