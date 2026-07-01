-- =====================================================================
-- 05_security_hardening.sql  (Phase 1.1)
-- Column-level protection, stricter provider rules, DB contact-leak guards,
-- booking integrity, and SECURITY DEFINER fixes for RLS-writing triggers.
--
-- Run AFTER 01–04. Safe to re-run (drops/replaces are guarded).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0) Privilege helper used by all protection triggers.
--    Returns true when the caller is allowed to bypass column protection:
--      * an admin profile (authenticated admin session), OR
--      * the service_role server (admin pipeline / cron), OR
--      * a trusted internal SECURITY DEFINER function (runs as postgres).
--    SECURITY INVOKER (default) so current_user reflects the real caller;
--    inside a DEFINER function current_user becomes 'postgres' -> bypass.
-- ---------------------------------------------------------------------
create or replace function acting_as_admin()
returns boolean
language plpgsql
stable
as $$
declare
  claims_role text;
begin
  if current_user in ('postgres', 'supabase_admin', 'service_role') then
    return true;
  end if;
  begin
    claims_role := current_setting('request.jwt.claims', true)::jsonb ->> 'role';
  exception when others then
    claims_role := null;
  end;
  if claims_role = 'service_role' then
    return true;
  end if;
  return is_admin();
end;
$$;

-- =====================================================================
-- 1) Unverified providers cannot CREATE any listing (even a draft).
--    Also keeps publish gated on verification (applies to admin too).
-- =====================================================================
create or replace function enforce_listing_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cnt int;
  bstatus provider_status;
begin
  select status into bstatus from businesses where id = new.business_id;

  if tg_op = 'INSERT' then
    if bstatus is distinct from 'verified' then
      raise exception
        'Only verified providers can create listings. Pay the Rs 499 verification fee and get admin approval first.';
    end if;
    select count(*) into cnt from listings where business_id = new.business_id;
    if cnt >= 7 then
      raise exception 'Listing limit reached (max 7 per provider account).';
    end if;
  end if;

  if new.status = 'published' and bstatus is distinct from 'verified' then
    raise exception 'A listing cannot be published unless its business is verified.';
  end if;

  return new;
end;
$$;
-- trigger listings_enforce_rules already exists (01); function replaced above.

-- =====================================================================
-- 2) Protect businesses admin/verification/premium/ownership columns.
-- =====================================================================
create or replace function protect_business_fields()
returns trigger
language plpgsql
as $$
begin
  if acting_as_admin() then
    return new;
  end if;
  if new.owner_id          is distinct from old.owner_id
     or new.status            is distinct from old.status
     or new.verification_paid is distinct from old.verification_paid
     or new.verified_at       is distinct from old.verified_at
     or new.rejected_reason   is distinct from old.rejected_reason
     or new.is_premium        is distinct from old.is_premium
     or new.premium_until     is distinct from old.premium_until then
    raise exception
      'You cannot modify verification, premium, or ownership fields. These are admin-controlled.';
  end if;
  return new;
end;
$$;
drop trigger if exists businesses_protect_fields on businesses;
create trigger businesses_protect_fields
  before update on businesses
  for each row execute function protect_business_fields();

-- =====================================================================
-- 3) Protect listing admin fields + enforce draft/pending_review flow.
--    Providers may only set status to draft/pending_review; admin publishes
--    and controls premium/featured/rating/review_count/rejected_reason.
-- =====================================================================
create or replace function protect_listing_fields()
returns trigger
language plpgsql
as $$
begin
  if acting_as_admin() then
    return new;
  end if;

  if new.status not in ('draft', 'pending_review') then
    raise exception
      'Providers cannot set listing status to "%". Submit as pending_review; an admin publishes.', new.status;
  end if;

  if tg_op = 'INSERT' then
    new.is_premium      := false;
    new.is_featured     := false;
    new.rating_avg      := 0;
    new.review_count    := 0;
    new.rejected_reason := null;
  else
    if new.is_premium      is distinct from old.is_premium
       or new.is_featured     is distinct from old.is_featured
       or new.rating_avg      is distinct from old.rating_avg
       or new.review_count    is distinct from old.review_count
       or new.rejected_reason is distinct from old.rejected_reason then
      raise exception
        'You cannot modify premium, featured, rating, or rejection fields. These are admin-controlled.';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists listings_protect_fields on listings;
