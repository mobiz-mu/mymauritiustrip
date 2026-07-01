'use client';

import { useCallback, useEffect, useState } from 'react';

// Image-only banners. Replace the SVGs in /public/home/banners with real
// 2000x800 images using the same filenames to upgrade instantly.
const BANNERS = [1, 2, 3, 4, 5, 6].map((n) => `/home/banners/banner-${n}.svg`);
const INTERVAL = 10000;

export default function BannerCarousel() {
  const [i, setI] = useState(0);
  const go = useCallback((n: number) => setI((n + BANNERS.length) % BANNERS.length), []);

  useEffect(() => {
    const t = setInterval(() => setI((p) => (p + 1) % BANNERS.length), INTERVAL);
    return () => clearInterval(t);
  }, []);

  return (
    <section className="mx-auto max-w-6xl px-4 py-3 sm:px-6">
      <div className="group relative overflow-hidden rounded-3xl shadow-sm ring-1 ring-slate-200">
        <div
          className="flex transition-transform duration-700 ease-out"
          style={{ transform: `translateX(-${i * 100}%)` }}
        >
          {BANNERS.map((src, idx) => (
            <div
              key={src}
              className="aspect-[5/2] w-full shrink-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${src})` }}
              role="img"
              aria-label={`Promotional banner ${idx + 1}`}
            />
          ))}
        </div>

        {/* arrows */}
        <button
          type="button"
          onClick={() => go(i - 1)}
          aria-label="Previous banner"
          className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-slate-800 opacity-0 shadow transition hover:bg-white group-hover:opacity-100"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <button
          type="button"
          onClick={() => go(i + 1)}
          aria-label="Next banner"
          className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-slate-800 opacity-0 shadow transition hover:bg-white group-hover:opacity-100"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
        </button>

        {/* dots */}
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
          {BANNERS.map((src, d) => (
            <button
              key={src}
              type="button"
              onClick={() => go(d)}
              aria-label={`Go to banner ${d + 1}`}
              className={`h-2 rounded-full transition-all ${d === i ? 'w-5 bg-white' : 'w-2 bg-white/60 hover:bg-white/80'}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
