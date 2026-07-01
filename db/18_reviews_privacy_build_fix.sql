-- =====================================================================
-- 18_reviews_privacy_build_fix.sql  (Phase 1.7.1)
-- Stop public/provider direct access to the raw reviews table (which would
-- expose client_id / booking_id). Public review access goes only through
-- reviews_public; provider access goes through provider_reviews_safe.
-- Also fold the provider reply body into both views so the app never queries
-- raw review_replies for display.
-- Run AFTER 01–17. Idempotent.
-- =====================================================================

-- 1) Tighten raw reviews SELECT: own (client) or admin only. No anon/public,
--    no provider direct access to client/booking identifiers.
drop policy if exists reviews_public_read on reviews;
drop policy if exists reviews_read on reviews;
create policy reviews_read on reviews for select using (
  client_id = auth.uid() or is_admin()
);

-- 2) Provider-safe reviews view (owner-scoped, approved only). No client_id /
--    booking_id / contact — just what a provider needs to read and reply.
create or replace view provider_reviews_safe as
select
  r.id,
  r.listing_id,
  l.title as listing_title,
  r.rating,
  r.comment,
  r.created_at,
  rr.body as reply_body
from reviews r
join listings   l on l.id = r.listing_id
join businesses b on b.id = l.business_id
left join review_replies rr on rr.review_id = r.id
where b.owner_id = auth.uid()
  and r.status = 'approved';

revoke all on provider_reviews_safe from anon;
grant select on provider_reviews_safe to authenticated;

-- 3) Public reviews view now includes the provider reply body via a safe left
--    join, so the public listing page never reads raw review_replies. Still
--    gated on approved review + published listing + verified business.
create or replace view reviews_public as
select
  r.id,
  r.listing_id,
  r.rating,
  r.comment,
  r.created_at,
  rr.body as reply_body
from reviews r
join listings   l on l.id = r.listing_id
join businesses b on b.id = l.business_id
left join review_replies rr on rr.review_id = r.id
where r.status = 'approved'
  and l.status = 'published'
  and b.status = 'verified';

grant select on reviews_public      to anon, authenticated;
grant select on provider_reviews_safe to authenticated;

-- End of 18_reviews_privacy_build_fix.sql
