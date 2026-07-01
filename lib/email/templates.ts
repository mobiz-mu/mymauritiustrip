import 'server-only';

// =====================================================================
// Email templates — branded, responsive, inline-styled (email-safe) HTML
// plus a plain-text fallback. Every builder returns { subject, html, text }.
//
// CONTACT-SAFETY (hard rule):
//  - CLIENT-facing emails never contain provider phone/email/WhatsApp/website/
//    owner name. Only the public business_name, the listing title, structured
//    booking facts, and platform links/support contact appear.
//  - PROVIDER-facing emails may include the client's name (the hosting provider
//    is allowed to see client contact on their booking) — but we keep it minimal
//    and push them to the dashboard for the rest.
//  - No free-text user content (special requests, notes) is echoed to the
//    counterparty, so contact details can't leak through those fields.
// =====================================================================

const BRAND = 'MyMauritiusTrip.com';
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.mymauritiustrip.com';
const SUPPORT_WA = '+230 5506 8119';
const SUPPORT_EMAIL = 'info@mymauritiustrip.com';

const OCEAN = '#0b6fb8';
const GOLD = '#d4a128';

export type EmailContent = { subject: string; html: string; text: string };

export function money(mur: number | null | undefined): string {
  const n = Math.round(Number(mur ?? 0));
  return 'Rs ' + new Intl.NumberFormat('en-US').format(n);
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? String(d) : dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function row(label: string, value: string): string {
  return `<tr>
    <td style="padding:6px 0;color:#64748b;font-size:13px;">${label}</td>
    <td style="padding:6px 0;color:#0f172a;font-size:13px;font-weight:600;text-align:right;">${value}</td>
  </tr>`;
}

function shell(opts: { heading: string; intro: string; rows?: Array<[string, string]>; cta?: { label: string; href: string }; outro?: string }): string {
  const { heading, intro, rows = [], cta, outro } = opts;
  const rowsHtml = rows.length
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;">${rows
        .map(([l, v]) => row(l, v))
        .join('')}</table>`
    : '';
  const ctaHtml = cta
    ? `<div style="margin:24px 0;"><a href="${cta.href}" style="background:${OCEAN};color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-size:14px;font-weight:600;display:inline-block;">${cta.label}</a></div>`
    : '';
  const outroHtml = outro ? `<p style="margin:16px 0 0;color:#475569;font-size:14px;line-height:1.6;">${outro}</p>` : '';
  return `<!doctype html><html><body style="margin:0;background:#f1f5f9;padding:24px 0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08);">
      <tr><td style="background:${OCEAN};padding:20px 28px;">
        <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:.2px;">MyMauritius<span style="color:${GOLD};">Trip</span></span>
      </td></tr>
      <tr><td style="padding:28px;">
        <h1 style="margin:0 0 10px;color:#0f172a;font-size:20px;">${heading}</h1>
        <p style="margin:0;color:#475569;font-size:14px;line-height:1.6;">${intro}</p>
        ${rowsHtml}
        ${ctaHtml}
        ${outroHtml}
      </td></tr>
      <tr><td style="padding:18px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;">
        <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.6;">
          All communication stays on ${BRAND}. Need help? WhatsApp ${SUPPORT_WA} or email ${SUPPORT_EMAIL}.<br>
          You're receiving this because you have activity on ${BRAND}.
        </p>
      </td></tr>
    </table>
  </td></tr></table>
  </body></html>`;
}

function textify(heading: string, lines: string[], cta?: { label: string; href: string }): string {
  const parts = [heading, '', ...lines];
  if (cta) parts.push('', `${cta.label}: ${cta.href}`);
  parts.push('', `All communication stays on ${BRAND}. Help: WhatsApp ${SUPPORT_WA} / ${SUPPORT_EMAIL}.`);
  return parts.join('\n');
}

// ---------- Bookings ----------

export function bookingRequestClient(o: { reference: string; listingTitle: string; arrivalDate: string | null; bookingId: string }): EmailContent {
  const cta = { label: 'View your booking', href: `${SITE}/client/bookings/${o.bookingId}` };
  return {
    subject: `Booking request received — ${o.reference}`,
    html: shell({
      heading: 'Your request was received',
      intro: `Thanks for booking <strong>${o.listingTitle}</strong>. The provider will review and respond shortly. You'll get an email when they do.`,
      rows: [['Reference', o.reference], ['Experience', o.listingTitle], ['Preferred date', fmtDate(o.arrivalDate)], ['Status', 'Awaiting provider']],
      cta,
    }),
    text: textify('Your request was received', [`Experience: ${o.listingTitle}`, `Reference: ${o.reference}`, `Preferred date: ${fmtDate(o.arrivalDate)}`, 'Status: Awaiting provider'], cta),
  };
}

