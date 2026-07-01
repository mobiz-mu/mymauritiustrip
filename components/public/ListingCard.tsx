import Link from 'next/link';
import type { ListingCardData } from '@/lib/public/catalog';
import { Badges, Stars, formatMUR, priceUnitLabel } from './ui';

export default function ListingCard({
  item,
  categoryName,
  locationName,
}: {
  item: ListingCardData;
  categoryName: string | null;
  locationName: string | null;
}) {
  return (
    <article className="group overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200 transition hover:shadow-lg">
      <Link href={`/listings/${item.slug}`} className="block">
        <div className="relative aspect-[4/3] bg-slate-100">
          {item.cover_card_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.cover_card_url}
              alt={item.title}
              loading="lazy"
              className="h-full w-full object-cover transition group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">No photo yet</div>
          )}
          <div className="absolute left-2 top-2">
            <Badges verified={item.business_status === 'verified'} premium={item.is_premium} featured={item.is_featured} />
          </div>
        </div>
      </Link>

      <div className="space-y-1.5 p-3">
        <div className="flex items-center justify-between text-[11px] text-slate-500">
          <span>{categoryName ?? ''}</span>
          <span>{locationName ?? ''}</span>
        </div>
        <Link href={`/listings/${item.slug}`}>
          <h3 className="line-clamp-1 font-semibold text-slate-900">{item.title}</h3>
        </Link>
        <p className="line-clamp-2 text-xs text-slate-500">{item.description}</p>
        <Stars rating={item.rating_avg} count={item.review_count} />
        <div className="flex items-center justify-between pt-1">
          <p className="text-sm">
            <span className="font-bold text-slate-900">{formatMUR(item.base_price_mur)}</span>{' '}
            <span className="text-xs text-slate-500">{priceUnitLabel(item.price_unit)}</span>
          </p>
        </div>
        <div className="flex gap-2 pt-1">
          <Link
            href={`/listings/${item.slug}`}
            className="flex-1 rounded-lg bg-ocean px-3 py-1.5 text-center text-xs font-semibold text-white"
          >
            View details
          </Link>
          <Link
            href={`/listings/${item.slug}#book`}
            className="flex-1 rounded-lg ring-1 ring-slate-300 px-3 py-1.5 text-center text-xs font-semibold text-slate-700"
          >
            Request / Book
          </Link>
        </div>
      </div>
    </article>
  );
}