create trigger listings_protect_fields
  before insert or update on listings
  for each row execute function protect_listing_fields();

-- =====================================================================
-- 4) Protect booking financial/identity/snapshot columns.
--    Providers may only move a pending booking to accepted/rejected.
-- =====================================================================
create or replace function protect_booking_fields()
returns trigger
language plpgsql
as $$
begin
  if acting_as_admin() then
    return new;
  end if;

  if new.reference               is distinct from old.reference
     or new.client_id               is distinct from old.client_id
     or new.listing_id              is distinct from old.listing_id
     or new.business_id             is distinct from old.business_id
     or new.base_amount_mur         is distinct from old.base_amount_mur
     or new.display_amount          is distinct from old.display_amount
     or new.display_currency        is distinct from old.display_currency
     or new.exchange_rate           is distinct from old.exchange_rate
     or new.exchange_rate_date      is distinct from old.exchange_rate_date
     or new.currency_margin_percent is distinct from old.currency_margin_percent
     or new.final_payment_currency  is distinct from old.final_payment_currency
     or new.full_name               is distinct from old.full_name
     or new.email                   is distinct from old.email
     or new.whatsapp                is distinct from old.whatsapp
     or new.country                 is distinct from old.country
     or new.booking_date            is distinct from old.booking_date
     or new.arrival_date            is distinct from old.arrival_date
     or new.num_people              is distinct from old.num_people
     or new.quantity                is distinct from old.quantity
     or new.special_request         is distinct from old.special_request
     or new.commission_invoice_id   is distinct from old.commission_invoice_id
     or new.confirmed_at            is distinct from old.confirmed_at
     or new.completed_at            is distinct from old.completed_at then
    raise exception
      'Providers cannot modify booking financial, identity, or snapshot fields.';
  end if;

  if new.status is distinct from old.status then
    if not (old.status = 'pending'
            and new.status in ('provider_accepted', 'provider_rejected')) then
      raise exception
        'Providers can only accept or reject a pending booking. Other transitions are admin-controlled.';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists bookings_protect_fields on bookings;
create trigger bookings_protect_fields
  before update on bookings
  for each row execute function protect_booking_fields();

-- =====================================================================
-- 5) Protect commission invoices. Providers may only attach proof_path.
-- =====================================================================
create or replace function protect_commission_fields()
returns trigger
language plpgsql
as $$
begin
  if acting_as_admin() then
    return new;
  end if;
  if new.booking_id            is distinct from old.booking_id
     or new.business_id           is distinct from old.business_id
     or new.booking_total_mur     is distinct from old.booking_total_mur
     or new.commission_percent    is distinct from old.commission_percent
     or new.commission_amount_mur is distinct from old.commission_amount_mur
     or new.due_date              is distinct from old.due_date
     or new.status                is distinct from old.status
     or new.paid_at               is distinct from old.paid_at
     or new.marked_paid_by        is distinct from old.marked_paid_by then
    raise exception
      'Providers can only attach a payment proof. Commission status and amounts are admin-controlled.';
  end if;
  return new;
end;
$$;
drop trigger if exists commission_protect_fields on commission_invoices;
create trigger commission_protect_fields
  before update on commission_invoices
  for each row execute function protect_commission_fields();

-- =====================================================================
-- 6) SECURITY DEFINER fixes for triggers that write to RLS-protected /
--    column-protected tables during normal client/provider actions.
-- =====================================================================

