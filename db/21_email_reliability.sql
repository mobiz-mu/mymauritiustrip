-- =====================================================================
-- 21_email_reliability.sql  (Phase 1.8.1)
-- Idempotency for the commission-invoice email + a delivery status on the
-- email audit log. Run AFTER 01–20. Idempotent.
-- =====================================================================

-- Mark when the commission-invoice email was actually sent, so a booking that
-- goes client_arrived -> completed only emails the invoice once.
alter table commission_invoices
  add column if not exists commission_invoice_email_sent_at timestamptz;

-- Record the real outcome of each send attempt: 'sent' | 'noop' | 'failed'.
alter table email_events
  add column if not exists status text not null default 'sent';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'email_events_status_chk') then
    alter table email_events
      add constraint email_events_status_chk check (status in ('sent', 'noop', 'failed'));
  end if;
end $$;

create index if not exists email_events_status_idx on email_events (status);

-- End of 21_email_reliability.sql
