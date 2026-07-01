import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireRole } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { statusBadge, statusLabel } from '@/lib/bookings/status';
import { formatMUR } from '@/components/public/ui';
import { respondBooking } from '../actions';

export const dynamic = 'force-dynamic';

export default async function ProviderBookingDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  await requireRole('provider');
  const { id } = await params;
  const flash = await searchParams;
  const supabase = await createClient();

  const { data: b } = await supabase.from('provider_bookings_safe').select('*').eq('id', id).single();
  if (!b) notFound();

  return (
    <main className="mx-auto max-w-2xl px-6 py-12 space-y-5">
      <Link href="/provider/bookings" className="text-sm text-ocean">← Booking requests</Link>

      {flash?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{flash.error}</p>}
      {flash?.ok && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">Updated.</p>}

      <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200 space-y-2">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">{b.listing_title ?? 'Listing'}</h1>
          <span className={`rounded-full px-2.5 py-0.5 text-xs ${statusBadge(b.status)}`}>{statusLabel(b.status)}</span>
        </div>
        <p className="text-xs text-slate-500">Reference {b.reference}</p>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 pt-2 text-sm">
          <dt className="text-slate-500">Guest</dt><dd>{b.full_name}</dd>
          <dt className="text-slate-500">Date</dt><dd>{b.arrival_date ?? 'TBC'}</dd>
          <dt className="text-slate-500">Guests</dt><dd>{b.num_people ?? 1}</dd>
          <dt className="text-slate-500">Amount</dt><dd>{formatMUR(Number(b.base_amount_mur))} (pay on arrival)</dd>
        </dl>
        {b.special_request && <p className="pt-1 text-sm text-slate-600">“{b.special_request}”</p>}
      </div>

      {b.status === 'pending' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <form action={respondBooking}>
              <input type="hidden" name="booking_id" value={b.id} />
              <input type="hidden" name="action" value="accept" />
              <button className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white">Accept</button>
            </form>
            <form action={respondBooking} className="flex items-center gap-2">
              <input type="hidden" name="booking_id" value={b.id} />
              <input type="hidden" name="action" value="reject" />
              <input name="note" placeholder="Reason (optional)" className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
              <button className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white">Reject</button>
            </form>
          </div>

          <form action={respondBooking} className="flex flex-wrap items-end gap-2 rounded-xl bg-slate-50 p-3">
            <input type="hidden" name="booking_id" value={b.id} />
            <input type="hidden" name="action" value="suggest_date" />
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">Suggest another date</span>
              <input name="suggested_date" type="date" required className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
            </label>
            <input name="note" placeholder="Note (optional)" className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
            <button className="rounded-lg bg-ocean px-4 py-2 text-sm font-semibold text-white">Suggest date</button>
          </form>
        </div>
      )}

      {b.status === 'date_suggested' && (
        <p className="rounded-xl bg-blue-50 px-3 py-2 text-sm text-blue-800">
          Suggested {b.suggested_date}. Waiting for the guest to accept or decline.
        </p>
      )}

      {b.status === 'confirmed' && (
        <form action={respondBooking}>
          <input type="hidden" name="booking_id" value={b.id} />
          <input type="hidden" name="action" value="arrived" />
          <button className="rounded-lg bg-turquoise px-4 py-2 text-sm font-semibold text-white">Mark guest arrived</button>
        </form>
      )}

      {b.status === 'client_arrived' && (
        <form action={respondBooking}>
          <input type="hidden" name="booking_id" value={b.id} />
          <input type="hidden" name="action" value="completed" />
          <button className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white">Mark completed</button>
        </form>
      )}

      {['client_arrived', 'completed'].includes(b.status) && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
          A 15% commission invoice has been generated for this booking and is payable within 15 days.
        </p>
      )}
    </main>
  );
}
