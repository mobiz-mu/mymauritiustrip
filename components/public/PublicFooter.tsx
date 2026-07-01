import Link from 'next/link';
import { WHATSAPP, SUPPORT_EMAIL } from '@/components/public/PublicHeader';
import { HOME_CATEGORIES } from '@/lib/home/content';

export default function PublicFooter() {
  return (
    <footer className="bg-gradient-to-br from-ocean to-turquoise text-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/home/mmt-logo.png" alt="MyMauritiusTrip" className="h-9 w-auto brightness-0 invert" />
          <p className="mt-3 max-w-xs text-sm text-white/85">
            Your whole Mauritius trip in one trusted place — verified providers, pay on arrival, local support.
          </p>
          <div className="mt-4 flex gap-3">
            <a href={`https://wa.me/${WHATSAPP}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:brightness-105">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 00-8.6 15l-1.3 4.8 4.9-1.3A10 10 0 1012 2zm0 2a8 8 0 11-4.1 14.9l-.3-.2-2.9.8.8-2.8-.2-.3A8 8 0 0112 4z" /></svg>
              WhatsApp
            </a>
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-white/70">Explore</h3>
          <ul className="mt-3 space-y-2 text-sm text-white/90">
            {HOME_CATEGORIES.slice(0, 6).map((c) => (
              <li key={c.title}><Link href={c.href} className="hover:text-white hover:underline">{c.title}</Link></li>
            ))}
            <li><Link href="/search" className="font-medium text-white hover:underline">All experiences →</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-white/70">Providers</h3>
          <ul className="mt-3 space-y-2 text-sm text-white/90">
            <li><Link href="/provider-signup" className="hover:text-white hover:underline">List your business</Link></li>
            <li><Link href="/login" className="hover:text-white hover:underline">Provider login</Link></li>
            <li><Link href="/request-transfer" className="hover:text-white hover:underline">Request a trip</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-white/70">Support</h3>
          <ul className="mt-3 space-y-2 text-sm text-white/90">
            <li><a href={`https://wa.me/${WHATSAPP}`} target="_blank" rel="noopener noreferrer" className="hover:text-white hover:underline">WhatsApp +230 5506 8119</a></li>
            <li><a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-white hover:underline">{SUPPORT_EMAIL}</a></li>
          </ul>
          <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-white/70">Legal</h3>
          <ul className="mt-3 space-y-2 text-sm text-white/90">
            <li><Link href="/terms" className="hover:text-white hover:underline">Terms</Link></li>
            <li><Link href="/privacy" className="hover:text-white hover:underline">Privacy</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/15">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-5 py-5 text-xs text-white/75 sm:flex-row">
          <p>© {new Date().getFullYear()} MyMauritiusTrip.com — All communication stays on-platform.</p>
          <p>Made in Mauritius 🇲🇺</p>
        </div>
      </div>
    </footer>
  );
}
