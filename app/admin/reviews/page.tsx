import { requireRole } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { LogoutButton } from '@/components/LogoutButton';
import { setReviewStatus } from './actions';

export const dynamic = 'force-dynamic';

const STATUS_CLASS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

export default async function AdminReviews({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  await requireRole('admin');
  const flash = await searchParams;
  const supabase = await createClient();

  const { data: reviews } = await supabase
    .from('reviews')
    .select('id, rating, comment, status, created_at, listing:listings(title)')
    .order('status', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(100);

  const pending = (reviews ?? []).filter((r) => r.status === 'pending');
  const others = (reviews ?? []).filter((r) => r.status !== 'pending');

  const card = (rv: Record<string, unknown>) => {
    const r = rv as { id: string; rating: number; comment: string | null; status: string; created_at: string };
    const listing = (rv as unknown as { listing?: { title: string } }).listing;
    return (
      <div key={r.id} className="rounded-xl bg-white p-4 ring-1 ring-slate-200 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{listing?.title ?? 'Listing'}</span>
          <span className={`rounded-full px-2.5 py-0.5 text-xs ${STATUS_CLASS[r.status] ?? 'bg-slate-100'}`}>{r.status}</span>
        </div>
        <p className="text-sm"><span className="text-gold">★</span> {r.rating}/5</p>
        {r.comment && <p className="text-sm text-slate-600">“{r.comment}”</p>}
        <div className="flex gap-2 pt-1">
          {r.status !== 'approved' && (
            <form action={setReviewStatus}>
              <input type="hidden" name="review_id" value={r.id} />
              <input type="hidden" name="status" value="approved" />
              <button className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white">Approve</button>
            </form>
          )}
          {r.status !== 'rejected' && (
            <form action={setReviewStatus}>
              <input type="hidden" name="review_id" value={r.id} />
              <input type="hidden" name="status" value="rejected" />
              <button className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white">Reject</button>
            </form>
          )}
        </div>
      </div>
    );
  };

  return (
    <main className="mx-auto max-w-2xl px-6 py-12 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Review moderation</h1>
        <LogoutButton />
      </div>
      {flash?.ok && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">Updated.</p>}
      {flash?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{flash.error}</p>}

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-slate-500">Pending ({pending.length})</h2>
        {pending.length === 0 && <p className="text-sm text-slate-400">Nothing pending.</p>}
        {pending.map(card)}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-slate-500">Recent</h2>
        {others.map(card)}
      </section>
    </main>
  );
}
