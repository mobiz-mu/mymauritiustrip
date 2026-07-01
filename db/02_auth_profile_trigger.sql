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
