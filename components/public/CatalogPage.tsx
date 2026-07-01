import Link from 'next/link';
import { searchListings, getReferenceData, type CatalogParams } from '@/lib/public/catalog';
import SiteHeader from './SiteHeader';
import PublicFooter from './PublicFooter';
import Filters from './Filters';
import ListingCard from './ListingCard';

export default async function CatalogPage({
  searchParams,
  basePath,
  forcedSlugs,
  title,
  intro,
}: {
  searchParams: CatalogParams;
  basePath: string;
  forcedSlugs?: string[];
  title: string;
  intro?: string;
}) {
  const ref = await getReferenceData();
  const { items, total, page, pageCount } = await searchListings(searchParams, forcedSlugs);

  const pageHref = (p: number) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) {
      const val = Array.isArray(v) ? v[0] : v;
      if (val && k !== 'page') qs.set(k, val);
    }
    qs.set('page', String(p));
    return `${basePath}?${qs.toString()}`;
  };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteHeader />

      {/* premium page header */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#eaf5fb] via-[#f5fafd] to-white">
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-turquoise/20 blur-3xl" aria-hidden="true" />
        <div className="mx-auto max-w-6xl px-4 py-9 sm:px-6 md:py-12">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-ocean">Explore Mauritius</p>
              <h1 className="font-serif text-3xl tracking-tight text-slate-900 md:text-4xl">{title}</h1>
              {intro && <p className="mt-2 max-w-xl text-sm text-slate-600">{intro}</p>}
              <p className="mt-2 text-xs font-medium text-slate-400">{total} result{total === 1 ? '' : 's'}</p>
            </div>
            <Link href="/request-transfer" className="rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition hover:brightness-105">
              Request a custom trip
            </Link>
          </div>
        </div>
      </section>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-[260px_1fr]">
          <aside className="sm:sticky sm:top-24 sm:self-start">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <Filters
                categories={ref.categories.map((c) => ({ slug: c.slug, name: c.name }))}
                locations={ref.locations.map((l) => ({ slug: l.slug, name: l.name }))}
                lockedCategorySlugs={forcedSlugs}
              />
            </div>
          </aside>

          <section>
            {items.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-slate-300 bg-slate-50/60 p-10 text-center">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-turquoise/10 text-ocean">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3-3" /></svg>
                </span>
                <h2 className="font-serif text-xl text-slate-900">Nothing here just yet</h2>
                <p className="max-w-md text-sm text-slate-500">
                  We're onboarding verified Mauritius providers now. Adjust your filters, or tell us what you're planning and our local team will help.
                </p>
                <Link href="/request-transfer" className="mt-1 rounded-full bg-ocean px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#095a96]">
                  Request a trip
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((item) => (
                  <ListingCard
                    key={item.id}
                    item={item}
                    categoryName={ref.catById.get(item.category_id)?.name ?? null}
                    locationName={item.location_id ? ref.locById.get(item.location_id)?.name ?? null : null}
                  />
                ))}
              </div>
            )}

            {pageCount > 1 && (
              <div className="mt-8 flex items-center justify-center gap-3 text-sm">
                {page > 1 && <Link href={pageHref(page - 1)} className="rounded-full border border-slate-300 bg-white px-4 py-2 font-medium transition hover:border-slate-400">← Prev</Link>}
                <span className="text-slate-500">Page {page} of {pageCount}</span>
                {page < pageCount && <Link href={pageHref(page + 1)} className="rounded-full border border-slate-300 bg-white px-4 py-2 font-medium transition hover:border-slate-400">Next →</Link>}
              </div>
            )}
          </section>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
