-- =====================================================================
-- 11_public_catalog.sql  (Phase 1.4)
-- Contact-safe public read surface for the catalog/search/detail pages.
--
-- listings_public already exists (01): published listings only, business_name
-- but no contact fields. This adds two more owner-owned views whose WHERE clause
-- is the security boundary (the views bypass table RLS, exactly like
-- listings_public), so public pages can never see pending/rejected/hidden media
-- or unapproved reviews — not even a logged-in provider's own pending media.
-- Run AFTER 01–10. Idempotent.
-- =====================================================================

-- Approved media on published listings only. No contact data exists on media,
-- and captions/alt are already contact-leak guarded on write.
create or replace view listing_media_public as
select
  m.id, m.listing_id, m.type, m.cloudinary_id, m.url,
  m.poster_url, m.thumbnail_url, m.alt_text, m.caption,
  m.position, m.is_cover, m.width, m.height, m.duration_seconds
from listing_media m
join listings l on l.id = m.listing_id
where m.status = 'approved'
  and l.status = 'published';

-- Approved reviews on published listings only. Reviewer identity is intentionally
-- omitted (no client_id / name / email) to keep the surface contact-safe.
create or replace view reviews_public as
select
  r.id, r.listing_id, r.rating, r.comment, r.created_at
from reviews r
join listings l on l.id = r.listing_id
where r.status = 'approved'
  and l.status = 'published';

grant select on listings_public      to anon, authenticated;
grant select on listing_media_public to anon, authenticated;
grant select on reviews_public       to anon, authenticated;

-- End of 11_public_catalog.sql
