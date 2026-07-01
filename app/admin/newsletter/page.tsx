import { requireRole } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Newsletter subscribers | Admin' };

type Row = { email: string; source: string; status: string; created_at: string };

export default async function AdminNewsletterPage() {
  await requireRole('admin');
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('newsletter_subscribers')
    .select('email, source, status, created_at')
    .order('created_at', { ascending: false })
    .limit(1000);

  const rows = (data ?? []) as Row[];

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Newsletter subscribers</h1>
        <a href="/admin" className="text-sm font-semibold text-ocean hover:underline">← Back to admin</a>
      </div>

      {error ? (
        <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">Could not load subscribers: {error.message}</p>
      ) : rows.length === 0 ? (
        <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">No subscribers yet.</p>
      ) : (
        <>
          <p className="mb-3 text-sm text-slate-500">{rows.length} subscriber{rows.length > 1 ? 's' : ''}</p>
          <div className="overflow-x-auto rounded-xl ring-1 ring-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Subscribed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {rows.map((r) => (
                  <tr key={r.email}>
                    <td className="px-4 py-3 font-medium text-slate-800">{r.email}</td>
                    <td className="px-4 py-3 text-slate-600">{r.source}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${r.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{r.status}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{new Date(r.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
