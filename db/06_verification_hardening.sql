-- =====================================================================
-- 06_verification_hardening.sql  (Phase 1.2 hardening)
-- Closes four self-approval gaps before the verification pipeline:
--   1. business_documents: providers cannot set/change document status
--   2. listing_media:       providers cannot set/change media status
--   3. payment records:     provider-created records must start pending/
--                           submitted; only admin marks verified/rejected
--   4. review_replies:      a reply's business must own the reviewed listing
--
-- Relies on acting_as_admin() from 05 (admin / service_role / trusted
-- internal SECURITY DEFINER functions bypass; everyone else is blocked).
-- Run AFTER 01–05. Idempotent.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) business_documents: status is admin-only.
-- ---------------------------------------------------------------------
create or replace function protect_document_fields()
returns trigger
language plpgsql
as $$
begin
  if acting_as_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status is distinct from 'pending'::media_status then
      raise exception 'New documents must start as pending. Only admin can change document status.';
    end if;
  else
    if new.status is distinct from old.status then
      raise exception 'Only admin can change document status.';
    end if;
    if new.business_id is distinct from old.business_id then
      raise exception 'You cannot reassign a document to another business.';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists business_documents_protect on business_documents;
create trigger business_documents_protect
  before insert or update on business_documents
  for each row execute function protect_document_fields();

-- ---------------------------------------------------------------------
-- 2) listing_media: status (approve/reject/hide) is admin-only.
--    Providers may still set captions, alt text, position, cover, urls.
-- ---------------------------------------------------------------------
create or replace function protect_listing_media_fields()
returns trigger
language plpgsql
as $$
begin
  if acting_as_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status is distinct from 'pending'::media_status then
      raise exception 'New media must start as pending. Only admin can approve, reject, or hide media.';
    end if;
  else
    if new.status is distinct from old.status then
      raise exception 'Only admin can change media status (approve/reject/hide).';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists listing_media_protect on listing_media;
create trigger listing_media_protect
  before insert or update on listing_media
  for each row execute function protect_listing_media_fields();

-- ---------------------------------------------------------------------
-- 3) Payment/proof records (verification payments, premium subs, payments):
--    must start pending/submitted; provider can never set/raise to verified.
-- ---------------------------------------------------------------------
create or replace function protect_payment_status()
returns trigger
language plpgsql
as $$
begin
  if acting_as_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status not in ('pending'::payment_status, 'submitted'::payment_status) then
      raise exception 'Payment/proof records must start as pending or submitted. Only admin can mark verified or rejected.';
    end if;
  else
    if new.status is distinct from old.status then
      raise exception 'Only admin can change payment status.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists bvp_protect_status on business_verification_payments;
create trigger bvp_protect_status
  before insert or update on business_verification_payments
  for each row execute function protect_payment_status();

drop trigger if exists premium_protect_status on premium_subscriptions;
create trigger premium_protect_status
  before insert or update on premium_subscriptions
  for each row execute function protect_payment_status();

drop trigger if exists payments_protect_status on payments;
create trigger payments_protect_status
  before insert or update on payments
  for each row execute function protect_payment_status();

-- ---------------------------------------------------------------------
-- 4) review_replies ownership integrity.
--    The reply's business_id must be one the caller owns AND must own the
--    listing the review is attached to. Prevents replying on another
--    business's review or spoofing business_id.
-- ---------------------------------------------------------------------
create or replace function enforce_review_reply_ownership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  review_business uuid;
begin
  if acting_as_admin() then
    return new;
  end if;

  -- Caller must own the business named on the reply.
  if not exists (
    select 1 from businesses b
    where b.id = new.business_id and b.owner_id = auth.uid()
  ) then
    raise exception 'You can only reply on behalf of your own business.';
  end if;

  -- That business must own the listing the review belongs to.
  select l.business_id
    into review_business
    from reviews r
    join listings l on l.id = r.listing_id
    where r.id = new.review_id;

  if review_business is null or review_business is distinct from new.business_id then
    raise exception 'You can only reply to reviews on your own listings.';
  end if;

  return new;
end;
$$;
drop trigger if exists review_replies_ownership on review_replies;
create trigger review_replies_ownership
  before insert or update on review_replies
  for each row execute function enforce_review_reply_ownership();

-- End of 06_verification_hardening.sql
