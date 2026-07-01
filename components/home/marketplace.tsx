import Link from 'next/link';
import type { ListingCardData } from '@/lib/public/catalog';
import { formatMUR, priceUnitLabel } from '@/components/public/ui';
import type { IconKey } from '@/lib/home/content';
import { Icon } from './icons';

type NameMap = ReadonlyMap<string, { name: string }>;

export type SectionKey = 'villas' | 'car' | 'restaurants' | 'catamaran';

type FeatureSpec = { key: string; icon: IconKey; format: (v: unknown) => string | null };

const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};
const truthy = (v: unknown) => v === true || v === 'true' || v === 'yes' || (num(v) ?? 0) > 0;
const text = (v: unknown) => {
  const s = typeof v === 'string' ? v.trim() : '';
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : null;
};

// Category-specific feature chips. Missing attributes are skipped gracefully.
const FEATURES: Record<SectionKey, FeatureSpec[]> = {
  villas: [
    { key: 'bedrooms', icon: 'villa', format: (v) => { const n = num(v); return n ? `${n} room${n > 1 ? 's' : ''}` : null; } },
    { key: 'bathrooms', icon: 'wallet', format: (v) => { const n = num(v); return n ? `${n} bath` : null; } },
    { key: 'pool', icon: 'boat', format: (v) => (truthy(v) ? 'Pool' : null) },
    { key: 'guests', icon: 'heart', format: (v) => { const n = num(v); return n ? `${n} guests` : null; } },
  ],
  car: [
    { key: 'seats', icon: 'car', format: (v) => { const n = num(v); return n ? `${n} seats` : null; } },
    { key: 'transmission', icon: 'route', format: (v) => text(v) },
    { key: 'air_conditioning', icon: 'sun', format: (v) => (truthy(v) ? 'A/C' : null) },
    { key: 'luggage', icon: 'plane', format: (v) => { const n = num(v); return n ? `${n} bags` : null; } },
  ],
  restaurants: [
    { key: 'cuisine', icon: 'dining', format: (v) => text(v) },
    { key: 'capacity', icon: 'heart', format: (v) => { const n = num(v); return n ? `${n} seats` : null; } },
  ],
  catamaran: [
    { key: 'duration', icon: 'compass', format: (v) => text(v) },
    { key: 'capacity', icon: 'heart', format: (v) => { const n = num(v); return n ? `${n} guests` : null; } },
    { key: 'route', icon: 'route', format: (v) => text(v) },
  ],
};

const PREVIEW_TITLES: Record<SectionKey, string[]> = {
  villas: ['Beachfront villa', 'Sea-view apartment', 'Garden villa', 'Family villa'],
  car: ['Compact hatchback', 'Family SUV', 'Convertible', 'Premium sedan'],
  restaurants: ['Seafront dining', 'Creole kitchen', 'Fine dining', 'Beach grill'],
  catamaran: ['Full-day cruise', 'Sunset sail', 'Northern islands', 'Private charter'],
};

function chips(item: ListingCardData, sectionKey: SectionKey) {
  const out: { icon: IconKey; label: string }[] = [];
  for (const spec of FEATURES[sectionKey]) {
    const label = spec.format(item.attributes?.[spec.key]);
    if (label) out.push({ icon: spec.icon, label });
    if (out.length >= 4) break;
  }
  return out;
}

function MarketplaceCard({
  item, categoryName, locationName, sectionKey, fallbackImage,
}: {
  item: ListingCardData; categoryName: string | null; locationName: string | null; sectionKey: SectionKey; fallbackImage: string;
}) {
  const img = item.cover_card_url ?? fallbackImage;
  const features = chips(item, sectionKey);
  return (
    <Link
      href={`/listings/${item.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-16px_rgba(15,23,42,0.25)]"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-slate-100">
        <span className="absolute inset-0 bg-cover bg-center transition duration-500 group-hover:scale-[1.04]" style={{ backgroundImage: `url(${img})` }} aria-hidden="true" />
        {item.is_premium && (
          <span className="absolute left-3 top-3 rounded-full bg-gold px-2.5 py-1 text-[11px] font-bold text-slate-900 shadow-sm">Premium</span>
        )}
        {item.review_count > 0 && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/92 px-2 py-1 text-[11px] font-semibold text-slate-800 shadow-sm">
            <Icon name="star" size={12} className="text-gold" /> {item.rating_avg.toFixed(1)}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-3.5">
        <p className="text-[11px] font-medium text-slate-400">
          {[categoryName, locationName].filter(Boolean).join(' · ') || 'Mauritius'}
        </p>
        <h3 className="mt-0.5 line-clamp-1 text-sm font-semibold text-slate-900">{item.title}</h3>
        {features.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
            {features.map((f, idx) => (
              <span key={idx} className="inline-flex items-center gap-1"><Icon name={f.icon} size={13} className="text-ocean" /> {f.label}</span>
            ))}
          </div>
        )}
        <div className="mt-auto pt-3">
          {item.base_price_mur > 0 ? (
            <p className="text-sm font-bold text-slate-900">{formatMUR(item.base_price_mur)} <span className="text-xs font-normal text-slate-400">{priceUnitLabel(item.price_unit)}</span></p>
          ) : (
            <p className="text-xs font-semibold text-ocean">View details →</p>
          )}
        </div>
      </div>
    </Link>
  );
}

function PreviewCard({ title, href, image }: { title: string; href: string; image: string }) {
  return (
    <Link href={href} className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-16px_rgba(15,23,42,0.25)]">
      <div className="relative aspect-square w-full overflow-hidden bg-slate-100">
        <span className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${image})` }} aria-hidden="true" />
        <span className="absolute inset-0 bg-gradient-to-t from-slate-900/45 to-transparent" aria-hidden="true" />
        <span className="absolute bottom-3 left-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-slate-800">Coming soon</span>
      </div>
      <div className="flex flex-1 flex-col p-3.5">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <p className="mt-auto pt-3 text-xs font-semibold text-ocean">Browse →</p>
      </div>
    </Link>
  );
}

export function MarketplaceSection({
  eyebrow, title, href, items, catById, locById, sectionKey, fallbackImage,
}: {
  eyebrow?: string; title: string; href: string; items: ListingCardData[];
  catById: NameMap; locById: NameMap; sectionKey: SectionKey; fallbackImage: string;
}) {
  // premium first, then the rest; cap at 4
  const ordered = [...items].sort((a, b) => Number(b.is_premium) - Number(a.is_premium)).slice(0, 4);

  return (
    <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 md:py-10">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          {eyebrow && <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-ocean">{eyebrow}</p>}
          <h2 className="font-serif text-xl tracking-tight text-slate-900 md:text-2xl">{title}</h2>
        </div>
        <Link href={href} className="shrink-0 text-sm font-semibold text-ocean hover:underline">View all →</Link>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {ordered.length > 0
          ? ordered.map((it) => (
              <MarketplaceCard
                key={it.id}
                item={it}
                sectionKey={sectionKey}
                fallbackImage={fallbackImage}
                categoryName={catById.get(it.category_id)?.name ?? null}
                locationName={it.location_id ? locById.get(it.location_id)?.name ?? null : null}
              />
            ))
          : PREVIEW_TITLES[sectionKey].map((t) => <PreviewCard key={t} title={t} href={href} image={fallbackImage} />)}
      </div>
    </section>
  );
}
