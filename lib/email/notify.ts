import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import * as T from './templates';
import type { EmailContent } from './templates';

// Email foundation. Uses Resend's REST API if RESEND_API_KEY is set, otherwise
// logs and no-ops so nothing ever blocks a booking/commission flow. All recipient
// resolution uses the service-role admin client (providers/clients can't read each
// other's rows), and all bodies are built by ./templates which enforce the
// contact-leak rules. Every notify call is best-effort and self-contained.

const FROM = process.env.EMAIL_FROM ?? 'MyMauritiusTrip <no-reply@mymauritiustrip.com>';
const ADMIN_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL ?? 'info@mymauritiustrip.com';
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.mymauritiustrip.com';

type Admin = ReturnType<typeof createAdminClient>;

// 'sent'  = Resend accepted it
// 'noop'  = no API key / no recipient — nothing was sent (NOT delivered)
// 'failed'= attempted but Resend returned an error / threw
export type SendStatus = 'sent' | 'noop' | 'failed';

export async function sendEmail(to: string, content: EmailContent): Promise<SendStatus> {
  const key = process.env.RESEND_API_KEY;
  if (!key || !to) {
    console.log(`[email:noop] to=${to} subject="${content.subject}"`);
    return 'noop';
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to, subject: content.subject, html: content.html, text: content.text }),
    });
    if (!res.ok) {
      console.error('[email:failed]', res.status, content.subject);
      return 'failed';
    }
    return 'sent';
  } catch (e) {
    console.error('[email:error]', (e as Error).message);
    return 'failed';
  }
}

async function logEvent(admin: Admin, toEmail: string, template: string, entity: string, entityId: string | null, status: SendStatus) {
  try {
    await admin.from('email_events').insert({ to_email: toEmail, template, entity, entity_id: entityId, status });
  } catch {
    /* audit logging is non-critical */
  }
}

// Resolve a booking + its business for email context (service-role).
async function bookingContext(admin: Admin, bookingId: string) {
  const { data: b } = await admin
    .from('bookings')
    .select('id, reference, email, full_name, arrival_date, status, business_id, listing:listings(title)')
    .eq('id', bookingId)
    .single();
  if (!b) return null;
  const listingTitle = (b as unknown as { listing?: { title: string } }).listing?.title ?? 'your booking';
  let providerEmail: string | null = null;
  if (b.business_id) {
    const { data: biz } = await admin.from('businesses').select('email').eq('id', b.business_id).single();
    providerEmail = (biz?.email as string) ?? null;
  }
  return {
    id: b.id as string,
    reference: (b.reference as string) ?? '',
    clientEmail: (b.email as string) ?? '',
    clientName: (b.full_name as string) ?? 'Guest',
    arrivalDate: (b.arrival_date as string) ?? null,
    status: b.status as string,
    providerEmail,
    listingTitle,
  };
}

// ---------- Booking created (client + provider + admin) ----------
export async function notifyBookingCreated(bookingId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const ctx = await bookingContext(admin, bookingId);
    if (!ctx) return;

    if (ctx.clientEmail) {
      const s = await sendEmail(ctx.clientEmail, T.bookingRequestClient({ reference: ctx.reference, listingTitle: ctx.listingTitle, arrivalDate: ctx.arrivalDate, bookingId: ctx.id }));
      await logEvent(admin, ctx.clientEmail, 'booking_request_client', 'booking', ctx.id, s);
    }
    if (ctx.providerEmail) {
      const s = await sendEmail(ctx.providerEmail, T.bookingRequestProvider({ reference: ctx.reference, listingTitle: ctx.listingTitle, clientName: ctx.clientName, arrivalDate: ctx.arrivalDate, bookingId: ctx.id }));
      await logEvent(admin, ctx.providerEmail, 'booking_request_provider', 'booking', ctx.id, s);
    }
    const sa = await sendEmail(ADMIN_EMAIL, T.adminNotification({ title: 'New booking request', lines: [['Reference', ctx.reference], ['Experience', ctx.listingTitle], ['Guest', ctx.clientName]], href: `${SITE}/admin/bookings/${ctx.id}` }));
    await logEvent(admin, ADMIN_EMAIL, 'booking_request_admin', 'booking', ctx.id, sa);
  } catch {
    /* non-critical */
  }
}

