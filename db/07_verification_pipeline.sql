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
