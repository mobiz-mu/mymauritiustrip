-- =====================================================================
-- 17_reviews.sql  (Phase 1.7)
-- Reviews after completed bookings. Most infrastructure already exists:
--   * reviews(booking_id UNIQUE, listing_id, client_id, rating, comment, status default pending)
--   * reviews_admin_update (admin-only) -> providers can't approve
--   * refresh_listing_rating trigger -> approved reviews update rating_avg/review_count
--   * review_replies + enforce_review_reply_ownership + guard_contact_leak_review_reply
--   * reviews_public / reviews_public view (approved + published + verified business)
-- This migration adds the remaining guards. Run AFTER 01–16. Idempotent.
-- =====================================================================

-- 1) Tighten client insert: must be the client's OWN completed booking, the
--    listing must match that booking, and the review must start as 'pending'
--    (so a client can't self-approve via a direct insert).
drop policy if exists reviews_client_insert on reviews;
create policy reviews_client_insert on reviews for insert with check (
  client_id = auth.uid()
  and status = 'pending'
  and exists (
    select 1 from bookings bk
    where bk.id = reviews.booking_id
      and bk.client_id = auth.uid()
      and bk.listing_id = reviews.listing_id
      and bk.status = 'completed'
  )
);

-- 2) Contact-leak guard on review comments (reply bodies are already guarded).
create or replace function guard_contact_leak_review()
returns trigger language plpgsql as $$
begin
  if contains_contact_info(new.comment) then
    raise exception 'Contact details are not allowed in reviews. All communication stays on MyMauritiusTrip.com.';
  end if;
  return new;
end $$;
drop trigger if exists reviews_guard_contact on reviews;
create trigger reviews_guard_contact
  before insert or update on reviews
  for each row execute function guard_contact_leak_review();

-- 3) One reply per review (provider can edit it, not spam).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'review_replies_one_per_review') then
    alter table review_replies add constraint review_replies_one_per_review unique (review_id);
  end if;
end $$;

-- 4) Admin moderation RPC (audited). The reviews_admin_update policy already
--    restricts direct updates to admin; this adds an audit trail and is the
--    sanctioned path from the admin dashboard. refresh_listing_rating fires on
--    the update and recomputes the listing's approved rating/count.
create or replace function admin_set_review_status(p_review_id uuid, p_status review_status)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Admin only.'; end if;
  if p_status not in ('approved','rejected','pending') then
    raise exception 'Invalid review status.';
  end if;

  update reviews set status = p_status where id = p_review_id;

  insert into audit_logs (actor_id, action, entity, entity_id, metadata)
  values (auth.uid(), 'review_'||p_status, 'review', p_review_id, null);
end $$;

revoke execute on function admin_set_review_status(uuid, review_status) from anon;

-- End of 17_reviews.sql
