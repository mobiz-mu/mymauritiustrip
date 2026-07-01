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
