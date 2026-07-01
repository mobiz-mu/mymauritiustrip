import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireRole } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { BUCKETS } from '@/lib/storage/paths';
import { invoiceBadge, invoiceLabel } from '@/lib/commissions/status';
import { formatMUR } from '@/components/public/ui';
import { setCommissionStatus } from '../actions';

export const dynamic = 'force-dynamic';

export default async function AdminCommissionDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  await requireRole('admin');
  const { id } = await params;
  const flash = await searchParams;
  const supabase = await createClient();

  const { data: ci } = await supabase
    .from('commission_invoices')
    .select('*, booking:bookings(reference, full_name, arrival_date, num_people, status), business:businesses(business_name, email, status)')
    .eq('id', id)
    .single();
  if (!ci) notFound();

  const booking = (ci as unknown as { booking?: { reference: string; full_name: string; arrival_date: string; num_people: number; status: string } }).booking;
  const business = (ci as unknown as { business?: { business_name: string; email: string; status: string } }).business;
  const overdue = ci.status === 'pending' && new Date(ci.due_date).getTime() < Date.now();

  let proofUrl: string | null = null;
  if (ci.proof_path) {
    const { data: signed } = await supabase.storage.from(BUCKETS.commissionProofs).createSignedUrl(ci.proof_path, 60);
    proofUrl = signed?.signedUrl ?? null;
  }

  const StatusButton = ({ status, label, cls }: { status: string; label: string; cls: string }) => (
    <form action={setCommissionStatus}>
      <input type="hidden" name="invoice_id" value={ci.id} />
      <input type="hidden" name="status" value={status} />
      <button className={`rounded-lg px-3 py-1.5 text-sm font-semibold text-white ${cls}`}>{label}</button>
    </form>
  );

  return (
    <main className="mx-auto max-w-2xl px-6 py-12 space-y-5">
      <Link href="/admin/commissions" className="text-sm text-ocean">← Commissions</Link>

      {flash?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{flash.error}</p>}
      {flash?.ok && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">Updated.</p>}

      <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200 space-y-2">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">{business?.business_name ?? 'Provider'}</h1>
          <span className={`rounded-full px-2.5 py-0.5 text-xs ${invoiceBadge(ci.status, overdue)}`}>{invoiceLabel(ci.status, overdue)}</span>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 pt-2 text-sm">
          <dt className="text-slate-500">Provider email</dt><dd>{business?.email}</dd>
          <dt className="text-slate-500">Business status</dt><dd>{business?.status}</dd>
          <dt className="text-slate-500">Booking</dt><dd>{booking?.reference} ({booking?.status})</dd>
          <dt className="text-slate-500">Guest</dt><dd>{booking?.full_name}</dd>
          <dt className="text-slate-500">Arrival</dt><dd>{booking?.arrival_date ?? '—'}</dd>
          <dt className="text-slate-500">Booking total</dt><dd>{formatMUR(Number(ci.booking_total_mur))}</dd>
          <dt className="text-slate-500">Commission</dt><dd>{ci.commission_percent}% = {formatMUR(Number(ci.commission_amount_mur))}</dd>
          <dt className="text-slate-500">Due date</dt><dd>{ci.due_date}</dd>
          {ci.paid_at && <><dt className="text-slate-500">Paid at</dt><dd>{new Date(ci.paid_at).toLocaleString()}</dd></>}
        </dl>
      </div>

      <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200 text-sm">
        <p className="font-medium">Payment proof</p>
        {proofUrl ? (
          <a href={proofUrl} target="_blank" rel="noopener noreferrer" className="text-ocean underline">View proof (signed link, expires in 60s)</a>
        ) : (
          <p className="text-slate-400">No proof uploaded yet.</p>
        )}
      </div>

      <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200 space-y-3">
        <p className="text-sm font-medium">Actions</p>
        <div className="flex flex-wrap gap-2">
          <StatusButton status="paid" label="Mark paid" cls="bg-green-600" />
          <StatusButton status="disputed" label="Mark disputed" cls="bg-red-600" />
          <StatusButton status="cancelled" label="Cancel" cls="bg-slate-600" />
        </div>
        <form action={setCommissionStatus} className="space-y-2 border-t border-slate-100 pt-3">
          <input type="hidden" name="invoice_id" value={ci.id} />
          <input type="hidden" name="status" value="pending" />
          <p className="text-xs text-slate-500">Reject proof (returns invoice to “Awaiting payment” so the provider can re-upload):</p>
          <input name="note" placeholder="Reason for rejection" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <button className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white">Reject proof</button>
        </form>
      </div>
    </main>
  );
}
