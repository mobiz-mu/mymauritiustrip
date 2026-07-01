import Link from 'next/link';

// All links map to existing routes (no dead links).
const STAYS = [
  { label: 'Villas', href: '/villas-mauritius' },
  { label: 'Apartments', href: '/apartments-mauritius' },
  { label: 'Studios', href: '/studios-mauritius' },
  { label: 'Holiday homes', href: '/holiday-homes-mauritius' },
];
const TRANSFERS = [
  { label: 'Airport transfer', href: '/airport-transfer-mauritius' },
  { label: 'Taxi service', href: '/taxi-service-mauritius' },
  { label: 'Private driver', href: '/private-driver-mauritius' },
  { label: 'Car rental', href: '/car-rental-mauritius' },
  { label: 'Scooter rental', href: '/scooter-rental-mauritius' },
];
const EXPERIENCES = [
  { label: 'Catamaran cruises', href: '/catamaran-cruise-mauritius' },
  { label: 'Boat trips', href: '/boat-trips-mauritius' },
  { label: 'Things to do', href: '/things-to-do-mauritius' },
  { label: 'Restaurants', href: '/restaurants-mauritius' },
];
const ALL_LINKS = [...STAYS, ...TRANSFERS, ...EXPERIENCES,
  { label: 'About Mauritius', href: '/about-mauritius' },
  { label: 'Contact', href: '/contact' },
  { label: 'Plan my trip', href: '/request-transfer' },
  { label: 'List your business', href: '/provider-signup' },
];

// Small 3D-style announcement icon: a soft gradient chip (Mauritius-flag accent)
// with a white glyph and subtle shadow. Pure SVG/CSS — no heavy libraries.
const FLAG = { red: '#EA2839', blue: '#1A206D', yellow: '#FFD500', green: '#00A551' };
function Chip({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex h-5 w-5 items-center justify-center rounded-[7px] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_1px_2px_rgba(0,0,0,0.25)]"
      style={{ background: `linear-gradient(145deg, ${color}, ${color}cc)` }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
    </span>
  );
}
const ANNOUNCE = [
  { color: FLAG.blue, glyph: <path d="M12 3l7 3v5c0 4-3 6.5-7 8-4-1.5-7-4-7-8V6l7-3zM9 12l2 2 4-4" />, label: 'Verified Mauritius providers' },
  { color: FLAG.green, glyph: <path d="M3 8h15a2 2 0 012 2v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm14 6h.01" />, label: 'Pay on arrival' },
  { color: FLAG.yellow, glyph: <path d="M5 5h14v9H9l-4 3V5z" />, label: 'Local WhatsApp support' },
  { color: FLAG.red, glyph: <path d="M7 10V8a5 5 0 0110 0v2M5.5 10h13v9h-13z" />, label: 'Secure on-platform communication' },
];

function Logo() {
  return (
    <Link href="/" className="flex items-center" aria-label="MyMauritiusTrip home">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/home/mmt-logo.png" alt="MyMauritiusTrip" className="h-11 w-auto sm:h-12" />
    </Link>
  );
}

function Chevron() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition group-hover:rotate-180" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>;
}

function MegaItem({ label, items }: { label: string; items: { label: string; href: string }[] }) {
  return (
    <div className="group relative">
      <button type="button" className="flex items-center gap-1 rounded-full px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900">
        {label} <Chevron />
      </button>
      <div className="invisible absolute left-0 top-full z-50 pt-2 opacity-0 transition group-hover:visible group-hover:opacity-100">
        <div className="w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
          {items.map((it) => (
            <Link key={it.href} href={it.href} className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-ocean">{it.label}</Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function SiteHeader() {
  return (
    <>
      {/* announcement bar */}
      <div className="bg-gradient-to-r from-ocean to-turquoise text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-center gap-x-6 px-4 py-2 text-[12px] font-medium">
          {ANNOUNCE.map((a, i) => (
            <span key={a.label} className={`items-center gap-2 ${i < 2 ? 'inline-flex' : 'hidden md:inline-flex'}`}>
              <Chip color={a.color}>{a.glyph}</Chip> {a.label}
            </span>
          ))}
        </div>
      </div>

      {/* sticky header */}
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-[70px] max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo />

          <nav className="hidden items-center gap-1 lg:flex">
            <MegaItem label="Stays" items={STAYS} />
            <MegaItem label="Transfers & cars" items={TRANSFERS} />
            <MegaItem label="Experiences" items={EXPERIENCES} />
            <Link href="/about-mauritius" className="rounded-full px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900">About Mauritius</Link>
            <Link href="/contact" className="rounded-full px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900">Contact</Link>
          </nav>

          <div className="flex items-center gap-2">
            <Link href="/provider-signup" className="hidden text-sm font-medium text-ocean transition hover:underline md:inline">List your business</Link>
            <Link href="/login" aria-label="Log in" title="Log in" className="flex h-10 w-10 items-center justify-center rounded-full bg-gold text-slate-900 shadow-sm transition hover:brightness-105">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="3.2" /><path d="M5.5 20a6.5 6.5 0 0113 0" /></svg>
            </Link>
            <Link href="/client-signup" aria-label="Sign up" title="Sign up" className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm transition hover:bg-emerald-700">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="10" cy="8" r="3.2" /><path d="M3.5 20a6.5 6.5 0 0112-3.2M18 8v6M15 11h6" /></svg>
            </Link>

            {/* mobile menu (no JS — native <details>) */}
            <details className="relative lg:hidden [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-full text-slate-700 ring-1 ring-slate-200">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
              </summary>
              <div className="absolute right-0 mt-2 max-h-[70vh] w-64 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                {ALL_LINKS.map((n) => (
                  <Link key={n.href + n.label} href={n.href} className="block rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">{n.label}</Link>
                ))}
              </div>
            </details>
          </div>
        </div>
      </header>
    </>
  );
}
