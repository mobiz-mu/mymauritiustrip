-- =====================================================================
-- 20_email_reminders.sql  (Phase 1.8)
-- Support for commission due/overdue reminder emails (idempotent sending) and a
-- light audit log of outbound emails. Run AFTER 01–19. Idempotent.
-- =====================================================================

-- Track when each reminder was last sent so the cron never spams a provider.
alter table commission_invoices
  add column if not exists due_reminder_sent_at     timestamptz,
  add column if not exists overdue_reminder_sent_at timestamptz;

-- Audit of outbound emails (written by the service-role notify layer / cron).
create table if not exists email_events (
  id         uuid primary key default gen_random_uuid(),
  to_email   citext not null,
  template   text not null,
  entity     text,
  entity_id  uuid,
  created_at timestamptz not null default now()
);
create index if not exists email_events_entity_idx on email_events (entity, entity_id);
create index if not exists email_events_created_idx on email_events (created_at desc);

alter table email_events enable row level security;

-- Admin-only read; inserts come from the service-role client (bypasses RLS).
revoke all on email_events from anon, authenticated;
grant select on email_events to authenticated;     -- still gated by the policy below
drop policy if exists email_events_admin_read on email_events;
create policy email_events_admin_read on email_events for select using (is_admin());

-- End of 20_email_reminders.sql
