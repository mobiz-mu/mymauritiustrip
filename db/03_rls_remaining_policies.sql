-- =====================================================================
-- 03_rls_remaining_policies.sql
-- Completes RLS for every table the base schema (01) did not fully cover.
-- Pattern recap:
--   public  -> read only published/approved public content, NEVER contact cols
--   client  -> own rows only
--   provider-> own business + its children only
--   admin   -> everything (is_admin())
-- Reusable ownership predicate: a row tied to a listing/business is "mine"
-- if I own the business. Provider contact columns live only on `businesses`,
-- which has no public/client SELECT policy, so they are unreachable.
-- =====================================================================

-- Helper: does the current user own the business behind a given listing?
create or replace function owns_listing(p_listing uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from listings l
    join businesses b on b.id = l.business_id
    where l.id = p_listing and b.owner_id = auth.uid()
  );
$$;

create or replace function owns_business(p_business uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from businesses b where b.id = p_business and b.owner_id = auth.uid()
  );
$$;

create or replace function listing_is_published(p_listing uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from listings l where l.id = p_listing and l.status = 'published');
$$;

-- ---------- business_documents (PRIVATE: owner + admin only) ----------
create policy bd_owner_rw on business_documents for all
  using (is_admin() or owns_business(business_id))
  with check (is_admin() or owns_business(business_id));

-- ---------- business_verification_payments (PRIVATE: owner + admin) ----------
create policy bvp_owner_read on business_verification_payments for select
  using (is_admin() or owns_business(business_id));
create policy bvp_owner_insert on business_verification_payments for insert
  with check (owns_business(business_id));
-- Only admin may verify (status changes) — provider cannot self-verify.
create policy bvp_admin_update on business_verification_payments for update
  using (is_admin()) with check (is_admin());

-- ---------- listing_prices (public read if listing published; owner/admin write) ----------
create policy lp_public_read on listing_prices for select
  using (listing_is_published(listing_id) or is_admin() or owns_listing(listing_id));
create policy lp_owner_write on listing_prices for all
  using (is_admin() or owns_listing(listing_id))
  with check (is_admin() or owns_listing(listing_id));

-- ---------- listing_availability (same access shape) ----------
create policy la_public_read on listing_availability for select
  using (listing_is_published(listing_id) or is_admin() or owns_listing(listing_id));
create policy la_owner_write on listing_availability for all
  using (is_admin() or owns_listing(listing_id))
  with check (is_admin() or owns_listing(listing_id));

-- ---------- booking_messages ----------
-- Read: admin, the booking's client, or the provider that owns the booking.
-- Internal messages (is_internal=true) are visible only to provider + admin.
create policy bm_read on booking_messages for select using (
  is_admin()
  or (not is_internal and exists (
        select 1 from bookings bk where bk.id = booking_messages.booking_id and bk.client_id = auth.uid()))
  or exists (
        select 1 from bookings bk join businesses b on b.id = bk.business_id
        where bk.id = booking_messages.booking_id and b.owner_id = auth.uid())
);
create policy bm_insert on booking_messages for insert with check (
  sender_id = auth.uid() and (
    is_admin()
    or exists (select 1 from bookings bk where bk.id = booking_messages.booking_id and bk.client_id = auth.uid())
    or exists (select 1 from bookings bk join businesses b on b.id = bk.business_id
               where bk.id = booking_messages.booking_id and b.owner_id = auth.uid())
  )
);

-- ---------- review_photos (public read if parent review approved) ----------
create policy rp_public_read on review_photos for select using (
  exists (select 1 from reviews r where r.id = review_photos.review_id and r.status = 'approved')
  or is_admin()
  or exists (select 1 from reviews r where r.id = review_photos.review_id and r.client_id = auth.uid())
);
create policy rp_client_write on review_photos for all using (
  is_admin() or exists (select 1 from reviews r where r.id = review_photos.review_id and r.client_id = auth.uid())
) with check (
  is_admin() or exists (select 1 from reviews r where r.id = review_photos.review_id and r.client_id = auth.uid())
);

-- ---------- review_replies (provider replies to approved reviews) ----------
create policy rr_public_read on review_replies for select using (
  exists (select 1 from reviews r where r.id = review_replies.review_id and r.status = 'approved')
  or is_admin()
  or owns_business(business_id)
);
create policy rr_owner_write on review_replies for all
  using (is_admin() or owns_business(business_id))
  with check (is_admin() or owns_business(business_id));

-- ---------- invoices / invoice_items (provider read own; admin all) ----------
create policy inv_read on invoices for select
  using (is_admin() or (business_id is not null and owns_business(business_id)));
create policy inv_admin_write on invoices for all using (is_admin()) with check (is_admin());

create policy invi_read on invoice_items for select using (
  is_admin() or exists (
    select 1 from invoices i where i.id = invoice_items.invoice_id
      and i.business_id is not null and owns_business(i.business_id))
);
create policy invi_admin_write on invoice_items for all using (is_admin()) with check (is_admin());

-- ---------- payments (provider submits proof; admin verifies) ----------
create policy pay_read on payments for select
  using (is_admin() or (business_id is not null and owns_business(business_id)));
create policy pay_owner_insert on payments for insert
  with check (business_id is not null and owns_business(business_id));
create policy pay_admin_update on payments for update using (is_admin()) with check (is_admin());

-- ---------- premium_subscriptions (owner read/insert; admin activates) ----------
create policy ps_read on premium_subscriptions for select
  using (is_admin() or owns_business(business_id));
create policy ps_owner_insert on premium_subscriptions for insert
  with check (owns_business(business_id));
create policy ps_admin_update on premium_subscriptions for update using (is_admin()) with check (is_admin());

-- ---------- ads_promotions (public read active; provider read own; admin write) ----------
create policy ads_public_read on ads_promotions for select using (
  (is_active and (starts_at is null or starts_at <= current_date)
              and (ends_at  is null or ends_at  >= current_date))
  or is_admin()
  or (business_id is not null and owns_business(business_id))
);
create policy ads_admin_write on ads_promotions for all using (is_admin()) with check (is_admin());

-- =====================================================================
-- JSONB attribute guard (defense in depth)
-- The authoritative validation is the per-category zod contract in
-- lib/validation/listing-attributes.ts (run at write time). This trigger
-- is a backstop: attributes must be a JSON object, never an array/scalar.
-- =====================================================================
create or replace function guard_listing_attributes()
returns trigger language plpgsql as $$
begin
  if new.attributes is null then
    new.attributes := '{}'::jsonb;
  end if;
  if jsonb_typeof(new.attributes) <> 'object' then
    raise exception 'listing.attributes must be a JSON object';
  end if;
  return new;
end $$;

drop trigger if exists listings_guard_attributes on listings;
create trigger listings_guard_attributes
  before insert or update on listings
  for each row execute function guard_listing_attributes();
