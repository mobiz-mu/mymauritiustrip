import { requireRole } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { replyToReview } from './actions';

export const dynamic = 'force-dynamic';

export default async function ProviderReviews({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  await requireRole('provider');
  const flash = await searchParams;
  const supabase = await createClient();

  // Owner-scoped, approved-only, no client_id/booking_id/contact.
  const { data: reviews } = await supabase
    .from('provider_reviews_safe')
    .select('id, listing_title, rating, comment, created_at, reply_body')
    .order('created_at', { ascending: false });

  return (
    <main className="mx-auto max-w-2xl px-6 py-12 space-y-4">
      <h1 className="text-xl font-semibold">Reviews</h1>
      {flash?.ok && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{flash.ok}</p>}
      {flash?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{flash.error}</p>}

      {(!reviews || reviews.length === 0) && (
        <p className="rounded-xl bg-white p-6 text-center text-sm text-slate-500 ring-1 ring-slate-200">
          No approved reviews yet.
        </p>
      )}

      {reviews?.map((r) => {
        const existing = (r.reply_body as string | null) ?? '';
        return (
          <div key={r.id} className="rounded-xl bg-white p-4 ring-1 ring-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{r.listing_title}</span>
              <span className="text-sm"><span className="text-gold">★</span> {r.rating}/5</span>
            </div>
            {r.comment && <p className="text-sm text-slate-600">“{r.comment}”</p>}
            <p className="text-[11px] text-slate-400">Verified guest · {new Date(r.created_at).toLocaleDateString()}</p>

            <form action={replyToReview} className="space-y-2 border-t border-slate-100 pt-2">
              <input type="hidden" name="review_id" value={r.id} />
              <textarea
                name="body"
                rows={2}
                defaultValue={existing}
                placeholder="Reply publicly (no phone/email/links)"
                className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm focus:border-ocean focus:outline-none"
              />
              <button className="rounded-lg bg-ocean px-3 py-1.5 text-xs font-semibold text-white">
                {existing ? 'Update reply' : 'Reply'}
              </button>
            </form>
          </div>
        );
      })}
    </main>
  );
}
