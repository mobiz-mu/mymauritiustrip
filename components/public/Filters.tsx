'use client';

import { useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { CATEGORY_FILTERS, type FilterDef } from '@/lib/public/filter-config';

type Opt = { slug: string; name: string };

const field = 'w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm focus:border-ocean focus:outline-none';

export default function Filters({
  categories,
  locations,
  lockedCategorySlugs,
}: {
  categories: Opt[];
  locations: Opt[];
  lockedCategorySlugs?: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const init = (k: string) => sp.get(k) ?? '';
  const [vals, setVals] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {};
    sp.forEach((v, k) => (o[k] = v));
    return o;
  });
  const [open, setOpen] = useState(false);

  const set = (k: string, v: string) => setVals((p) => ({ ...p, [k]: v }));

  const selectedCats = lockedCategorySlugs ?? (vals.category ? [vals.category] : []);
  const attrDefs: FilterDef[] = [];
  const seen = new Set<string>();
  for (const slug of selectedCats) {
    for (const f of CATEGORY_FILTERS[slug] ?? []) {
      if (!seen.has(f.key)) { seen.add(f.key); attrDefs.push(f); }
    }
  }

  function apply() {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(vals)) {
      if (v && v !== '' && k !== 'page') qs.set(k, v);
    }
    router.push(`${pathname}?${qs.toString()}`);
  }
  function clear() {
    setVals({});
    router.push(pathname);
  }

  return (
    <div className="rounded-2xl bg-white ring-1 ring-slate-200">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold sm:cursor-default"
      >
        Filters
        <span className="sm:hidden">{open ? '▲' : '▼'}</span>
      </button>

      <div className={`${open ? 'block' : 'hidden'} space-y-3 px-4 pb-4 sm:block`}>
        <input
          placeholder="Search…"
          defaultValue={init('q')}
          onChange={(e) => set('q', e.target.value)}
          className={field}
        />

        {!lockedCategorySlugs && (
          <select defaultValue={init('category')} onChange={(e) => set('category', e.target.value)} className={field}>
            <option value="">All categories</option>
            {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </select>
        )}

        <select defaultValue={init('location')} onChange={(e) => set('location', e.target.value)} className={field}>
          <option value="">All locations</option>
          {locations.map((l) => <option key={l.slug} value={l.slug}>{l.name}</option>)}
        </select>

        <div className="grid grid-cols-2 gap-2">
          <input type="number" placeholder="Min price" defaultValue={init('price_min')} onChange={(e) => set('price_min', e.target.value)} className={field} />
          <input type="number" placeholder="Max price" defaultValue={init('price_max')} onChange={(e) => set('price_max', e.target.value)} className={field} />
        </div>

        <select defaultValue={init('rating_min')} onChange={(e) => set('rating_min', e.target.value)} className={field}>
          <option value="">Any rating</option>
          <option value="3">3+ stars</option>
          <option value="4">4+ stars</option>
          <option value="4.5">4.5+ stars</option>
        </select>

        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" defaultChecked={init('featured') === '1'} onChange={(e) => set('featured', e.target.checked ? '1' : '')} /> Featured
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" defaultChecked={init('premium') === '1'} onChange={(e) => set('premium', e.target.checked ? '1' : '')} /> Premium
          </label>
        </div>

        {attrDefs.length > 0 && (
          <div className="space-y-2 border-t border-slate-100 pt-3">
            <p className="text-xs font-medium text-slate-500">More filters</p>
            {attrDefs.map((f) => {
              const name = `f_${f.key}`;
              if (f.type === 'bool') {
                return (
                  <label key={f.key} className="flex items-center gap-1.5 text-sm">
                    <input type="checkbox" defaultChecked={init(name) === '1'} onChange={(e) => set(name, e.target.checked ? '1' : '')} /> {f.label}
                  </label>
                );
              }
              if (f.type === 'enum' || f.type === 'arrcontains') {
                return (
                  <select key={f.key} defaultValue={init(name)} onChange={(e) => set(name, e.target.value)} className={field}>
                    <option value="">{f.label}: any</option>
                    {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                );
              }
              if (f.type === 'min') {
                return (
                  <input key={f.key} type="number" placeholder={f.label} defaultValue={init(name)} onChange={(e) => set(name, e.target.value)} className={field} />
                );
              }
              return (
                <input key={f.key} type="text" placeholder={f.placeholder ?? f.label} defaultValue={init(name)} onChange={(e) => set(name, e.target.value)} className={field} />
              );
            })}
          </div>
        )}

        <select defaultValue={init('sort')} onChange={(e) => set('sort', e.target.value)} className={field}>
          <option value="">Sort: recommended</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
          <option value="rating">Rating</option>
        </select>

        <div className="flex gap-2 pt-1">
          <button onClick={apply} className="flex-1 rounded-lg bg-ocean px-3 py-2 text-sm font-semibold text-white">Apply</button>
          <button onClick={clear} className="rounded-lg ring-1 ring-slate-300 px-3 py-2 text-sm font-semibold text-slate-600">Clear</button>
        </div>
      </div>
    </div>
  );
}
