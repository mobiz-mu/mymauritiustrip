import { requireRole } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { quoteRequest, assignRequest } from './actions';

export const dynamic = 'force-dynamic';

const VEHICLES = ['luxury', 'family_car', 'suv', 'sedan', 'small_car', 'van', 'minibus', 'coach'];
const input = 'rounded-lg border border-slate-300 px-2 py-1.5 text-sm';

export default async function AdminTransferRequests({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  await requireRole('admin');
  const flash = await searchParams;
  const supabase = await createClient();

  // Only transport/transfer providers may be assigned (not restaurants/villas/etc).
  const { data: transportCats } = await supabase
    .from('categories')
    .select('id')
    .in('slug', ['taxi-private-transfers', 'airport-transfer']);
  const catIds = (transportCats ?? []).map((c) => c.id);

  const [{ data: requests }, { data: providers }] = await Promise.all([
    supabase
      .from('transfer_requests')
      .select('id, reference, full_name, needs, status, quoted_amount_mur, passengers, pickup_location, dropoff_location, pickup_date, created_at')
      .order('created_at', { ascending: false }),
    catIds.length
      ? supabase
          .from('businesses')
          .select('id, business_name')
          .eq('status', 'verified')
          .in('category_id', catIds)
      : Promise.resolve({ data: [] as { id: string; business_name: string }[] }),
  ]);

  return (
    <main className="mx-auto max-w-4xl px-6 py-12 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Transfer / DMC requests</h1>
        <a href="/admin/transfers" className="text-sm text-ocean">← Transfers</a>
      </div>

      {flash?.ok && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{flash.ok}</p>}
      {flash?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{flash.error}</p>}

      {(!requests || requests.length === 0) && <p className="text-slate-500">No requests yet.</p>}

      <div className="space-y-4">
        {requests?.map((r) => (
          <div key={r.id} className="rounded-xl ring-1 ring-slate-200 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{r.reference} · {r.full_name}</p>
                <p className="text-xs text-slate-500">
                  {r.pickup_location ?? '—'} → {r.dropoff_location ?? '—'} ·{' '}
                  {r.passengers ?? '?'} pax · {r.pickup_date ?? 'no date'}
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs">{r.status}</span>
            </div>
            <p className="text-sm text-slate-700">{r.needs}</p>

            <div className="grid gap-3 md:grid-cols-2">
              {/* Quote */}
              <form action={quoteRequest} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="request_id" value={r.id} />
                <input name="amount" type="number" step="0.01" min={1} placeholder="Quote MUR" className={input} />
                <input name="notes" placeholder="Notes" className={input} />
                <button className="rounded bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white">Save quote</button>
              </form>

              {/* Assign */}
              <form action={assignRequest} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="request_id" value={r.id} />
                <select name="business_id" required className={input}>
                  <option value="">Assign provider…</option>
                  {providers?.map((b) => <option key={b.id} value={b.id}>{b.business_name}</option>)}
                </select>
                <select name="vehicle_type" className={input} defaultValue="">
                  <option value="">Vehicle</option>
                  {VEHICLES.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
                <input name="final_price" type="number" step="0.01" min={1} required placeholder="Final MUR *" className={input} />
                <label className="flex items-center gap-1 text-xs text-slate-500">
                  <input type="checkbox" name="override" /> override quote
                </label>
                <button className="rounded bg-ocean px-3 py-1.5 text-xs font-semibold text-white">Assign</button>
              </form>
            </div>
            {r.quoted_amount_mur != null && (
              <p className="text-xs text-slate-500">Current quote: Rs {r.quoted_amount_mur}</p>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
