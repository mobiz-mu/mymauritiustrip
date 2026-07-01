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
