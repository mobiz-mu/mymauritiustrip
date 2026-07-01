import type { Metadata } from 'next';
import { SITE, canonical } from './site';

type Seo = { title: string; description: string; keywords: string[] };

// Natural, intent-rich metadata per category landing page (no keyword stuffing).
const LANDING_SEO: Record<string, Seo> = {
  'villas-mauritius': {
    title: 'Villas in Mauritius',
    description: 'Browse beachfront and private villas in Mauritius from verified local hosts. Compare pools, bedrooms and locations, and book with pay-on-arrival.',
    keywords: ['villas in Mauritius', 'beachfront villas Mauritius', 'private villa rental Mauritius', 'luxury villas Mauritius'],
  },
  'apartments-mauritius': {
    title: 'Apartments in Mauritius',
    description: 'Stylish apartments and self-catering stays across Mauritius from verified providers. Find sea-view and central options and book in minutes.',
    keywords: ['apartments in Mauritius', 'holiday apartments Mauritius', 'self catering Mauritius'],
  },
  'studios-mauritius': {
    title: 'Studios in Mauritius',
    description: 'Comfortable studio stays in Mauritius for couples and solo travellers. Verified local hosts, clear prices, pay on arrival.',
    keywords: ['studios in Mauritius', 'studio rental Mauritius', 'budget stays Mauritius'],
  },
  'holiday-homes-mauritius': {
    title: 'Holiday Homes in Mauritius',
    description: 'Spacious holiday homes for families and groups in Mauritius. Compare space, location and amenities from verified local hosts.',
    keywords: ['holiday homes Mauritius', 'family villas Mauritius', 'group accommodation Mauritius'],
  },
  'car-rental-mauritius': {
    title: 'Car Rental in Mauritius',
    description: 'Rent a car in Mauritius from trusted local providers. Compare transmission, seats and prices, and drive the island your way.',
    keywords: ['car rental Mauritius', 'car hire Mauritius', 'rent a car Mauritius', 'self drive Mauritius'],
  },
  'scooter-rental-mauritius': {
    title: 'Scooter Rental in Mauritius',
    description: 'Hire a scooter in Mauritius to explore coastal roads and villages. Verified local providers, clear pricing, easy booking.',
    keywords: ['scooter rental Mauritius', 'moped hire Mauritius', 'bike rental Mauritius'],
  },
  'airport-transfer-mauritius': {
    title: 'Airport Transfers in Mauritius',
    description: 'Book private airport transfers in Mauritius with meet-and-greet and fixed prices. Smooth arrivals and departures from verified drivers.',
    keywords: ['airport transfer Mauritius', 'SSR airport transfer', 'private transfer Mauritius', 'airport taxi Mauritius'],
  },
  'taxi-service-mauritius': {
    title: 'Taxi Service in Mauritius',
    description: 'Trusted taxi services across Mauritius at clear, fixed prices. Book verified local drivers for trips around the island.',
    keywords: ['taxi Mauritius', 'taxi service Mauritius', 'island taxi Mauritius'],
  },
  'private-driver-mauritius': {
    title: 'Private Driver in Mauritius',
    description: 'Hire a private driver in Mauritius for day trips and tours. Verified, English-speaking local drivers with fixed pricing.',
    keywords: ['private driver Mauritius', 'chauffeur Mauritius', 'day tour driver Mauritius'],
  },
  'catamaran-cruise-mauritius': {
    title: 'Catamaran Cruises in Mauritius',
    description: 'Book catamaran cruises and lagoon days in Mauritius — snorkelling, island-hopping and sunset sails from verified operators.',
    keywords: ['catamaran cruise Mauritius', 'catamaran Mauritius', 'lagoon cruise Mauritius', 'island hopping Mauritius'],
  },
  'boat-trips-mauritius': {
    title: 'Boat Trips in Mauritius',
    description: 'Speedboat and boat trips in Mauritius to dolphins, islets and snorkelling spots. Verified local operators, easy booking.',
    keywords: ['boat trips Mauritius', 'speedboat Mauritius', 'dolphin tour Mauritius', 'snorkelling Mauritius'],
  },
  'restaurants-mauritius': {
    title: 'Restaurants in Mauritius',
    description: 'Discover restaurants in Mauritius, from Creole tables to seafront fine dining. Explore cuisines and locations across the island.',
    keywords: ['restaurants Mauritius', 'best restaurants Mauritius', 'Creole food Mauritius', 'seafood Mauritius'],
  },
  'things-to-do-mauritius': {
    title: 'Things to Do in Mauritius',
    description: 'Find tours, activities and experiences in Mauritius — diving, hikes, cultural trips and more from verified local providers.',
    keywords: ['things to do in Mauritius', 'Mauritius tours', 'Mauritius activities', 'Mauritius experiences', 'excursions Mauritius'],
  },
};

export function landingMetadata(routeSlug: string): Metadata {
  const seo = LANDING_SEO[routeSlug];
  const path = `/${routeSlug}`;
  const title = seo?.title ?? 'Explore Mauritius';
  const description = seo?.description ?? SITE.description;
  const keywords = seo?.keywords ?? SITE.keywords.slice();
  const url = canonical(path);
  return {
    title,
    description,
    keywords,
    alternates: { canonical: url },
    openGraph: {
      title: `${title} | ${SITE.name}`,
      description,
      url,
      type: 'website',
      siteName: SITE.name,
      images: [{ url: SITE.ogImage }],
    },
    twitter: { card: 'summary_large_image', title: `${title} | ${SITE.name}`, description, images: [SITE.ogImage] },
  };
}
