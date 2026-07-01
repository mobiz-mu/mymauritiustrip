import { requireRole } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { createPackage, togglePackage } from './actions';

export const dynamic = 'force-dynamic';

const VEHICLES = ['luxury', 'family_car', 'suv', 'sedan', 'small_car', 'van', 'minibus', 'coach'];
const input = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm';

export default async function AdminPackagesPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  await requireRole('admin');
  const flash = await searchParams;
  const supabase = await createClient();
  const { data: packages } = await supabase
    .from('transfer_packages')
    .select('id, title, base_price_mur, vehicle_type, is_active, duration')
    .order('created_at', { ascending: false });

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Transfer / DMC packages</h1>
        <a href="/admin/transfers" className="text-sm text-ocean">← Transfers</a>
      </div>

      {flash?.ok && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{flash.ok}</p>}
      {flash?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{flash.error}</p>}

      {/* Create */}
      <section className="rounded-xl ring-1 ring-slate-200 p-5">
        <h2 className="mb-3 font-medium">Create a package</h2>
        <form action={createPackage} className="space-y-3">
          <input name="title" placeholder="Package title (e.g. Airport to Grand Baie transfer) *" className={input} />
          <div className="grid grid-cols-2 gap-3">
            <input name="pickup_label" placeholder="Pickup (e.g. Airport)" className={input} />
            <input name="dropoff_label" placeholder="Drop-off (e.g. Grand Baie)" className={input} />
            <input name="duration" placeholder="Duration (e.g. Full day / ~45 min)" className={input} />
            <select name="vehicle_type" className={input} defaultValue="">
              <option value="">Vehicle required</option>
              {VEHICLES.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
            <input name="min_passengers" type="number" min={1} placeholder="Min passengers" className={input} />
            <input name="max_passengers" type="number" min={1} placeholder="Max passengers" className={input} />
            <input name="base_price_mur" type="number" min={1} step="0.01" placeholder="Base price MUR *" className={input} />
          </div>
          <textarea name="notes" rows={2} placeholder="Notes" className={input} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="is_active" /> Publish (active)
          </label>
          <button className="rounded-lg bg-ocean px-4 py-2 text-sm font-semibold text-white">Create package</button>
        </form>
      </section>

      {/* List */}
      <section className="space-y-2">
        {(!packages || packages.length === 0) && <p className="text-slate-500">No packages yet.</p>}
        {packages?.map((p) => (
          <div key={p.id} className="flex items-center justify-between rounded-xl ring-1 ring-slate-200 px-4 py-3 text-sm">
            <div>
              <p className="font-medium">{p.title}</p>
              <p className="text-xs text-slate-500">
                Rs {p.base_price_mur} · {p.vehicle_type ?? 'any vehicle'} · {p.duration ?? '—'} ·{' '}
                {p.is_active ? <span className="text-green-600">active</span> : <span className="text-slate-400">inactive</span>}
              </p>
            </div>
            <form action={togglePackage}>
              <input type="hidden" name="id" value={p.id} />
              <input type="hidden" name="next" value={(!p.is_active).toString()} />
              <button className="rounded ring-1 ring-slate-300 px-3 py-1 text-xs">
                {p.is_active ? 'Deactivate' : 'Activate'}
              </button>
            </form>
          </div>
        ))}
      </section>
    </main>
  );
}
