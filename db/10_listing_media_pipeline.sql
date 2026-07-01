-- =====================================================================
-- 10_listing_media_pipeline.sql  (Phase 1.3)
-- Adds half_day/full_day price units, Cloudinary media metadata columns,
-- per-listing media count limits (12 photos / 3 videos), and audited RPCs
-- for the listing review/publish + media approval workflow.
--
-- Most enforcement already exists:
--   * enforce_listing_rules  -> verified-only create + 7-listing cap + publish gate (05)
--   * protect_listing_fields -> providers limited to draft/pending_review; admin
--     controls published/featured/premium/rating/rejected (05)
--   * protect_listing_media_fields -> media status is admin-only; new media = pending (06)
--   * contact-leak guards on listing title/description + media caption/alt (05/06)
-- Run AFTER 01–09. Idempotent.
-- =====================================================================
set check_function_bodies = off;

-- ---------- New price units ----------
alter type price_unit add value if not exists 'half_day';
alter type price_unit add value if not exists 'full_day';

-- ---------- Cloudinary metadata on listing_media ----------
-- Existing columns map as: cloudinary_id = public_id, url = secure_url,
-- poster_url = video poster, position = sort_order, type = media_type.
alter table listing_media
  add column if not exists thumbnail_url    text,
  add column if not exists width            int,
  add column if not exists height           int,
  add column if not exists bytes            int,
  add column if not exists format           text,
  add column if not exists duration_seconds numeric;

-- ---------- Media count limits (12 photos / 3 videos per listing) ----------
create or replace function enforce_media_limits()
returns trigger language plpgsql as $$
declare
  img_count int;
  vid_count int;
begin
  if tg_op = 'INSERT' then
    if new.type = 'image' then
      select count(*) into img_count from listing_media
        where listing_id = new.listing_id and type = 'image';
      if img_count >= 12 then
        raise exception 'Maximum 12 photos per listing.';
      end if;
    elsif new.type = 'video' then
      select count(*) into vid_count from listing_media
        where listing_id = new.listing_id and type = 'video';
      if vid_count >= 3 then
        raise exception 'Maximum 3 videos per listing.';
      end if;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists listing_media_limits on listing_media;
create trigger listing_media_limits
  before insert on listing_media
  for each row execute function enforce_media_limits();

-- =====================================================================
-- Provider RPC: submit a listing for review (draft/rejected/hidden -> pending_review)
-- =====================================================================
create or replace function provider_submit_listing(p_listing_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  l record;
begin
  select l2.*, b.owner_id, b.status as business_status
    into l
    from listings l2 join businesses b on b.id = l2.business_id
    where l2.id = p_listing_id;

  if l.id is null then raise exception 'Listing not found.'; end if;
  if l.owner_id is distinct from auth.uid() then
    raise exception 'This listing does not belong to you.';
  end if;
  if l.business_status is distinct from 'verified' then
    raise exception 'Your business must be verified before submitting listings.';
  end if;
  if l.status not in ('draft','rejected','hidden','pending_review') then
    raise exception 'This listing cannot be submitted from its current status.';
  end if;

  update listings set status = 'pending_review' where id = p_listing_id;

  insert into audit_logs (actor_id, action, entity, entity_id, metadata)
  values (auth.uid(), 'listing_submitted', 'listing', p_listing_id, null);
end $$;

-- =====================================================================
-- Admin RPCs (audited; is_admin() self-check)
-- =====================================================================
create or replace function admin_set_listing_status(p_listing_id uuid, p_status listing_status, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Admin only.'; end if;

  update listings
    set status = p_status,
        rejected_reason = case when p_status = 'rejected'
                               then coalesce(nullif(p_reason,''), 'Did not meet listing requirements.')
                               else rejected_reason end
    where id = p_listing_id;

  insert into audit_logs (actor_id, action, entity, entity_id, metadata)
  values (auth.uid(), 'listing_' || p_status, 'listing', p_listing_id,
          case when p_reason is not null then jsonb_build_object('reason', p_reason) else null end);
end $$;

create or replace function admin_set_listing_flags(p_listing_id uuid, p_featured boolean, p_premium boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Admin only.'; end if;
  update listings set is_featured = p_featured, is_premium = p_premium where id = p_listing_id;
  insert into audit_logs (actor_id, action, entity, entity_id, metadata)
  values (auth.uid(), 'listing_flags', 'listing', p_listing_id,
          jsonb_build_object('featured', p_featured, 'premium', p_premium));
end $$;

create or replace function admin_set_media_status(p_media_id uuid, p_status media_status)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Admin only.'; end if;
  if p_status not in ('approved','rejected','hidden','pending') then
    raise exception 'Invalid media status.';
  end if;
  update listing_media set status = p_status where id = p_media_id;
  insert into audit_logs (actor_id, action, entity, entity_id, metadata)
  values (auth.uid(), 'media_' || p_status, 'listing_media', p_media_id, null);
end $$;

create or replace function admin_set_cover_media(p_media_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_listing uuid;
begin
  if not is_admin() then raise exception 'Admin only.'; end if;
  select listing_id into v_listing from listing_media where id = p_media_id;
  if v_listing is null then raise exception 'Media not found.'; end if;

  update listing_media set is_cover = false where listing_id = v_listing;
  update listing_media set is_cover = true  where id = p_media_id;

  insert into audit_logs (actor_id, action, entity, entity_id, metadata)
  values (auth.uid(), 'media_set_cover', 'listing_media', p_media_id, null);
end $$;

revoke execute on function provider_submit_listing(uuid) from anon;
revoke execute on function admin_set_listing_status(uuid, listing_status, text) from anon;
revoke execute on function admin_set_listing_flags(uuid, boolean, boolean) from anon;
revoke execute on function admin_set_media_status(uuid, media_status) from anon;
revoke execute on function admin_set_cover_media(uuid) from anon;

-- End of 10_listing_media_pipeline.sql
