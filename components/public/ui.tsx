export function formatMUR(n: number): string {
  return 'Rs ' + Math.round(n).toLocaleString('en-US');
}

export function priceUnitLabel(u: string): string {
  return (
    {
      per_night: '/ night',
      per_day: '/ day',
      per_person: '/ person',
      per_trip: '/ trip',
      per_booking: '/ booking',
      half_day: '/ half day',
      full_day: '/ full day',
    }[u] ?? ''
  );
}

export function Badges({
  verified,
  premium,
  featured,
}: {
  verified?: boolean;
  premium?: boolean;
  featured?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {verified && (
        <span className="rounded-full bg-ocean/10 px-2 py-0.5 text-[11px] font-medium text-ocean">✓ Verified</span>
      )}
      {featured && (
        <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[11px] font-medium text-gold">★ Featured</span>
      )}
      {premium && (
        <span className="rounded-full bg-turquoise/15 px-2 py-0.5 text-[11px] font-medium text-turquoise">Premium</span>
      )}
    </div>
  );
}

export function Stars({ rating, count }: { rating: number; count: number }) {
  if (!count) return <span className="text-xs text-slate-400">No reviews yet</span>;
  return (
    <span className="text-xs text-slate-600">
      <span className="text-gold">★</span> {rating.toFixed(1)} <span className="text-slate-400">({count})</span>
    </span>
  );
}