export function bookingRequestProvider(o: { reference: string; listingTitle: string; clientName: string; arrivalDate: string | null; bookingId: string }): EmailContent {
  const cta = { label: 'Review the request', href: `${SITE}/provider/bookings/${o.bookingId}` };
  return {
    subject: `New booking request — ${o.reference}`,
    html: shell({
      heading: 'You have a new booking request',
      intro: `A guest has requested <strong>${o.listingTitle}</strong>. Please accept, decline, or suggest a new date from your dashboard.`,
      rows: [['Reference', o.reference], ['Experience', o.listingTitle], ['Guest', o.clientName], ['Preferred date', fmtDate(o.arrivalDate)]],
      cta,
      outro: 'Respond promptly to keep your response rate high.',
    }),
    text: textify('New booking request', [`Experience: ${o.listingTitle}`, `Reference: ${o.reference}`, `Guest: ${o.clientName}`, `Preferred date: ${fmtDate(o.arrivalDate)}`], cta),
  };
}

export function bookingStatusClient(o: { reference: string; listingTitle: string; status: string; suggestedDate: string | null; bookingId: string }): EmailContent {
  const cta = { label: 'View your booking', href: `${SITE}/client/bookings/${o.bookingId}` };
  const map: Record<string, { heading: string; intro: string; extra?: [string, string] }> = {
    confirmed: { heading: 'Your booking is confirmed 🎉', intro: `Great news — <strong>${o.listingTitle}</strong> is confirmed. You'll pay on arrival.` },
    provider_rejected: { heading: 'Your booking was declined', intro: `Unfortunately the provider couldn't take <strong>${o.listingTitle}</strong> for your dates. You can explore other options on ${BRAND}.` },
    date_suggested: { heading: 'A new date was suggested', intro: `The provider suggested a new date for <strong>${o.listingTitle}</strong>. Review and accept or decline it.`, extra: ['Suggested date', fmtDate(o.suggestedDate)] },
    cancelled: { heading: 'Your booking was cancelled', intro: `Your booking for <strong>${o.listingTitle}</strong> has been cancelled.` },
    completed: { heading: 'Thanks for travelling with us', intro: `We hope you enjoyed <strong>${o.listingTitle}</strong>. We'd love your feedback.` },
  };
  const m = map[o.status] ?? { heading: 'Booking update', intro: `There's an update on your booking for <strong>${o.listingTitle}</strong>.` };
  const rows: Array<[string, string]> = [['Reference', o.reference], ['Experience', o.listingTitle]];
  if (m.extra) rows.push(m.extra);
  return {
    subject: `${m.heading.replace(/[🎉]/g, '').trim()} — ${o.reference}`,
    html: shell({ heading: m.heading, intro: m.intro, rows, cta }),
    text: textify(m.heading, rows.map(([l, v]) => `${l}: ${v}`), cta),
  };
}

export function reviewRequestClient(o: { reference: string; listingTitle: string; bookingId: string }): EmailContent {
  const cta = { label: 'Write a review', href: `${SITE}/client/bookings/${o.bookingId}` };
  return {
    subject: `How was ${o.listingTitle}?`,
    html: shell({
      heading: 'Share your experience',
      intro: `Your booking for <strong>${o.listingTitle}</strong> is complete. A quick review helps other travellers and the provider.`,
      rows: [['Reference', o.reference], ['Experience', o.listingTitle]],
      cta,
    }),
    text: textify('Share your experience', [`Experience: ${o.listingTitle}`, `Reference: ${o.reference}`], cta),
  };
}

