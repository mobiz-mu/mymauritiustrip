import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireRole } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { statusBadge, statusLabel } from '@/lib/bookings/status';
import { formatMUR } from '@/components/public/ui';
import { setBookingStatus } from '../actions';

export const dynamic = 'force-dynamic';

const STATUSES = ['pending', 'confirmed', 'date_suggested', 'provider_rejected', 'client_arrived', 'completed', 'cancelled'];

export default async function AdminBookingDetail({
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

  const { data: b } = await supabase
    .from('bookings')
    .select('*, listing:listings(title, slug), business:businesses(business_name, email, status)')
    .eq('id', id)
    .single();
  if (!b) notFound();

  const listing = (b as unknown as { listing?: { title: string; slug: string } }).listing;
  const business = (b as unknown as { business?: { business_name: string; email: string; status: string } }).business;

  let invoice: { id: string; commission_amount_mur: number; status: string; due_date: string } | null = null;
  if (b.commission_invoice_id) {
    const { data: inv } = await supabase
      .from('commission_invoices')
      .select('id, commission_amount_mur, status, due_date')
      .eq('id', b.commission_invoice_id)
      .single();
    invoice = inv ?? null;
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12 space-y-5">
      <Link href="/admin/bookings" className="text-sm text-ocean">← Bookings</Link>

      {flash?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{flash.error}</p>}
      {flash?.ok && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">Updated.</p>}

      <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200 space-y-2">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">{listing?.title ?? 'Listing'}</h1>
          <span className={`rounded-full px-2.5 py-0.5 text-xs ${statusBadge(b.status)}`}>{statusLabel(b.status)}</span>
        </div>
        <p className="text-xs text-slate-500">Reference {b.reference}</p>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 pt-2 text-sm">
          <dt className="text-slate-500">Guest</dt><dd>{b.full_name}</dd>
          <dt className="text-slate-500">Client email</dt><dd>{b.email}</dd>
          <dt className="text-slate-500">Client WhatsApp</dt><dd>{b.whatsapp ?? '—'}</dd>
          <dt className="text-slate-500">Date</dt><dd>{b.arrival_date ?? 'TBC'}</dd>
          <dt className="text-slate-500">Guests</dt><dd>{b.num_people ?? 1}</dd>
          <dt className="text-slate-500">Amount</dt><dd>{formatMUR(Number(b.base_amount_mur))} MUR</dd>
          <dt className="text-slate-500">Provider</dt><dd>{business?.business_name} ({business?.status})</dd>
        </dl>
        {b.special_request && <p className="pt-1 text-sm text-slate-600">“{b.special_request}”</p>}
        {b.provider_note && <p className="text-xs text-slate-500">Provider note: {b.provider_note}</p>}
      </div>

      {invoice && (
        <div className="rounded-2xl bg-amber-50 p-4 text-sm ring-1 ring-amber-200">
          Commission invoice: {formatMUR(Number(invoice.commission_amount_mur))} · {invoice.status} · due {invoice.due_date}
        </div>
      )}

      <form action={setBookingStatus} className="rounded-2xl bg-white p-5 ring-1 ring-slate-200 space-y-3">
        <input type="hidden" name="booking_id" value={b.id} />
        <p className="text-sm font-medium">Override status</p>
        <select name="status" defaultValue={b.status} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
          {STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
        </select>
        <input name="note" placeholder="Internal note (optional)" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <button className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white">Apply</button>
      </form>
    </main>
  );
}
