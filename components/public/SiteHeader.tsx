import Link from 'next/link';
import { Icon } from '@/components/home/icons';
import type { IconKey } from '@/lib/home/content';

// Menu items map ONLY to existing routes (no dead links).
const NAV = [
  { label: 'Stays', href: '/villas-mauritius' },
  { label: 'Transfers', href: '/airport-transfer-mauritius' },
  { label: 'Things to do', href: '/things-to-do-mauritius' },
  { label: 'Restaurants', href: '/restaurants-mauritius' },
  { label: 'Plan my trip', href: '/request-transfer' },
];

const ANNOUNCE: { icon: IconKey; label: string }[] = [
  { icon: 'shield', label: 'Verified Mauritius providers' },
  { icon: 'wallet', label: 'Pay on arrival' },
  { icon: 'chat', label: 'Local WhatsApp support' },
  { icon: 'lock', label: 'Secure on-platform communication' },
];

// Logo image only (no text). Place the real logo at public/home/mmt-logo.png.
function Logo() {
  return (
    <Link href="/" className="flex items-center" aria-label="MyMauritiusTrip home">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/home/mmt-logo.png" alt="MyMauritiusTrip" className="h-9 w-auto sm:h-10" />
    </Link>
  );
}

export default function SiteHeader() {
  return (
    <>
      {/* announcement bar */}
      <div className="bg-gradient-to-r from-ocean to-turquoise text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-center gap-x-6 px-4 py-2 text-[12px] font-medium">
          {ANNOUNCE.map((a, i) => (
            <span key={a.label} className={`items-center gap-1.5 ${i < 2 ? 'inline-flex' : 'hidden md:inline-flex'}`}>
              <Icon name={a.icon} size={14} className="text-white/90" /> {a.label}
            </span>
          ))}
        </div>
      </div>

      {/* sticky header */}
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo />

          <nav className="hidden items-center gap-7 text-sm font-medium text-slate-600 lg:flex">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="transition hover:text-slate-900">{n.label}</Link>
            ))}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <Link href="/provider-signup" className="rounded-full bg-ocean px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#095a96]">List your business</Link>
            <Link href="/login" className="rounded-full bg-gold px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:brightness-105">Log in</Link>
            <Link href="/client-signup" className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700">Sign up</Link>
          </div>

          {/* mobile menu (no JS — native <details>) */}
          <details className="relative md:hidden [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-full text-slate-700 ring-1 ring-slate-200">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
            </summary>
            <div className="absolute right-0 mt-2 w-60 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="block rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">{n.label}</Link>
              ))}
              <div className="my-1.5 border-t border-slate-100" />
              <Link href="/provider-signup" className="mb-1 block rounded-lg bg-ocean px-3 py-2.5 text-center text-sm font-semibold text-white">List your business</Link>
              <Link href="/login" className="mb-1 block rounded-lg bg-gold px-3 py-2.5 text-center text-sm font-semibold text-slate-900">Log in</Link>
              <Link href="/client-signup" className="block rounded-lg bg-emerald-600 px-3 py-2.5 text-center text-sm font-semibold text-white">Sign up</Link>
            </div>
          </details>
        </div>
      </header>
    </>
  );
}
