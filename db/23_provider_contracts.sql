-- =====================================================================
-- db/23_provider_contracts.sql
-- Provider signed-contract PDF upload. Private bucket + table + RLS.
-- Run AFTER 01â€“22. Idempotent. Mirrors the storage-policy pattern used by
-- business-documents / payment-proofs (folder[1] = business_id).
-- =====================================================================

do $$ begin
  create type contract_status as enum ('pending','approved','rejected');
exception when duplicate_object then null; end $$;

create table if not exists provider_contracts (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null references businesses(id) on delete cascade,
  storage_path      text not null,
  original_filename text,
  mime_type         text,
  size_bytes        bigint,
  status            contract_status not null default 'pending',
  admin_note        text,
  uploaded_at       timestamptz not null default now(),
  reviewed_at       timestamptz,
  reviewed_by       uuid references profiles(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists provider_contracts_business_idx on provider_contracts(business_id);
create index if not exists provider_contracts_status_idx   on provider_contracts(status);

create or replace function set_provider_contracts_updated_at() returns trigger as $f$
begin new.updated_at = now(); return new; end $f$ language plpgsql;
drop trigger if exists provider_contracts_updated_at on provider_contracts;
create trigger provider_contracts_updated_at before update on provider_contracts
  for each row execute function set_provider_contracts_updated_at();

alter table provider_contracts enable row level security;

-- Provider: read own (via business ownership) or admin.
drop policy if exists provider_contracts_owner_sel on provider_contracts;
create policy provider_contracts_owner_sel on provider_contracts for select to authenticated
  using (is_admin() or business_id in (select id from businesses where owner_id = auth.uid()));

-- Provider: insert only own pending contract rows.
-- Provider must never be able to insert an already approved/rejected contract.
drop policy if exists provider_contracts_owner_ins on provider_contracts;
create policy provider_contracts_owner_ins on provider_contracts for insert to authenticated
  with check (
    business_id in (select id from businesses where owner_id = auth.uid())
    and status = 'pending'
    and admin_note is null
    and reviewed_at is null
    and reviewed_by is null
    and mime_type = 'application/pdf'
    and size_bytes > 0
    and size_bytes <= 10485760
    and storage_path like business_id::text || '/%'
  );

-- Provider contract review fields are admin-only.
-- Providers re-upload by INSERTING a new pending contract row.
drop policy if exists provider_contracts_owner_upd on provider_contracts;
-- Admin: full access (belt-and-braces; no anon/public policy exists â†’ no public access).
drop policy if exists provider_contracts_admin_all on provider_contracts;
create policy provider_contracts_admin_all on provider_contracts for all to authenticated
  using (is_admin()) with check (is_admin());

-- ---- Private storage bucket ----
insert into storage.buckets (id, name, public)
values ('provider-contracts', 'provider-contracts', false)
on conflict (id) do nothing;

drop policy if exists "contracts owner read" on storage.objects;
create policy "contracts owner read" on storage.objects for select to authenticated
using (
  bucket_id = 'provider-contracts'
  and (
    public.is_admin()
    or (storage.foldername(name))[1] in (
      select id::text from public.businesses where owner_id = auth.uid()
    )
  )
);

drop policy if exists "contracts owner insert" on storage.objects;
create policy "contracts owner insert" on storage.objects for insert to authenticated
with check (
  bucket_id = 'provider-contracts'
  and (storage.foldername(name))[1] in (
    select id::text from public.businesses where owner_id = auth.uid()
  )
);

drop policy if exists "contracts owner update" on storage.objects;
-- No provider storage UPDATE policy for contracts. Re-uploads use a new unique file path.
-- Rollback (manual):
--   drop policy "contracts owner read"   on storage.objects;
--   drop policy "contracts owner insert" on storage.objects;
--   drop policy "contracts owner update" on storage.objects;
--   delete from storage.buckets where id = 'provider-contracts';
--   drop table provider_contracts;  drop type contract_status;

