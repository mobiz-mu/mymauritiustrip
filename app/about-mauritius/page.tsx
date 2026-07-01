import type { Metadata } from 'next';
import Link from 'next/link';
import PublicShell from '@/components/public/PublicShell';
import { JsonLd } from '@/components/seo/JsonLd';
import { touristDestinationLd, breadcrumbLd } from '@/lib/seo/jsonld';
import { canonical } from '@/lib/seo/site';
import { HOME_CATEGORIES } from '@/lib/home/content';

export const metadata: Metadata = {
  title: 'About Mauritius — beaches, culture, food & travel tips',
  description:
    'Discover Mauritius: turquoise lagoons and white-sand beaches, a warm multicultural island, incredible Creole food, and unforgettable experiences. Plan your trip with verified local providers.',
  alternates: { canonical: canonical('/about-mauritius') },
  keywords: ['about Mauritius', 'Mauritius travel guide', 'Mauritius beaches', 'Mauritius culture', 'Mauritius food', 'honeymoon Mauritius'],
  openGraph: { title: 'About Mauritius | MyMauritiusTrip', description: 'Beaches, culture, food and travel tips for your Mauritius trip.', url: canonical('/about-mauritius'), type: 'article', images: [{ url: '/home/hero-beach.svg' }] },
};

function Block({ img, title, children, reverse = false }: { img: string; title: string; children: React.ReactNode; reverse?: boolean }) {
  return (
    <div className={`grid items-center gap-6 md:grid-cols-2 ${reverse ? 'md:[&>*:first-child]:order-2' : ''}`}>
      <div className="relative h-56 overflow-hidden rounded-3xl bg-cover bg-center shadow-sm md:h-64" style={{ backgroundImage: `url(${img})` }} aria-hidden="true" />
      <div>
        <h2 className="font-serif text-2xl tracking-tight text-slate-900 md:text-[26px]">{title}</h2>
        <div className="mt-2 space-y-2 text-sm leading-relaxed text-slate-600">{children}</div>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <PublicShell>
      <JsonLd data={[touristDestinationLd(), breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'About Mauritius', path: '/about-mauritius' }])]} />

      <section className="relative overflow-hidden">
        <div className="h-64 bg-cover bg-center md:h-80" style={{ backgroundImage: 'url(/home/hero-beach.svg)' }} aria-hidden="true" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/55 to-transparent" aria-hidden="true" />
        <div className="absolute inset-x-0 bottom-0">
          <div className="mx-auto max-w-4xl px-6 pb-8">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-white/90">The island</p>
            <h1 className="font-serif text-3xl tracking-tight text-white md:text-5xl">About Mauritius</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/90 md:text-base">A jewel of the Indian Ocean — turquoise lagoons, green mountains, and a warm, multicultural welcome.</p>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-4xl space-y-12 px-6 py-12">
        <p className="text-base leading-relaxed text-slate-700">
          Mauritius is a small island nation roughly 2,000 km off the southeast coast of Africa, ringed by one of the
          world&rsquo;s great coral lagoons. In a single day you can snorkel a technicolour reef, hike a volcanic
          peak, taste Creole, Indian, Chinese and French flavours, and watch the sun set over sugarcane fields. It is
          famous for honeymoons and family holidays, but there is far more to discover — and the best way to see it is
          with trusted local people who call the island home.
        </p>

        <Block img="/home/hero-villa.svg" title="Beaches & lagoons">
          <p>Powder-white sand and calm, shallow lagoons make the coast ideal for swimming, snorkelling and paddleboarding. The north (Grand Baie, Trou aux Biches) is lively; the east (Belle Mare) is serene; the wild south and west (Le Morne, Flic en Flac) draw surfers and sunset-lovers.</p>
        </Block>

        <Block img="/home/things-to-do.svg" title="Nature & adventure" reverse>
          <p>Beyond the beach lies Black River Gorges National Park, the coloured earths of Chamarel, waterfalls, and the UNESCO-listed Le Morne mountain. Dolphins, catamaran cruises and diving fill the water; ziplines, hikes and quad trails fill the land.</p>
        </Block>

        <Block img="/home/wedding.svg" title="Culture & people">
          <p>Mauritius is a genuine melting pot — Indian, African, Chinese, European and Creole heritage live side by side. Temples, mosques, churches and pagodas share the same streets, and festivals run through the year. English and French are widely spoken, with Mauritian Creole as the heart language.</p>
        </Block>

        <Block img="/home/restaurants.svg" title="Food to remember" reverse>
          <p>Street dholl puri, fiery vindaye, fresh seafood, rougaille and rum — Mauritian cuisine is a highlight in its own right. Eat at seafront tables, family kitchens and fine-dining rooms, all bookable through verified local restaurants.</p>
        </Block>

        <section className="rounded-3xl border border-slate-200 bg-slate-50/60 p-6 md:p-8">
          <h2 className="font-serif text-2xl tracking-tight text-slate-900">Travel & safety tips</h2>
          <ul className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
            <li>• Drive on the left; roads are good but winding — a private driver is easy and stress-free.</li>
            <li>• The lagoon is calm, but always check local flags and currents on open-sea beaches.</li>
            <li>• Sun is strong year-round; carry water, hat and reef-safe sunscreen.</li>
            <li>• Peak sun and heat are Nov–Apr; cooler, drier months are May–Oct.</li>
            <li>• Mauritius is welcoming and generally very safe; use normal travel common sense.</li>
            <li>• Keep bookings and payments on-platform for protection and clear pricing.</li>
          </ul>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-ocean/15 bg-gradient-to-br from-[#eef7fc] to-white p-6">
            <h2 className="font-serif text-xl tracking-tight text-slate-900">Why book with local providers</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">Local hosts, drivers and operators know the island, the tides, the shortcuts and the hidden spots. Booking locally means fairer prices, authentic experiences, and money that stays in the community.</p>
          </div>
          <div className="rounded-3xl border border-turquoise/20 bg-gradient-to-br from-turquoise/10 to-white p-6">
            <h2 className="font-serif text-xl tracking-tight text-slate-900">Why MyMauritiusTrip</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">Every provider is verified before listing. You browse, compare and book stays, transfers, cruises and experiences in one place, pay on arrival, and get local support — with all communication kept safely on-platform.</p>
          </div>
        </section>

        <section>
          <h2 className="mb-4 font-serif text-2xl tracking-tight text-slate-900">Start planning</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {HOME_CATEGORIES.slice(0, 8).map((c) => (
              <Link key={c.title} href={c.href} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-800 transition hover:-translate-y-0.5 hover:border-turquoise/40 hover:shadow-sm">
                {c.title} <span className="text-ocean">→</span>
              </Link>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/search" className="rounded-full bg-ocean px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#095a96]">Explore Mauritius</Link>
            <Link href="/request-transfer" className="rounded-full bg-gold px-5 py-3 text-sm font-semibold text-slate-900 transition hover:brightness-105">Request a custom trip</Link>
          </div>
        </section>
      </main>
    </PublicShell>
  );
}
