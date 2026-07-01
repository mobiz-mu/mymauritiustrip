'use client';

import { useState } from 'react';
import type { DetailMedia } from '@/lib/public/catalog';

export default function Gallery({ images, videos }: { images: DetailMedia[]; videos: DetailMedia[] }) {
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState<Set<string>>(new Set());

  const main = images[active];

  return (
    <div className="space-y-4">
      {images.length > 0 && main && (
        <div className="space-y-2">
          <div className="aspect-[16/10] overflow-hidden rounded-2xl bg-slate-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={main.full_url} alt={main.alt_text ?? ''} className="h-full w-full object-cover" />
          </div>
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {images.map((m, i) => (
                <button
                  key={m.id}
                  onClick={() => setActive(i)}
                  className={`h-16 w-20 flex-shrink-0 overflow-hidden rounded-lg ring-2 ${i === active ? 'ring-ocean' : 'ring-transparent'}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.gallery_url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
          {main.caption && <p className="text-xs text-slate-500">{main.caption}</p>}
        </div>
      )}

      {videos.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium text-slate-600">Videos</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {videos.map((v) => (
              <div key={v.id} className="overflow-hidden rounded-xl bg-slate-900">
                {playing.has(v.id) ? (
                  // Loads only after the user clicks the poster.
                  <video src={v.preview_url} poster={v.poster_url} controls autoPlay className="h-40 w-full object-cover" />
                ) : (
                  <button onClick={() => setPlaying((s) => new Set(s).add(v.id))} className="relative block h-40 w-full">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={v.poster_url} alt={v.alt_text ?? ''} className="h-full w-full object-cover opacity-90" />
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-ocean">▶</span>
                    </span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {images.length === 0 && videos.length === 0 && (
        <div className="flex aspect-[16/10] items-center justify-center rounded-2xl bg-slate-100 text-sm text-slate-400">
          No photos available yet
        </div>
      )}
    </div>
  );
}
