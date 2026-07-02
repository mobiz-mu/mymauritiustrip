'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  uploadPaymentProof,
  uploadDocument,
  submitVerification,
  uploadContract,
  type Result,
} from './actions';

type Business = {
  id: string;
  business_name: string;
  status: string;
  verification_paid: boolean;
  rejected_reason: string | null;
} | null;

type Payment = { id: string; amount_mur: number; method: string | null; status: string; created_at: string };
type Doc = { id: string; doc_type: string; status: string; created_at: string };
type Contract = { id: string; status: string; admin_note: string | null; original_filename: string | null; uploaded_at: string } | null;

const STATUS: Record<string, { label: string; tone: string }> = {
  pending_verification: { label: 'Pending verification', tone: 'bg-slate-100 text-slate-700' },
  payment_pending: { label: 'Payment pending', tone: 'bg-amber-100 text-amber-800' },
  under_review: { label: 'Under review', tone: 'bg-blue-100 text-blue-800' },
  verified: { label: 'Verified', tone: 'bg-green-100 text-green-800' },
  rejected: { label: 'Rejected', tone: 'bg-red-100 text-red-800' },
  suspended: { label: 'Suspended', tone: 'bg-red-100 text-red-800' },
  pending: { label: 'Pending review', tone: 'bg-amber-100 text-amber-800' },
  approved: { label: 'Approved', tone: 'bg-green-100 text-green-800' },
};

function Badge({ status }: { status: string }) {
  const s = STATUS[status] ?? { label: status, tone: 'bg-slate-100 text-slate-700' };
  return <span className={`rounded-full px-3 py-1 text-xs font-medium ${s.tone}`}>{s.label}</span>;
}

function SubmitBtn({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className="rounded-lg bg-ocean px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
    >
      {pending ? 'Working…' : label}
    </button>
  );
}

function Note({ state }: { state: { error?: string; success?: string } | null }) {
  if (!state) return null;
  if (state.error) return <p className="text-sm text-red-600">{state.error}</p>;
  if (state.success) return <p className="text-sm text-green-600">{state.success}</p>;
  return null;
}

