-- =====================================================================
-- 16_commission_security_build_cleanup.sql  (Phase 1.6.1)
-- Providers must no longer update commission_invoices directly. The proper
-- path is provider_submit_commission_proof(invoice_id, path) (SECURITY DEFINER,
-- owner-checked, audited, sets status='submitted'). Direct updates are now
-- admin-only, so a provider cannot bypass the audit log or write an arbitrary
-- proof_path / tamper with status/amount/due/paid fields by table update.
-- Run AFTER 01–15. Idempotent.
-- =====================================================================

-- Remove the old provider/admin update policy (it allowed providers to update
-- their own invoice row, relying on protect_commission_fields to limit columns).
drop policy if exists commission_provider_update on commission_invoices;

-- Admin-only direct update. Providers go through the RPC.
drop policy if exists commission_admin_update on commission_invoices;
create policy commission_admin_update on commission_invoices
  for update using (is_admin()) with check (is_admin());

-- Providers keep READ access to their own invoices (no client contact lives on
-- this table); commission_provider_read is unchanged. Provider proof submission
-- continues to work because provider_submit_commission_proof() is SECURITY
-- DEFINER and bypasses RLS while still checking ownership and writing an audit
-- log. (Defined in 15; re-affirmed here for clarity — unchanged.)

-- End of 16_commission_security_build_cleanup.sql
