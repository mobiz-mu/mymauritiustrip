'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/guards';
import { notifyBookingCreated } from '@/lib/email/notify';

export type BookingFormResult = { error?: string } | null;

export async function createBooking(slug: string, _prev: BookingFormResult, formData: FormData): Promise<BookingFormResult> {
  const profile = await requireRole('client');
  const supabase = await createClient();

  // Listing must be publicly bookable (published + verified business).
  const { data: listing } = await supabase
    .from('listings_public')
    .select('id, title, base_price_mur, price_unit')
    .eq('slug', slug)
    .single();
  if (!listing) return { error: 'This listing is not available for booking.' };

  const fullName = (formData.get('full_name') as string)?.trim() || profile.full_name;
  const email = (formData.get('email') as string)?.trim() || profile.email;
  const arrival = (formData.get('arrival_date') as string) || null;
  const numPeople = Number(formData.get('num_people')) || 1;
  const quantity = Number(formData.get('quantity')) || 1;

  if (!fullName || !email) return { error: 'Your name and email are required.' };
  if (!arrival) return { error: 'Please choose a date.' };

  const { data: inserted, error } = await supabase
    .from('bookings')
    .insert({
      client_id: profile.id,
      listing_id: listing.id,
      full_name: fullName,
      email,
      whatsapp: (formData.get('whatsapp') as string) || profile.whatsapp,
      country: (formData.get('country') as string) || profile.country,
      arrival_date: arrival,
      num_people: numPeople,
      quantity,
      special_request: (formData.get('special_request') as string) || null,
      display_currency: 'MUR',
      // business_id, base_amount_mur and display_amount are set server-side by
      // the bookings_enforce_integrity trigger — never trusted from the client.
    })
    .select('id, reference')
    .single();

  if (error) return { error: error.message };

  // Best-effort notifications (never block the booking): client + provider + admin.
  await notifyBookingCreated(inserted!.id);

  redirect(`/client/bookings/${inserted!.id}`);
}
