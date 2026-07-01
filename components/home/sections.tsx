import type { ReactNode } from 'react';
import Link from 'next/link';
import type { ListingCardData } from '@/lib/public/catalog';
import { WHATSAPP, SUPPORT_EMAIL } from '@/components/public/PublicHeader';
import { formatMUR } from '@/components/public/ui';
import { HOME_CATEGORIES, VALUE_PROPS, TRIP_SERVICES, type IconKey } from '@/lib/home/content';
import { Icon } from './icons';

type Ref = { slug: string; name: string };

/* image panel with gradient overlay (SVG art in /public/home; swap for photos) */
function Scene({ src, className = '', overlay = true, children }: { src: string; className?: string; overlay?: boolean; children?: ReactNode }) {
  return (
    <div className={`relative overflow-hidden bg-slate-100 bg-cover bg-center ${className}`} style={{ backgroundImage: `url(${src})` }}>
      {overlay && <span className="absolute inset-0 bg-gradient-to-t from-slate-900/55 via-slate-900/10 to-transparent" aria-hidden="true" />}
      {children}
    </div>
  );
}

function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm ring-1 ring-slate-200">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="text-turquoise" aria-hidden="true"><path d="M5 12l4.5 4.5L19 7" /></svg>
      {children}
    </span>
  );
}

function Heading({ eyebrow, title, subtitle, href }: { eyebrow?: string; title: string; subtitle?: string; href?: string }) {
  return (
    <div className="mb-7 flex items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-ocean">{eyebrow}</p>}
        <h2 className="font-serif text-2xl tracking-tight text-slate-900 md:text-[30px]">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {href && <Link href={href} className="hidden shrink-0 text-sm font-semibold text-ocean hover:underline sm:block">View all →</Link>}
    </div>
  );
}

