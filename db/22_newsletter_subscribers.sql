-- 22_newsletter_subscribers.sql
-- Newsletter signups collected from the public homepage.
-- Public may INSERT only (email/source); admins may SELECT; no public SELECT.

create table if not exists public.newsletter_subscribers (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  source      text not null default 'homepage',
  status      text not null default 'active',
  user_agent  text,
  created_at  timestamptz not null default now(),
  constraint newsletter_email_format check (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  constraint newsletter_status_chk   check (status in ('active', 'unsubscribed'))
);

create index if not exists newsletter_subscribers_created_idx
  on public.newsletter_subscribers (created_at desc);

alter table public.newsletter_subscribers enable row level security;

-- Force safe values on every public insert: status is always 'active',
-- source is clamped, email is normalised. This is what makes a public insert
-- effectively "email + source only".
create or replace function public.newsletter_before_insert()
returns trigger
language plpgsql
as $$
begin
  new.email  := lower(trim(new.email));
  new.status := 'active';
  if new.source is null or length(new.source) = 0 or length(new.source) > 40 then
    new.source := 'homepage';
  end if;
  new.created_at := now();
  return new;
end;
$$;

drop trigger if exists trg_newsletter_before_insert on public.newsletter_subscribers;
create trigger trg_newsletter_before_insert
  before insert on public.newsletter_subscribers
  for each row execute function public.newsletter_before_insert();

-- Public (anonymous + signed-in) may INSERT.
drop policy if exists newsletter_insert_public on public.newsletter_subscribers;
create policy newsletter_insert_public
  on public.newsletter_subscribers
  for insert
  to anon, authenticated
  with check (true);

-- Only admins may READ. No public SELECT policy exists, so the public cannot read.
drop policy if exists newsletter_select_admin on public.newsletter_subscribers;
create policy newsletter_select_admin
  on public.newsletter_subscribers
  for select
  to authenticated
  using (public.acting_as_admin());

grant insert on public.newsletter_subscribers to anon, authenticated;
grant select on public.newsletter_subscribers to authenticated;
