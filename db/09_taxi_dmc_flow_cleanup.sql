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
