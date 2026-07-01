

-- =====================================================
-- START 01_schema.sql
-- =====================================================

-- =====================================================================
-- MyMauritiusTrip.com — PostgreSQL / Supabase schema
-- Version 1.0  |  Base currency: MUR (single source of truth for money)
-- Target: Postgres 15 (Supabase). Run in the SQL editor or via migration.
--
-- Conventions:
--   * All money is stored as numeric(12,2) in MUR unless suffixed otherwise.
--   * Every table has created_at / updated_at with an auto-update trigger.
--   * RLS is enabled on every table. Core policies are included below;
--     remaining tables follow the same four patterns (public/client/
--     provider/admin) and are completed from db/policies/ in Phase 1.
-- =====================================================================

-- ---------- Extensions ----------
create extension if not exists pgcrypto;     -- gen_random_uuid()
create extension if not exists citext;       -- case-insensitive email
-- create extension if not exists pg_cron;   -- enable in Supabase dashboard for reminders

-- ---------- Enums ----------
create type user_role          as enum ('client','provider','admin');

create type provider_status    as enum
  ('pending_verification','payment_pending','under_review','verified','rejected','suspended');

create type listing_status     as enum
  ('draft','pending_review','published','rejected','hidden','suspended');

create type booking_status      as enum
  ('pending','provider_accepted','provider_rejected','confirmed',
   'client_arrived','completed','cancelled');

create type invoice_status      as enum
  ('draft','sent','pending','paid','overdue','cancelled','disputed');

create type review_status       as enum ('pending','approved','rejected');

create type price_unit          as enum
  ('per_day','per_night','per_person','per_trip','per_booking');

create type media_type          as enum ('image','video');

create type media_status        as enum ('pending','approved','rejected','hidden');

create type payment_kind        as enum ('verification_fee','premium_subscription','commission');

create type payment_status      as enum ('pending','submitted','verified','rejected');

create type display_currency    as enum ('MUR','EUR','USD','GBP','INR','ZAR','CHF','AED');

-- =====================================================================
-- Helper: updated_at trigger
-- =====================================================================
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- =====================================================================
-- profiles  (1:1 with auth.users; holds role + contact)
-- =====================================================================
create table profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  role                user_role   not null default 'client',
  full_name           text        not null,
  email               citext      not null,
  whatsapp            text,
  country             text,
  preferred_language  text        default 'en',
  preferred_currency  display_currency default 'MUR',
  -- optional client trip context
  travel_dates        text,
  travellers          int,
  special_needs       text,
  terms_accepted_at   timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index profiles_role_idx on profiles(role);
create trigger profiles_set_updated before update on profiles
  for each row execute function set_updated_at();

-- Role helper functions (used throughout RLS)
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function is_provider() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'provider');
$$;

-- =====================================================================
-- businesses  (one per provider account)
-- Contact columns here are NEVER exposed to public/client roles.
-- =====================================================================
create table businesses (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid not null references profiles(id) on delete cascade,
  business_name       text not null,
  owner_full_name     text not null,
  email               citext not null,           -- private
  whatsapp            text not null,             -- private
  phone               text,                      -- private
  category_id         uuid,                      -- primary category (FK added later)
  location_id         uuid,
  brn                 text,                      -- business registration number
  country             text not null default 'Mauritius',
  status              provider_status not null default 'pending_verification',
  verification_paid   boolean not null default false,
  verified_at         timestamptz,
  rejected_reason     text,
  is_premium          boolean not null default false,
  premium_until       date,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique(owner_id)                                -- one business per provider account
);
create index businesses_status_idx on businesses(status);
create trigger businesses_set_updated before update on businesses
  for each row execute function set_updated_at();

