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
