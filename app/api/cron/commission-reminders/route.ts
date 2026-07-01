import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email/notify';
import * as T from '@/lib/email/templates';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Commission reminder cron.
// Schedule this once a day. It (1) flips due->overdue via mark_commissions_overdue(),
// (2) emails providers whose commission is due within DUE_WINDOW_DAYS and not yet
// reminded, and (3) re-emails overdue providers at most every OVERDUE_REPEAT_DAYS.
//
// Auth: send `Authorization: Bearer <CRON_SECRET>` OR `?key=<CRON_SECRET>`.
// If CRON_SECRET is unset the endpoint refuses to run (so it's never public).

const DUE_WINDOW_DAYS = 5;
const OVERDUE_REPEAT_DAYS = 7;

type InvoiceRow = {
  id: string;
  commission_amount_mur: number;
  due_date: string;
  business: { email: string; business_name: string } | null;
  booking: { reference: string } | null;
};

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get('authorization');
  if (header === `Bearer ${secret}`) return true;
  const url = new URL(req.url);
  return url.searchParams.get('key') === secret;
}

async function run(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const today = new Date();
  const isoDate = (d: Date) => d.toISOString().slice(0, 10);

  // 1) Flip anything past due into 'overdue'.
  let swept = 0;
  try {
    const { data } = await admin.rpc('mark_commissions_overdue');
    swept = Number(data ?? 0);
  } catch {
    /* continue with reminders regardless */
  }

  const select = 'id, commission_amount_mur, due_date, business:businesses(email, business_name), booking:bookings(reference)';

  // 2) Due soon (still unpaid) and not yet reminded.
  const dueCutoff = new Date(today);
  dueCutoff.setDate(dueCutoff.getDate() + DUE_WINDOW_DAYS);
  const { data: dueRows } = await admin
    .from('commission_invoices')
    .select(select)
    .in('status', ['pending', 'submitted'])
    .gte('due_date', isoDate(today))
    .lte('due_date', isoDate(dueCutoff))
    .is('due_reminder_sent_at', null);

  let dueSent = 0;
  for (const inv of (dueRows ?? []) as unknown as InvoiceRow[]) {
    const email = inv.business?.email;
    if (!email) continue;
    const status = await sendEmail(
      email,
      T.commissionDueReminderProvider({ bookingReference: inv.booking?.reference ?? '', amountMur: Number(inv.commission_amount_mur), dueDate: inv.due_date }),
    );
    await admin.from('email_events').insert({ to_email: email, template: 'commission_due_reminder', entity: 'commission_invoice', entity_id: inv.id, status });
    if (status === 'sent') {
      // Only mark as reminded when it actually went out — a no-op (missing
      // RESEND_API_KEY) must not suppress a future real send.
      await admin.from('commission_invoices').update({ due_reminder_sent_at: new Date().toISOString() }).eq('id', inv.id);
      dueSent += 1;
    }
  }

  // 3) Overdue, not reminded in the last OVERDUE_REPEAT_DAYS.
  const repeatCutoff = new Date(today);
  repeatCutoff.setDate(repeatCutoff.getDate() - OVERDUE_REPEAT_DAYS);
  const { data: overdueRows } = await admin
    .from('commission_invoices')
    .select(select)
    .eq('status', 'overdue')
    .or(`overdue_reminder_sent_at.is.null,overdue_reminder_sent_at.lt.${repeatCutoff.toISOString()}`);

  let overdueSent = 0;
  for (const inv of (overdueRows ?? []) as unknown as InvoiceRow[]) {
    const email = inv.business?.email;
    if (!email) continue;
    const status = await sendEmail(
      email,
      T.commissionOverdueReminderProvider({ bookingReference: inv.booking?.reference ?? '', amountMur: Number(inv.commission_amount_mur), dueDate: inv.due_date }),
    );
    await admin.from('email_events').insert({ to_email: email, template: 'commission_overdue_reminder', entity: 'commission_invoice', entity_id: inv.id, status });
    if (status === 'sent') {
      await admin.from('commission_invoices').update({ overdue_reminder_sent_at: new Date().toISOString() }).eq('id', inv.id);
      overdueSent += 1;
    }
  }

  return NextResponse.json({ ok: true, swept, dueSent, overdueSent });
}

export async function GET(req: Request) {
  return run(req);
}
export async function POST(req: Request) {
  return run(req);
}
