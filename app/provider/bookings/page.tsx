import Link from 'next/link';
import { requireRole } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { statusBadge, statusLabel } from '@/lib/bookings/status';
import { formatMUR } from '@/components/public/ui';

export const dynamic = 'force-dynamic';

export default async function ProviderBookings() {
  await requireRole('provider');
  const supabase = await createClient();

  // Provider-safe view: scoped to the caller's business, no client contact columns.
  const { data: bookings } = await supabase
    .from('provider_bookings_safe')
    .select('id, reference, status, arrival_date, num_people, full_name, display_amount, listing_title')
    .order('created_at', { ascending: false });

  const order = (s: string) => (s === 'pending' ? 0 : s === 'date_suggested' ? 1 : 2);
  const sorted = [...(bookings ?? [])].sort((a, b) => order((a as { status: string }).status) - order((b as { status: string }).status));

  return (
    <main className="mx-auto max-w-2xl px-6 py-12 space-y-4">
      <h1 className="text-xl font-semibold">Booking requests</h1>

      {sorted.length === 0 && (
        <p className="rounded-xl bg-white p-6 text-center text-sm text-slate-500 ring-1 ring-slate-200">No booking requests yet.</p>
      )}

      {sorted.map((bk) => {
        const b = bk as Record<string, unknown>;
        const firstName = String(b.full_name ?? '').split(' ')[0] || 'Guest';
        return (
          <Link key={b.id as string} href={`/provider/bookings/${b.id}`} className="block rounded-xl bg-white p-4 ring-1 ring-slate-200 hover:shadow">
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-900">{String(b.listing_title ?? 'Listing')}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs ${statusBadge(b.status as string)}`}>{statusLabel(b.status as string)}</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Ref {String(b.reference)} · {firstName} · {String(b.arrival_date ?? 'date TBC')} · {String(b.num_people ?? 1)} guest(s) · {formatMUR(Number(b.display_amount))}
            </p>
          </Link>
        );
      })}
    </main>
  );
}
