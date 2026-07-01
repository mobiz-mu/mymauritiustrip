import Link from 'next/link';
import { requireRole } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { invoiceBadge, invoiceLabel } from '@/lib/commissions/status';
import { formatMUR } from '@/components/public/ui';

export const dynamic = 'force-dynamic';

export default async function ProviderCommissions() {
  await requireRole('provider');
  const supabase = await createClient();

  const { data: invoices } = await supabase
    .from('provider_commissions_safe')
    .select('id, booking_reference, listing_title, commission_amount_mur, due_date, status, is_overdue, paid_at')
    .order('created_at', { ascending: false });

  const outstanding = (invoices ?? []).filter((i) => i.status !== 'paid' && i.status !== 'cancelled');
  const totalDue = outstanding.reduce((s, i) => s + Number(i.commission_amount_mur), 0);

  return (
    <main className="mx-auto max-w-2xl px-6 py-12 space-y-4">
      <h1 className="text-xl font-semibold">Commission invoices</h1>
      <div className="rounded-xl bg-white p-4 text-sm ring-1 ring-slate-200">
        Outstanding: <span className="font-bold">{formatMUR(totalDue)}</span> across {outstanding.length} invoice(s).
        <p className="mt-1 text-xs text-slate-500">15% commission per confirmed booking, payable within 15 days of the guest's arrival.</p>
      </div>

      {(!invoices || invoices.length === 0) && (
        <p className="rounded-xl bg-white p-6 text-center text-sm text-slate-500 ring-1 ring-slate-200">No commission invoices yet.</p>
      )}

      {invoices?.map((i) => (
        <Link key={i.id} href={`/provider/commissions/${i.id}`} className="block rounded-xl bg-white p-4 ring-1 ring-slate-200 hover:shadow">
          <div className="flex items-center justify-between">
            <span className="font-medium text-slate-900">{i.listing_title}</span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs ${invoiceBadge(i.status, i.is_overdue)}`}>{invoiceLabel(i.status, i.is_overdue)}</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Booking {i.booking_reference} · {formatMUR(Number(i.commission_amount_mur))} · due {i.due_date}
          </p>
        </Link>
      ))}
    </main>
  );
}
