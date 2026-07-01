import type { MetadataRoute } from 'next';

const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

// Static public routes only — no Supabase read, so this is fully build-safe.
// Per-listing URLs can be appended later from listings_public if desired.
const ROUTES = [
  '',
  '/search',
  '/request-transfer',
  '/terms',
  '/privacy',
  '/villas-mauritius',
  '/apartments-mauritius',
  '/studios-mauritius',
  '/holiday-homes-mauritius',
  '/car-rental-mauritius',
  '/scooter-rental-mauritius',
  '/taxi-service-mauritius',
  '/private-driver-mauritius',
  '/airport-transfer-mauritius',
  '/boat-trips-mauritius',
  '/catamaran-cruise-mauritius',
  '/restaurants-mauritius',
  '/things-to-do-mauritius',
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return ROUTES.map((r) => ({
    url: `${base}${r}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: r === '' ? 1 : 0.7,
  }));
}
