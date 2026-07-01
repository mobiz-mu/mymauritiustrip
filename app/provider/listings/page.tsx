import { requireRole } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { submitForReview } from './actions';

export const dynamic = 'force-dynamic';

const STATUS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  pending_review: 'bg-blue-100 text-blue-800',
  published: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  hidden: 'bg-amber-100 text-amber-800',
  suspended: 'bg-red-100 text-red-800',
};

export default async function ProviderListings({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const profile = await requireRole('provider');
  const flash = await searchParams;
  const supabase = await createClient();

  const { data: business } = await supabase
    .from('businesses')
    .select('id, status')
    .eq('owner_id', profile.id)
    .single();

  const { data: listings } = business
    ? await supabase
        .from('listings')
        .select('id, title, status, rejected_reason, category_id, created_at')
        .eq('business_id', business.id)
        .order('created_at', { ascending: false })
    : { data: [] as { id: string; title: string; status: string; rejected_reason: string | null; category_id: string; created_at: string }[] };

  const used = listings?.length ?? 0;
  const verified = business?.status === 'verified';
  const canCreate = verified && used < 7;

  return (
    <main className="mx-auto max-w-2xl px-6 py-12 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">My listings</h1>
        <span className="text-sm text-slate-500">{used}/7 used</span>
      </div>

      {flash?.ok && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{flash.ok}</p>}
      {flash?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{flash.error}</p>}

      {!verified && (
        <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
          Your business isn't verified yet, so you can't create listings.{' '}
          <a href="/provider/verification" className="underline">Go to verification</a>.
        </div>
      )}

      {verified && (
        <a
          href="/provider/listings/new"
          aria-disabled={!canCreate}
          className={`inline-block rounded-lg px-4 py-2 text-sm font-semibold text-white ${canCreate ? 'bg-ocean' : 'pointer-events-none bg-slate-300'}`}
        >
          {used >= 7 ? 'Limit reached (7/7)' : 'New listing'}
        </a>
      )}

      <div className="space-y-2">
        {listings?.map((l) => (
          <div key={l.id} className="rounded-xl ring-1 ring-slate-200 p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium">{l.title}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs ${STATUS[l.status] ?? 'bg-slate-100'}`}>{l.status}</span>
            </div>
            {l.status === 'rejected' && l.rejected_reason && (
              <p className="mt-1 text-xs text-red-600">Rejected: {l.rejected_reason}</p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
              <a href={`/provider/listings/${l.id}/edit`} className="text-ocean">Edit</a>
              <a href={`/provider/listings/${l.id}/media`} className="text-ocean">Media</a>
              {['draft', 'rejected', 'hidden'].includes(l.status) && (
                <form action={submitForReview}>
                  <input type="hidden" name="listing_id" value={l.id} />
                  <button className="rounded bg-blue-600 px-2.5 py-1 font-semibold text-white">Submit for review</button>
                </form>
              )}
            </div>
          </div>
        ))}
        {used === 0 && <p className="text-slate-500">No listings yet.</p>}
      </div>
    </main>
  );
}
