// UI descriptors for category-specific attributes. Keys MUST match the strict
// zod schemas in listing-attributes.ts (which remain the source of truth).
// The collector turns form fields into an attributes object; the server action
// then validates it with validateAttributes() before saving.

export type AttrField =
  | { key: string; label: string; type: 'bool' }
  | { key: string; label: string; type: 'number'; min?: number; optional?: boolean }
  | { key: string; label: string; type: 'enum'; options: string[]; optional?: boolean }
  | { key: string; label: string; type: 'multienum'; options: string[] }
  | { key: string; label: string; type: 'text'; optional?: boolean };

const accommodation: AttrField[] = [
  { key: 'guests', label: 'Guests', type: 'number', min: 1 },
  { key: 'bedrooms', label: 'Bedrooms', type: 'number', min: 0 },
  { key: 'bathrooms', label: 'Bathrooms', type: 'number', min: 0 },
  { key: 'pool', label: 'Pool', type: 'bool' },
  { key: 'sea_view', label: 'Sea view', type: 'bool' },
  { key: 'beachfront', label: 'Beachfront', type: 'bool' },
  { key: 'air_conditioning', label: 'Air conditioning', type: 'bool' },
  { key: 'wifi', label: 'WiFi', type: 'bool' },
  { key: 'kitchen', label: 'Kitchen', type: 'bool' },
  { key: 'parking', label: 'Parking', type: 'bool' },
  { key: 'family_friendly', label: 'Family friendly', type: 'bool' },
];

const boatTrip: AttrField[] = [
  { key: 'trip_type', label: 'Trip type', type: 'enum', options: ['shared', 'private'] },
  { key: 'destination', label: 'Destination', type: 'text', optional: true },
  { key: 'duration_hours', label: 'Duration (hours)', type: 'number', min: 0, optional: true },
  { key: 'capacity', label: 'Capacity', type: 'number', min: 1 },
  { key: 'food_included', label: 'Food included', type: 'bool' },
  { key: 'snorkeling_included', label: 'Snorkeling included', type: 'bool' },
  { key: 'pickup_included', label: 'Pickup included', type: 'bool' },
];

