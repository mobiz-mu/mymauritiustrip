import { requireRole } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { respondQuote } from './actions';

export const dynamic = 'force-dynamic';

const LABEL: Record<string, string> = {
  new: 'Submitted',
  reviewing: 'Being reviewed',
  quote_pending_client: 'Quote ready — your response needed',
  quote_accepted: 'Quote accepted',
  quote_rejected: 'Quote declined',
  assigned: 'Driver assigned',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export default async function ClientQuotes({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  await requireRole('client');
  const flash = await searchParams;
  const supabase = await createClient();

  // RLS returns only this client's own requests.
  const { data: requests } = await supabase
    .from('transfer_requests')
    .select('id, reference, status, quoted_amount_mur, notes_admin, pickup_location, dropoff_location, pickup_date, preferred_currency')
    .order('created_at', { ascending: false });

  return (
    <main className="mx-auto max-w-2xl px-6 py-12 space-y-4">
      <h1 className="text-xl font-semibold">My transfer requests & quotes</h1>

      {flash?.ok && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">Updated.</p>}
      {flash?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{flash.error}</p>}

      {(!requests || requests.length === 0) && (
        <p className="text-slate-500">You have no transfer requests yet.</p>
      )}

      {requests?.map((r) => (
        <div key={r.id} className="rounded-xl ring-1 ring-slate-200 p-4 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-medium">{r.reference}</span>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs">
              {LABEL[r.status] ?? r.status}
            </span>
          </div>
          <p className="text-slate-600">
            {r.pickup_location ?? '—'} → {r.dropoff_location ?? '—'}
            {r.pickup_date ? ` · ${r.pickup_date}` : ''}
          </p>

          {r.quoted_amount_mur != null && (
            <p className="text-slate-700">
              Quote: <strong>Rs {r.quoted_amount_mur}</strong>
              {r.notes_admin ? ` — ${r.notes_admin}` : ''}
            </p>
          )}

          {r.status === 'quote_pending_client' && (
            <div className="flex gap-2 pt-1">
              <form action={respondQuote}>
                <input type="hidden" name="request_id" value={r.id} />
                <input type="hidden" name="decision" value="accept" />
                <button className="rounded bg-green-600 px-3 py-1 text-xs font-semibold text-white">Accept quote</button>
              </form>
              <form action={respondQuote}>
                <input type="hidden" name="request_id" value={r.id} />
                <input type="hidden" name="decision" value="reject" />
                <button className="rounded bg-red-600 px-3 py-1 text-xs font-semibold text-white">Decline</button>
              </form>
            </div>
          )}
        </div>
      ))}

      <p className="text-xs text-slate-400">
        Need help? WhatsApp +230 5506 8119 or email info@mymauritiustrip.com.
      </p>
    </main>
  );
}
