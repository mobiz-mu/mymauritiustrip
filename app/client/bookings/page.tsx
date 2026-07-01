import Link from 'next/link';
import { requireRole } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { statusBadge, statusLabel } from '@/lib/bookings/status';
import { formatMUR } from '@/components/public/ui';

export const dynamic = 'force-dynamic';

export default async function ClientBookings() {
  await requireRole('client');
  const supabase = await createClient();

  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, reference, status, arrival_date, num_people, display_amount, display_currency, listing:listings(title, slug)')
    .order('created_at', { ascending: false });

  return (
    <main className="mx-auto max-w-2xl px-6 py-12 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">My bookings</h1>
        <Link href="/search" className="text-sm text-ocean">Browse listings →</Link>
      </div>

      {(!bookings || bookings.length === 0) && (
        <p className="rounded-xl bg-white p-6 text-center text-sm text-slate-500 ring-1 ring-slate-200">
          No bookings yet. <Link href="/search" className="text-ocean">Find something to do →</Link>
        </p>
      )}

      {bookings?.map((b) => {
        const listing = (b as unknown as { listing?: { title: string; slug: string } }).listing;
        return (
          <Link key={b.id} href={`/client/bookings/${b.id}`} className="block rounded-xl bg-white p-4 ring-1 ring-slate-200 hover:shadow">
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-900">{listing?.title ?? 'Listing'}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs ${statusBadge(b.status)}`}>{statusLabel(b.status)}</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Ref {b.reference} · {b.arrival_date ?? 'date TBC'} · {b.num_people ?? 1} guest(s) · {formatMUR(Number(b.display_amount))}
            </p>
          </Link>
        );
      })}
    </main>
  );
}
