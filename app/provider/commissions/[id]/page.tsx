import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireRole } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { BUCKETS } from '@/lib/storage/paths';
import { invoiceBadge, invoiceLabel } from '@/lib/commissions/status';
import { formatMUR } from '@/components/public/ui';
import { WHATSAPP, SUPPORT_EMAIL } from '@/components/public/PublicHeader';
import { uploadCommissionProof } from '../actions';

export const dynamic = 'force-dynamic';

export default async function ProviderCommissionDetail({
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

  const { data: ci } = await supabase.from('provider_commissions_safe').select('*').eq('id', id).single();
  if (!ci) notFound();

  // Provider may view their own submitted proof via a short-lived signed URL.
  let proofUrl: string | null = null;
  if (ci.proof_path) {
    const { data: signed } = await supabase.storage.from(BUCKETS.commissionProofs).createSignedUrl(ci.proof_path, 60);
    proofUrl = signed?.signedUrl ?? null;
  }

  const isPaid = ci.status === 'paid';
  const dueSoon = !isPaid && !ci.is_overdue && new Date(ci.due_date).getTime() - Date.now() < 5 * 86400000;
  const canUpload = ['pending', 'overdue', 'submitted'].includes(ci.status);

  return (
    <main className="mx-auto max-w-2xl px-6 py-12 space-y-5">
      <Link href="/provider/commissions" className="text-sm text-ocean">← Commission invoices</Link>

      {flash?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{flash.error}</p>}
      {flash?.ok && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{flash.ok}</p>}

      {ci.is_overdue && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">This commission is overdue. Please pay and upload proof as soon as possible.</p>
      )}
      {dueSoon && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">This commission is due soon ({ci.due_date}).</p>
      )}

      <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200 space-y-2">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">{ci.listing_title}</h1>
          <span className={`rounded-full px-2.5 py-0.5 text-xs ${invoiceBadge(ci.status, ci.is_overdue)}`}>{invoiceLabel(ci.status, ci.is_overdue)}</span>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 pt-2 text-sm">
          <dt className="text-slate-500">Booking</dt><dd>{ci.booking_reference}</dd>
          <dt className="text-slate-500">Booking total</dt><dd>{formatMUR(Number(ci.booking_total_mur))}</dd>
          <dt className="text-slate-500">Commission</dt><dd>{ci.commission_percent}%</dd>
          <dt className="text-slate-500">Amount due</dt><dd className="font-semibold">{formatMUR(Number(ci.commission_amount_mur))}</dd>
          <dt className="text-slate-500">Due date</dt><dd>{ci.due_date}</dd>
          {isPaid && <><dt className="text-slate-500">Paid at</dt><dd>{ci.paid_at ? new Date(ci.paid_at).toLocaleDateString() : '—'}</dd></>}
        </dl>
      </div>

      {!isPaid && (
        <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200 space-y-2">
          <h2 className="font-medium">How to pay</h2>
          <p className="text-sm text-slate-600">
            Settle your 15% commission within 15 days of the guest's arrival, then upload your payment proof
            below. Payment details are provided by the MyMauritiusTrip team — contact us to confirm the
            current method.
          </p>
          <div className="flex gap-2 pt-1">
            <a href={`https://wa.me/${WHATSAPP}`} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-[#25D366] px-3 py-1.5 text-sm font-semibold text-white">WhatsApp</a>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="rounded-lg ring-1 ring-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700">Email</a>
          </div>
        </div>
      )}

      {proofUrl && (
        <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200 text-sm">
          {ci.status === 'submitted' ? 'Proof submitted — under review.' : 'Proof on file.'}{' '}
          <a href={proofUrl} target="_blank" rel="noopener noreferrer" className="text-ocean underline">View submitted proof</a>
        </div>
      )}

      {canUpload && (
        <form action={uploadCommissionProof} className="rounded-2xl bg-white p-5 ring-1 ring-slate-200 space-y-3">
          <input type="hidden" name="invoice_id" value={ci.id} />
          <p className="text-sm font-medium">{ci.proof_path ? 'Replace payment proof' : 'Upload payment proof'}</p>
          <input type="file" name="file" accept="image/jpeg,image/png,image/webp,application/pdf" required className="block text-sm" />
          <p className="text-xs text-slate-400">JPG, PNG, WEBP or PDF, up to 10 MB. Your proof is private — only you and admin can see it.</p>
          <button className="rounded-lg bg-ocean px-4 py-2 text-sm font-semibold text-white">Submit proof</button>
        </form>
      )}
    </main>
  );
}