export default function VerificationClient({
  business,
  payments,
  documents,
  contract,
}: {
  business: Business;
  payments: Payment[];
  documents: Doc[];
  contract: Contract;
}) {
  const [proofState, proofAction] = useActionState<Result | null, FormData>(uploadPaymentProof, null);
  const [docState, docAction] = useActionState<Result | null, FormData>(uploadDocument, null);
  const [submitState, submitAction] = useActionState<Result | null, FormData>(submitVerification, null);
  const [contractState, contractAction] = useActionState<Result | null, FormData>(uploadContract, null);

  if (!business) {
    return <main className="mx-auto max-w-2xl px-6 py-12">No business found for your account.</main>;
  }

  const verified = business.status === 'verified';
  const hasPaymentProof = payments.length > 0;
  const canSubmit = !verified && hasPaymentProof && business.status !== 'under_review';

  return (
    <main className="mx-auto max-w-2xl px-6 py-12 space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Business verification</h1>
          <p className="text-sm text-slate-500">{business.business_name}</p>
        </div>
        <Badge status={business.status} />
      </header>

      {verified && (
        <div className="rounded-xl bg-green-50 p-5 text-sm text-green-800">
          Your business is verified. You can now create up to 7 listings.
        </div>
      )}

      {business.status === 'rejected' && business.rejected_reason && (
        <div className="rounded-xl bg-red-50 p-5 text-sm text-red-800">
          <p className="font-medium">Your verification was rejected.</p>
          <p className="mt-1">Reason: {business.rejected_reason}</p>
          <p className="mt-1">You can update your proof/documents below and submit again.</p>
        </div>
      )}

      {business.status === 'under_review' && (
        <div className="rounded-xl bg-blue-50 p-5 text-sm text-blue-800">
          Your request is under review. We'll update your status here once an admin has checked it.
        </div>
      )}

      {/* Fee + payment proof */}
      <section className="rounded-xl ring-1 ring-slate-200 p-5 space-y-4">
        <div>
          <h2 className="font-medium">Step 1 — Rs 499 one-time verification fee</h2>
          <p className="text-sm text-slate-500">
            Pay the one-time Rs 499 verification/posting fee by bank transfer or MCB Juice,
            then upload your payment proof. Listing creation unlocks only after admin approval.
          </p>
        </div>

        {payments.length > 0 && (
          <ul className="text-sm text-slate-600 space-y-1">
            {payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <span>Rs {p.amount_mur} · {p.method ?? '—'}</span>
                <Badge status={p.status} />
              </li>
            ))}
          </ul>
        )}

        {!verified && (
          <form action={proofAction} className="space-y-3">
            <select name="method" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="bank_transfer">Bank transfer</option>
              <option value="mcb_juice">MCB Juice</option>
            </select>
            <input type="file" name="file" accept="image/*,application/pdf" className="block text-sm" />
            <Note state={proofState} />
            <SubmitBtn label="Upload payment proof" />
          </form>
        )}
      </section>

      {/* Documents */}
      <section className="rounded-xl ring-1 ring-slate-200 p-5 space-y-4">
        <div>
          <h2 className="font-medium">Step 2 — Business documents (optional but recommended)</h2>
          <p className="text-sm text-slate-500">
            Upload your BRN certificate, ID, or licence. Documents are private and reviewed by admin.
          </p>
        </div>

        {documents.length > 0 && (
          <ul className="text-sm text-slate-600 space-y-1">
            {documents.map((d) => (
              <li key={d.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <span>{d.doc_type}</span>
                <Badge status={d.status} />
              </li>
            ))}
          </ul>
        )}

        {!verified && (
          <form action={docAction} className="space-y-3">
            <select name="doc_type" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="brn">BRN / registration certificate</option>
              <option value="id">ID document</option>
              <option value="license">Licence</option>
              <option value="vehicle_registration">Vehicle registration</option>
              <option value="insurance">Insurance</option>
              <option value="taxi_permit">Taxi / operator permit</option>
              <option value="driver_licence">Driver licence</option>
              <option value="transport_licence">Transport licence</option>
              <option value="vehicle_photo">Vehicle photo</option>
              <option value="other">Other</option>
            </select>
            <input type="file" name="file" accept="image/*,application/pdf" className="block text-sm" />
            <Note state={docState} />
            <SubmitBtn label="Upload document" />
          </form>
        )}
      </section>

      {/* Contract agreement */}
      <section className="rounded-xl ring-1 ring-slate-200 p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-medium">Signed contract agreement (PDF)</h2>
          {contract && <Badge status={contract.status} />}
        </div>
        <p className="text-sm text-slate-500">
          Download the MyMauritiusTrip provider agreement, sign it, and upload the signed copy as a PDF.
          Your contract is private — only you and admin can access it.
        </p>

        {contract ? (
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
            <p className="flex items-center justify-between gap-3">
              <span className="truncate">{contract.original_filename ?? 'contract.pdf'}</span>
              <span className="shrink-0 text-xs text-slate-400">{new Date(contract.uploaded_at).toLocaleDateString('en-GB')}</span>
            </p>
            {contract.status === 'approved' && <p className="mt-1 text-green-700">Your contract has been approved.</p>}
            {contract.status === 'pending' && <p className="mt-1 text-amber-700">Uploaded — pending admin review.</p>}
            {contract.status === 'rejected' && (
              <p className="mt-1 text-red-700">Rejected{contract.admin_note ? `: ${contract.admin_note}` : ''}. Please re-upload a corrected signed PDF.</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-amber-700">No contract uploaded yet.</p>
        )}

        {contract?.status !== 'approved' && (
          <form action={contractAction} className="space-y-3">
            <input type="file" name="file" accept="application/pdf" className="block text-sm" />
            <Note state={contractState} />
            <SubmitBtn label={contract ? 'Re-upload signed contract' : 'Upload signed contract'} />
          </form>
        )}
      </section>

      {/* Submit */}
      {!verified && (
        <section className="rounded-xl ring-1 ring-slate-200 p-5 space-y-3">
          <h2 className="font-medium">Step 3 — Submit for review</h2>
          <p className="text-sm text-slate-500">
            Once your payment proof is uploaded, submit your request. An admin will verify your
            payment and documents before approving your business.
          </p>
          <form action={submitAction}>
            <Note state={submitState} />
            <button
              disabled={!canSubmit}
              className="rounded-lg bg-ocean px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {business.status === 'rejected' ? 'Resubmit for review' : 'Submit for review'}
            </button>
            {!hasPaymentProof && (
              <p className="mt-2 text-xs text-slate-400">Upload a payment proof first to enable this.</p>
            )}
          </form>
        </section>
      )}

      <p className="text-xs text-slate-400">
        Need help? WhatsApp +230 5506 8119 or email info@mymauritiustrip.com.
      </p>
    </main>
  );
}
