// Static homepage content. No Supabase here, so it's safe at build time and the
// homepage always looks complete even before any listings exist.

export type IconKey =
  | 'villa' | 'car' | 'taxi' | 'boat' | 'dining' | 'compass' | 'plane' | 'heart'
  | 'shield' | 'wallet' | 'chat' | 'lock' | 'star' | 'route' | 'sun';

export type HomeCategory = { title: string; blurb: string; href: string; icon: IconKey; image: string };

// Each card links to an existing public route (no 404s). Wedding & honeymoon is
// bespoke planning, so it routes to the trip-request flow. `image` points to a
// premium SVG scene in /public/home — replace with a photo of the same name to
// upgrade instantly.
export const HOME_CATEGORIES: HomeCategory[] = [
  { title: 'Villas & apartments', blurb: 'Beachfront villas and stylish island stays.', href: '/villas-mauritius', icon: 'villa', image: '/home/villas.svg' },
  { title: 'Car rental', blurb: 'Self-drive and explore at your own pace.', href: '/car-rental-mauritius', icon: 'car', image: '/home/car.svg' },
  { title: 'Taxi & private driver', blurb: 'Trusted drivers at clear, fixed prices.', href: '/taxi-service-mauritius', icon: 'taxi', image: '/home/taxi.svg' },
  { title: 'Airport transfer', blurb: 'Smooth arrivals and departures, door to door.', href: '/airport-transfer-mauritius', icon: 'plane', image: '/home/airport.svg' },
  { title: 'Catamaran & boat trips', blurb: 'Lagoon cruises, snorkelling and island hops.', href: '/catamaran-cruise-mauritius', icon: 'boat', image: '/home/boat.svg' },
  { title: 'Restaurants', blurb: 'From Creole tables to seafront fine dining.', href: '/restaurants-mauritius', icon: 'dining', image: '/home/restaurants.svg' },
  { title: 'Things to do', blurb: 'Tours, diving and island adventures.', href: '/things-to-do-mauritius', icon: 'compass', image: '/home/things-to-do.svg' },
  { title: 'Wedding & honeymoon', blurb: 'Bespoke island celebrations, planned for you.', href: '/request-transfer', icon: 'heart', image: '/home/wedding.svg' },
];

export type ValueProp = { icon: IconKey; title: string; body: string };

export const VALUE_PROPS: ValueProp[] = [
  { icon: 'shield', title: 'Verified local providers', body: 'Every business is checked and approved before it can appear here.' },
  { icon: 'wallet', title: 'Pay on arrival', body: 'Reserve now and pay your provider directly when you arrive.' },
  { icon: 'chat', title: 'Local support', body: 'Real people on the island, reachable on WhatsApp and email.' },
  { icon: 'lock', title: 'Everything stays on-platform', body: 'Book and message safely — no contact details exchanged upfront.' },
  { icon: 'star', title: 'Curated for Mauritius', body: 'Hand-picked stays, transfers and experiences across the island.' },
];

export const TRIP_SERVICES: { icon: IconKey; label: string }[] = [
  { icon: 'route', label: 'Custom itineraries' },
  { icon: 'plane', label: 'Airport transfers' },
  { icon: 'taxi', label: 'Private drivers' },
  { icon: 'sun', label: 'Family trips' },
  { icon: 'heart', label: 'Honeymoon planning' },
  { icon: 'compass', label: 'Group travel' },
];
