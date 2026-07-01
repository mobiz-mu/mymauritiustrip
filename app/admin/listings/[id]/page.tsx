import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { setListingStatus, setFlags, setMediaStatus, setMediaCover } from '../actions';

export const dynamic = 'force-dynamic';

export default async function AdminListingDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  await requireRole('admin');
  const { id } = await params;
  const flash = await searchParams;
  const supabase = await createClient();

  const { data: l } = await supabase.from('listings').select('*').eq('id', id).single();
  if (!l) notFound();

  const [{ data: business }, { data: media }, { data: cat }, { data: loc }] = await Promise.all([
    supabase.from('businesses').select('business_name, owner_full_name, email, whatsapp, phone, status').eq('id', l.business_id).single(),
    supabase.from('listing_media').select('id, type, status, is_cover, thumbnail_url, url, caption, alt_text').eq('listing_id', id).order('position'),
    supabase.from('categories').select('name').eq('id', l.category_id).single(),
    l.location_id ? supabase.from('locations').select('name').eq('id', l.location_id).single() : Promise.resolve({ data: null }),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 space-y-6">
      <div className="flex items-center justify-between">
        <a href="/admin/listings" className="text-sm text-ocean">← Listings</a>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs">{l.status}</span>
      </div>

      {flash?.ok && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{flash.ok}</p>}
      {flash?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{flash.error}</p>}

      {/* Listing */}
      <section className="rounded-xl ring-1 ring-slate-200 p-5 space-y-2">
        <h1 className="text-lg font-semibold">{l.title}</h1>
        <p className="text-sm text-slate-500">
          {cat?.name ?? '—'} · {loc?.name ?? 'no location'} · Rs {l.base_price_mur} {l.price_unit}
        </p>
        <p className="text-sm whitespace-pre-line">{l.description}</p>
        {l.included?.length > 0 && <p className="text-xs text-slate-500">Included: {l.included.join(', ')}</p>}
        {l.not_included?.length > 0 && <p className="text-xs text-slate-500">Not included: {l.not_included.join(', ')}</p>}
        <pre className="overflow-x-auto rounded bg-slate-50 p-2 text-xs">{JSON.stringify(l.attributes, null, 2)}</pre>
      </section>

      {/* Private business info (admin only) */}
      <section className="rounded-xl ring-1 ring-slate-200 p-5">
        <h2 className="mb-2 font-medium">Provider (private)</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <dt className="text-slate-500">Business</dt><dd>{business?.business_name}</dd>
          <dt className="text-slate-500">Owner</dt><dd>{business?.owner_full_name}</dd>
          <dt className="text-slate-500">Email</dt><dd>{business?.email}</dd>
          <dt className="text-slate-500">WhatsApp</dt><dd>{business?.whatsapp}</dd>
          <dt className="text-slate-500">Business status</dt><dd>{business?.status}</dd>
        </dl>
      </section>

      {/* Media approval */}
      <section className="rounded-xl ring-1 ring-slate-200 p-5">
        <h2 className="mb-3 font-medium">Media</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {media?.map((m) => (
            <div key={m.id} className="rounded-lg ring-1 ring-slate-200 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.thumbnail_url ?? m.url} alt={m.alt_text ?? ''} className="h-28 w-full object-cover" />
              <div className="p-2 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5">{m.status}</span>
                  {m.is_cover && <span className="text-gold">★</span>}
                </div>
                <div className="flex flex-wrap gap-1">
                  {(['approved', 'rejected', 'hidden'] as const).map((s) => (
                    <form action={setMediaStatus} key={s}>
                      <input type="hidden" name="listing_id" value={id} />
                      <input type="hidden" name="media_id" value={m.id} />
                      <input type="hidden" name="status" value={s} />
                      <button className="rounded bg-slate-800 px-2 py-0.5 text-white">{s}</button>
                    </form>
                  ))}
                  {m.type === 'image' && (
                    <form action={setMediaCover}>
                      <input type="hidden" name="listing_id" value={id} />
                      <input type="hidden" name="media_id" value={m.id} />
                      <button className="rounded bg-ocean px-2 py-0.5 text-white">cover</button>
                    </form>
                  )}
                </div>
              </div>
            </div>
          ))}
          {(!media || media.length === 0) && <p className="text-sm text-slate-500">No media.</p>}
        </div>
      </section>

      {/* Decisions */}
      <section className="rounded-xl ring-1 ring-slate-200 p-5 space-y-4">
        <h2 className="font-medium">Decision</h2>
        <div className="flex flex-wrap gap-2">
          {(['published', 'hidden', 'suspended'] as const).map((s) => (
            <form action={setListingStatus} key={s}>
              <input type="hidden" name="listing_id" value={id} />
              <input type="hidden" name="status" value={s} />
              <button className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-semibold text-white capitalize">{s === 'published' ? 'Publish' : s}</button>
            </form>
          ))}
        </div>

        <form action={setListingStatus} className="space-y-2">
          <input type="hidden" name="listing_id" value={id} />
          <input type="hidden" name="status" value="rejected" />
          <textarea name="reason" placeholder="Reason for rejection (shown to provider)" rows={2} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <button className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white">Reject with reason</button>
        </form>

        <form action={setFlags} className="flex items-center gap-4 text-sm">
          <input type="hidden" name="listing_id" value={id} />
          <label className="flex items-center gap-2"><input type="checkbox" name="featured" defaultChecked={l.is_featured} /> Featured</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="premium" defaultChecked={l.is_premium} /> Premium</label>
          <button className="rounded-lg ring-1 ring-slate-300 px-3 py-1.5 font-semibold">Save flags</button>
        </form>
      </section>
    </main>
  );
}
