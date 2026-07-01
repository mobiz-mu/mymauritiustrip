// Central site + SEO configuration. NEXT_PUBLIC_SITE_URL should be your real
// domain in production so canonical/OG URLs resolve correctly.
export const SITE = {
  name: 'MyMauritiusTrip',
  legalName: 'MyMauritiusTrip.com',
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
  defaultTitle: 'MyMauritiusTrip.com — Villas, transfers, cruises & experiences in Mauritius',
  description:
    'Book villas, car rental, taxis, airport transfers, catamaran cruises, restaurants and things to do in Mauritius from verified local providers. Pay on arrival, local support, all in one place.',
  ogImage: '/home/hero-beach.svg',
  locale: 'en_US',
  supportWhatsapp: '23055068119',
  supportEmail: 'info@mymauritiustrip.com',
  keywords: [
    'Mauritius travel marketplace',
    'villas in Mauritius',
    'apartments in Mauritius',
    'car rental Mauritius',
    'airport transfer Mauritius',
    'taxi Mauritius',
    'private driver Mauritius',
    'catamaran cruise Mauritius',
    'boat trips Mauritius',
    'things to do in Mauritius',
    'restaurants Mauritius',
    'honeymoon Mauritius',
    'Mauritius tours and experiences',
    'verified local providers Mauritius',
    'pay on arrival Mauritius',
  ],
} as const;

export function canonical(path: string): string {
  const base = SITE.url.replace(/\/$/, '');
  return path === '/' ? base : `${base}${path.startsWith('/') ? path : `/${path}`}`;
}
