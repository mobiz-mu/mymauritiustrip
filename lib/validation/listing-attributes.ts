import { z } from 'zod';

// =====================================================================
// Strict, per-category attribute contracts for listings.attributes (JSONB).
// Every schema uses .strict() so UNKNOWN KEYS ARE REJECTED — this is what
// keeps filterable data clean and consistent across the marketplace.
// Validate at write time (listing create/update) before inserting.
//
// Money is NOT stored here (base_price_mur lives on the listing row).
// =====================================================================

const boolish = z.boolean();

// ---- Car Rental ----
const carRental = z
  .object({
    pickup_location: z.string().min(1).optional(),
    dropoff_location: z.string().min(1).optional(),
    transmission: z.enum(['manual', 'automatic']),
    seats: z.number().int().min(1).max(60),
    vehicle_type: z.enum([
      'economy',
      'sedan',
      'suv',
      'van',
      'luxury',
      'convertible',
      'pickup',
    ]),
    air_conditioning: boolish.default(false),
    airport_delivery: boolish.default(false),
    baby_seat: boolish.default(false),
    unlimited_mileage: boolish.default(false),
  })
  .strict();

// ---- Scooter Rental ----
const scooterRental = z
  .object({
    location: z.string().min(1).optional(),
    engine_cc: z.number().int().min(50).max(1500),
    helmet_included: boolish.default(false),
    delivery_available: boolish.default(false),
    licence_required: boolish.default(true),
  })
  .strict();

// ---- Accommodation (villas / apartments / studios / houses / holiday homes) ----
const accommodation = z
  .object({
    guests: z.number().int().min(1).max(50),
    bedrooms: z.number().int().min(0).max(30),
    bathrooms: z.number().int().min(0).max(30),
    pool: boolish.default(false),
    sea_view: boolish.default(false),
    beachfront: boolish.default(false),
    air_conditioning: boolish.default(false),
    wifi: boolish.default(false),
    kitchen: boolish.default(false),
    parking: boolish.default(false),
    family_friendly: boolish.default(false),
  })
  .strict();

// ---- Boat / Catamaran ----
const boatTrip = z
  .object({
    trip_type: z.enum(['shared', 'private']),
    destination: z.string().min(1).optional(),
    duration_hours: z.number().min(0.5).max(24).optional(),
    capacity: z.number().int().min(1).max(500),
    food_included: boolish.default(false),
    snorkeling_included: boolish.default(false),
    pickup_included: boolish.default(false),
  })
  .strict();

// ---- Restaurant ----
const restaurant = z
  .object({
    cuisine: z.string().min(1),
    budget: z.enum(['budget', 'mid_range', 'fine_dining']),
    sea_view: boolish.default(false),
    family_friendly: boolish.default(false),
    halal_friendly: boolish.default(false),
    vegetarian_friendly: boolish.default(false),
    romantic: boolish.default(false),
    local_food: boolish.default(false),
  })
  .strict();

// ---- Airport Transfer ----
const airportTransfer = z
  .object({
    pickup_location: z.string().min(1).optional(),
    dropoff_location: z.string().min(1).optional(),
    seats: z.number().int().min(1).max(60),
    air_conditioning: boolish.default(false),
    meet_and_greet: boolish.default(false),
    baby_seat: boolish.default(false),
  })
  .strict();

// ---- Activities / Experiences ----
const experience = z
  .object({
    duration_hours: z.number().min(0.25).max(72).optional(),
    group_size: z.number().int().min(1).max(500).optional(),
    pickup_included: boolish.default(false),
    family_friendly: boolish.default(false),
    difficulty: z.enum(['easy', 'moderate', 'hard']).optional(),
  })
  .strict();

// ---- Taxi & Private Transfers ----
const PICKUP_REGIONS = [
  'north',
  'south',
  'east',
  'west',
  'centre',
  'airport',
  'port-louis',
  'any',
] as const;

const taxiTransfer = z
  .object({
    vehicle_type: z.enum([
      'luxury',
      'family_car',
      'suv',
      'sedan',
      'small_car',
      'van',
      'minibus',
      'coach',
    ]),
    seats: z.number().int().min(1).max(70),
    luggage_capacity: z.number().int().min(0).max(100),
    pickup_regions: z.array(z.enum(PICKUP_REGIONS)).min(1).max(PICKUP_REGIONS.length),
    airport_transfer_available: boolish.default(false),
    full_day_available: boolish.default(false),
    half_day_available: boolish.default(false),
    group_transfer_available: boolish.default(false),
    min_group_size: z.number().int().min(1).max(70).optional(),
    max_group_size: z.number().int().min(1).max(70).optional(),
    driver_included: boolish.default(true),
    child_seat_available: boolish.default(false),
    luxury_service: boolish.default(false),
    // Optional per-service prices (MUR). base_price_mur remains the headline.
    price_airport_transfer_mur: z.number().min(0).optional(),
    price_half_day_mur: z.number().min(0).optional(),
    price_full_day_mur: z.number().min(0).optional(),
    price_per_trip_mur: z.number().min(0).optional(),
  })
  .strict()
  .refine(
    (d) => d.min_group_size == null || d.max_group_size == null || d.max_group_size >= d.min_group_size,
    { message: 'max_group_size must be greater than or equal to min_group_size', path: ['max_group_size'] },
  );

// Map category slug -> schema. Accommodation slugs share one contract.
export const ATTRIBUTE_SCHEMAS: Record<string, z.ZodTypeAny> = {
  'car-rental': carRental,
  'scooter-rental': scooterRental,
  'airport-transfer': airportTransfer,
  'taxi-private-transfers': taxiTransfer,
  'catamaran-trips': boatTrip,
  'boat-trips': boatTrip,
  villas: accommodation,
  apartments: accommodation,
  studios: accommodation,
  'individual-houses': accommodation,
  'holiday-homes': accommodation,
  restaurants: restaurant,
  activities: experience,
  experiences: experience,
};

export type AttributeValidation =
  | { success: true; data: Record<string, unknown> }
  | { success: false; error: string };

// Validate a listing's attributes against its category contract.
export function validateAttributes(
  categorySlug: string,
  attributes: unknown,
): AttributeValidation {
  const schema = ATTRIBUTE_SCHEMAS[categorySlug];
  if (!schema) {
    return { success: false, error: `Unknown category: ${categorySlug}` };
  }
  const result = schema.safeParse(attributes ?? {});
  if (!result.success) {
    const first = result.error.issues[0];
    return {
      success: false,
      error: `${first.path.join('.') || 'attributes'}: ${first.message}`,
    };
  }
  return { success: true, data: result.data as Record<string, unknown> };
}
