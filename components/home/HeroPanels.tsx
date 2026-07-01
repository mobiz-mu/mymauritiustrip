'use client';

import { useEffect, useState } from 'react';

// One vertical + three horizontal SQUARE panels. Each cycles through ~5 local
// SVG scenes every 6s with a smooth crossfade. Initial render is deterministic
// (index 0) so there is no hydration mismatch, and the container has a fixed
// height so there is no layout shift. Assets are tiny SVGs (no eager image
// weight). Rotation is disabled for users who prefer reduced motion.
const ROTATE_MS = 6000;

const VERTICAL = ['/home/hero-sunrise.svg', '/home/hero-villa.svg', '/home/wedding.svg', '/home/lagoon.svg', '/home/villas.svg'];
const H1 = ['/home/hero-boat.svg', '/home/boat.svg', '/home/sunset-sail.svg', '/home/things-to-do.svg', '/home/hero-beach.svg'];
const H2 = ['/home/airport.svg', '/home/taxi.svg', '/home/car.svg', '/home/hero-villa.svg', '/home/lagoon.svg'];
const H3 = ['/home/restaurants.svg', '/home/things-to-do.svg', '/home/hero-beach.svg', '/home/wedding.svg', '/home/boat.svg'];

function Panel({ images, label, className }: { images: string[]; label: string; className: string }) {
  const [i, setI] = useState(0);

  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || images.length < 2) return;
    const t = setInterval(() => setI((p) => (p + 1) % images.length), ROTATE_MS);
    return () => clearInterval(t);
  }, [images.length]);

  return (
    <div className={`relative overflow-hidden rounded-none ring-1 ring-black/5 shadow-lg ${className}`}>
      {images.map((src, idx) => (
        <div
          key={src + idx}
          className="absolute inset-0 bg-cover bg-center transition-opacity duration-700 ease-out"
          style={{ backgroundImage: `url(${src})`, opacity: idx === i ? 1 : 0 }}
          aria-hidden={idx !== i}
        />
      ))}
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-900/50 via-slate-900/5 to-transparent" aria-hidden="true" />
      <span className="absolute bottom-3 left-3 rounded-md bg-white/90 px-2.5 py-1 text-xs font-semibold text-slate-800 shadow-sm">{label}</span>
    </div>
  );
}

export default function HeroPanels() {
  return (
    <div className="grid h-[340px] grid-cols-2 grid-rows-3 gap-3 sm:h-[440px] sm:gap-4">
      <Panel images={VERTICAL} label="Sunrise beaches" className="col-start-1 row-span-3" />
      <Panel images={H1} label="Catamaran cruises" className="col-start-2 row-start-1" />
      <Panel images={H2} label="Transfers & cars" className="col-start-2 row-start-2" />
      <Panel images={H3} label="Food & experiences" className="col-start-2 row-start-3" />
    </div>
  );
}