// ---------- Booking status change (client) ----------
// Also fires the commission-invoice email (provider, idempotent) on
// arrived/completed and a review request (client) on completed.
export async function notifyBookingStatusChange(bookingId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const ctx = await bookingContext(admin, bookingId);
    if (!ctx) return;

    let suggestedDate: string | null = null;
    if (ctx.status === 'date_suggested') {
      const { data } = await admin.from('bookings').select('suggested_date').eq('id', bookingId).single();
      suggestedDate = (data?.suggested_date as string) ?? null;
    }

    if (ctx.clientEmail && ['confirmed', 'provider_rejected', 'date_suggested', 'cancelled', 'completed'].includes(ctx.status)) {
      const s = await sendEmail(ctx.clientEmail, T.bookingStatusClient({ reference: ctx.reference, listingTitle: ctx.listingTitle, status: ctx.status, suggestedDate, bookingId: ctx.id }));
      await logEvent(admin, ctx.clientEmail, `booking_${ctx.status}`, 'booking', ctx.id, s);
    }

    if (ctx.status === 'client_arrived' || ctx.status === 'completed') {
      await notifyCommissionCreated(bookingId);
    }
    if (ctx.status === 'completed' && ctx.clientEmail) {
      const s = await sendEmail(ctx.clientEmail, T.reviewRequestClient({ reference: ctx.reference, listingTitle: ctx.listingTitle, bookingId: ctx.id }));
      await logEvent(admin, ctx.clientEmail, 'review_request_client', 'booking', ctx.id, s);
    }
  } catch {
    /* non-critical */
  }
}

// ---------- Commission invoice created (provider) — idempotent ----------
// Sends at most once per invoice. Guarded by commission_invoice_email_sent_at,
// which is only stamped when the email is actually accepted (status 'sent'), so
// a no-op (no RESEND_API_KEY) does not permanently suppress the email.
export async function notifyCommissionCreated(bookingId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: inv } = await admin
      .from('commission_invoices')
      .select('id, commission_amount_mur, due_date, business_id, commission_invoice_email_sent_at, booking:bookings(reference)')
      .eq('booking_id', bookingId)
      .single();
    if (!inv) return;
    if (inv.commission_invoice_email_sent_at) return; // already emailed — idempotent

    const bookingReference = (inv as unknown as { booking?: { reference: string } }).booking?.reference ?? '';
    const { data: biz } = await admin.from('businesses').select('email').eq('id', inv.business_id).single();
    const providerEmail = (biz?.email as string) ?? null;
    if (!providerEmail) return;

    const status = await sendEmail(providerEmail, T.commissionInvoiceProvider({ bookingReference, amountMur: Number(inv.commission_amount_mur), dueDate: inv.due_date as string }));
    await logEvent(admin, providerEmail, 'commission_invoice_provider', 'commission_invoice', inv.id as string, status);
    if (status === 'sent') {
      await admin.from('commission_invoices').update({ commission_invoice_email_sent_at: new Date().toISOString() }).eq('id', inv.id);
    }
  } catch {
    /* non-critical */
  }
}

// ---------- Transfer quote (client) ----------
export async function notifyTransferQuote(requestId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: r } = await admin
      .from('transfer_requests')
      .select('id, reference, email, quoted_amount_mur')
      .eq('id', requestId)
      .single();
    if (!r?.email) return;
    const s = await sendEmail(r.email as string, T.transferQuoteClient({ reference: (r.reference as string) ?? '', amountMur: Number(r.quoted_amount_mur ?? 0) }));
    await logEvent(admin, r.email as string, 'transfer_quote_client', 'transfer_request', r.id as string, s);
  } catch {
    /* non-critical */
  }
}
