import Link from 'next/link';
import type { PublicReview } from '@/lib/public/catalog';

// Official TripAdvisor provision (no scraping). If you have an official
// TripAdvisor profile/widget, set NEXT_PUBLIC_TRIPADVISOR_URL to its public URL
// and a button links to it. Nothing renders if unset — the site is unaffected.
const TRIPADVISOR_URL = process.env.NEXT_PUBLIC_TRIPADVISOR_URL;

function Stars({ rating }: { rating: number }) {
  const r = Math.round(rating);
  return (
    <div className="flex gap-0.5" aria-label={`${rating} out of 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} width="14" height="14" viewBox="0 0 24 24" className={i < r ? 'text-gold' : 'text-slate-200'} fill="currentColor" aria-hidden="true">
          <path d="M12 4l2.2 4.5 4.8.7-3.5 3.4.8 4.8L12 15.6 7.7 17.4l.8-4.8-3.5-3.4 4.8-.7L12 4z" />
        </svg>
      ))}
    </div>
  );
}

export default function Testimonials({ reviews }: { reviews: PublicReview[] }) {
  return (
    <section className="bg-slate-50/70">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 md:py-16">
        <div className="mb-7 flex items-end justify-between gap-4">
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-ocean">Reviews</p>
            <h2 className="font-serif text-2xl tracking-tight text-slate-900 md:text-[28px]">What travellers say</h2>
            <p className="mt-1 text-sm text-slate-500">Real, approved reviews from guests who booked through the platform.</p>
          </div>
          {TRIPADVISOR_URL && (
            <a href={TRIPADVISOR_URL} target="_blank" rel="noopener noreferrer" className="hidden shrink-0 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-slate-400 sm:block">
              Read us on TripAdvisor →
            </a>
          )}
        </div>

        {reviews.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {reviews.slice(0, 6).map((r) => (
              <figure key={r.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5">
                <Stars rating={r.rating} />
                <blockquote className="mt-3 line-clamp-4 text-sm leading-relaxed text-slate-700">&ldquo;{r.comment}&rdquo;</blockquote>
                <figcaption className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3 text-xs">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-ocean/10 text-[11px] font-bold text-ocean">✓</span>
                  <span className="font-semibold text-slate-800">Verified traveller</span>
                  {r.listingTitle && r.listingSlug && (
                    <>
                      <span className="text-slate-300">·</span>
                      <Link href={`/listings/${r.listingSlug}`} className="line-clamp-1 text-slate-500 hover:text-ocean hover:underline">{r.listingTitle}</Link>
                    </>
                  )}
                </figcaption>
              </figure>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-turquoise/10 text-ocean">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 5h14v9H8l-3 3V5z" /></svg>
            </span>
            <h3 className="font-serif text-xl text-slate-900">Reviews are on the way</h3>
            <p className="max-w-md text-sm text-slate-500">As guests complete their trips, their approved reviews will appear here. Book a verified experience and be among the first to share yours.</p>
            <Link href="/search" className="mt-1 rounded-full bg-ocean px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#095a96]">Explore experiences</Link>
          </div>
        )}
      </div>
    </section>
  );
}
