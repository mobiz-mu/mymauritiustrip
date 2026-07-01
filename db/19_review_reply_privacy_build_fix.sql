-- =====================================================================
-- 19_review_reply_privacy_build_fix.sql  (Phase 1.7.2)
-- Lock down direct reads of the raw review_replies table. Public reply display
-- goes through reviews_public.reply_body and provider display through
-- provider_reviews_safe (both owner-owned views that bypass RLS). The old
-- rr_public_read policy (which let anon/public select raw rows) is removed.
--
-- After this:
--   * anon/public      -> NO direct select on review_replies
--   * admin            -> read (rr_read)
--   * provider (owner) -> read/write own replies (rr_read + rr_owner_write) and
--                         display via provider_reviews_safe
--   * ownership + contact-leak guards on replies are unchanged
-- Run AFTER 01-18. Idempotent.
-- =====================================================================

-- Remove public/anon direct read of raw replies.
drop policy if exists rr_public_read on review_replies;

-- Explicit admin/owner-only read (does not rely on the broad FOR ALL write rule).
drop policy if exists rr_read on review_replies;
create policy rr_read on review_replies for select
  using (is_admin() or owns_business(business_id));

-- rr_owner_write (insert/update/delete by admin or business owner) stays as-is,
-- and enforce_review_reply_ownership + guard_contact_leak_review_reply remain in
-- force (defined in 03/05/06). Nothing else changes.

-- End of 19_review_reply_privacy_build_fix.sql
