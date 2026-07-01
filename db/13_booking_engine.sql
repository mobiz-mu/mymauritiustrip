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
