'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

export type PremiumAd = {
  id: string;
  slug: string;
  title: string;
  image: string;
  location: string | null;
  category: string | null;
  priceLabel: string | null;
};

const PAGE_SIZE = 10; // 2 rows of 5 on desktop
const AUTO_MS = 10000;

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

function AdCard({ ad, premium }: { ad: PremiumAd; premium: boolean }) {
  return (
    <Link
      href={`/listings/${ad.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-16px_rgba(15,23,42,0.25)]"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-slate-100">
        <span className="absolute inset-0 bg-cover bg-center transition duration-500 group-hover:scale-[1.04]" style={{ backgroundImage: `url(${ad.image})` }} aria-hidden="true" />
        {premium && (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-emerald-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">Premium Ad</span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-3">
        <p className="text-[11px] font-medium text-slate-400">{[ad.category, ad.location].filter(Boolean).join(' · ') || 'Mauritius'}</p>
        <h3 className="mt-0.5 line-clamp-1 text-sm font-semibold text-slate-900">{ad.title}</h3>
        <p className="mt-auto pt-2 text-sm font-bold text-slate-900">{ad.priceLabel ?? 'View details →'}</p>
      </div>
    </Link>
  );
}

export default function PremiumAds({ ads, mode }: { ads: PremiumAd[]; mode: 'premium' | 'recent' | 'empty' }) {
  const pages = chunk(ads, PAGE_SIZE);
  const [page, setPage] = useState(0);
  const go = useCallback((n: number) => setPage((p) => (n + pages.length) % Math.max(1, pages.length)), [pages.length]);

  useEffect(() => {
    if (pages.length < 2) return;
    const t = setInterval(() => setPage((p) => (p + 1) % pages.length), AUTO_MS);
    return () => clearInterval(t);
  }, [pages.length]);

  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 md:py-12">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600">Premium Ads</p>
          <h2 className="font-serif text-2xl tracking-tight text-slate-900 md:text-[28px]">
            {mode === 'premium' ? 'Featured premium listings' : 'Featured on MyMauritiusTrip'}
          </h2>
        </div>
        {pages.length > 1 && (
          <div className="flex gap-2">
            <button type="button" onClick={() => go(page - 1)} aria-label="Previous premium ads" className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 transition hover:border-slate-400">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
            </button>
            <button type="button" onClick={() => go(page + 1)} aria-label="Next premium ads" className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 transition hover:border-slate-400">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
            </button>
          </div>
        )}
      </div>

      {mode === 'empty' ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, idx) => (
            <Link key={idx} href="/provider-signup" className="group flex flex-col overflow-hidden rounded-2xl border border-dashed border-slate-300 bg-slate-50/60">
              <div className="relative aspect-square w-full overflow-hidden">
                <span className="absolute inset-0 bg-cover bg-center opacity-70" style={{ backgroundImage: 'url(/home/hero-beach.svg)' }} aria-hidden="true" />
                <span className="absolute left-2.5 top-2.5 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-semibold text-slate-700">Available soon</span>
              </div>
              <div className="p-3">
                <h3 className="text-sm font-semibold text-slate-900">Premium ad slot</h3>
                <p className="mt-auto pt-2 text-xs font-semibold text-emerald-700">List your business →</p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden">
          <div className="flex transition-transform duration-500 ease-out" style={{ transform: `translateX(-${page * 100}%)` }}>
            {pages.map((p, pi) => (
              <div key={pi} className="grid w-full shrink-0 grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
                {p.map((ad) => <AdCard key={ad.id} ad={ad} premium={mode === 'premium'} />)}
              </div>
            ))}
          </div>
        </div>
      )}

      {mode === 'recent' && (
        <p className="mt-4 text-center text-xs text-slate-400">Premium placements are opening up — <Link href="/provider-signup" className="font-semibold text-ocean hover:underline">list your business</Link> to feature here.</p>
      )}
    </section>
  );
}
