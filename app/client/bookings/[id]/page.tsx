import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireRole } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { statusBadge, statusLabel } from '@/lib/bookings/status';
import { formatMUR } from '@/components/public/ui';
import { WHATSAPP, SUPPORT_EMAIL } from '@/components/public/PublicHeader';
import { respondSuggestedDate, cancelBooking } from '../actions';
import ReviewForm from './review-form';

export const dynamic = 'force-dynamic';

export default async function ClientBookingDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  await requireRole('client');
  const { id } = await params;
  const flash = await searchParams;
  const supabase = await createClient();

  const { data: b } = await supabase
    .from('bookings')
    .select('*, listing:listings(title, slug)')
    .eq('id', id)
    .single();
  if (!b) notFound();

  const listing = (b as unknown as { listing?: { title: string; slug: string } }).listing;

  // Provider business name only (no contact) via the contact-safe view.
  let businessName: string | null = null;
  const { data: pub } = await supabase.from('listings_public').select('business_name').eq('id', b.listing_id).single();
  businessName = pub?.business_name ?? null;

  const canCancel = ['pending', 'date_suggested', 'confirmed'].includes(b.status);

  let existingReview: { rating: number; comment: string | null; status: string } | null = null;
  if (b.status === 'completed') {
    const { data: rv } = await supabase
      .from('reviews')
      .select('rating, comment, status')
      .eq('booking_id', b.id)
      .maybeSingle();
    existingReview = rv ?? null;
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12 space-y-5">
      <Link href="/client/bookings" className="text-sm text-ocean">← My bookings</Link>

      {flash?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{flash.error}</p>}
      {flash?.ok && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">Updated.</p>}

      <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200 space-y-2">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">{listing?.title ?? 'Listing'}</h1>
          <span className={`rounded-full px-2.5 py-0.5 text-xs ${statusBadge(b.status)}`}>{statusLabel(b.status)}</span>
        </div>
        <p className="text-xs text-slate-500">Reference {b.reference}</p>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 pt-2 text-sm">
          <dt className="text-slate-500">Date</dt><dd>{b.arrival_date ?? 'TBC'}</dd>
          <dt className="text-slate-500">Guests</dt><dd>{b.num_people ?? 1}</dd>
          <dt className="text-slate-500">Amount</dt><dd>{formatMUR(Number(b.display_amount))} ({b.display_currency})</dd>
          <dt className="text-slate-500">Provider</dt><dd>{businessName ?? '—'}</dd>
        </dl>
        {b.special_request && <p className="pt-1 text-sm text-slate-600">“{b.special_request}”</p>}
        <p className="pt-2 text-xs text-slate-400">Payment is made on arrival. No card is charged now.</p>
      </div>

      {b.status === 'date_suggested' && (
        <div className="rounded-2xl bg-blue-50 p-5 ring-1 ring-blue-200 space-y-3">
          <p className="text-sm text-blue-900">
            The provider suggested a new date: <strong>{b.suggested_date}</strong>
            {b.provider_note ? ` — “${b.provider_note}”` : ''}
          </p>
          <div className="flex gap-2">
            <form action={respondSuggestedDate}>
              <input type="hidden" name="booking_id" value={b.id} />
              <input type="hidden" name="action" value="accept" />
              <button className="rounded-lg bg-ocean px-4 py-2 text-sm font-semibold text-white">Accept new date</button>
            </form>
            <form action={respondSuggestedDate}>
              <input type="hidden" name="booking_id" value={b.id} />
              <input type="hidden" name="action" value="decline" />
              <button className="rounded-lg ring-1 ring-slate-300 px-4 py-2 text-sm font-semibold text-slate-600">Decline</button>
            </form>
          </div>
        </div>
      )}

      {canCancel && (
        <form action={cancelBooking}>
          <input type="hidden" name="booking_id" value={b.id} />
          <button className="rounded-lg ring-1 ring-red-300 px-4 py-2 text-sm font-semibold text-red-600">Cancel booking</button>
        </form>
      )}

      {b.status === 'completed' && (
        existingReview ? (
          <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200 text-sm">
            <p className="font-medium">Your review</p>
            <p className="mt-1"><span className="text-gold">★</span> {existingReview.rating}/5</p>
            {existingReview.comment && <p className="mt-1 text-slate-600">{existingReview.comment}</p>}
            <p className="mt-1 text-xs text-slate-400">
              Status: {existingReview.status === 'approved' ? 'Published' : existingReview.status === 'rejected' ? 'Not approved' : 'Awaiting approval'}
            </p>
          </div>
        ) : (
          <ReviewForm bookingId={b.id} />
        )
      )}

      <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
        <p className="text-sm font-medium text-slate-700">Need help?</p>
        <div className="mt-2 flex gap-2">
          <a href={`https://wa.me/${WHATSAPP}`} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-[#25D366] px-4 py-2 text-sm font-semibold text-white">WhatsApp us</a>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="rounded-lg ring-1 ring-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Email us</a>
        </div>
        <p className="mt-3 text-[11px] text-slate-400">All communication stays on MyMauritiusTrip.com.</p>
      </div>
    </main>
  );
}