export const ATTRIBUTE_UI: Record<string, AttrField[]> = {
  'car-rental': [
    { key: 'transmission', label: 'Transmission', type: 'enum', options: ['manual', 'automatic'] },
    { key: 'seats', label: 'Seats', type: 'number', min: 1 },
    { key: 'vehicle_type', label: 'Vehicle type', type: 'enum', options: ['economy', 'sedan', 'suv', 'van', 'luxury', 'convertible', 'pickup'] },
    { key: 'air_conditioning', label: 'Air conditioning', type: 'bool' },
    { key: 'airport_delivery', label: 'Airport delivery', type: 'bool' },
    { key: 'baby_seat', label: 'Baby seat', type: 'bool' },
    { key: 'unlimited_mileage', label: 'Unlimited mileage', type: 'bool' },
    { key: 'pickup_location', label: 'Pickup location', type: 'text', optional: true },
    { key: 'dropoff_location', label: 'Drop-off location', type: 'text', optional: true },
  ],
  'scooter-rental': [
    { key: 'engine_cc', label: 'Engine (cc)', type: 'number', min: 50 },
    { key: 'helmet_included', label: 'Helmet included', type: 'bool' },
    { key: 'delivery_available', label: 'Delivery available', type: 'bool' },
    { key: 'licence_required', label: 'Licence required', type: 'bool' },
    { key: 'location', label: 'Location', type: 'text', optional: true },
  ],
  'airport-transfer': [
    { key: 'seats', label: 'Seats', type: 'number', min: 1 },
    { key: 'air_conditioning', label: 'Air conditioning', type: 'bool' },
    { key: 'meet_and_greet', label: 'Meet & greet', type: 'bool' },
    { key: 'baby_seat', label: 'Baby seat', type: 'bool' },
    { key: 'pickup_location', label: 'Pickup location', type: 'text', optional: true },
    { key: 'dropoff_location', label: 'Drop-off location', type: 'text', optional: true },
  ],
  'taxi-private-transfers': [
    { key: 'vehicle_type', label: 'Vehicle type', type: 'enum', options: ['luxury', 'family_car', 'suv', 'sedan', 'small_car', 'van', 'minibus', 'coach'] },
    { key: 'seats', label: 'Seats', type: 'number', min: 1 },
    { key: 'luggage_capacity', label: 'Luggage capacity', type: 'number', min: 0 },
    { key: 'pickup_regions', label: 'Pickup regions', type: 'multienum', options: ['north', 'south', 'east', 'west', 'centre', 'airport', 'port-louis', 'any'] },
    { key: 'airport_transfer_available', label: 'Airport transfer', type: 'bool' },
    { key: 'full_day_available', label: 'Full-day available', type: 'bool' },
    { key: 'half_day_available', label: 'Half-day available', type: 'bool' },
    { key: 'group_transfer_available', label: 'Group transfer', type: 'bool' },
    { key: 'min_group_size', label: 'Min group size', type: 'number', min: 1, optional: true },
    { key: 'max_group_size', label: 'Max group size', type: 'number', min: 1, optional: true },
    { key: 'driver_included', label: 'Driver included', type: 'bool' },
    { key: 'child_seat_available', label: 'Child seat available', type: 'bool' },
    { key: 'luxury_service', label: 'Luxury service', type: 'bool' },
    { key: 'price_airport_transfer_mur', label: 'Price: airport transfer (MUR)', type: 'number', min: 0, optional: true },
    { key: 'price_half_day_mur', label: 'Price: half day (MUR)', type: 'number', min: 0, optional: true },
    { key: 'price_full_day_mur', label: 'Price: full day (MUR)', type: 'number', min: 0, optional: true },
    { key: 'price_per_trip_mur', label: 'Price: per trip (MUR)', type: 'number', min: 0, optional: true },
  ],
  'catamaran-trips': boatTrip,
  'boat-trips': boatTrip,
  villas: accommodation,
  apartments: accommodation,
  studios: accommodation,
  'individual-houses': accommodation,
  'holiday-homes': accommodation,
  restaurants: [
    { key: 'cuisine', label: 'Cuisine', type: 'text' },
    { key: 'budget', label: 'Budget', type: 'enum', options: ['budget', 'mid_range', 'fine_dining'] },
    { key: 'sea_view', label: 'Sea view', type: 'bool' },
    { key: 'family_friendly', label: 'Family friendly', type: 'bool' },
    { key: 'halal_friendly', label: 'Halal friendly', type: 'bool' },
    { key: 'vegetarian_friendly', label: 'Vegetarian friendly', type: 'bool' },
    { key: 'romantic', label: 'Romantic', type: 'bool' },
    { key: 'local_food', label: 'Local food', type: 'bool' },
  ],
  activities: [
    { key: 'duration_hours', label: 'Duration (hours)', type: 'number', min: 0, optional: true },
    { key: 'group_size', label: 'Group size', type: 'number', min: 1, optional: true },
    { key: 'pickup_included', label: 'Pickup included', type: 'bool' },
    { key: 'family_friendly', label: 'Family friendly', type: 'bool' },
    { key: 'difficulty', label: 'Difficulty', type: 'enum', options: ['easy', 'moderate', 'hard'], optional: true },
  ],
  experiences: [
    { key: 'duration_hours', label: 'Duration (hours)', type: 'number', min: 0, optional: true },
    { key: 'group_size', label: 'Group size', type: 'number', min: 1, optional: true },
    { key: 'pickup_included', label: 'Pickup included', type: 'bool' },
    { key: 'family_friendly', label: 'Family friendly', type: 'bool' },
    { key: 'difficulty', label: 'Difficulty', type: 'enum', options: ['easy', 'moderate', 'hard'], optional: true },
  ],
};

// Collect attributes from a submitted form into a plain object. Booleans always
// emit true/false; optional empty numbers/text/enums are omitted so the zod
// `.optional()` rules apply cleanly.
export function collectAttributes(categorySlug: string, formData: FormData): Record<string, unknown> {
  const fields = ATTRIBUTE_UI[categorySlug] ?? [];
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    const raw = formData.get(`attr_${f.key}`);
    if (f.type === 'bool') {
      out[f.key] = raw === 'on';
    } else if (f.type === 'number') {
      if (raw !== null && String(raw) !== '') out[f.key] = Number(raw);
    } else if (f.type === 'multienum') {
      out[f.key] = formData.getAll(`attr_${f.key}`).map(String);
    } else {
      if (raw !== null && String(raw) !== '') out[f.key] = String(raw);
    }
  }
  return out;
}
