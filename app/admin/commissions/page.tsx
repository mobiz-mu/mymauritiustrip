import Link from 'next/link';
import { requireRole } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { LogoutButton } from '@/components/LogoutButton';
import { invoiceBadge, invoiceLabel } from '@/lib/commissions/status';
import { formatMUR } from '@/components/public/ui';
import { refreshOverdue } from './actions';

export const dynamic = 'force-dynamic';

const FILTERS = ['all', 'pending', 'submitted', 'overdue', 'paid', 'disputed'];

export default async function AdminCommissions({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; swept?: string; error?: string }>;
}) {
  await requireRole('admin');
  const sp = await searchParams;
  const filter = sp.status && FILTERS.includes(sp.status) ? sp.status : 'all';
  const supabase = await createClient();

  let q = supabase
    .from('commission_invoices')
    .select('id, commission_amount_mur, due_date, status, booking:bookings(reference), business:businesses(business_name)')
    .order('created_at', { ascending: false })
    .limit(200);
  if (filter !== 'all') q = q.eq('status', filter);

  const { data: invoices } = await q;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Commission invoices</h1>
        <LogoutButton />
      </div>

      {sp.swept !== undefined && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{sp.swept} invoice(s) marked overdue.</p>}
      {sp.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{sp.error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={`/admin/commissions?status=${f}`}
            className={`rounded-full px-3 py-1 text-xs font-medium ${filter === f ? 'bg-ocean text-white' : 'bg-slate-100 text-slate-600'}`}
          >
            {f}
          </Link>
        ))}
        <form action={refreshOverdue} className="ml-auto">
          <button className="rounded-lg ring-1 ring-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700">Mark overdue now</button>
        </form>
      </div>

      {(!invoices || invoices.length === 0) && <p className="text-sm text-slate-500">No invoices for this filter.</p>}

      {invoices?.map((iv) => {
        const i = iv as Record<string, unknown>;
        const booking = (i as unknown as { booking?: { reference: string } }).booking;
        const business = (i as unknown as { business?: { business_name: string } }).business;
        const overdue = i.status === 'pending' && new Date(i.due_date as string).getTime() < Date.now();
        return (
          <Link key={i.id as string} href={`/admin/commissions/${i.id}`} className="block rounded-xl bg-white p-4 ring-1 ring-slate-200 hover:bg-slate-50">
            <div className="flex items-center justify-between">
              <span className="font-medium">{business?.business_name ?? '—'}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs ${invoiceBadge(i.status as string, overdue)}`}>{invoiceLabel(i.status as string, overdue)}</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Booking {booking?.reference ?? '—'} · {formatMUR(Number(i.commission_amount_mur))} · due {String(i.due_date)}
            </p>
          </Link>
        );
      })}
    </main>
  );
}
