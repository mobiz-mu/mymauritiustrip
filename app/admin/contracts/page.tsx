import { requireRole } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { LogoutButton } from '@/components/LogoutButton';
import { reviewContract } from './actions';

export const dynamic = 'force-dynamic';

const TONE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

type Row = {
  id: string;
  status: string;
  admin_note: string | null;
  original_filename: string | null;
  uploaded_at: string;
  business: { business_name: string } | null;
};

export default async function AdminContractsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  await requireRole('admin');
  const sp = await searchParams;
  const supabase = await createClient();

  const { data } = await supabase
    .from('provider_contracts')
    .select('id, status, admin_note, original_filename, uploaded_at, business:businesses(business_name)')
    .order('uploaded_at', { ascending: false });
  const rows = (data as Row[] | null) ?? [];
  const pending = rows.filter((r) => r.status === 'pending');
  const others = rows.filter((r) => r.status !== 'pending');

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ocean">Admin</p>
          <h1 className="font-serif text-2xl tracking-tight text-slate-900">Provider contracts</h1>
        </div>
        <LogoutButton />
      </div>

      {sp.ok && <p className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{sp.ok}</p>}
      {sp.error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{sp.error}</p>}

      <h2 className="mb-2 text-sm font-semibold text-slate-700">Pending review ({pending.length})</h2>
      {pending.length === 0 ? (
        <p className="mb-8 text-sm text-slate-400">No contracts awaiting review.</p>
      ) : (
        <ul className="mb-8 space-y-3">
          {pending.map((r) => (
            <li key={r.id} className="rounded-xl ring-1 ring-slate-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="truncate font-medium text-slate-800">{r.business?.business_name ?? 'Business'}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE[r.status]}`}>{r.status}</span>
              </div>
              <p className="mt-1 text-xs text-slate-400">{r.original_filename ?? 'contract.pdf'} · {new Date(r.uploaded_at).toLocaleDateString('en-GB')}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <a href={`/admin/contracts/${r.id}/download`} className="rounded-lg bg-ocean px-3 py-1.5 text-xs font-semibold text-white">View PDF →</a>
                <form action={reviewContract} className="inline">
                  <input type="hidden" name="contract_id" value={r.id} />
                  <input type="hidden" name="decision" value="approved" />
                  <button className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white">Approve</button>
                </form>
                <form action={reviewContract} className="inline-flex items-center gap-2">
                  <input type="hidden" name="contract_id" value={r.id} />
                  <input type="hidden" name="decision" value="rejected" />
                  <input name="admin_note" placeholder="Reason (optional)" className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
                  <button className="rounded-lg ring-1 ring-red-300 px-3 py-1.5 text-xs font-semibold text-red-700">Reject</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mb-2 text-sm font-semibold text-slate-700">Reviewed</h2>
      {others.length === 0 ? (
        <p className="text-sm text-slate-400">Nothing reviewed yet.</p>
      ) : (
        <ul className="space-y-2">
          {others.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 rounded-xl ring-1 ring-slate-200 px-4 py-2.5">
              <span className="truncate text-sm text-slate-700">{r.business?.business_name ?? 'Business'}</span>
              <span className="flex shrink-0 items-center gap-2">
                <a href={`/admin/contracts/${r.id}/download`} className="text-xs font-semibold text-ocean hover:underline">View</a>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE[r.status]}`}>{r.status}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
