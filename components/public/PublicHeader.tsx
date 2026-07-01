import Link from 'next/link';

export const WHATSAPP = '23055068119';
export const SUPPORT_EMAIL = 'info@mymauritiustrip.com';

export default function PublicHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/search" className="font-bold text-ocean">
          MyMauritiusTrip
        </Link>
        <div className="flex items-center gap-2 text-xs">
          <a
            href={`https://wa.me/${WHATSAPP}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-[#25D366] px-3 py-1.5 font-semibold text-white"
          >
            WhatsApp
          </a>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="rounded-lg ring-1 ring-slate-300 px-3 py-1.5 font-semibold text-slate-700">
            Email us
          </a>
        </div>
      </div>
    </header>
  );
}
