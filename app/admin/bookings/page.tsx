import Link from 'next/link';
import { requireRole } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { LogoutButton } from '@/components/LogoutButton';
import { statusBadge, statusLabel } from '@/lib/bookings/status';
import { formatMUR } from '@/components/public/ui';

export const dynamic = 'force-dynamic';

export default async function AdminBookings() {
  await requireRole('admin');
  const supabase = await createClient();

  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, reference, status, arrival_date, display_amount, listing:listings(title), business:businesses(business_name)')
    .order('created_at', { ascending: false })
    .limit(100);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Bookings</h1>
        <LogoutButton />
      </div>

      {(!bookings || bookings.length === 0) && <p className="text-sm text-slate-500">No bookings yet.</p>}

      {bookings?.map((bk) => {
        const b = bk as Record<string, unknown>;
        const listing = (b as unknown as { listing?: { title: string } }).listing;
        const business = (b as unknown as { business?: { business_name: string } }).business;
        return (
          <Link key={b.id as string} href={`/admin/bookings/${b.id}`} className="block rounded-xl bg-white p-4 ring-1 ring-slate-200 hover:bg-slate-50">
            <div className="flex items-center justify-between">
              <span className="font-medium">{listing?.title ?? 'Listing'}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs ${statusBadge(b.status as string)}`}>{statusLabel(b.status as string)}</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Ref {String(b.reference)} · {business?.business_name ?? '—'} · {String(b.arrival_date ?? 'TBC')} · {formatMUR(Number(b.display_amount))}
            </p>
          </Link>
        );
      })}
    </main>
  );
}
