'use server';

import { createClient } from '@/lib/supabase/server';

export type ReqResult = { error?: string; success?: string } | null;

const VEHICLES = [
  'luxury',
  'family_car',
  'suv',
  'sedan',
  'small_car',
  'van',
  'minibus',
  'coach',
];

export async function submitTransferRequest(
  _prev: ReqResult,
  formData: FormData,
): Promise<ReqResult> {
  const supabase = await createClient();

  // If signed in, stamp the caller's own id (RLS requires null or auth.uid()).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const fullName = (formData.get('full_name') as string)?.trim();
  const email = (formData.get('email') as string)?.trim();
  const needs = (formData.get('needs') as string)?.trim();
  if (!fullName || !email || !needs) {
    return { error: 'Please provide your name, email, and what you need.' };
  }

  const vehicle = formData.get('preferred_vehicle') as string;
  const passengers = formData.get('passengers') as string;
  const luggage = formData.get('luggage') as string;

  const { error } = await supabase.from('transfer_requests').insert({
    client_id: user?.id ?? null,
    full_name: fullName,
    email,
    whatsapp: (formData.get('whatsapp') as string) || null,
    country: (formData.get('country') as string) || null,
    pickup_location: (formData.get('pickup_location') as string) || null,
    dropoff_location: (formData.get('dropoff_location') as string) || null,
    pickup_region_id: (formData.get('pickup_region_id') as string) || null,
    dropoff_region_id: (formData.get('dropoff_region_id') as string) || null,
    pickup_date: (formData.get('pickup_date') as string) || null,
    pickup_time: (formData.get('pickup_time') as string) || null,
    passengers: passengers ? Number(passengers) : null,
    luggage: luggage ? Number(luggage) : null,
    preferred_vehicle: VEHICLES.includes(vehicle) ? vehicle : null,
    flight_number: (formData.get('flight_number') as string) || null,
    needs,
    preferred_currency: (formData.get('preferred_currency') as string) || 'MUR',
  });

  if (error) return { error: error.message };
  return {
    success:
      'Request received. Our MyMauritiusTrip.com team will plan it and reply with a quote. You can also WhatsApp us on +230 5506 8119.',
  };
}