-- generate_commission_invoice writes to commission_invoices (admin-only INSERT)
-- and back to bookings (protected columns). Run as definer so it is reliable.
create or replace function generate_commission_invoice()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cid uuid;
begin
  if new.status in ('client_arrived', 'completed')
     and old.status not in ('client_arrived', 'completed')
     and not exists (select 1 from commission_invoices where booking_id = new.id) then
    insert into commission_invoices
      (booking_id, business_id, booking_total_mur, commission_percent,
       commission_amount_mur, due_date, status)
    values
      (new.id, new.business_id, new.base_amount_mur, 15.00,
       round(new.base_amount_mur * 0.15, 2), current_date + interval '15 days', 'pending')
    returning id into cid;

    update bookings set commission_invoice_id = cid where id = new.id;
  end if;
  return new;
end;
$$;

-- refresh_listing_rating updates listings (RLS + protected columns). Definer.
create or replace function refresh_listing_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  lid uuid;
begin
  lid := coalesce(new.listing_id, old.listing_id);
  update listings l set
    rating_avg = coalesce((select round(avg(rating)::numeric, 1)
                           from reviews where listing_id = lid and status = 'approved'), 0),
    review_count = (select count(*) from reviews where listing_id = lid and status = 'approved')
  where l.id = lid;
  return null;
end;
$$;

-- =====================================================================
-- 7) Database-level contact-leak protection.
--    Applied to public-facing / cross-party free text only:
--    listing title+description, media caption+alt, booking messages,
--    review replies. NOT applied to chatbot_leads / support_messages,
--    because those legitimately contain the USER'S OWN contact details.
-- =====================================================================
create or replace function contains_contact_info(p text)
returns boolean
language plpgsql
immutable
as $$
begin
  if p is null then
    return false;
  end if;
  -- email
  if p ~* '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}' then return true; end if;
  -- phone / WhatsApp: 7+ digit run with optional separators
  if p ~ '(\+?\d[\d\s().\-]{6,}\d)' then return true; end if;
  -- explicit URL
  if p ~* '(https?://|www\.)' then return true; end if;
  -- bare domain
  if p ~* '[a-z0-9-]+\.(com|net|org|io|mu|fr|co)([/[:space:]]|$)' then return true; end if;
  -- social platforms
  if p ~* '(whatsapp|wa\.me|t\.me|telegram|facebook|fb\.com|instagram|insta|tiktok|snapchat|messenger)' then return true; end if;
  -- @handle
  if p ~* '(^|[[:space:]])@[a-z0-9._]{2,}' then return true; end if;
  return false;
end;
$$;

create or replace function guard_contact_leak_listing()
returns trigger language plpgsql as $$
begin
  if acting_as_admin() then return new; end if;
  if contains_contact_info(new.title) or contains_contact_info(new.description) then
    raise exception
      'Contact details are not allowed in listing title or description. All communication goes through MyMauritiusTrip.com.';
  end if;
  return new;
end; $$;
drop trigger if exists listings_guard_contact on listings;
create trigger listings_guard_contact
  before insert or update on listings
  for each row execute function guard_contact_leak_listing();

create or replace function guard_contact_leak_media()
returns trigger language plpgsql as $$
begin
  if acting_as_admin() then return new; end if;
  if contains_contact_info(new.caption) or contains_contact_info(new.alt_text) then
    raise exception 'Contact details are not allowed in media captions or alt text.';
  end if;
  return new;
end; $$;
drop trigger if exists media_guard_contact on listing_media;
create trigger media_guard_contact
  before insert or update on listing_media
  for each row execute function guard_contact_leak_media();

create or replace function guard_contact_leak_booking_message()
returns trigger language plpgsql as $$
begin
  if acting_as_admin() then return new; end if;
  if contains_contact_info(new.body) then
    raise exception 'Contact details are not allowed in messages. Communication stays on MyMauritiusTrip.com.';
  end if;
  return new;
end; $$;
drop trigger if exists booking_messages_guard_contact on booking_messages;
create trigger booking_messages_guard_contact
  before insert or update on booking_messages
  for each row execute function guard_contact_leak_booking_message();

