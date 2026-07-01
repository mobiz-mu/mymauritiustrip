import type { Metadata } from 'next';
import PublicShell from '@/components/public/PublicShell';
import { JsonLd } from '@/components/seo/JsonLd';
import { breadcrumbLd } from '@/lib/seo/jsonld';
import { canonical } from '@/lib/seo/site';
import ContactForm from './contact-form';

const WHATSAPP = '23055068119';
const SUPPORT_EMAIL = 'info@mymauritiustrip.com';

export const metadata: Metadata = {
  title: 'Contact Us',
  description: 'Get in touch with MyMauritiusTrip support. WhatsApp +230 5506 8119 or email info@mymauritiustrip.com. We help plan and book your Mauritius trip.',
  alternates: { canonical: canonical('/contact') },
  openGraph: { title: 'Contact Us | MyMauritiusTrip', description: 'WhatsApp or email our local Mauritius support team.', url: canonical('/contact'), type: 'website', images: [{ url: '/home/hero-boat.svg' }] },
};

export default function Page() {
  return (
    <PublicShell>
      <JsonLd data={breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Contact', path: '/contact' }])} />

      <section className="relative overflow-hidden bg-gradient-to-b from-[#eaf5fb] via-[#f5fafd] to-white">
        <div className="mx-auto max-w-4xl px-6 py-10 md:py-14">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-ocean">We&rsquo;re here to help</p>
          <h1 className="font-serif text-3xl tracking-tight text-slate-900 md:text-4xl">Contact us</h1>
          <p className="mt-2 max-w-xl text-sm text-slate-600">Questions about a booking or planning your trip? Reach our local team directly. All communication stays on MyMauritiusTrip.com.</p>
        </div>
      </section>

      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="grid gap-6 md:grid-cols-2">
          {/* contact channels + form */}
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <a href={`https://wa.me/${WHATSAPP}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:brightness-105">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 00-8.6 15l-1.3 4.8 4.9-1.3A10 10 0 1012 2zm0 2a8 8 0 11-4.1 14.9l-.3-.2-2.9.8.8-2.8-.2-.3A8 8 0 0112 4z" /></svg>
                WhatsApp +230 5506 8119
              </a>
              <a href={`mailto:${SUPPORT_EMAIL}`} className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 transition hover:border-slate-400">
                {SUPPORT_EMAIL}
              </a>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="font-serif text-lg font-semibold text-slate-900">Send us a message</h2>
              <p className="mb-4 mt-1 text-sm text-slate-500">We usually reply within one business day.</p>
              <ContactForm />
            </div>
          </div>

          {/* map + info */}
          <div className="space-y-4">
            <div className="overflow-hidden rounded-3xl border border-slate-200 shadow-sm">
              <iframe
                title="MyMauritiusTrip location — Mauritius"
                src="https://maps.google.com/maps?q=Mobiz.mu,Mauritius&z=10&output=embed"
                className="h-64 w-full md:h-80"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
            <div className="rounded-3xl border border-turquoise/20 bg-turquoise/5 p-6">
              <h2 className="font-serif text-lg font-semibold text-slate-900">Support hours</h2>
              <p className="mt-1 text-sm text-slate-600">Our local Mauritius team is available daily. For the fastest response, message us on WhatsApp. For bookings, keep all communication on-platform so we can help if anything comes up.</p>
            </div>
          </div>
        </div>
      </main>
    </PublicShell>
  );
}
