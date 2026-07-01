# Phase 1.8 — Email Templates + Reminder Cron

Branded, contact-safe transactional emails for the whole booking/transfer/commission lifecycle, plus
a protected daily cron for commission due/overdue reminders. Email sending no-ops cleanly when
`RESEND_API_KEY` is unset, so nothing ever blocks a flow.

---

## Files changed

```
NEW FILES:
- lib/email/templates.ts
- app/api/cron/commission-reminders/route.ts
- db/20_email_reminders.sql
- PHASE1_8_EMAIL.md

MODIFIED FILES:
- lib/email/notify.ts
- app/listings/[slug]/book/actions.ts
- app/provider/bookings/actions.ts
- app/admin/bookings/actions.ts
- app/admin/transfers/requests/actions.ts
- PHASE1_SETUP.md

DELETED FILES:
- (none)
```

## What gets sent, and when

| Event | Trigger | Recipient(s) |
|---|---|---|
| Booking request received | client creates booking (`createBooking`) | client + provider + admin |
| Booking confirmed | provider/admin sets `confirmed` | client |
| Booking rejected | provider/admin sets `provider_rejected` | client |
| Suggested date | provider sets `date_suggested` | client (shows suggested date) |
| Booking cancelled | status `cancelled` | client |
| Commission invoice created | booking hits `client_arrived`/`completed` (DB trigger makes the invoice) | provider |
| Review request | booking `completed` | client |
| Transfer quote | admin quotes a request (`admin_quote_transfer`) | client |
| Commission due reminder | daily cron, due within 5 days, not yet reminded | provider |
| Commission overdue reminder | daily cron, status `overdue`, at most every 7 days | provider |
| Admin notification | new booking request | admin |

All bodies are built in `lib/email/templates.ts` (responsive inline-styled HTML + plain-text
fallback), sent via `lib/email/notify.ts`.

## Contact-leak safety (enforced in the templates)
- **Client-facing** emails never include provider phone/email/WhatsApp/website/owner name. They show
  only the public `business_name`, the listing title, structured facts (reference, date, amount,
  status) and platform links. The only contact in the footer is the platform's own
  (WhatsApp +230 5506 8119 / info@mymauritiustrip.com).
- **Provider-facing** emails include the client's name (the hosting provider is allowed to see client
  contact on their booking) and push to the dashboard for the rest.
- **No free-text** user content (special requests, provider notes, admin notes) is echoed to the
  counterparty, so contact details can't leak through those fields.
- Recipient lookups run through the **service-role** admin client inside `notify.ts` (providers and
  clients can't read each other's rows), never exposing addresses to the other party.

## Database (migration 20)
- `commission_invoices.due_reminder_sent_at` / `overdue_reminder_sent_at` — so the cron never spams.
- `email_events` — light audit log of outbound emails (admin-only read; inserts via service role).

## Cron endpoint
`POST|GET /api/cron/commission-reminders` (Node runtime, force-dynamic). It:
1. calls `mark_commissions_overdue()` (flips due → overdue),
2. emails providers with commission due within 5 days (once),
3. re-emails overdue providers at most every 7 days,
4. returns `{ ok, swept, dueSent, overdueSent }`.

Auth: `Authorization: Bearer $CRON_SECRET` **or** `?key=$CRON_SECRET`. If `CRON_SECRET` is unset the
endpoint refuses (never public).

---

## SQL to run
After `01`–`19`:
```
db/20_email_reminders.sql
```

## Env (.env.local) — all optional; email no-ops if unset
```
RESEND_API_KEY=...
EMAIL_FROM=MyMauritiusTrip <no-reply@mymauritiustrip.com>
ADMIN_NOTIFICATION_EMAIL=info@mymauritiustrip.com
NEXT_PUBLIC_SITE_URL=https://www.mymauritiustrip.com
CRON_SECRET=<long-random-string>
```

## Scheduling (pick one)
- Vercel Cron (`vercel.json`): `{ "crons":[{ "path":"/api/cron/commission-reminders","schedule":"0 8 * * *" }] }`
- Any scheduler: `curl -X POST "$SITE/api/cron/commission-reminders" -H "Authorization: Bearer $CRON_SECRET"`
- pg_cron (overdue flip only): `select cron.schedule('mark-overdue-daily','0 7 * * *', $$ select mark_commissions_overdue(); $$);`

## Local commands
```bash
npm install
npx tsc --noEmit
npm run build
```
Sandbox note: npm/Resend/Supabase aren't reachable here, so this is verified by inspection
(brace balance, import/export parity, contact-leak grep). Emails log to the console without
`RESEND_API_KEY`, so you can exercise every flow locally before wiring Resend.

---

## Test checklist
1. **No key → safe no-op.** Without `RESEND_API_KEY`, create a booking → console shows `[email:noop]`
   lines for client/provider/admin; booking still succeeds.
2. **With key → delivery.** Set `RESEND_API_KEY`; repeat → client/provider/admin receive the branded
   emails; `select * from email_events order by created_at desc` shows the rows (as admin).
3. **Status emails.** Provider accept → client gets "confirmed"; reject → "declined"; suggest date →
   "new date suggested" with the date; admin status changes send the same.
4. **Completion.** Mark a booking `completed` → provider gets the commission invoice email, client
   gets the review-request email.
5. **Transfer quote.** Admin quotes a request → the requester gets the quote email with the amount.
6. **Cron.** `curl -X POST .../api/cron/commission-reminders -H "Authorization: Bearer $CRON_SECRET"`
   → returns `{ ok, swept, dueSent, overdueSent }`; due/overdue providers get reminders; a second
   immediate call sends nothing (timestamps guard repeats). Wrong/missing secret → 401.
7. **Contact safety.** Inspect any client email source: no provider phone/email/WhatsApp/owner name;
   only `business_name`, listing title, structured facts, platform support footer.
8. **Build.** `npx tsc --noEmit` and `npm run build` both complete (the build-phase guards from 1.7.4
   keep the new server-only modules from running during build).