-- =====================================================================
-- business_documents (private storage references)
-- =====================================================================
create table business_documents (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references businesses(id) on delete cascade,
  doc_type      text not null,                   -- 'brn','id','license',...
  storage_path  text not null,                   -- private Supabase bucket path
  status        media_status not null default 'pending',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger business_documents_set_updated before update on business_documents
  for each row execute function set_updated_at();

-- =====================================================================
-- business_verification_payments (Rs 499 one-time)
-- =====================================================================
create table business_verification_payments (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references businesses(id) on delete cascade,
  amount_mur      numeric(12,2) not null default 499.00,
  method          text,                          -- 'bank_transfer','mcb_juice',...
  proof_path      text,                          -- private storage
  status          payment_status not null default 'pending',
  verified_by     uuid references profiles(id),
  verified_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger bvp_set_updated before update on business_verification_payments
  for each row execute function set_updated_at();

-- =====================================================================
-- categories & locations
-- =====================================================================
create table categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  name_fr     text,
  icon        text,
  sort_order  int default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger categories_set_updated before update on categories
  for each row execute function set_updated_at();

create table locations (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  region      text,
  latitude    numeric(9,6),
  longitude   numeric(9,6),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger locations_set_updated before update on locations
  for each row execute function set_updated_at();

-- Now that categories/locations exist, attach business FKs.
alter table businesses
  add constraint businesses_category_fk foreign key (category_id) references categories(id),
  add constraint businesses_location_fk foreign key (location_id) references locations(id);

-- =====================================================================
-- listings
-- attributes JSONB holds category-specific filters (transmission, seats,
-- bedrooms, pool, snorkeling, cuisine, ...). GIN index for fast filtering.
-- =====================================================================
create table listings (
  id                  uuid primary key default gen_random_uuid(),
  business_id         uuid not null references businesses(id) on delete cascade,
  category_id         uuid not null references categories(id),
  location_id         uuid references locations(id),
  title               text not null,
  slug                text not null unique,
  description         text not null,
  status              listing_status not null default 'draft',
  -- primary price (variants live in listing_prices)
  base_price_mur      numeric(12,2) not null,
  price_unit          price_unit not null default 'per_booking',
  attributes          jsonb not null default '{}'::jsonb,  -- category filters
  included            text[],
  not_included        text[],
  rules               text,
  cancellation_policy text,
  is_premium          boolean not null default false,
  is_featured         boolean not null default false,
  rating_avg          numeric(2,1) not null default 0,     -- denormalized
  review_count        int not null default 0,              -- denormalized
  -- SEO
  seo_title           text,
  seo_description     text,
  seo_keywords        text[],
  rejected_reason     text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index listings_status_idx       on listings(status);
create index listings_category_idx     on listings(category_id);
create index listings_location_idx     on listings(location_id);
create index listings_business_idx     on listings(business_id);
create index listings_attributes_gin   on listings using gin (attributes);
create index listings_featured_idx     on listings(is_featured) where is_featured;
create trigger listings_set_updated before update on listings
  for each row execute function set_updated_at();

-- Enforce: max 7 listings per business, and only verified businesses publish.
create or replace function enforce_listing_rules()
returns trigger language plpgsql as $$
declare
  cnt int;
  bstatus provider_status;
begin
  select status into bstatus from businesses where id = new.business_id;
  if bstatus is distinct from 'verified' and new.status = 'published' then
    raise exception 'Business must be verified before publishing listings';
  end if;

  if tg_op = 'INSERT' then
    select count(*) into cnt from listings where business_id = new.business_id;
    if cnt >= 7 then
      raise exception 'Listing limit reached (max 7 per provider account)';
    end if;
  end if;
  return new;
end $$;
create trigger listings_enforce_rules
  before insert or update on listings
  for each row execute function enforce_listing_rules();

-- =====================================================================
-- listing_media (Cloudinary public id + transform metadata)
-- =====================================================================
create table listing_media (
  id              uuid primary key default gen_random_uuid(),
  listing_id      uuid not null references listings(id) on delete cascade,
  type            media_type not null,
  cloudinary_id   text not null,
  url             text not null,
  poster_url      text,                          -- video thumbnail/poster
  alt_text        text,
  caption         text,
  position        int not null default 0,
  is_cover        boolean not null default false,
  status          media_status not null default 'pending',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index listing_media_listing_idx on listing_media(listing_id);
create trigger listing_media_set_updated before update on listing_media
  for each row execute function set_updated_at();

-- =====================================================================
-- listing_prices (optional seasonal / variant pricing) & availability
-- =====================================================================
create table listing_prices (
  id            uuid primary key default gen_random_uuid(),
  listing_id    uuid not null references listings(id) on delete cascade,
  label         text,                            -- 'High season', 'Weekend'...
  price_mur     numeric(12,2) not null,
  price_unit    price_unit not null,
  valid_from    date,
  valid_to      date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger listing_prices_set_updated before update on listing_prices
  for each row execute function set_updated_at();

create table listing_availability (
  id            uuid primary key default gen_random_uuid(),
  listing_id    uuid not null references listings(id) on delete cascade,
  day           date not null,
  is_available  boolean not null default true,
  price_override_mur numeric(12,2),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique(listing_id, day)
);
create index listing_availability_listing_idx on listing_availability(listing_id, day);
create trigger listing_availability_set_updated before update on listing_availability
  for each row execute function set_updated_at();

-- =====================================================================
-- favourites
-- =====================================================================
create table favourites (
  client_id   uuid not null references profiles(id) on delete cascade,
  listing_id  uuid not null references listings(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (client_id, listing_id)
);

-- =====================================================================
-- bookings  (currency context snapshotted here)
-- =====================================================================
create sequence booking_seq;

create table bookings (
  id                    uuid primary key default gen_random_uuid(),
  reference             text unique,             -- MMT-2026-0001 (trigger-filled)
  client_id             uuid not null references profiles(id),
  listing_id            uuid not null references listings(id),
  business_id           uuid not null references businesses(id),
  status                booking_status not null default 'pending',
  -- request details
  full_name             text not null,
  email                 citext not null,
  whatsapp              text,
  country               text,
  booking_date          date,
  arrival_date          date,
  num_people            int,
  quantity              int,                     -- days / nights / units
  special_request       text,
  -- money (MUR is source of truth)
  base_amount_mur       numeric(12,2) not null,
  display_currency      display_currency not null default 'MUR',
  exchange_rate         numeric(14,6) not null default 1,
  exchange_rate_date    date not null default current_date,
  currency_margin_percent numeric(5,2) not null default 0,
  display_amount        numeric(14,2) not null,
  final_payment_currency display_currency not null default 'MUR',
  -- commission convenience flags (authoritative state in commission_invoices)
  commission_invoice_id uuid,
  provider_responded_at timestamptz,
  confirmed_at          timestamptz,
  completed_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index bookings_client_idx   on bookings(client_id);
create index bookings_business_idx on bookings(business_id);
create index bookings_status_idx   on bookings(status);
create trigger bookings_set_updated before update on bookings
  for each row execute function set_updated_at();

-- Reference generator: MMT-<year>-<padded seq>
create or replace function set_booking_reference()
returns trigger language plpgsql as $$
begin
  if new.reference is null then
    new.reference := 'MMT-' || to_char(now(),'YYYY') || '-' ||
                     lpad(nextval('booking_seq')::text, 4, '0');
  end if;
  return new;
end $$;
create trigger bookings_set_reference before insert on bookings
  for each row execute function set_booking_reference();

-- =====================================================================
-- booking_messages (internal, platform-mediated)
-- =====================================================================
create table booking_messages (
  id            uuid primary key default gen_random_uuid(),
  booking_id    uuid not null references bookings(id) on delete cascade,
  sender_id     uuid not null references profiles(id),
  body          text not null,
  is_internal   boolean not null default false,  -- provider<->admin only
  created_at    timestamptz not null default now()
);
create index booking_messages_booking_idx on booking_messages(booking_id);

-- =====================================================================
-- trip_requests (Request Your Trip)
-- =====================================================================
create table trip_requests (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid references profiles(id),    -- may be guest (null)
  full_name       text not null,
  email           citext not null,
  whatsapp        text,
  country         text,
  arrival_date    date,
  departure_date  date,
  travellers      int,
  budget          text,
  needs           text not null,
  preferred_location text,
  preferred_language text,
  notes           text,
  status          text not null default 'new',     -- new / in_progress / closed
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger trip_requests_set_updated before update on trip_requests
  for each row execute function set_updated_at();

-- =====================================================================
-- reviews  (only on completed bookings) + photos + replies
-- =====================================================================
create table reviews (
  id            uuid primary key default gen_random_uuid(),
  booking_id    uuid not null references bookings(id) on delete cascade,
  listing_id    uuid not null references listings(id) on delete cascade,
  client_id     uuid not null references profiles(id),
  rating        int not null check (rating between 1 and 5),
  comment       text,
  status        review_status not null default 'pending',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique(booking_id)                               -- one review per booking
);
create index reviews_listing_idx on reviews(listing_id, status);
create trigger reviews_set_updated before update on reviews
  for each row execute function set_updated_at();

create table review_photos (
  id          uuid primary key default gen_random_uuid(),
  review_id   uuid not null references reviews(id) on delete cascade,
  cloudinary_id text not null,
  url         text not null,
  created_at  timestamptz not null default now()
);

create table review_replies (
  id          uuid primary key default gen_random_uuid(),
  review_id   uuid not null references reviews(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  body        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger review_replies_set_updated before update on review_replies
  for each row execute function set_updated_at();

-- Keep listing rating_avg / review_count in sync on approval.
create or replace function refresh_listing_rating()
returns trigger language plpgsql as $$
declare lid uuid;
begin
  lid := coalesce(new.listing_id, old.listing_id);
  update listings l set
    rating_avg = coalesce((select round(avg(rating)::numeric,1)
                           from reviews where listing_id = lid and status='approved'),0),
    review_count = (select count(*) from reviews where listing_id = lid and status='approved')
  where l.id = lid;
  return null;
end $$;
create trigger reviews_refresh_rating
  after insert or update or delete on reviews
  for each row execute function refresh_listing_rating();

-- =====================================================================
-- commission_invoices  (15% of MUR total, 15-day due window)
-- =====================================================================
create table commission_invoices (
  id                  uuid primary key default gen_random_uuid(),
  booking_id          uuid not null references bookings(id) on delete cascade,
  business_id         uuid not null references businesses(id),
  booking_total_mur   numeric(12,2) not null,
  commission_percent  numeric(5,2) not null default 15.00,
  commission_amount_mur numeric(12,2) not null,
  due_date            date not null,                  -- created + 15 days
  status              invoice_status not null default 'pending',
  proof_path          text,                           -- private storage
  paid_at             timestamptz,
  marked_paid_by      uuid references profiles(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique(booking_id)
);
create index commission_invoices_business_idx on commission_invoices(business_id, status);
create trigger commission_invoices_set_updated before update on commission_invoices
  for each row execute function set_updated_at();

-- Generate commission invoice when a booking reaches client_arrived/completed.
create or replace function generate_commission_invoice()
returns trigger language plpgsql as $$
declare cid uuid;
begin
  if new.status in ('client_arrived','completed')
     and old.status not in ('client_arrived','completed')
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
end $$;
create trigger bookings_generate_commission
  after update on bookings
  for each row execute function generate_commission_invoice();

-- =====================================================================
-- generic invoices / payments / premium / ads
-- =====================================================================
create table invoices (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid references businesses(id),
  kind          payment_kind not null,
  amount_mur    numeric(12,2) not null,
  status        invoice_status not null default 'draft',
  due_date      date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger invoices_set_updated before update on invoices
  for each row execute function set_updated_at();

create table invoice_items (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references invoices(id) on delete cascade,
  description text not null,
  amount_mur  numeric(12,2) not null
);

create table payments (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid references businesses(id),
  kind          payment_kind not null,
  amount_mur    numeric(12,2) not null,
  method        text,
  proof_path    text,                            -- private storage
  status        payment_status not null default 'pending',
  reference_id  uuid,                            -- invoice / commission_invoice id
  verified_by   uuid references profiles(id),
  verified_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger payments_set_updated before update on payments
  for each row execute function set_updated_at();

create table premium_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references businesses(id) on delete cascade,
  amount_mur    numeric(12,2) not null default 299.00,
  period_start  date not null default current_date,
  period_end    date not null,
  status        payment_status not null default 'pending',
  proof_path    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger premium_subscriptions_set_updated before update on premium_subscriptions
  for each row execute function set_updated_at();

create table ads_promotions (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid references businesses(id) on delete cascade,
  listing_id    uuid references listings(id) on delete cascade,
  placement     text not null,                   -- 'homepage','category_top',...
  starts_at     date,
  ends_at       date,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger ads_promotions_set_updated before update on ads_promotions
  for each row execute function set_updated_at();

-- =====================================================================
-- currency
-- =====================================================================
create table exchange_rates (
  id            uuid primary key default gen_random_uuid(),
  currency      display_currency not null,
  rate_per_mur  numeric(14,8) not null,          -- 1 MUR = rate_per_mur <currency>
  rate_date     date not null default current_date,
  source        text,
  created_at    timestamptz not null default now(),
  unique(currency, rate_date)
);
create index exchange_rates_currency_idx on exchange_rates(currency, rate_date desc);

create table currency_settings (
  id              int primary key default 1 check (id = 1), -- singleton
  base_currency   display_currency not null default 'MUR',
  margin_percent  numeric(5,2) not null default 3.00,
  updated_at      timestamptz not null default now()
);
create trigger currency_settings_set_updated before update on currency_settings
  for each row execute function set_updated_at();

-- =====================================================================
-- leads / support / content / settings / audit
-- =====================================================================
create table chatbot_leads (
  id          uuid primary key default gen_random_uuid(),
  name        text,
  email       citext,
  whatsapp    text,
  country     text,
  travel_dates text,
  request_details text,
  transcript  jsonb,
  status      text not null default 'new',
  created_at  timestamptz not null default now()
);

create table support_messages (
  id          uuid primary key default gen_random_uuid(),
  sender_id   uuid references profiles(id),
  name        text,
  email       citext,
  subject     text,
  body        text not null,
  status      text not null default 'open',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger support_messages_set_updated before update on support_messages
  for each row execute function set_updated_at();

create table seo_pages (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  title         text not null,
  meta_description text,
  h1            text,
  body_html     text,
  json_ld       jsonb,
  locale        text not null default 'en',
  is_published  boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger seo_pages_set_updated before update on seo_pages
  for each row execute function set_updated_at();

create table blog_posts (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  title         text not null,
  excerpt       text,
  body_html     text,
  cover_url     text,
  locale        text not null default 'en',
  is_published  boolean not null default false,
  published_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger blog_posts_set_updated before update on blog_posts
  for each row execute function set_updated_at();

create table settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);
create trigger settings_set_updated before update on settings
  for each row execute function set_updated_at();

create table audit_logs (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references profiles(id),
  action      text not null,
  entity      text,
  entity_id   uuid,
  metadata    jsonb,
  created_at  timestamptz not null default now()
);
create index audit_logs_entity_idx on audit_logs(entity, entity_id);

-- =====================================================================
-- A public, contact-safe view of listings for anonymous/client reads.
-- Deliberately excludes any business contact columns.
-- =====================================================================
create or replace view listings_public as
select
  l.id, l.slug, l.title, l.description, l.category_id, l.location_id,
  l.base_price_mur, l.price_unit, l.attributes, l.included, l.not_included,
  l.rules, l.cancellation_policy, l.is_premium, l.is_featured,
  l.rating_avg, l.review_count, l.seo_title, l.seo_description, l.seo_keywords,
  b.business_name,                       -- name only, no contact fields
  b.status as business_status,
  l.created_at
from listings l
join businesses b on b.id = l.business_id
where l.status = 'published';

-- =====================================================================
-- ROW-LEVEL SECURITY
-- Enable on every table; core policies below. Remaining tables follow
-- the same patterns and are completed in Phase 1 (db/policies/).
-- =====================================================================
alter table profiles                         enable row level security;
alter table businesses                       enable row level security;
alter table business_documents               enable row level security;
alter table business_verification_payments   enable row level security;
alter table categories                       enable row level security;
alter table locations                        enable row level security;
alter table listings                         enable row level security;
alter table listing_media                    enable row level security;
alter table listing_prices                   enable row level security;
alter table listing_availability             enable row level security;
alter table favourites                       enable row level security;
alter table bookings                         enable row level security;
alter table booking_messages                 enable row level security;
alter table trip_requests                    enable row level security;
alter table reviews                          enable row level security;
alter table review_photos                    enable row level security;
alter table review_replies                   enable row level security;
alter table commission_invoices              enable row level security;
alter table invoices                         enable row level security;
alter table invoice_items                    enable row level security;
alter table payments                         enable row level security;
alter table premium_subscriptions            enable row level security;
alter table ads_promotions                   enable row level security;
alter table exchange_rates                   enable row level security;
alter table currency_settings                enable row level security;
alter table chatbot_leads                    enable row level security;
alter table support_messages                 enable row level security;
alter table seo_pages                        enable row level security;
alter table blog_posts                       enable row level security;
alter table settings                         enable row level security;
alter table audit_logs                       enable row level security;

-- ---------- profiles ----------
create policy profiles_self_read   on profiles for select using (id = auth.uid() or is_admin());
create policy profiles_self_update on profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_self_insert on profiles for insert with check (id = auth.uid());
create policy profiles_admin_all   on profiles for all using (is_admin()) with check (is_admin());

-- ---------- businesses ----------
create policy businesses_owner_rw on businesses for all
  using (owner_id = auth.uid() or is_admin())
  with check (owner_id = auth.uid() or is_admin());
-- NOTE: no public/client SELECT policy -> contact columns are unreachable
--       by anonymous or client roles. Public reads go through listings_public.

-- ---------- categories & locations (public read, admin write) ----------
create policy categories_public_read on categories for select using (is_active or is_admin());
create policy categories_admin_write on categories for all using (is_admin()) with check (is_admin());
create policy locations_public_read  on locations  for select using (is_active or is_admin());
create policy locations_admin_write  on locations  for all using (is_admin()) with check (is_admin());

-- ---------- listings ----------
create policy listings_public_read on listings for select
  using (status = 'published' or is_admin());
create policy listings_owner_rw on listings for all
  using (is_admin() or exists (
    select 1 from businesses b where b.id = listings.business_id and b.owner_id = auth.uid()))
  with check (is_admin() or exists (
    select 1 from businesses b where b.id = listings.business_id and b.owner_id = auth.uid()));

-- ---------- listing_media (public sees approved media of published listings) ----------
create policy listing_media_public_read on listing_media for select using (
  status = 'approved' and exists (
    select 1 from listings l where l.id = listing_media.listing_id and l.status='published')
  or is_admin()
  or exists (select 1 from listings l join businesses b on b.id=l.business_id
             where l.id = listing_media.listing_id and b.owner_id = auth.uid()));
create policy listing_media_owner_write on listing_media for all using (
  is_admin() or exists (select 1 from listings l join businesses b on b.id=l.business_id
             where l.id = listing_media.listing_id and b.owner_id = auth.uid()))
  with check (
  is_admin() or exists (select 1 from listings l join businesses b on b.id=l.business_id
             where l.id = listing_media.listing_id and b.owner_id = auth.uid()));

-- ---------- favourites (client owns) ----------
create policy favourites_self on favourites for all
  using (client_id = auth.uid()) with check (client_id = auth.uid());

-- ---------- bookings ----------
-- Client sees own; provider sees bookings for their business; admin all.
create policy bookings_read on bookings for select using (
  client_id = auth.uid()
  or is_admin()
  or exists (select 1 from businesses b where b.id = bookings.business_id and b.owner_id = auth.uid()));
create policy bookings_client_insert on bookings for insert
  with check (client_id = auth.uid());
-- Provider may update status fields for their bookings; admin full.
create policy bookings_provider_update on bookings for update using (
  is_admin()
  or exists (select 1 from businesses b where b.id = bookings.business_id and b.owner_id = auth.uid()))
  with check (
  is_admin()
  or exists (select 1 from businesses b where b.id = bookings.business_id and b.owner_id = auth.uid()));

-- ---------- reviews ----------
create policy reviews_public_read on reviews for select using (status='approved' or is_admin()
  or client_id = auth.uid());
create policy reviews_client_insert on reviews for insert with check (
  client_id = auth.uid()
  and exists (select 1 from bookings bk
              where bk.id = reviews.booking_id
                and bk.client_id = auth.uid()
                and bk.status = 'completed'));
create policy reviews_admin_update on reviews for update using (is_admin()) with check (is_admin());

-- ---------- commission_invoices ----------
create policy commission_provider_read on commission_invoices for select using (
  is_admin()
  or exists (select 1 from businesses b where b.id = commission_invoices.business_id and b.owner_id = auth.uid()));
create policy commission_provider_update on commission_invoices for update using (
  -- provider may attach proof; status transitions are validated app-side / admin
  is_admin()
  or exists (select 1 from businesses b where b.id = commission_invoices.business_id and b.owner_id = auth.uid()))
  with check (
  is_admin()
  or exists (select 1 from businesses b where b.id = commission_invoices.business_id and b.owner_id = auth.uid()));
create policy commission_admin_insert on commission_invoices for insert with check (is_admin());

-- ---------- exchange rates & currency (public read, admin write) ----------
create policy rates_public_read on exchange_rates for select using (true);
create policy rates_admin_write on exchange_rates for all using (is_admin()) with check (is_admin());
create policy currency_public_read on currency_settings for select using (true);
create policy currency_admin_write on currency_settings for all using (is_admin()) with check (is_admin());

-- ---------- public content ----------
create policy seo_public_read on seo_pages for select using (is_published or is_admin());
create policy seo_admin_write on seo_pages for all using (is_admin()) with check (is_admin());
create policy blog_public_read on blog_posts for select using (is_published or is_admin());
create policy blog_admin_write on blog_posts for all using (is_admin()) with check (is_admin());

-- ---------- admin-only tables ----------
create policy audit_admin on audit_logs for select using (is_admin());
create policy settings_admin on settings for all using (is_admin()) with check (is_admin());

-- trip_requests: anyone can submit; only owner/admin can read.
create policy trip_requests_insert on trip_requests for insert with check (true);
create policy trip_requests_read on trip_requests for select using (
  is_admin() or client_id = auth.uid());

-- chatbot_leads & support_messages: anyone can insert; admin reads.
create policy chatbot_leads_insert on chatbot_leads for insert with check (true);
create policy chatbot_leads_admin on chatbot_leads for select using (is_admin());
create policy support_insert on support_messages for insert with check (true);
create policy support_admin on support_messages for select using (is_admin() or sender_id = auth.uid());

-- =====================================================================
-- Minimal seed (categories, currency settings). Extend in db/seed.sql.
-- =====================================================================
insert into currency_settings (id, base_currency, margin_percent)
  values (1, 'MUR', 3.00) on conflict (id) do nothing;

insert into categories (slug, name, name_fr, sort_order) values
  ('car-rental','Car Rental','Location de voiture',1),
  ('scooter-rental','Scooter Rental','Location de scooter',2),
  ('airport-transfer','Airport Transfer','Transfert aéroport',3),
  ('catamaran-trips','Catamaran Trips','Croisières catamaran',4),
  ('boat-trips','Boat Trips','Sorties en bateau',5),
  ('villas','Villas','Villas',6),
  ('apartments','Apartments','Appartements',7),
  ('studios','Studios','Studios',8),
  ('individual-houses','Individual Houses','Maisons individuelles',9),
  ('holiday-homes','Holiday Homes','Maisons de vacances',10),
  ('restaurants','Restaurants','Restaurants',11),
  ('activities','Activities','Activités',12),
  ('experiences','Experiences','Expériences',13)
on conflict (slug) do nothing;

-- End of schema.


-- END 01_schema.sql



-- =====================================================
-- START 02_auth_profile_trigger.sql
-- =====================================================

-- =====================================================================
-- 02_auth_profile_trigger.sql
-- Creates a profiles row for every new auth user, and a businesses row
-- for providers. SECURITY DEFINER so it runs regardless of email-confirm
-- state and bypasses RLS (function owned by postgres).
--
-- SECURITY: role is taken from signup metadata but is HARD-LIMITED to
-- 'client' or 'provider'. 'admin' can NEVER be assigned via signup — it
-- is granted manually in the database only.
-- =====================================================================

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role user_role;
  v_cat  uuid;
  v_loc  uuid;
  v_ccy  display_currency;
begin
  -- Never trust metadata for admin. Only 'provider' is honored; default 'client'.
  v_role := case
              when new.raw_user_meta_data->>'role' = 'provider' then 'provider'::user_role
              else 'client'::user_role
            end;

  -- Safe currency parse: invalid/absent metadata falls back to MUR rather
  -- than throwing and breaking signup.
  begin
    v_ccy := coalesce((new.raw_user_meta_data->>'preferred_currency')::display_currency, 'MUR');
  exception when others then
    v_ccy := 'MUR';
  end;

  insert into profiles (
    id, role, full_name, email, whatsapp, country,
    preferred_language, preferred_currency, terms_accepted_at
  ) values (
    new.id,
    v_role,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    new.raw_user_meta_data->>'whatsapp',
    new.raw_user_meta_data->>'country',
    coalesce(new.raw_user_meta_data->>'preferred_language', 'en'),
    v_ccy,
    now()
  );

  -- Providers get a business shell in 'pending_verification'. They cannot
  -- publish anything until admin verifies the Rs 499 payment (enforced by
  -- the enforce_listing_rules trigger in 01_schema.sql).
  if v_role = 'provider' then
    select id into v_cat from categories where slug = new.raw_user_meta_data->>'category_slug';
    select id into v_loc from locations  where slug = new.raw_user_meta_data->>'location_slug';

    insert into businesses (
      owner_id, business_name, owner_full_name, email, whatsapp,
      category_id, location_id, brn, country, status
    ) values (
      new.id,
      coalesce(new.raw_user_meta_data->>'business_name', ''),
      coalesce(new.raw_user_meta_data->>'owner_full_name',
               coalesce(new.raw_user_meta_data->>'full_name', '')),
      coalesce(new.raw_user_meta_data->>'business_email', new.email),
      coalesce(new.raw_user_meta_data->>'whatsapp', ''),
      v_cat,
      v_loc,
      new.raw_user_meta_data->>'brn',
      'Mauritius',
      'pending_verification'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Keep profiles.email in sync if the auth email changes.
create or replace function sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update profiles set email = new.email where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_change on auth.users;
create trigger on_auth_user_email_change
  after update of email on auth.users
  for each row execute function sync_profile_email();


-- END 02_auth_profile_trigger.sql



-- =====================================================
-- START 03_rls_remaining_policies.sql
-- =====================================================

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


-- END 03_rls_remaining_policies.sql



-- =====================================================
-- START 04_seed_locations.sql
-- =====================================================

-- =====================================================================
-- 04_seed_locations.sql
-- Mauritius tourist locations (matches the SEO location pages in the spec).
-- Categories and currency_settings are already seeded in 01_schema.sql.
-- =====================================================================

insert into locations (slug, name, region, latitude, longitude) values
  ('grand-baie',      'Grand Baie',      'North',  -20.0136, 57.5800),
  ('pereybere',       'Pereybère',       'North',  -20.0000, 57.5900),
  ('trou-aux-biches', 'Trou aux Biches', 'North',  -20.0333, 57.5450),
  ('flic-en-flac',    'Flic en Flac',    'West',   -20.2747, 57.3697),
  ('tamarin',         'Tamarin',         'West',   -20.3258, 57.3719),
  ('black-river',     'Black River',     'West',   -20.3600, 57.3700),
  ('le-morne',        'Le Morne',        'South-West', -20.4564, 57.3122),
  ('belle-mare',      'Belle Mare',      'East',   -20.1900, 57.7700),
  ('blue-bay',        'Blue Bay',        'South-East', -20.4439, 57.7100),
  ('mahebourg',       'Mahébourg',       'South-East', -20.4081, 57.7000),
  ('port-louis',      'Port Louis',      'Central', -20.1609, 57.5012)
on conflict (slug) do nothing;


-- END 04_seed_locations.sql



-- =====================================================
-- START 05_security_hardening.sql
-- =====================================================

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


-- END 05_security_hardening.sql



-- =====================================================
-- START 06_verification_hardening.sql
-- =====================================================

-- =====================================================================
-- 06_verification_hardening.sql  (Phase 1.2 hardening)
-- Closes four self-approval gaps before the verification pipeline:
--   1. business_documents: providers cannot set/change document status
--   2. listing_media:       providers cannot set/change media status
--   3. payment records:     provider-created records must start pending/
--                           submitted; only admin marks verified/rejected
--   4. review_replies:      a reply's business must own the reviewed listing
--
-- Relies on acting_as_admin() from 05 (admin / service_role / trusted
-- internal SECURITY DEFINER functions bypass; everyone else is blocked).
-- Run AFTER 01–05. Idempotent.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) business_documents: status is admin-only.
-- ---------------------------------------------------------------------
create or replace function protect_document_fields()
returns trigger
language plpgsql
as $$
begin
  if acting_as_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status is distinct from 'pending'::media_status then
      raise exception 'New documents must start as pending. Only admin can change document status.';
    end if;
  else
    if new.status is distinct from old.status then
      raise exception 'Only admin can change document status.';
    end if;
    if new.business_id is distinct from old.business_id then
      raise exception 'You cannot reassign a document to another business.';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists business_documents_protect on business_documents;
create trigger business_documents_protect
  before insert or update on business_documents
  for each row execute function protect_document_fields();

-- ---------------------------------------------------------------------
-- 2) listing_media: status (approve/reject/hide) is admin-only.
--    Providers may still set captions, alt text, position, cover, urls.
-- ---------------------------------------------------------------------
create or replace function protect_listing_media_fields()
returns trigger
language plpgsql
as $$
begin
  if acting_as_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status is distinct from 'pending'::media_status then
      raise exception 'New media must start as pending. Only admin can approve, reject, or hide media.';
    end if;
  else
    if new.status is distinct from old.status then
      raise exception 'Only admin can change media status (approve/reject/hide).';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists listing_media_protect on listing_media;
create trigger listing_media_protect
  before insert or update on listing_media
  for each row execute function protect_listing_media_fields();

-- ---------------------------------------------------------------------
-- 3) Payment/proof records (verification payments, premium subs, payments):
--    must start pending/submitted; provider can never set/raise to verified.
-- ---------------------------------------------------------------------
create or replace function protect_payment_status()
returns trigger
language plpgsql
as $$
begin
  if acting_as_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status not in ('pending'::payment_status, 'submitted'::payment_status) then
      raise exception 'Payment/proof records must start as pending or submitted. Only admin can mark verified or rejected.';
    end if;
  else
    if new.status is distinct from old.status then
      raise exception 'Only admin can change payment status.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists bvp_protect_status on business_verification_payments;
create trigger bvp_protect_status
  before insert or update on business_verification_payments
  for each row execute function protect_payment_status();

drop trigger if exists premium_protect_status on premium_subscriptions;
create trigger premium_protect_status
  before insert or update on premium_subscriptions
  for each row execute function protect_payment_status();

drop trigger if exists payments_protect_status on payments;
create trigger payments_protect_status
  before insert or update on payments
  for each row execute function protect_payment_status();

-- ---------------------------------------------------------------------
-- 4) review_replies ownership integrity.
--    The reply's business_id must be one the caller owns AND must own the
--    listing the review is attached to. Prevents replying on another
--    business's review or spoofing business_id.
-- ---------------------------------------------------------------------
create or replace function enforce_review_reply_ownership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  review_business uuid;
begin
  if acting_as_admin() then
    return new;
  end if;

  -- Caller must own the business named on the reply.
  if not exists (
    select 1 from businesses b
    where b.id = new.business_id and b.owner_id = auth.uid()
  ) then
    raise exception 'You can only reply on behalf of your own business.';
  end if;

  -- That business must own the listing the review belongs to.
  select l.business_id
    into review_business
    from reviews r
    join listings l on l.id = r.listing_id
    where r.id = new.review_id;

  if review_business is null or review_business is distinct from new.business_id then
    raise exception 'You can only reply to reviews on your own listings.';
  end if;

  return new;
end;
$$;
drop trigger if exists review_replies_ownership on review_replies;
create trigger review_replies_ownership
  before insert or update on review_replies
  for each row execute function enforce_review_reply_ownership();

-- End of 06_verification_hardening.sql


-- END 06_verification_hardening.sql



-- =====================================================
-- START 07_verification_pipeline.sql
-- =====================================================

-- =====================================================================
-- 07_verification_pipeline.sql  (Phase 1.2 pipeline)
-- Private Storage buckets + RLS, and the sanctioned RPCs that drive the
-- provider verification / admin approval workflow. All status transitions
-- on businesses go through these DEFINER functions (which bypass the
-- column-protection triggers safely) and write audit logs.
-- Run AFTER 01–06. Idempotent.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Private storage buckets (NOT public). Files are reached via short-lived
-- signed URLs generated server-side for the owner or admin only.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('business-documents', 'business-documents', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', false)
on conflict (id) do nothing;

-- Path convention: <bucket>/<business_id>/<filename>
-- Owner = a user who owns the business in the first path segment. Admin = all.

-- business-documents
drop policy if exists "docs owner read" on storage.objects;
create policy "docs owner read" on storage.objects for select to authenticated
using (
  bucket_id = 'business-documents'
  and (
    public.is_admin()
    or (storage.foldername(name))[1] in (
      select id::text from public.businesses where owner_id = auth.uid()
    )
  )
);

drop policy if exists "docs owner insert" on storage.objects;
create policy "docs owner insert" on storage.objects for insert to authenticated
with check (
  bucket_id = 'business-documents'
  and (storage.foldername(name))[1] in (
    select id::text from public.businesses where owner_id = auth.uid()
  )
);

-- payment-proofs
drop policy if exists "proofs owner read" on storage.objects;
create policy "proofs owner read" on storage.objects for select to authenticated
using (
  bucket_id = 'payment-proofs'
  and (
    public.is_admin()
    or (storage.foldername(name))[1] in (
      select id::text from public.businesses where owner_id = auth.uid()
    )
  )
);

drop policy if exists "proofs owner insert" on storage.objects;
create policy "proofs owner insert" on storage.objects for insert to authenticated
with check (
  bucket_id = 'payment-proofs'
  and (storage.foldername(name))[1] in (
    select id::text from public.businesses where owner_id = auth.uid()
  )
);

-- ---------------------------------------------------------------------
-- PROVIDER: submit verification request.
-- Moves the business to 'under_review' once a payment proof exists.
-- DEFINER so it can set the admin-controlled status column.
-- ---------------------------------------------------------------------
create or replace function submit_verification_request()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  b record;
begin
  select * into b from businesses where owner_id = auth.uid();
  if b.id is null then
    raise exception 'No business found for the current user.';
  end if;
  if b.status = 'verified' then
    raise exception 'Your business is already verified.';
  end if;
  if not exists (
    select 1 from business_verification_payments
    where business_id = b.id and status in ('pending', 'submitted', 'verified')
  ) then
    raise exception 'Upload your Rs 499 payment proof before submitting for review.';
  end if;

  update businesses set status = 'under_review' where id = b.id;

  insert into audit_logs (actor_id, action, entity, entity_id, metadata)
  values (auth.uid(), 'provider_submitted_verification', 'business', b.id, null);
end;
$$;

-- ---------------------------------------------------------------------
-- ADMIN: verify/reject a Rs 499 payment record.
-- ---------------------------------------------------------------------
create or replace function admin_set_payment_status(p_payment_id uuid, p_status payment_status)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business uuid;
begin
  if not is_admin() then
    raise exception 'Admin only.';
  end if;
  if p_status not in ('verified', 'rejected') then
    raise exception 'Payment decision must be verified or rejected.';
  end if;

  update business_verification_payments
    set status = p_status,
        verified_by = case when p_status = 'verified' then auth.uid() else verified_by end,
        verified_at = case when p_status = 'verified' then now() else verified_at end
    where id = p_payment_id
    returning business_id into v_business;

  -- Reflect on the business flag when the fee is verified.
  if p_status = 'verified' and v_business is not null then
    update businesses set verification_paid = true where id = v_business;
  end if;

  insert into audit_logs (actor_id, action, entity, entity_id, metadata)
  values (auth.uid(), 'payment_' || p_status, 'business_verification_payment', p_payment_id,
          jsonb_build_object('business_id', v_business));
end;
$$;

-- ---------------------------------------------------------------------
-- ADMIN: approve/reject an uploaded business document.
-- ---------------------------------------------------------------------
create or replace function admin_set_document_status(p_doc_id uuid, p_status media_status)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Admin only.';
  end if;
  if p_status not in ('approved', 'rejected', 'hidden', 'pending') then
    raise exception 'Invalid document status.';
  end if;

  update business_documents set status = p_status where id = p_doc_id;

  insert into audit_logs (actor_id, action, entity, entity_id, metadata)
  values (auth.uid(), 'document_' || p_status, 'business_document', p_doc_id, null);
end;
$$;

-- ---------------------------------------------------------------------
-- ADMIN: approve a provider (requires a verified payment on file).
-- ---------------------------------------------------------------------
create or replace function admin_approve_provider(p_business_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Admin only.';
  end if;
  if not exists (
    select 1 from business_verification_payments
    where business_id = p_business_id and status = 'verified'
  ) then
    raise exception 'Verify the Rs 499 payment before approving this provider.';
  end if;

  update businesses
    set status = 'verified',
        verification_paid = true,
        verified_at = now(),
        rejected_reason = null
    where id = p_business_id;

  insert into audit_logs (actor_id, action, entity, entity_id, metadata)
  values (auth.uid(), 'provider_approved', 'business', p_business_id, null);
end;
$$;

-- ---------------------------------------------------------------------
-- ADMIN: reject a provider with a reason (provider may resubmit).
-- ---------------------------------------------------------------------
create or replace function admin_reject_provider(p_business_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Admin only.';
  end if;

  update businesses
    set status = 'rejected',
        rejected_reason = coalesce(nullif(p_reason, ''), 'Verification requirements not met.')
    where id = p_business_id;

  insert into audit_logs (actor_id, action, entity, entity_id, metadata)
  values (auth.uid(), 'provider_rejected', 'business', p_business_id,
          jsonb_build_object('reason', p_reason));
end;
$$;

-- ---------------------------------------------------------------------
-- ADMIN: suspend a provider.
-- ---------------------------------------------------------------------
create or replace function admin_suspend_provider(p_business_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Admin only.';
  end if;

  update businesses set status = 'suspended' where id = p_business_id;

  insert into audit_logs (actor_id, action, entity, entity_id, metadata)
  values (auth.uid(), 'provider_suspended', 'business', p_business_id,
          jsonb_build_object('reason', p_reason));
end;
$$;

-- Lock down the internal helpers: these RPCs self-check is_admin()/ownership,
-- but we keep execute available to authenticated callers (the checks inside
-- enforce authorization). Revoke from anon for tidiness.
revoke execute on function submit_verification_request() from anon;
revoke execute on function admin_set_payment_status(uuid, payment_status) from anon;
revoke execute on function admin_set_document_status(uuid, media_status) from anon;
revoke execute on function admin_approve_provider(uuid) from anon;
revoke execute on function admin_reject_provider(uuid, text) from anon;
revoke execute on function admin_suspend_provider(uuid, text) from anon;

-- End of 07_verification_pipeline.sql


-- END 07_verification_pipeline.sql



-- =====================================================
-- START 08_taxi_transfer_dmc_module.sql
-- =====================================================

-- =====================================================================
-- 08_taxi_transfer_dmc_module.sql
-- Taxi & Private Transfers + admin-controlled DMC packages and the
-- request -> quote -> assignment -> completion workflow.
--
-- Design:
--   * Provider taxi listings reuse the existing listings table with strictly
--     validated JSONB attributes (see lib/validation/listing-attributes.ts).
--   * Admin-controlled packages/route prices live in their own tables and are
--     provider-write-protected (admin-only writes via RLS).
--   * Driver/provider assignment is one table (transfer_assignments); provider
--     responses go through a sanctioned, audited RPC.
-- Run AFTER 01–07. Idempotent where practical.
-- =====================================================================

-- ---------- Enums ----------
do $$ begin
  create type vehicle_type as enum
    ('luxury','family_car','suv','sedan','small_car','van','minibus','coach');
exception when duplicate_object then null; end $$;

do $$ begin
  create type transfer_request_status as enum
    ('new','reviewing','quoted','assigned','confirmed','completed','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type transfer_assignment_status as enum
    ('offered','accepted','rejected','completed','cancelled');
exception when duplicate_object then null; end $$;

-- ---------- New category ----------
insert into categories (slug, name, name_fr, sort_order) values
  ('taxi-private-transfers', 'Taxi & Private Transfers', 'Taxi & transferts privés', 14)
on conflict (slug) do nothing;

-- ---------- pickup_regions (reference) ----------
create table if not exists pickup_regions (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  is_active   boolean not null default true,
  sort_order  int default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
drop trigger if exists pickup_regions_set_updated on pickup_regions;
create trigger pickup_regions_set_updated before update on pickup_regions
  for each row execute function set_updated_at();

insert into pickup_regions (slug, name, sort_order) values
  ('north','North',1), ('south','South',2), ('east','East',3),
  ('west','West',4), ('centre','Centre',5), ('airport','Airport',6),
  ('port-louis','Port Louis',7), ('any','Any location in Mauritius',8)
on conflict (slug) do nothing;

-- ---------- transfer_packages (admin-created DMC/transfer packages) ----------
create table if not exists transfer_packages (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null unique,
  title              text not null,
  pickup_region_id   uuid references pickup_regions(id),
  dropoff_region_id  uuid references pickup_regions(id),
  pickup_label       text,
  dropoff_label      text,
  duration           text,
  vehicle_type       vehicle_type,
  min_passengers     int,
  max_passengers     int,
  base_price_mur     numeric(12,2) not null,
  included           text[],
  not_included       text[],
  notes              text,
  seo_title          text,
  seo_description    text,
  is_active          boolean not null default false,
  created_by         uuid references profiles(id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
drop trigger if exists transfer_packages_set_updated on transfer_packages;
create trigger transfer_packages_set_updated before update on transfer_packages
  for each row execute function set_updated_at();

-- ---------- package_prices (tiered prices per package) ----------
create table if not exists package_prices (
  id              uuid primary key default gen_random_uuid(),
  package_id      uuid not null references transfer_packages(id) on delete cascade,
  label           text,
  vehicle_type    vehicle_type,
  min_passengers  int,
  max_passengers  int,
  price_mur       numeric(12,2) not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
drop trigger if exists package_prices_set_updated on package_prices;
create trigger package_prices_set_updated before update on package_prices
  for each row execute function set_updated_at();

-- ---------- route_prices (admin point-to-point matrix) ----------
create table if not exists route_prices (
  id              uuid primary key default gen_random_uuid(),
  from_region_id  uuid not null references pickup_regions(id),
  to_region_id    uuid not null references pickup_regions(id),
  vehicle_type    vehicle_type not null,
  price_mur       numeric(12,2) not null,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (from_region_id, to_region_id, vehicle_type)
);
drop trigger if exists route_prices_set_updated on route_prices;
create trigger route_prices_set_updated before update on route_prices
  for each row execute function set_updated_at();

-- ---------- transfer_requests (client/guest DMC custom request) ----------
create sequence if not exists transfer_request_seq;

create table if not exists transfer_requests (
  id                 uuid primary key default gen_random_uuid(),
  reference          text unique,
  client_id          uuid references profiles(id),
  full_name          text not null,
  email              citext not null,
  whatsapp           text,
  country            text,
  pickup_location    text,
  dropoff_location   text,
  pickup_region_id   uuid references pickup_regions(id),
  dropoff_region_id  uuid references pickup_regions(id),
  pickup_date        date,
  pickup_time        text,
  passengers         int,
  luggage            int,
  preferred_vehicle  vehicle_type,
  flight_number      text,
  package_id         uuid references transfer_packages(id),
  needs              text,
  preferred_currency display_currency default 'MUR',
  status             transfer_request_status not null default 'new',
  quoted_amount_mur  numeric(12,2),
  notes_admin        text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists transfer_requests_status_idx on transfer_requests(status);
drop trigger if exists transfer_requests_set_updated on transfer_requests;
create trigger transfer_requests_set_updated before update on transfer_requests
  for each row execute function set_updated_at();

create or replace function set_transfer_request_reference()
returns trigger language plpgsql as $$
begin
  if new.reference is null then
    new.reference := 'TRF-' || to_char(now(),'YYYY') || '-' ||
                     lpad(nextval('transfer_request_seq')::text, 4, '0');
  end if;
  return new;
end $$;
drop trigger if exists transfer_requests_set_reference on transfer_requests;
create trigger transfer_requests_set_reference before insert on transfer_requests
  for each row execute function set_transfer_request_reference();

-- ---------- transfer_assignments (admin assigns to a provider/driver) ----------
create table if not exists transfer_assignments (
  id                   uuid primary key default gen_random_uuid(),
  transfer_request_id  uuid references transfer_requests(id) on delete cascade,
  booking_id           uuid references bookings(id) on delete cascade,
  business_id          uuid not null references businesses(id),
  vehicle_type         vehicle_type,
  final_price_mur      numeric(12,2),
  status               transfer_assignment_status not null default 'offered',
  provider_notes       text,
  job_details          jsonb not null default '{}'::jsonb,
  assigned_by          uuid references profiles(id),
  responded_at         timestamptz,
  completed_at         timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists transfer_assignments_business_idx on transfer_assignments(business_id, status);
drop trigger if exists transfer_assignments_set_updated on transfer_assignments;
create trigger transfer_assignments_set_updated before update on transfer_assignments
  for each row execute function set_updated_at();

-- ---------- bookings: forward-ready transfer detail (server-authoritative) ----------
alter table bookings add column if not exists transfer_details jsonb not null default '{}'::jsonb;

-- Extend booking field protection so providers cannot tamper with transfer_details.
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
     or new.transfer_details        is distinct from old.transfer_details
     or new.commission_invoice_id   is distinct from old.commission_invoice_id
     or new.confirmed_at            is distinct from old.confirmed_at
     or new.completed_at            is distinct from old.completed_at then
    raise exception 'Providers cannot modify booking financial, identity, or snapshot fields.';
  end if;

  if new.status is distinct from old.status then
    if not (old.status = 'pending'
            and new.status in ('provider_accepted', 'provider_rejected')) then
      raise exception 'Providers can only accept or reject a pending booking. Other transitions are admin-controlled.';
    end if;
  end if;
  return new;
end;
$$;

-- =====================================================================
-- RLS
-- =====================================================================
alter table pickup_regions       enable row level security;
alter table transfer_packages    enable row level security;
alter table package_prices       enable row level security;
alter table route_prices         enable row level security;
alter table transfer_requests    enable row level security;
alter table transfer_assignments enable row level security;

-- pickup_regions: public read active, admin write
drop policy if exists regions_public_read on pickup_regions;
create policy regions_public_read on pickup_regions for select using (is_active or is_admin());
drop policy if exists regions_admin_write on pickup_regions;
create policy regions_admin_write on pickup_regions for all using (is_admin()) with check (is_admin());

-- transfer_packages: public read active, admin write
drop policy if exists packages_public_read on transfer_packages;
create policy packages_public_read on transfer_packages for select using (is_active or is_admin());
drop policy if exists packages_admin_write on transfer_packages;
create policy packages_admin_write on transfer_packages for all using (is_admin()) with check (is_admin());

-- package_prices: public read when parent active, admin write
drop policy if exists package_prices_public_read on package_prices;
create policy package_prices_public_read on package_prices for select using (
  is_admin() or exists (
    select 1 from transfer_packages p where p.id = package_prices.package_id and p.is_active)
);
drop policy if exists package_prices_admin_write on package_prices;
create policy package_prices_admin_write on package_prices for all using (is_admin()) with check (is_admin());

-- route_prices: public read active, admin write
drop policy if exists route_prices_public_read on route_prices;
create policy route_prices_public_read on route_prices for select using (is_active or is_admin());
drop policy if exists route_prices_admin_write on route_prices;
create policy route_prices_admin_write on route_prices for all using (is_admin()) with check (is_admin());

-- transfer_requests: guest/client insert (anti-impersonation), owner/admin read, admin update
drop policy if exists transfer_requests_insert on transfer_requests;
create policy transfer_requests_insert on transfer_requests for insert
  with check (client_id is null or client_id = auth.uid());
drop policy if exists transfer_requests_read on transfer_requests;
create policy transfer_requests_read on transfer_requests for select
  using (is_admin() or client_id = auth.uid());
drop policy if exists transfer_requests_admin_update on transfer_requests;
create policy transfer_requests_admin_update on transfer_requests for update
  using (is_admin()) with check (is_admin());

-- transfer_assignments: admin all; provider reads own; provider writes ONLY via RPC.
drop policy if exists assignments_admin_all on transfer_assignments;
create policy assignments_admin_all on transfer_assignments for all
  using (is_admin()) with check (is_admin());
drop policy if exists assignments_provider_read on transfer_assignments;
create policy assignments_provider_read on transfer_assignments for select
  using (owns_business(business_id));

-- =====================================================================
-- RPCs (audited; SECURITY DEFINER with is_admin()/ownership self-checks)
-- =====================================================================

-- Centralized admin audit writer (audit_logs has no authenticated INSERT policy).
create or replace function admin_audit(p_action text, p_entity text, p_entity_id uuid, p_metadata jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'Admin only.';
  end if;
  insert into audit_logs (actor_id, action, entity, entity_id, metadata)
  values (auth.uid(), p_action, p_entity, p_entity_id, p_metadata);
end $$;

-- Admin: quote a transfer request.
create or replace function admin_quote_transfer(p_request_id uuid, p_amount numeric, p_notes text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Admin only.'; end if;
  update transfer_requests
    set status = 'quoted', quoted_amount_mur = p_amount, notes_admin = p_notes
    where id = p_request_id;
  insert into audit_logs (actor_id, action, entity, entity_id, metadata)
  values (auth.uid(), 'transfer_quoted', 'transfer_request', p_request_id,
          jsonb_build_object('amount_mur', p_amount));
end $$;

-- Admin: assign a transfer request to a verified provider/driver.
create or replace function admin_assign_transfer(
  p_request_id uuid, p_business_id uuid, p_vehicle vehicle_type, p_final_price numeric
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_status provider_status;
  v_job jsonb;
begin
  if not is_admin() then raise exception 'Admin only.'; end if;

  select status into v_status from businesses where id = p_business_id;
  if v_status is distinct from 'verified' then
    raise exception 'You can only assign transfers to a verified provider.';
  end if;

  -- Safe job snapshot for the provider (NO client name/email/whatsapp).
  select jsonb_build_object(
           'pickup_location', pickup_location,
           'dropoff_location', dropoff_location,
           'pickup_date', pickup_date,
           'pickup_time', pickup_time,
           'passengers', passengers,
           'luggage', luggage,
           'flight_number', flight_number,
           'needs', needs
         )
    into v_job
    from transfer_requests where id = p_request_id;

  insert into transfer_assignments
    (transfer_request_id, business_id, vehicle_type, final_price_mur, status, job_details, assigned_by)
  values
    (p_request_id, p_business_id, p_vehicle, p_final_price, 'offered', coalesce(v_job, '{}'::jsonb), auth.uid())
  returning id into v_id;

  update transfer_requests set status = 'assigned' where id = p_request_id;

  insert into audit_logs (actor_id, action, entity, entity_id, metadata)
  values (auth.uid(), 'transfer_assigned', 'transfer_assignment', v_id,
          jsonb_build_object('request_id', p_request_id, 'business_id', p_business_id));
  return v_id;
end $$;

-- Provider: respond to an assignment (accept/reject/complete). Ownership-checked.
create or replace function provider_respond_assignment(
  p_assignment_id uuid, p_decision transfer_assignment_status, p_notes text
) returns void language plpgsql security definer set search_path = public as $$
declare
  a record;
begin
  select * into a from transfer_assignments where id = p_assignment_id;
  if a.id is null then raise exception 'Assignment not found.'; end if;

  -- Must own the assigned business.
  if not exists (select 1 from businesses b where b.id = a.business_id and b.owner_id = auth.uid()) then
    raise exception 'This assignment does not belong to your business.';
  end if;

  if p_decision not in ('accepted','rejected','completed') then
    raise exception 'Invalid decision.';
  end if;

  -- Valid transitions: offered -> accepted/rejected ; accepted -> completed.
  if p_decision in ('accepted','rejected') and a.status <> 'offered' then
    raise exception 'You can only accept or reject an offered assignment.';
  end if;
  if p_decision = 'completed' and a.status <> 'accepted' then
    raise exception 'Only an accepted assignment can be completed.';
  end if;

  update transfer_assignments
    set status = p_decision,
        provider_notes = coalesce(p_notes, provider_notes),
        responded_at = case when p_decision in ('accepted','rejected') then now() else responded_at end,
        completed_at = case when p_decision = 'completed' then now() else completed_at end
    where id = p_assignment_id;

  insert into audit_logs (actor_id, action, entity, entity_id, metadata)
  values (auth.uid(), 'assignment_' || p_decision, 'transfer_assignment', p_assignment_id, null);
end $$;

revoke execute on function admin_audit(text, text, uuid, jsonb) from anon;
revoke execute on function admin_quote_transfer(uuid, numeric, text) from anon;
revoke execute on function admin_assign_transfer(uuid, uuid, vehicle_type, numeric) from anon;
revoke execute on function provider_respond_assignment(uuid, transfer_assignment_status, text) from anon;

-- End of 08_taxi_transfer_dmc_module.sql


-- END 08_taxi_transfer_dmc_module.sql



-- =====================================================
-- START 09_taxi_dmc_flow_cleanup.sql
-- =====================================================

-- =====================================================================
-- 09_taxi_dmc_flow_cleanup.sql  (Phase 1.2.2)
-- 1) Client quote confirmation states + client_respond_quote()
-- 2) provider_respond_assignment() keeps the parent transfer_request in sync
-- 3) admin_assign_transfer(): transport-only providers, requires quote
--    acceptance (unless override), requires a positive final price
--
-- Run AFTER 01–08. Idempotent.
--
-- check_function_bodies is disabled so functions that reference the NEW enum
-- labels below can be (re)created in the same migration/transaction safely.
-- =====================================================================
set check_function_bodies = off;

-- ---------- New request states ----------
alter type transfer_request_status add value if not exists 'quote_pending_client';
alter type transfer_request_status add value if not exists 'quote_accepted';
alter type transfer_request_status add value if not exists 'quote_rejected';

-- ---------------------------------------------------------------------
-- Admin quote -> request goes to quote_pending_client (awaiting client).
-- ---------------------------------------------------------------------
create or replace function admin_quote_transfer(p_request_id uuid, p_amount numeric, p_notes text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Admin only.'; end if;
  if p_amount is null or p_amount <= 0 or p_amount = 'NaN'::numeric then
    raise exception 'Quote amount is required and must be greater than 0.';
  end if;

  update transfer_requests
    set status = 'quote_pending_client', quoted_amount_mur = p_amount, notes_admin = p_notes
    where id = p_request_id;

  insert into audit_logs (actor_id, action, entity, entity_id, metadata)
  values (auth.uid(), 'transfer_quoted', 'transfer_request', p_request_id,
          jsonb_build_object('amount_mur', p_amount));
end $$;

-- ---------------------------------------------------------------------
-- Client accepts/rejects the quote (DB foundation; client UI is minimal).
-- Ownership-checked; only valid while quote_pending_client.
-- ---------------------------------------------------------------------
create or replace function client_respond_quote(p_request_id uuid, p_decision text)
returns void language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_new transfer_request_status;
begin
  select * into r from transfer_requests where id = p_request_id;
  if r.id is null then raise exception 'Request not found.'; end if;
  if r.client_id is distinct from auth.uid() then
    raise exception 'This request does not belong to you.';
  end if;
  if r.status <> 'quote_pending_client' then
    raise exception 'There is no quote awaiting your response on this request.';
  end if;

  if p_decision = 'accept' then
    v_new := 'quote_accepted';
  elsif p_decision = 'reject' then
    v_new := 'quote_rejected';
  else
    raise exception 'Decision must be accept or reject.';
  end if;

  update transfer_requests set status = v_new where id = p_request_id;

  insert into audit_logs (actor_id, action, entity, entity_id, metadata)
  values (auth.uid(), 'quote_' || p_decision, 'transfer_request', p_request_id, null);
end $$;

-- ---------------------------------------------------------------------
-- Admin assign: transport providers only, quote must be accepted (unless
-- override), and a positive final price is required.
-- Signature changes (adds p_override) -> drop the old overload first.
-- ---------------------------------------------------------------------
drop function if exists admin_assign_transfer(uuid, uuid, vehicle_type, numeric);

create or replace function admin_assign_transfer(
  p_request_id uuid,
  p_business_id uuid,
  p_vehicle vehicle_type,
  p_final_price numeric,
  p_override boolean default false
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_status provider_status;
  v_req_status transfer_request_status;
  v_job jsonb;
begin
  if not is_admin() then raise exception 'Admin only.'; end if;

  -- Required, positive final price.
  if p_final_price is null or p_final_price <= 0 or p_final_price = 'NaN'::numeric then
    raise exception 'Final price is required and must be greater than 0.';
  end if;

  -- Provider must be verified.
  select status into v_status from businesses where id = p_business_id;
  if v_status is distinct from 'verified' then
    raise exception 'You can only assign transfers to a verified provider.';
  end if;

  -- Provider must be a transport/transfer provider.
  if not exists (
    select 1 from businesses b
    join categories c on c.id = b.category_id
    where b.id = p_business_id
      and c.slug in ('taxi-private-transfers', 'airport-transfer')
  ) then
    raise exception 'Selected provider is not a taxi/transfer/transport provider.';
  end if;

  -- Quote must be accepted by the client, unless admin overrides.
  select status into v_req_status from transfer_requests where id = p_request_id;
  if not p_override and v_req_status is distinct from 'quote_accepted' then
    raise exception 'The client must accept the quote before assigning (or use admin override).';
  end if;

  -- Safe job snapshot for the provider (NO client name/email/whatsapp).
  select jsonb_build_object(
           'pickup_location', pickup_location,
           'dropoff_location', dropoff_location,
           'pickup_date', pickup_date,
           'pickup_time', pickup_time,
           'passengers', passengers,
           'luggage', luggage,
           'flight_number', flight_number,
           'needs', needs
         )
    into v_job
    from transfer_requests where id = p_request_id;

  insert into transfer_assignments
    (transfer_request_id, business_id, vehicle_type, final_price_mur, status, job_details, assigned_by)
  values
    (p_request_id, p_business_id, p_vehicle, p_final_price, 'offered', coalesce(v_job, '{}'::jsonb), auth.uid())
  returning id into v_id;

  update transfer_requests set status = 'assigned' where id = p_request_id;

  insert into audit_logs (actor_id, action, entity, entity_id, metadata)
  values (auth.uid(), 'transfer_assigned', 'transfer_assignment', v_id,
          jsonb_build_object('request_id', p_request_id, 'business_id', p_business_id,
                             'override', p_override));
  return v_id;
end $$;

-- ---------------------------------------------------------------------
-- Provider response now syncs the parent transfer_request status:
--   accepted  -> request confirmed
--   rejected  -> request back to reviewing (admin can reassign w/ override)
--   completed -> request completed
-- ---------------------------------------------------------------------
create or replace function provider_respond_assignment(
  p_assignment_id uuid, p_decision transfer_assignment_status, p_notes text
) returns void language plpgsql security definer set search_path = public as $$
declare
  a record;
begin
  select * into a from transfer_assignments where id = p_assignment_id;
  if a.id is null then raise exception 'Assignment not found.'; end if;

  if not exists (select 1 from businesses b where b.id = a.business_id and b.owner_id = auth.uid()) then
    raise exception 'This assignment does not belong to your business.';
  end if;

  if p_decision not in ('accepted', 'rejected', 'completed') then
    raise exception 'Invalid decision.';
  end if;
  if p_decision in ('accepted', 'rejected') and a.status <> 'offered' then
    raise exception 'You can only accept or reject an offered assignment.';
  end if;
  if p_decision = 'completed' and a.status <> 'accepted' then
    raise exception 'Only an accepted assignment can be completed.';
  end if;

  update transfer_assignments
    set status = p_decision,
        provider_notes = coalesce(p_notes, provider_notes),
        responded_at = case when p_decision in ('accepted', 'rejected') then now() else responded_at end,
        completed_at = case when p_decision = 'completed' then now() else completed_at end
    where id = p_assignment_id;

  -- Keep the parent request in sync (only if this assignment is tied to one).
  if a.transfer_request_id is not null then
    if p_decision = 'accepted' then
      update transfer_requests set status = 'confirmed' where id = a.transfer_request_id;
    elsif p_decision = 'rejected' then
      update transfer_requests set status = 'reviewing' where id = a.transfer_request_id;
    elsif p_decision = 'completed' then
      update transfer_requests set status = 'completed' where id = a.transfer_request_id;
    end if;
  end if;

  insert into audit_logs (actor_id, action, entity, entity_id, metadata)
  values (auth.uid(), 'assignment_' || p_decision, 'transfer_assignment', p_assignment_id, null);
end $$;

-- Lock down execute from anon.
revoke execute on function client_respond_quote(uuid, text) from anon;
revoke execute on function admin_assign_transfer(uuid, uuid, vehicle_type, numeric, boolean) from anon;

-- End of 09_taxi_dmc_flow_cleanup.sql


-- END 09_taxi_dmc_flow_cleanup.sql



-- =====================================================
-- START 10_listing_media_pipeline.sql
-- =====================================================

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


-- END 10_listing_media_pipeline.sql



-- =====================================================
-- START 11_public_catalog.sql
-- =====================================================

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


-- END 11_public_catalog.sql



-- =====================================================
-- START 12_public_catalog_business_status_hardening.sql
-- =====================================================

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


-- END 12_public_catalog_business_status_hardening.sql



-- =====================================================
-- START 13_booking_engine.sql
-- =====================================================

-- =====================================================================
-- 13_booking_engine.sql  (Phase 1.5)
-- Booking lifecycle RPCs + a "suggest another date" state.
--
-- Reuses existing infrastructure:
--   * bookings_set_reference     -> MMT-YYYY-NNNN (01)
--   * bookings_enforce_integrity -> derives business_id, server-authoritative
--                                   amount, requires published listing (05)
--   * protect_booking_fields     -> providers limited to pending->accept/reject (05)
--   * bookings_generate_commission -> commission invoice auto-created when a
--                                   booking reaches client_arrived/completed (01)
--
-- All privileged transitions go through SECURITY DEFINER RPCs that self-authorize
-- against auth.uid() (the RPC body runs as owner, which bypasses
-- protect_booking_fields, so the RPC itself is the authorization boundary).
-- Run AFTER 01–12. Idempotent.
-- =====================================================================
set check_function_bodies = off;

-- New lifecycle state: provider proposed an alternative date, awaiting client.
alter type booking_status add value if not exists 'date_suggested';

alter table bookings
  add column if not exists suggested_date date,
  add column if not exists provider_note  text;

-- =====================================================================
-- Provider responds to a booking they own.
--   accept       : pending        -> confirmed
--   reject       : pending        -> provider_rejected (+note)
--   suggest_date : pending        -> date_suggested (+date,+note)
--   arrived      : confirmed      -> client_arrived  (fires commission invoice)
--   completed    : client_arrived/confirmed -> completed (fires commission invoice)
-- =====================================================================
create or replace function provider_respond_booking(
  p_booking_id uuid,
  p_action text,
  p_suggested_date date default null,
  p_note text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_status   booking_status;
  v_business uuid;
  v_owner    uuid;
  v_suggest  date;
begin
  select status, business_id, suggested_date into v_status, v_business, v_suggest
    from bookings where id = p_booking_id;
  if v_status is null then raise exception 'Booking not found.'; end if;

  select owner_id into v_owner from businesses where id = v_business;
  if v_owner is distinct from auth.uid() then
    raise exception 'This booking does not belong to your business.';
  end if;

  if p_action = 'accept' then
    if v_status <> 'pending' then raise exception 'Only a pending booking can be accepted.'; end if;
    update bookings set status='confirmed', confirmed_at=now(), provider_responded_at=now()
      where id=p_booking_id;

  elsif p_action = 'reject' then
    if v_status <> 'pending' then raise exception 'Only a pending booking can be rejected.'; end if;
    update bookings set status='provider_rejected', provider_responded_at=now(), provider_note=p_note
      where id=p_booking_id;

  elsif p_action = 'suggest_date' then
    if v_status <> 'pending' then raise exception 'A date can only be suggested for a pending booking.'; end if;
    if p_suggested_date is null or p_suggested_date < current_date then
      raise exception 'Please provide a valid future date.';
    end if;
    update bookings set status='date_suggested', suggested_date=p_suggested_date,
                        provider_note=p_note, provider_responded_at=now()
      where id=p_booking_id;

  elsif p_action = 'arrived' then
    if v_status <> 'confirmed' then raise exception 'Only a confirmed booking can be marked as arrived.'; end if;
    update bookings set status='client_arrived' where id=p_booking_id;

  elsif p_action = 'completed' then
    if v_status not in ('client_arrived','confirmed') then
      raise exception 'This booking cannot be completed from its current status.';
    end if;
    update bookings set status='completed', completed_at=now() where id=p_booking_id;

  else
    raise exception 'Unknown action.';
  end if;

  insert into audit_logs (actor_id, action, entity, entity_id, metadata)
  values (auth.uid(), 'booking_'||p_action, 'booking', p_booking_id,
          case when p_note is not null then jsonb_build_object('note', p_note) else null end);
end $$;

-- =====================================================================
-- Client accepts/declines a suggested date.
--   accept  : date_suggested -> confirmed (arrival_date := suggested_date)
--   decline : date_suggested -> cancelled
-- =====================================================================
create or replace function client_respond_suggested_date(p_booking_id uuid, p_action text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_status booking_status;
  v_client uuid;
  v_suggest date;
begin
  select status, client_id, suggested_date into v_status, v_client, v_suggest
    from bookings where id = p_booking_id;
  if v_status is null then raise exception 'Booking not found.'; end if;
  if v_client is distinct from auth.uid() then raise exception 'This booking is not yours.'; end if;
  if v_status <> 'date_suggested' then raise exception 'There is no date suggestion to respond to.'; end if;

  if p_action = 'accept' then
    update bookings set arrival_date=v_suggest, status='confirmed', confirmed_at=now()
      where id=p_booking_id;
  elsif p_action = 'decline' then
    update bookings set status='cancelled' where id=p_booking_id;
  else
    raise exception 'Unknown action.';
  end if;

  insert into audit_logs (actor_id, action, entity, entity_id, metadata)
  values (auth.uid(), 'booking_suggest_'||p_action, 'booking', p_booking_id, null);
end $$;

-- =====================================================================
-- Client cancels their own booking (before completion).
-- =====================================================================
create or replace function client_cancel_booking(p_booking_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_status booking_status;
  v_client uuid;
begin
  select status, client_id into v_status, v_client from bookings where id = p_booking_id;
  if v_status is null then raise exception 'Booking not found.'; end if;
  if v_client is distinct from auth.uid() then raise exception 'This booking is not yours.'; end if;
  if v_status not in ('pending','date_suggested','confirmed') then
    raise exception 'This booking can no longer be cancelled.';
  end if;

  update bookings set status='cancelled' where id=p_booking_id;

  insert into audit_logs (actor_id, action, entity, entity_id, metadata)
  values (auth.uid(), 'booking_client_cancelled', 'booking', p_booking_id, null);
end $$;

-- =====================================================================
-- Admin sets any booking status (override). client_arrived/completed will
-- auto-create the commission invoice via the existing trigger.
-- =====================================================================
create or replace function admin_set_booking_status(p_booking_id uuid, p_status booking_status, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Admin only.'; end if;

  update bookings set
    status       = p_status,
    confirmed_at = case when p_status='confirmed' then coalesce(confirmed_at, now()) else confirmed_at end,
    completed_at = case when p_status='completed' then coalesce(completed_at, now()) else completed_at end,
    provider_note = coalesce(p_note, provider_note)
  where id = p_booking_id;

  insert into audit_logs (actor_id, action, entity, entity_id, metadata)
  values (auth.uid(), 'booking_admin_'||p_status, 'booking', p_booking_id,
          case when p_note is not null then jsonb_build_object('note', p_note) else null end);
end $$;

revoke execute on function provider_respond_booking(uuid, text, date, text) from anon;
revoke execute on function client_respond_suggested_date(uuid, text) from anon;
revoke execute on function client_cancel_booking(uuid) from anon;
revoke execute on function admin_set_booking_status(uuid, booking_status, text) from anon;

-- End of 13_booking_engine.sql


-- END 13_booking_engine.sql



-- =====================================================
-- START 14_booking_privacy_hardening.sql
-- =====================================================

-- =====================================================================
-- 14_booking_privacy_hardening.sql  (Phase 1.5.1)
-- Protect client contact at the database/API level, not just the UI.
--
-- 1) Providers can no longer SELECT the bookings table directly (so client
--    email / WhatsApp / country are unreadable to them via the API).
-- 2) Provider booking reads go through provider_bookings_safe, an owner-scoped
--    view that omits every client contact column.
-- 3) special_request and provider_note are contact-leak guarded on write.
-- Run AFTER 01–13. Idempotent.
-- =====================================================================

-- ---------- 1) Tighten bookings RLS ----------
-- Clients read their own; admin reads all; providers get NO direct table read.
drop policy if exists bookings_read on bookings;
create policy bookings_read on bookings for select using (
  client_id = auth.uid() or is_admin()
);

-- Providers no longer update the bookings table directly — every provider
-- transition goes through provider_respond_booking() (SECURITY DEFINER).
-- Admin keeps a direct-update path; admin_set_booking_status() also works.
drop policy if exists bookings_provider_update on bookings;
drop policy if exists bookings_admin_update on bookings;
create policy bookings_admin_update on bookings for update using (is_admin()) with check (is_admin());

-- bookings_client_insert stays as-is (client inserts their own booking).

-- ---------- 2) Provider-safe booking view (no client contact) ----------
-- Owner-owned view: bypasses table RLS, but the WHERE clause scopes rows to the
-- calling provider via auth.uid(). NO email / whatsapp / country columns exist.
create or replace view provider_bookings_safe as
select
  bk.id,
  bk.reference,
  bk.status,
  bk.full_name,                       -- guest name only (not a contact channel)
  bk.booking_date,
  bk.arrival_date,
  bk.num_people,
  bk.quantity,
  bk.base_amount_mur,
  bk.display_amount,
  bk.display_currency,
  bk.special_request,                 -- contact-leak guarded on write
  bk.suggested_date,
  bk.provider_note,
  bk.commission_invoice_id,
  bk.created_at,
  bk.business_id,
  l.title as listing_title,
  l.slug  as listing_slug,
  ci.status                as commission_status,
  ci.commission_amount_mur as commission_amount_mur,
  ci.due_date              as commission_due_date
from bookings bk
join businesses b on b.id = bk.business_id
join listings   l on l.id = bk.listing_id
left join commission_invoices ci on ci.id = bk.commission_invoice_id
where b.owner_id = auth.uid();

revoke all on provider_bookings_safe from anon;
grant select on provider_bookings_safe to authenticated;

-- ---------- 3) Contact-leak guard on booking free text ----------
create or replace function guard_contact_leak_booking()
returns trigger language plpgsql as $$
begin
  if contains_contact_info(new.special_request) then
    raise exception 'Contact details are not allowed in the booking request. All communication stays on MyMauritiusTrip.com.';
  end if;
  if contains_contact_info(new.provider_note) then
    raise exception 'Contact details are not allowed in booking notes. All communication stays on MyMauritiusTrip.com.';
  end if;
  return new;
end $$;

drop trigger if exists bookings_guard_contact on bookings;
create trigger bookings_guard_contact
  before insert or update on bookings
  for each row execute function guard_contact_leak_booking();

-- End of 14_booking_privacy_hardening.sql


-- END 14_booking_privacy_hardening.sql



-- =====================================================
-- START 15_commission_payment_dashboard.sql
-- =====================================================

-- =====================================================================
-- 15_commission_payments.sql  (Phase 1.6)
-- Commission / payment dashboard support.
--   * 'submitted' invoice status (proof uploaded, awaiting admin verification)
--   * private commission-proofs storage bucket (owner + admin only)
--   * provider_commissions_safe view (owner-scoped, with computed overdue)
--   * RPCs: provider_submit_commission_proof, admin_set_commission_status,
--           mark_commissions_overdue
-- Reuses: bookings_generate_commission (auto-creates the 15% / due+15d invoice
-- on client_arrived/completed) and protect_commission_fields (providers may only
-- attach proof_path; status/amounts are admin-controlled).
-- Run AFTER 01–14. Idempotent.
-- =====================================================================
set check_function_bodies = off;

-- Proof uploaded, awaiting admin verification.
alter type invoice_status add value if not exists 'submitted';

-- ---------- Private storage bucket for commission proofs ----------
insert into storage.buckets (id, name, public)
values ('commission-proofs', 'commission-proofs', false)
on conflict (id) do nothing;

-- Path convention: <business_id>/<timestamp>-<filename>
drop policy if exists "commission proofs owner read" on storage.objects;
create policy "commission proofs owner read" on storage.objects for select to authenticated
using (
  bucket_id = 'commission-proofs'
  and (
    public.is_admin()
    or (storage.foldername(name))[1] in (
      select id::text from public.businesses where owner_id = auth.uid()
    )
  )
);

drop policy if exists "commission proofs owner insert" on storage.objects;
create policy "commission proofs owner insert" on storage.objects for insert to authenticated
with check (
  bucket_id = 'commission-proofs'
  and (storage.foldername(name))[1] in (
    select id::text from public.businesses where owner_id = auth.uid()
  )
);

-- ---------- Provider-safe commissions view (owner-scoped) ----------
create or replace view provider_commissions_safe as
select
  ci.id,
  ci.booking_id,
  ci.business_id,
  ci.booking_total_mur,
  ci.commission_percent,
  ci.commission_amount_mur,
  ci.due_date,
  ci.status,
  ci.proof_path,
  ci.paid_at,
  ci.created_at,
  bk.reference as booking_reference,
  l.title      as listing_title,
  (ci.status in ('pending','overdue') and ci.due_date < current_date) as is_overdue
from commission_invoices ci
join businesses b on b.id = ci.business_id
join bookings   bk on bk.id = ci.booking_id
join listings   l on l.id = bk.listing_id
where b.owner_id = auth.uid();

revoke all on provider_commissions_safe from anon;
grant select on provider_commissions_safe to authenticated;

-- ---------- Provider submits a payment proof ----------
create or replace function provider_submit_commission_proof(p_invoice_id uuid, p_path text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_status   invoice_status;
  v_business uuid;
  v_owner    uuid;
begin
  select status, business_id into v_status, v_business from commission_invoices where id = p_invoice_id;
  if v_status is null then raise exception 'Commission invoice not found.'; end if;

  select owner_id into v_owner from businesses where id = v_business;
  if v_owner is distinct from auth.uid() then raise exception 'This invoice does not belong to your business.'; end if;

  if p_path is null or p_path = '' then raise exception 'A proof file is required.'; end if;
  if v_status not in ('pending','overdue','submitted') then
    raise exception 'A proof cannot be submitted for this invoice in its current status.';
  end if;

  update commission_invoices set proof_path = p_path, status = 'submitted' where id = p_invoice_id;

  insert into audit_logs (actor_id, action, entity, entity_id, metadata)
  values (auth.uid(), 'commission_proof_submitted', 'commission_invoice', p_invoice_id, null);
end $$;

-- ---------- Admin verifies / rejects / sets commission status ----------
create or replace function admin_set_commission_status(p_invoice_id uuid, p_status invoice_status, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Admin only.'; end if;
  if p_status not in ('pending','submitted','paid','overdue','disputed','cancelled') then
    raise exception 'Invalid commission status.';
  end if;

  update commission_invoices set
    status         = p_status,
    paid_at        = case when p_status='paid' then coalesce(paid_at, now()) else paid_at end,
    marked_paid_by = case when p_status='paid' then auth.uid() else marked_paid_by end
  where id = p_invoice_id;

  insert into audit_logs (actor_id, action, entity, entity_id, metadata)
  values (auth.uid(), 'commission_'||p_status, 'commission_invoice', p_invoice_id,
          case when p_note is not null then jsonb_build_object('note', p_note) else null end);
end $$;

-- ---------- Overdue sweep (call from a cron/Edge function or admin button) ----------
create or replace function mark_commissions_overdue()
returns integer language plpgsql security definer set search_path = public as $$
declare
  n integer;
begin
  if not is_admin() then raise exception 'Admin only.'; end if;
  update commission_invoices set status = 'overdue'
   where status = 'pending' and due_date < current_date;
  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on function provider_submit_commission_proof(uuid, text) from anon;
revoke execute on function admin_set_commission_status(uuid, invoice_status, text) from anon;
revoke execute on function mark_commissions_overdue() from anon;

-- End of 15_commission_payments.sql


-- END 15_commission_payment_dashboard.sql



-- =====================================================
-- START 16_commission_security_build_cleanup.sql
-- =====================================================

-- =====================================================================
-- 16_commission_security_build_cleanup.sql  (Phase 1.6.1)
-- Providers must no longer update commission_invoices directly. The proper
-- path is provider_submit_commission_proof(invoice_id, path) (SECURITY DEFINER,
-- owner-checked, audited, sets status='submitted'). Direct updates are now
-- admin-only, so a provider cannot bypass the audit log or write an arbitrary
-- proof_path / tamper with status/amount/due/paid fields by table update.
-- Run AFTER 01–15. Idempotent.
-- =====================================================================

-- Remove the old provider/admin update policy (it allowed providers to update
-- their own invoice row, relying on protect_commission_fields to limit columns).
drop policy if exists commission_provider_update on commission_invoices;

-- Admin-only direct update. Providers go through the RPC.
drop policy if exists commission_admin_update on commission_invoices;
create policy commission_admin_update on commission_invoices
  for update using (is_admin()) with check (is_admin());

-- Providers keep READ access to their own invoices (no client contact lives on
-- this table); commission_provider_read is unchanged. Provider proof submission
-- continues to work because provider_submit_commission_proof() is SECURITY
-- DEFINER and bypasses RLS while still checking ownership and writing an audit
-- log. (Defined in 15; re-affirmed here for clarity — unchanged.)

-- End of 16_commission_security_build_cleanup.sql


-- END 16_commission_security_build_cleanup.sql



-- =====================================================
-- START 17_reviews.sql
-- =====================================================

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


-- END 17_reviews.sql



-- =====================================================
-- START 18_reviews_privacy_build_fix.sql
-- =====================================================

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


-- END 18_reviews_privacy_build_fix.sql



-- =====================================================
-- START 19_review_reply_privacy_build_fix.sql
-- =====================================================

-- =====================================================================
-- 19_review_reply_privacy_build_fix.sql  (Phase 1.7.2)
-- Lock down direct reads of the raw review_replies table. Public reply display
-- goes through reviews_public.reply_body and provider display through
-- provider_reviews_safe (both owner-owned views that bypass RLS). The old
-- rr_public_read policy (which let anon/public select raw rows) is removed.
--
-- After this:
--   * anon/public      -> NO direct select on review_replies
--   * admin            -> read (rr_read)
--   * provider (owner) -> read/write own replies (rr_read + rr_owner_write) and
--                         display via provider_reviews_safe
--   * ownership + contact-leak guards on replies are unchanged
-- Run AFTER 01-18. Idempotent.
-- =====================================================================

-- Remove public/anon direct read of raw replies.
drop policy if exists rr_public_read on review_replies;

-- Explicit admin/owner-only read (does not rely on the broad FOR ALL write rule).
drop policy if exists rr_read on review_replies;
create policy rr_read on review_replies for select
  using (is_admin() or owns_business(business_id));

-- rr_owner_write (insert/update/delete by admin or business owner) stays as-is,
-- and enforce_review_reply_ownership + guard_contact_leak_review_reply remain in
-- force (defined in 03/05/06). Nothing else changes.

-- End of 19_review_reply_privacy_build_fix.sql


-- END 19_review_reply_privacy_build_fix.sql



-- =====================================================
-- START 20_email_reminders.sql
-- =====================================================

-- =====================================================================
-- 20_email_reminders.sql  (Phase 1.8)
-- Support for commission due/overdue reminder emails (idempotent sending) and a
-- light audit log of outbound emails. Run AFTER 01–19. Idempotent.
-- =====================================================================

-- Track when each reminder was last sent so the cron never spams a provider.
alter table commission_invoices
  add column if not exists due_reminder_sent_at     timestamptz,
  add column if not exists overdue_reminder_sent_at timestamptz;

-- Audit of outbound emails (written by the service-role notify layer / cron).
create table if not exists email_events (
  id         uuid primary key default gen_random_uuid(),
  to_email   citext not null,
  template   text not null,
  entity     text,
  entity_id  uuid,
  created_at timestamptz not null default now()
);
create index if not exists email_events_entity_idx on email_events (entity, entity_id);
create index if not exists email_events_created_idx on email_events (created_at desc);

alter table email_events enable row level security;

-- Admin-only read; inserts come from the service-role client (bypasses RLS).
revoke all on email_events from anon, authenticated;
grant select on email_events to authenticated;     -- still gated by the policy below
drop policy if exists email_events_admin_read on email_events;
create policy email_events_admin_read on email_events for select using (is_admin());

-- End of 20_email_reminders.sql


-- END 20_email_reminders.sql



-- =====================================================
-- START 21_email_reliability.sql
-- =====================================================

-- =====================================================================
-- 21_email_reliability.sql  (Phase 1.8.1)
-- Idempotency for the commission-invoice email + a delivery status on the
-- email audit log. Run AFTER 01–20. Idempotent.
-- =====================================================================

-- Mark when the commission-invoice email was actually sent, so a booking that
-- goes client_arrived -> completed only emails the invoice once.
alter table commission_invoices
  add column if not exists commission_invoice_email_sent_at timestamptz;

-- Record the real outcome of each send attempt: 'sent' | 'noop' | 'failed'.
alter table email_events
  add column if not exists status text not null default 'sent';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'email_events_status_chk') then
    alter table email_events
      add constraint email_events_status_chk check (status in ('sent', 'noop', 'failed'));
  end if;
end $$;

create index if not exists email_events_status_idx on email_events (status);

-- End of 21_email_reliability.sql


-- END 21_email_reliability.sql

