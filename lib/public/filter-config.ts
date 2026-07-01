// Shared filter configuration used by the server query layer (catalog.ts) and
// the client Filters component. Keys map to listing.attributes JSONB fields.

export type FilterDef =
  | { key: string; label: string; type: 'bool' }
  | { key: string; label: string; type: 'min'; placeholder?: string }
  | { key: string; label: string; type: 'enum'; options: string[] }
  | { key: string; label: string; type: 'arrcontains'; options: string[] } // attribute is an array
  | { key: string; label: string; type: 'text'; placeholder?: string };

const transport: FilterDef[] = [
  { key: 'vehicle_type', label: 'Vehicle type', type: 'enum', options: ['luxury', 'family_car', 'suv', 'sedan', 'small_car', 'van', 'minibus', 'coach'] },
  { key: 'pickup_regions', label: 'Pickup region', type: 'arrcontains', options: ['north', 'south', 'east', 'west', 'centre', 'airport', 'port-louis'] },
  { key: 'seats', label: 'Min seats', type: 'min' },
  { key: 'airport_transfer_available', label: 'Airport transfer', type: 'bool' },
  { key: 'full_day_available', label: 'Full day', type: 'bool' },
  { key: 'half_day_available', label: 'Half day', type: 'bool' },
  { key: 'group_transfer_available', label: 'Group transfer', type: 'bool' },
];

const accommodation: FilterDef[] = [
  { key: 'guests', label: 'Min guests', type: 'min' },
  { key: 'bedrooms', label: 'Min bedrooms', type: 'min' },
  { key: 'pool', label: 'Pool', type: 'bool' },
  { key: 'sea_view', label: 'Sea view', type: 'bool' },
  { key: 'beachfront', label: 'Beachfront', type: 'bool' },
];

const carRental: FilterDef[] = [
  { key: 'transmission', label: 'Transmission', type: 'enum', options: ['manual', 'automatic'] },
  { key: 'seats', label: 'Min seats', type: 'min' },
  { key: 'vehicle_type', label: 'Vehicle type', type: 'enum', options: ['economy', 'sedan', 'suv', 'van', 'luxury', 'convertible', 'pickup'] },
  { key: 'airport_delivery', label: 'Airport delivery', type: 'bool' },
];

const boat: FilterDef[] = [
  { key: 'trip_type', label: 'Trip type', type: 'enum', options: ['shared', 'private'] },
  { key: 'capacity', label: 'Min capacity', type: 'min' },
  { key: 'food_included', label: 'Food included', type: 'bool' },
  { key: 'pickup_included', label: 'Pickup included', type: 'bool' },
];

const restaurants: FilterDef[] = [
  { key: 'cuisine', label: 'Cuisine', type: 'text', placeholder: 'e.g. Creole' },
  { key: 'budget', label: 'Budget', type: 'enum', options: ['budget', 'mid_range', 'fine_dining'] },
  { key: 'halal_friendly', label: 'Halal friendly', type: 'bool' },
  { key: 'vegetarian_friendly', label: 'Vegetarian friendly', type: 'bool' },
  { key: 'sea_view', label: 'Sea view', type: 'bool' },
];

// category slug -> attribute filter set
export const CATEGORY_FILTERS: Record<string, FilterDef[]> = {
  'taxi-private-transfers': transport,
  'airport-transfer': transport,
  villas: accommodation,
  apartments: accommodation,
  studios: accommodation,
  'individual-houses': accommodation,
  'holiday-homes': accommodation,
  'car-rental': carRental,
  'scooter-rental': [
    { key: 'engine_cc', label: 'Min engine (cc)', type: 'min' },
    { key: 'helmet_included', label: 'Helmet included', type: 'bool' },
    { key: 'delivery_available', label: 'Delivery available', type: 'bool' },
  ],
  'catamaran-trips': boat,
  'boat-trips': boat,
  restaurants,
};

// Marketing landing slug -> { category slugs, page title }
export const LANDING_CATEGORIES: Record<string, { slugs: string[]; title: string }> = {
  'car-rental-mauritius': { slugs: ['car-rental'], title: 'Car Rental in Mauritius' },
  'scooter-rental-mauritius': { slugs: ['scooter-rental'], title: 'Scooter Rental in Mauritius' },
  'airport-transfer-mauritius': { slugs: ['airport-transfer'], title: 'Airport Transfers in Mauritius' },
  'taxi-service-mauritius': { slugs: ['taxi-private-transfers'], title: 'Taxi Service in Mauritius' },
  'private-driver-mauritius': { slugs: ['taxi-private-transfers'], title: 'Private Driver in Mauritius' },
  'catamaran-cruise-mauritius': { slugs: ['catamaran-trips'], title: 'Catamaran Cruises in Mauritius' },
  'boat-trips-mauritius': { slugs: ['boat-trips'], title: 'Boat Trips in Mauritius' },
  'villas-mauritius': { slugs: ['villas'], title: 'Villas in Mauritius' },
  'apartments-mauritius': { slugs: ['apartments'], title: 'Apartments in Mauritius' },
  'studios-mauritius': { slugs: ['studios'], title: 'Studios in Mauritius' },
  'holiday-homes-mauritius': { slugs: ['holiday-homes'], title: 'Holiday Homes in Mauritius' },
  'restaurants-mauritius': { slugs: ['restaurants'], title: 'Restaurants in Mauritius' },
  'things-to-do-mauritius': { slugs: ['activities', 'experiences'], title: 'Things to Do in Mauritius' },
};