create or replace function guard_contact_leak_review_reply()
returns trigger language plpgsql as $$
begin
  if acting_as_admin() then return new; end if;
  if contains_contact_info(new.body) then
    raise exception 'Contact details are not allowed in review replies.';
  end if;
  return new;
end; $$;
drop trigger if exists review_replies_guard_contact on review_replies;
create trigger review_replies_guard_contact
  before insert or update on review_replies
  for each row execute function guard_contact_leak_review_reply();

-- =====================================================================
-- 8) Tighten guest/client insert policies (anti-impersonation).
--    A supplied client_id / sender_id must be null or the caller's own uid.
-- =====================================================================
drop policy if exists trip_requests_insert on trip_requests;
create policy trip_requests_insert on trip_requests for insert
  with check (client_id is null or client_id = auth.uid());

drop policy if exists support_insert on support_messages;
create policy support_insert on support_messages for insert
  with check (sender_id is null or sender_id = auth.uid());

-- booking_messages: sender must be the caller (kept from 03, restated for clarity)
drop policy if exists bm_insert on booking_messages;
create policy bm_insert on booking_messages for insert with check (
  sender_id = auth.uid() and (
    is_admin()
    or exists (select 1 from bookings bk where bk.id = booking_messages.booking_id and bk.client_id = auth.uid())
    or exists (select 1 from bookings bk join businesses b on b.id = bk.business_id
               where bk.id = booking_messages.booking_id and b.owner_id = auth.uid())
  )
);

-- =====================================================================
-- 9) Booking integrity guard (server-authoritative amounts + snapshot).
--    business_id is derived from the listing; listing must be published;
--    base_amount_mur and the currency snapshot are computed here, never
--    trusted from client input.
-- =====================================================================
create or replace function enforce_booking_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  l       record;
  v_units numeric;
  v_rate  numeric;
  v_margin numeric;
begin
  select id, business_id, status, base_price_mur, price_unit
    into l from listings where id = new.listing_id;

  if l.id is null then
    raise exception 'Listing not found for booking.';
  end if;

  -- Derive business from the listing; never trust client-supplied value.
  new.business_id := l.business_id;

  if l.status <> 'published' then
    raise exception 'This listing is not available for booking.';
  end if;

  -- Server-side amount (ignore any client-sent amount).
  v_units := case l.price_unit
               when 'per_person' then coalesce(new.num_people, 1)
               when 'per_day'    then coalesce(new.quantity, 1)
               when 'per_night'  then coalesce(new.quantity, 1)
               else 1
             end;
  if v_units < 1 then v_units := 1; end if;

  new.base_amount_mur := round(l.base_price_mur * v_units, 2);
  new.final_payment_currency := 'MUR';

  -- Currency snapshot (display only).
  if new.display_currency is null then
    new.display_currency := 'MUR';
  end if;

  if new.display_currency = 'MUR' then
    new.exchange_rate := 1;
    new.exchange_rate_date := current_date;
    new.currency_margin_percent := 0;
    new.display_amount := new.base_amount_mur;
  else
    select margin_percent into v_margin from currency_settings where id = 1;
    v_margin := coalesce(v_margin, 0);

    select rate_per_mur, rate_date
      into v_rate, new.exchange_rate_date
      from exchange_rates
      where currency = new.display_currency
      order by rate_date desc
      limit 1;

    if v_rate is null then
      -- No rate on file: fall back to MUR to stay correct.
      new.display_currency := 'MUR';
      new.exchange_rate := 1;
      new.exchange_rate_date := current_date;
      new.currency_margin_percent := 0;
      new.display_amount := new.base_amount_mur;
    else
      new.exchange_rate := v_rate;
      new.currency_margin_percent := v_margin;
      new.display_amount := round(new.base_amount_mur * v_rate * (1 + v_margin / 100.0), 2);
    end if;
  end if;

  return new;
end;
$$;
drop trigger if exists bookings_enforce_integrity on bookings;
create trigger bookings_enforce_integrity
  before insert on bookings
  for each row execute function enforce_booking_integrity();

-- End of 05_security_hardening.sql