/* ---------------------------------------------------------------- Hero */
export function HomeHero({ categories, locations }: { categories: Ref[]; locations: Ref[] }) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[#eaf5fb] via-[#f5fafd] to-white">
      <div className="pointer-events-none absolute -right-28 -top-28 h-80 w-80 rounded-full bg-turquoise/20 blur-3xl" aria-hidden="true" />
      <div className="mx-auto max-w-6xl px-4 pb-10 pt-10 sm:px-6 md:pb-16 md:pt-14">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          {/* copy */}
          <div>
            <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-ocean ring-1 ring-ocean/15">
              Mauritius travel marketplace
            </p>
            <h1 className="font-serif text-[2.1rem] leading-[1.08] tracking-tight text-slate-900 sm:text-5xl md:text-[3.4rem]">
              Discover Mauritius stays, transfers and <span className="text-ocean">experiences</span> in one trusted place
            </h1>
            <p className="mt-4 max-w-xl text-base text-slate-600 md:text-lg">
              Book with verified local providers, pay on arrival, and plan your whole trip with local support.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link href="/search" className="rounded-full bg-ocean px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#095a96]">Explore Mauritius</Link>
              <Link href="/request-transfer" className="rounded-full bg-gold px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:brightness-105">Request a custom trip</Link>
              <Link href="/provider-signup" className="rounded-full border-2 border-ocean px-5 py-3 text-sm font-semibold text-ocean transition hover:bg-ocean/5">List your business</Link>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <Pill>Verified local providers</Pill>
              <Pill>Pay on arrival</Pill>
              <Pill>Local support</Pill>
            </div>
          </div>

          {/* image collage */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <Scene src="/home/hero-villa.svg" className="row-span-2 h-full min-h-[260px] rounded-3xl shadow-lg sm:min-h-[340px]">
              <span className="absolute bottom-3 left-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-800">Beachfront villas</span>
            </Scene>
            <Scene src="/home/hero-boat.svg" className="h-[122px] rounded-3xl shadow-lg sm:h-[160px]">
              <span className="absolute bottom-3 left-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-800">Catamaran days</span>
            </Scene>
            <Scene src="/home/hero-beach.svg" className="h-[122px] rounded-3xl shadow-lg sm:h-[160px]">
              <span className="absolute bottom-3 left-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-800">Island experiences</span>
            </Scene>
          </div>
        </div>

        {/* search panel */}
        <form action="/search" method="get" className="mt-9 grid grid-cols-1 gap-2.5 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-[0_18px_50px_-18px_rgba(11,111,184,0.4)] sm:grid-cols-2 lg:grid-cols-[1.1fr_1fr_0.9fr_0.8fr_auto]">
          <Field label="What">
            <select name="category" className="w-full bg-transparent text-sm text-slate-800 outline-none">
              <option value="">All experiences</option>
              {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Where">
            <select name="location" className="w-full bg-transparent text-sm text-slate-800 outline-none">
              <option value="">Anywhere in Mauritius</option>
              {locations.map((l) => <option key={l.slug} value={l.slug}>{l.name}</option>)}
            </select>
          </Field>
          <Field label="When"><input type="date" name="when" className="w-full bg-transparent text-sm text-slate-800 outline-none" /></Field>
          <Field label="Travellers"><input type="number" name="travellers" min={1} placeholder="2" className="w-full bg-transparent text-sm text-slate-800 outline-none" /></Field>
          <button type="submit" className="flex items-center justify-center gap-2 rounded-xl bg-ocean px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#095a96]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3-3" /></svg>
            Search
          </button>
        </form>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-0.5 rounded-xl px-3 py-2 ring-1 ring-slate-200 transition focus-within:ring-2 focus-within:ring-ocean/60">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
      {children}
    </label>
  );
}

/* ---------------------------------------------------------------- Categories (image-led) */
export function CategoryGrid() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 md:py-16">
      <Heading eyebrow="Browse" title="Find your Mauritius experience" subtitle="Everything you need for a great island trip." href="/search" />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        {HOME_CATEGORIES.map((c) => (
          <Link
            key={c.title}
            href={c.href}
            className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-16px_rgba(15,23,42,0.25)]"
          >
            <Scene src={c.image} className="h-24 sm:h-28">
              <span className="absolute left-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/90 text-ocean shadow-sm">
                <Icon name={c.icon} size={17} />
              </span>
            </Scene>
            <div className="flex flex-1 flex-col p-4">
              <h3 className="text-sm font-semibold text-slate-900">{c.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{c.blurb}</p>
              <span className="mt-3 text-xs font-semibold text-ocean">Explore →</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- Featured (compact one-row) */
type NameMap = ReadonlyMap<string, { name: string }>;
const PREVIEWS = [
  { title: 'Villas by the coast', href: '/villas-mauritius', image: '/home/villas.svg', badge: 'Stays' },
  { title: 'Private airport transfers', href: '/airport-transfer-mauritius', image: '/home/airport.svg', badge: 'Transfers' },
  { title: 'Catamaran lagoon day', href: '/catamaran-cruise-mauritius', image: '/home/boat.svg', badge: 'Experiences' },
  { title: 'Local restaurants', href: '/restaurants-mauritius', image: '/home/restaurants.svg', badge: 'Dining' },
];

export function FeaturedExperiences({ items, catById, locById }: { items: ListingCardData[]; catById: NameMap; locById: NameMap }) {
  const row = items.slice(0, 4);
  return (
    <section className="border-y border-slate-100 bg-slate-50/70">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 md:py-12">
        <Heading eyebrow="Handpicked" title="Featured experiences" subtitle="A taste of what's bookable on the island." href="/search" />
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {row.length > 0
            ? row.map((it) => {
                const cat = catById.get(it.category_id)?.name ?? null;
                const loc = it.location_id ? locById.get(it.location_id)?.name ?? null : null;
                return (
                  <Link key={it.id} href={`/listings/${it.slug}`} className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-16px_rgba(15,23,42,0.25)]">
                    <Scene src={it.cover_card_url ?? '/home/hero-villa.svg'} className="h-28 sm:h-32">
                      {it.is_premium && <span className="absolute left-2.5 top-2.5 rounded-full bg-gold px-2 py-0.5 text-[10px] font-bold text-slate-900">Premium</span>}
                    </Scene>
                    <div className="flex flex-1 flex-col p-3">
                      <p className="text-[11px] font-medium text-slate-400">{[cat, loc].filter(Boolean).join(' · ') || 'Mauritius'}</p>
                      <h3 className="mt-0.5 line-clamp-1 text-sm font-semibold text-slate-900">{it.title}</h3>
                      <p className="mt-auto pt-2 text-sm font-bold text-slate-900">{it.base_price_mur > 0 ? formatMUR(it.base_price_mur) : 'View →'}</p>
                    </div>
                  </Link>
                );
              })
            : PREVIEWS.map((p) => (
                <Link key={p.title} href={p.href} className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-16px_rgba(15,23,42,0.25)]">
                  <Scene src={p.image} className="h-28 sm:h-32">
                    <span className="absolute left-2.5 top-2.5 rounded-full bg-gold px-2 py-0.5 text-[10px] font-semibold text-slate-900">{p.badge}</span>
                  </Scene>
                  <div className="flex flex-1 flex-col p-3">
                    <h3 className="line-clamp-1 text-sm font-semibold text-slate-900">{p.title}</h3>
                    <span className="mt-auto pt-2 text-xs font-semibold text-ocean">Explore →</span>
                  </div>
                </Link>
              ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- Why us */
export function ValueProps() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 md:py-16">
      <Heading eyebrow="Trust" title="Why book with MyMauritiusTrip" subtitle="One trustworthy place for your whole island trip." />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        {VALUE_PROPS.map((v) => (
          <div key={v.title} className="rounded-2xl bg-gradient-to-b from-white to-slate-50 p-4 ring-1 ring-slate-200">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-ocean/10 text-ocean"><Icon name={v.icon} size={18} /></span>
            <h3 className="mt-3 text-sm font-semibold text-slate-900">{v.title}</h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">{v.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- Plan your trip / DMC */
export function RequestTripBand() {
  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6">
      <div className="overflow-hidden rounded-3xl border border-ocean/15 bg-gradient-to-br from-[#0b6fb8] to-[#1bc0c9] p-1.5">
        <div className="grid items-stretch gap-0 overflow-hidden rounded-[1.35rem] md:grid-cols-[1.1fr_1fr]">
          <div className="bg-white p-7 md:p-10">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-ocean">Local trip planning</p>
            <h2 className="font-serif text-2xl tracking-tight text-slate-900 md:text-[28px]">Plan your Mauritius trip with local support</h2>
            <p className="mt-2 max-w-md text-sm text-slate-600">Tell us your dates and ideas — our local team arranges transfers, stays, cruises and experiences, end to end.</p>
            <Link href="/request-transfer" className="mt-5 inline-block rounded-full bg-ocean px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#095a96]">Request your trip</Link>
          </div>
          <div className="bg-white/10 p-7 md:p-10">
            <p className="mb-3 text-sm font-semibold text-white">Your trip, handled:</p>
            <ul className="grid grid-cols-1 gap-2">
              {TRIP_SERVICES.map((s) => (
                <li key={s.label} className="flex items-center gap-2.5 rounded-xl bg-white/15 px-3 py-2.5 text-sm font-medium text-white ring-1 ring-white/20">
                  <Icon name={s.icon} size={16} className="text-gold" /> {s.label}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- Provider CTA */
export function ProviderBand() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 md:py-16">
      <div className="grid items-stretch gap-0 overflow-hidden rounded-3xl border border-slate-200 bg-white md:grid-cols-[1.4fr_1fr]">
        <div className="p-7 md:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">For local businesses</p>
          <h2 className="mt-1.5 font-serif text-2xl tracking-tight text-slate-900 md:text-[28px]">List your Mauritius tourism business</h2>
          <p className="mt-2 max-w-lg text-sm text-slate-600">Join a verified, trusted marketplace reaching travellers across the island. Manage your listings, receive booking requests, and track everything from one dashboard.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/provider-signup" className="rounded-full bg-ocean px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#095a96]">List your business</Link>
            <Link href="/login" className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 transition hover:border-slate-400">Provider login</Link>
          </div>
        </div>
        <Scene src="/home/hero-boat.svg" className="min-h-[200px]">
          <div className="absolute inset-0 flex flex-col justify-end gap-2 p-6">
            {[['shield', 'Verified, trusted marketplace'], ['star', 'Up to 7 listings per business'], ['chat', 'Booking requests in one dashboard'], ['wallet', 'Pay-on-arrival · 15% commission']].map(([ic, tx]) => (
              <span key={tx} className="inline-flex items-center gap-2 rounded-lg bg-white/92 px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm">
                <Icon name={ic as IconKey} size={15} className="text-ocean" /> {tx}
              </span>
            ))}
          </div>
        </Scene>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- Support */
export function SupportBand() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-14 sm:px-6">
      <div className="flex flex-col items-center gap-4 rounded-3xl border border-turquoise/20 bg-gradient-to-br from-turquoise/10 to-white px-6 py-10 text-center">
        <h2 className="font-serif text-2xl tracking-tight text-slate-900 md:text-[28px]">Here to help, before and during your trip</h2>
        <p className="max-w-xl text-sm text-slate-600">Questions about a booking or planning? Reach our local team directly. All communication stays on MyMauritiusTrip.com — you never need to chase a provider off-platform.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <a href={`https://wa.me/${WHATSAPP}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:brightness-105">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 00-8.6 15l-1.3 4.8 4.9-1.3A10 10 0 1012 2zm0 2a8 8 0 11-4.1 14.9l-.3-.2-2.9.8.8-2.8-.2-.3A8 8 0 0112 4zm4.5 9.8c-.2-.1-1.4-.7-1.6-.8-.2-.1-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1a6.5 6.5 0 01-3.2-2.8c-.1-.2 0-.4.1-.5l.4-.5.2-.4v-.4l-.8-1.8c-.2-.4-.4-.4-.5-.4h-.5a1 1 0 00-.7.3 3 3 0 00-.9 2.2c0 1.3.9 2.5 1.1 2.7.1.2 1.9 2.9 4.6 3.9 1.7.6 2.3.7 2.9.6.6-.1 1.4-.6 1.6-1.1.2-.5.2-1 .1-1.1l-.2-.2z" /></svg>
            WhatsApp +230 5506 8119
          </a>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 transition hover:border-slate-400">{SUPPORT_EMAIL}</a>
        </div>
      </div>
    </section>
  );
}
