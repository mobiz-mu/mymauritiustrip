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
