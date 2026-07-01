# Phase 1.8.1 — Email Reliability + Packaging Cleanup

Three reliability fixes on top of Phase 1.8: idempotent commission-invoice emails, reminder
timestamps that only move when an email actually sent, and a real delivery `status` on the audit log.

---

## Files changed

```
NEW FILES:
- db/21_email_reliability.sql
- PHASE1_8_1_EMAIL_RELIABILITY.md

MODIFIED FILES:
- lib/email/notify.ts
- app/api/cron/commission-reminders/route.ts
- PHASE1_SETUP.md

DELETED FILES:
- (none)
```

## 1) Commission invoice email is now idempotent
`notifyBookingStatusChange()` still calls `notifyCommissionCreated()` on both `client_arrived` and
`completed`, but `notifyCommissionCreated()` now:
- reads `commission_invoices.commission_invoice_email_sent_at`,
- **returns early if it's already set** (so `client_arrived → completed` emails the invoice once), and
- stamps that column **only when the send actually succeeded** (`status === 'sent'`).

So a no-op send (no `RESEND_API_KEY`) does not permanently suppress the email — once Resend is
configured, the next completion event will send it and stamp it. The review-request email on
`completed` is unaffected and still sends.

## 2) Reminder timestamps only move on a real send
In the cron, `due_reminder_sent_at` / `overdue_reminder_sent_at` are now updated **only when
`sendEmail()` returns `'sent'`**. If it returns `'noop'` (missing key) or `'failed'`, the timestamp
is left null so the reminder will be retried on a future run. The `dueSent` / `overdueSent` counters
likewise count real sends only.

## 3) `email_events.status`
`sendEmail()` now returns `'sent' | 'noop' | 'failed'` instead of a bare boolean:
- `sent` — Resend accepted it
- `noop` — no API key / no recipient; nothing was sent
- `failed` — attempted but Resend errored or threw

Every audit row in `email_events` now carries this `status`, so the log never implies delivery when
it was only a no-op. (Migration 21 adds the column with a `check (status in ('sent','noop','failed'))`
constraint and an index.)

## Everything else intact
Booking request, provider/admin status, transfer quote, review-request, and the due/overdue cron all
work exactly as in 1.8 — only the success-tracking and idempotency changed. Client emails still carry
no provider contact (templates unchanged).

---

## SQL to run
After `01`–`20`:
```
db/21_email_reliability.sql
```
Idempotent (adds two nullable columns + a check constraint + index).

## Local commands
```bash
npm install
npx tsc --noEmit
npm run build
```

## Merge into your local project
Copy only the changed files into `C:\Dev\mymauritiustrip`:
- new: `db/21_email_reliability.sql`
- modified: `lib/email/notify.ts`, `app/api/cron/commission-reminders/route.ts`, `PHASE1_SETUP.md`

No deletions; `.env.local`, `node_modules`, `.next` untouched.

---

## Test checklist
1. **Invoice email once.** Move a booking `client_arrived` (no key → `[email:noop]` for
   `commission_invoice_provider`; with key → one email). Then move it `completed` → **no second**
   invoice email; review-request email still sends. `select commission_invoice_email_sent_at ...` is
   set only after a real send.
2. **No-op doesn't suppress.** With no `RESEND_API_KEY`, trigger completion → `email_events` shows
   `commission_invoice_provider` with `status='noop'` and `commission_invoice_email_sent_at` stays
   null. Set the key, trigger the next reminder/completion path → it sends and stamps.
3. **Reminder retries after no-op.** Run the cron with no key → due/overdue rows logged `status='noop'`
   and `due_reminder_sent_at` stays null. Add the key, run again → sends, logs `status='sent'`,
   stamps the timestamp. A third run sends nothing.
4. **Audit truthfulness.** `select template, status, count(*) from email_events group by 1,2` — no-ops
   and failures are distinguishable from real sends.
5. **Regression.** Booking request, confirmed/rejected/suggested/cancelled, transfer quote, and
   review-request emails still fire; client emails still expose no provider contact.
6. **Build/type-check.** `npx tsc --noEmit` and `npm run build` both pass.
