import { requireRole } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { BUCKETS } from '@/lib/storage/paths';
import {
  setPaymentStatus,
  setDocumentStatus,
  approveProvider,
  rejectProvider,
  suspendProvider,
} from '../actions';

export const dynamic = 'force-dynamic';

function Badge({ status }: { status: string }) {
  const tone =
    status === 'verified' || status === 'approved'
      ? 'bg-green-100 text-green-800'
      : status === 'rejected' || status === 'suspended'
      ? 'bg-red-100 text-red-800'
      : status === 'under_review'
      ? 'bg-blue-100 text-blue-800'
      : 'bg-slate-100 text-slate-700';
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${tone}`}>{status}</span>;
}

export default async function AdminVerificationDetail({
  params,
  searchParams,
}: {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  await requireRole('admin');
  const { businessId } = await params;
  const flash = await searchParams;
  const supabase = await createClient();

  const { data: b } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', businessId)
    .single();

  if (!b) {
    return <main className="mx-auto max-w-3xl px-6 py-12">Business not found.</main>;
  }

  const [{ data: payments }, { data: documents }] = await Promise.all([
    supabase
      .from('business_verification_payments')
      .select('id, amount_mur, method, status, proof_path, created_at')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false }),
    supabase
      .from('business_documents')
      .select('id, doc_type, status, storage_path, created_at')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false }),
  ]);

  // Signed URLs for the private files (60s). Admin-only read via storage RLS.
  const paymentLinks = await Promise.all(
    (payments ?? []).map(async (p) => {
      let url: string | null = null;
      if (p.proof_path) {
        const { data } = await supabase.storage
          .from(BUCKETS.paymentProofs)
          .createSignedUrl(p.proof_path, 60);
        url = data?.signedUrl ?? null;
      }
      return { ...p, url };
    }),
  );
  const documentLinks = await Promise.all(
    (documents ?? []).map(async (d) => {
      let url: string | null = null;
      if (d.storage_path) {
        const { data } = await supabase.storage
          .from(BUCKETS.businessDocuments)
          .createSignedUrl(d.storage_path, 60);
        url = data?.signedUrl ?? null;
      }
      return { ...d, url };
    }),
  );

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 space-y-8">
      <div className="flex items-center justify-between">
        <a href="/admin/verification" className="text-sm text-ocean">← Queue</a>
        <Badge status={b.status} />
      </div>

      {flash?.ok && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{flash.ok}</p>}
      {flash?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{flash.error}</p>}

      {/* Business details (admin-only view, includes private contact) */}
      <section className="rounded-xl ring-1 ring-slate-200 p-5">
        <h1 className="text-lg font-semibold">{b.business_name}</h1>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <dt className="text-slate-500">Owner</dt><dd>{b.owner_full_name}</dd>
          <dt className="text-slate-500">Email (private)</dt><dd>{b.email}</dd>
          <dt className="text-slate-500">WhatsApp (private)</dt><dd>{b.whatsapp}</dd>
          <dt className="text-slate-500">Phone (private)</dt><dd>{b.phone ?? '—'}</dd>
          <dt className="text-slate-500">BRN</dt><dd>{b.brn ?? '—'}</dd>
          <dt className="text-slate-500">Fee paid</dt><dd>{b.verification_paid ? 'Yes' : 'No'}</dd>
        </dl>
        {b.rejected_reason && (
          <p className="mt-3 text-sm text-red-600">Last rejection: {b.rejected_reason}</p>
        )}
      </section>

      {/* Payment proofs */}
      <section className="rounded-xl ring-1 ring-slate-200 p-5 space-y-3">
        <h2 className="font-medium">Rs 499 payment proof</h2>
        {paymentLinks.length === 0 && <p className="text-sm text-slate-500">No payment uploaded yet.</p>}
        {paymentLinks.map((p) => (
          <div key={p.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <div className="flex items-center gap-3">
              <Badge status={p.status} />
              <span>Rs {p.amount_mur} · {p.method ?? '—'}</span>
              {p.url && <a href={p.url} target="_blank" className="text-ocean">View proof</a>}
            </div>
            {p.status !== 'verified' && (
              <div className="flex gap-2">
                <form action={setPaymentStatus}>
                  <input type="hidden" name="business_id" value={businessId} />
                  <input type="hidden" name="payment_id" value={p.id} />
                  <input type="hidden" name="decision" value="verified" />
                  <button className="rounded bg-green-600 px-3 py-1 text-xs font-semibold text-white">Verify</button>
                </form>
                <form action={setPaymentStatus}>
                  <input type="hidden" name="business_id" value={businessId} />
                  <input type="hidden" name="payment_id" value={p.id} />
                  <input type="hidden" name="decision" value="rejected" />
                  <button className="rounded bg-red-600 px-3 py-1 text-xs font-semibold text-white">Reject</button>
                </form>
              </div>
            )}
          </div>
        ))}
      </section>

      {/* Documents */}
      <section className="rounded-xl ring-1 ring-slate-200 p-5 space-y-3">
        <h2 className="font-medium">Business documents</h2>
        {documentLinks.length === 0 && <p className="text-sm text-slate-500">No documents uploaded.</p>}
        {documentLinks.map((d) => (
          <div key={d.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <div className="flex items-center gap-3">
              <Badge status={d.status} />
              <span>{d.doc_type}</span>
              {d.url && <a href={d.url} target="_blank" className="text-ocean">View</a>}
            </div>
            {d.status !== 'approved' && (
              <div className="flex gap-2">
                <form action={setDocumentStatus}>
                  <input type="hidden" name="business_id" value={businessId} />
                  <input type="hidden" name="doc_id" value={d.id} />
                  <input type="hidden" name="decision" value="approved" />
                  <button className="rounded bg-green-600 px-3 py-1 text-xs font-semibold text-white">Approve</button>
                </form>
                <form action={setDocumentStatus}>
                  <input type="hidden" name="business_id" value={businessId} />
                  <input type="hidden" name="doc_id" value={d.id} />
                  <input type="hidden" name="decision" value="rejected" />
                  <button className="rounded bg-red-600 px-3 py-1 text-xs font-semibold text-white">Reject</button>
                </form>
              </div>
            )}
          </div>
        ))}
      </section>

      {/* Decision */}
      <section className="rounded-xl ring-1 ring-slate-200 p-5 space-y-4">
        <h2 className="font-medium">Decision</h2>
        <p className="text-xs text-slate-500">
          Approving requires a verified Rs 499 payment. Approval sets the business to verified
          and unlocks listing creation (max 7).
        </p>

        <form action={approveProvider}>
          <input type="hidden" name="business_id" value={businessId} />
          <button className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white">
            Approve provider
          </button>
        </form>

        <form action={rejectProvider} className="space-y-2">
          <input type="hidden" name="business_id" value={businessId} />
          <textarea
            name="reason"
            placeholder="Reason for rejection (shown to the provider)"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            rows={2}
          />
          <button className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white">
            Reject with reason
          </button>
        </form>

        <form action={suspendProvider} className="space-y-2">
          <input type="hidden" name="business_id" value={businessId} />
          <input
            name="reason"
            placeholder="Suspension note (optional)"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button className="rounded-lg ring-1 ring-red-300 text-red-700 px-4 py-2 text-sm font-semibold">
            Suspend provider
          </button>
        </form>
      </section>
    </main>
  );
}