// ---------- Transfers ----------

export function transferQuoteClient(o: { reference: string; amountMur: number }): EmailContent {
  const cta = { label: 'View your quote', href: `${SITE}/client/quotes` };
  return {
    subject: `Your transfer quote — ${o.reference}`,
    html: shell({
      heading: 'Your quote is ready',
      intro: `Our team has prepared a quote for your transfer request. Review it and accept to proceed — you pay on arrival.`,
      rows: [['Reference', o.reference], ['Quoted price', money(o.amountMur)], ['Payment', 'Pay on arrival']],
      cta,
    }),
    text: textify('Your quote is ready', [`Reference: ${o.reference}`, `Quoted price: ${money(o.amountMur)}`, 'Payment: pay on arrival'], cta),
  };
}

// ---------- Commissions (provider-facing) ----------

export function commissionInvoiceProvider(o: { bookingReference: string; amountMur: number; dueDate: string }): EmailContent {
  const cta = { label: 'View commission', href: `${SITE}/provider/commissions` };
  return {
    subject: `Commission due — booking ${o.bookingReference}`,
    html: shell({
      heading: 'A commission invoice was created',
      intro: `A 15% platform commission is now due for booking <strong>${o.bookingReference}</strong>. Please settle it by the due date and upload your payment proof.`,
      rows: [['Booking', o.bookingReference], ['Commission (15%)', money(o.amountMur)], ['Due by', fmtDate(o.dueDate)]],
      cta,
    }),
    text: textify('A commission invoice was created', [`Booking: ${o.bookingReference}`, `Commission (15%): ${money(o.amountMur)}`, `Due by: ${fmtDate(o.dueDate)}`], cta),
  };
}

export function commissionDueReminderProvider(o: { bookingReference: string; amountMur: number; dueDate: string }): EmailContent {
  const cta = { label: 'Pay & upload proof', href: `${SITE}/provider/commissions` };
  return {
    subject: `Reminder: commission due soon — ${o.bookingReference}`,
    html: shell({
      heading: 'Your commission is due soon',
      intro: `This is a friendly reminder that the commission for booking <strong>${o.bookingReference}</strong> is due on <strong>${fmtDate(o.dueDate)}</strong>.`,
      rows: [['Booking', o.bookingReference], ['Commission (15%)', money(o.amountMur)], ['Due by', fmtDate(o.dueDate)]],
      cta,
    }),
    text: textify('Your commission is due soon', [`Booking: ${o.bookingReference}`, `Commission: ${money(o.amountMur)}`, `Due by: ${fmtDate(o.dueDate)}`], cta),
  };
}

export function commissionOverdueReminderProvider(o: { bookingReference: string; amountMur: number; dueDate: string }): EmailContent {
  const cta = { label: 'Settle now', href: `${SITE}/provider/commissions` };
  return {
    subject: `Overdue: commission for ${o.bookingReference}`,
    html: shell({
      heading: 'Your commission is overdue',
      intro: `The commission for booking <strong>${o.bookingReference}</strong> was due on <strong>${fmtDate(o.dueDate)}</strong> and is now overdue. Please settle it to keep your account in good standing.`,
      rows: [['Booking', o.bookingReference], ['Commission (15%)', money(o.amountMur)], ['Was due', fmtDate(o.dueDate)]],
      cta,
    }),
    text: textify('Your commission is overdue', [`Booking: ${o.bookingReference}`, `Commission: ${money(o.amountMur)}`, `Was due: ${fmtDate(o.dueDate)}`], cta),
  };
}

// ---------- Admin notifications (internal) ----------

export function adminNotification(o: { title: string; lines: Array<[string, string]>; href?: string }): EmailContent {
  const cta = o.href ? { label: 'Open admin', href: o.href } : undefined;
  return {
    subject: `[Admin] ${o.title}`,
    html: shell({ heading: o.title, intro: 'Internal notification.', rows: o.lines, cta }),
    text: textify(o.title, o.lines.map(([l, v]) => `${l}: ${v}`), cta),
  };
}
