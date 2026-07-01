import type { Metadata } from 'next';
import { getReferenceData, searchListings } from '@/lib/public/catalog';
import SiteHeader from '@/components/public/SiteHeader';
import PublicFooter from '@/components/public/PublicFooter';
import BannerCarousel from '@/components/home/BannerCarousel';
import NewsletterSection from '@/components/home/NewsletterSection';
import { MarketplaceSection } from '@/components/home/marketplace';
import {
  HomeHero,
  CategoryGrid,
  FeaturedExperiences,
  ValueProps,
  RequestTripBand,
  ProviderBand,
  SupportBand,
} from '@/components/home/sections';

// Live data is fetched per request. The build-phase guards in lib/public/catalog
// short-circuit every Supabase read during `next build`, so the homepage renders
// its premium empty/preview states at build time and never blocks page-data.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { absolute: 'MyMauritiusTrip.com — Villas, transfers, cruises & experiences in Mauritius' },
  description:
    'Book villas, car rental, taxis, catamaran cruises, restaurants and things to do in Mauritius from verified local providers. Pay on arrival, local support, all in one place.',
  openGraph: {
    title: 'MyMauritiusTrip.com — Your whole Mauritius trip in one place',
    description: 'Verified local providers, pay on arrival, and curated experiences across Mauritius.',
    type: 'website',
  },
};

export default async function HomePage() {
  const [ref, featured, villas, cars, restaurants, catamaran] = await Promise.all([
    getReferenceData(),
    searchListings({}),
    searchListings({}, ['villas']),
    searchListings({}, ['car-rental']),
    searchListings({}, ['restaurants']),
    searchListings({}, ['catamaran-trips']),
  ]);

  return (
    <div className="bg-white">
      <SiteHeader />
      <HomeHero categories={ref.categories} locations={ref.locations} />
      <CategoryGrid />
      <BannerCarousel />
      <FeaturedExperiences items={featured.items} catById={ref.catById} locById={ref.locById} />

      <MarketplaceSection eyebrow="Stays" title="Villas & apartments" href="/villas-mauritius" sectionKey="villas" fallbackImage="/home/villas.svg" items={villas.items} catById={ref.catById} locById={ref.locById} />
      <MarketplaceSection eyebrow="On the road" title="Car rental" href="/car-rental-mauritius" sectionKey="car" fallbackImage="/home/car.svg" items={cars.items} catById={ref.catById} locById={ref.locById} />
      <MarketplaceSection eyebrow="Dining" title="Restaurants" href="/restaurants-mauritius" sectionKey="restaurants" fallbackImage="/home/restaurants.svg" items={restaurants.items} catById={ref.catById} locById={ref.locById} />
      <MarketplaceSection eyebrow="On the water" title="Catamaran & boat trips" href="/catamaran-cruise-mauritius" sectionKey="catamaran" fallbackImage="/home/boat.svg" items={catamaran.items} catById={ref.catById} locById={ref.locById} />

      <ValueProps />
      <RequestTripBand />
      <ProviderBand />
      <SupportBand />
      <NewsletterSection />
      <PublicFooter />
    </div>
  );
}
