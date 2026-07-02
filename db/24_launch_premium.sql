-- =====================================================================
-- db/24_launch_premium.sql
-- First-20 launch-free Premium Ads automation with expiry.
-- Run AFTER 23. Idempotent.
--   * adds premium expiry/source fields to listings
--   * recreates listings_public to expose premium_expires_at + premium_source
--   * auto-awards 1-month free premium to the first 20 published listings
--   * expiry helper so expired launch-free premium is dropped
-- Public premium filtering also excludes expired premium at query time
-- (see lib/public/catalog.ts), so expiry is respected even before a sweep.
-- =====================================================================

do $$ begin
  create type premium_source as enum ('manual','paid','launch_free');
exception when duplicate_object then null; end $$;

alter table listings add column if not exists premium_source     premium_source;
alter table listings add column if not exists premium_started_at timestamptz;
alter table listings add column if not exists premium_expires_at timestamptz;
alter table listings add column if not exists premium_awarded_at timestamptz;
alter table listings add column if not exists premium_award_rank int;

-- Public view now exposes premium expiry/source (name only; no contact fields).
-- IMPORTANT: PostgreSQL CREATE OR REPLACE VIEW must keep existing columns
-- in the same order. New premium columns are appended at the end.
create or replace view listings_public as
select
  l.id, l.slug, l.title, l.description, l.category_id, l.location_id,
  l.base_price_mur, l.price_unit, l.attributes, l.included, l.not_included,
  l.rules, l.cancellation_policy, l.is_premium, l.is_featured,
  l.rating_avg, l.review_count, l.seo_title, l.seo_description, l.seo_keywords,
  b.business_name, b.status as business_status, l.created_at,
  l.premium_source, l.premium_expires_at
from listings l
join businesses b on b.id = l.business_id
where l.status = 'published' and b.status = 'verified';
grant select on listings_public to anon, authenticated;

-- Award the next launch-free premium slot (cap 20), 1 month. Idempotent per listing.
create or replace function award_launch_premium(p_listing_id uuid) returns void as $$
declare v_awarded int;
begin
  if exists (select 1 from listings where id = p_listing_id and premium_award_rank is not null) then
    return; -- already awarded
  end if;
  select count(*) into v_awarded from listings where premium_source = 'launch_free';
  if v_awarded >= 20 then return; end if;
  update listings set
    is_premium         = true,
    premium_source     = 'launch_free',
    premium_started_at = now(),
    premium_expires_at = now() + interval '1 month',
    premium_awarded_at = now(),
    premium_award_rank = v_awarded + 1
  where id = p_listing_id;
end;
$$ language plpgsql security definer;

-- Fire when a listing becomes published (insert or update).
create or replace function listings_award_launch_premium() returns trigger as $$
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    perform award_launch_premium(new.id);
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists listings_launch_premium_upd on listings;
create trigger listings_launch_premium_upd after update of status on listings
  for each row execute function listings_award_launch_premium();

drop trigger if exists listings_launch_premium_ins on listings;
create trigger listings_launch_premium_ins after insert on listings
  for each row execute function listings_award_launch_premium();

-- Drop expired launch-free premium (safe anytime; can be wired to the existing cron).
create or replace function expire_launch_premium() returns int as $$
declare n int;
begin
  update listings set is_premium = false
  where premium_source = 'launch_free'
    and is_premium = true
    and premium_expires_at is not null
    and premium_expires_at < now();
  get diagnostics n = row_count;
  return n;
end;
$$ language plpgsql security definer;

-- Rollback (manual):
--   drop trigger listings_launch_premium_upd on listings;
--   drop trigger listings_launch_premium_ins on listings;
--   drop function listings_award_launch_premium(); drop function award_launch_premium(uuid);
--   drop function expire_launch_premium();
--   alter table listings drop column premium_source, drop column premium_started_at,
--     drop column premium_expires_at, drop column premium_awarded_at, drop column premium_award_rank;
--   (then re-create listings_public without the two premium columns)

