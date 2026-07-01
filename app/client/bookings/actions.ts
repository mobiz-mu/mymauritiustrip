'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/guards';

export async function respondSuggestedDate(formData: FormData) {
  await requireRole('client');
  const id = formData.get('booking_id') as string;
  const action = formData.get('action') as string; // accept | decline
  const supabase = await createClient();
  const { error } = await supabase.rpc('client_respond_suggested_date', { p_booking_id: id, p_action: action });
  revalidatePath(`/client/bookings/${id}`);
  redirect(`/client/bookings/${id}?${error ? 'error=' + encodeURIComponent(error.message) : 'ok=1'}`);
}

export async function cancelBooking(formData: FormData) {
  await requireRole('client');
  const id = formData.get('booking_id') as string;
  const supabase = await createClient();
  const { error } = await supabase.rpc('client_cancel_booking', { p_booking_id: id });
  revalidatePath(`/client/bookings/${id}`);
  redirect(`/client/bookings/${id}?${error ? 'error=' + encodeURIComponent(error.message) : 'ok=1'}`);
}

export type ReviewResult = { error?: string; ok?: boolean } | null;

export async function createReview(bookingId: string, _prev: ReviewResult, formData: FormData): Promise<ReviewResult> {
  const profile = await requireRole('client');
  const supabase = await createClient();

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, listing_id, status')
    .eq('id', bookingId)
    .single();
  if (!booking) return { error: 'Booking not found.' };
  if (booking.status !== 'completed') return { error: 'You can review only after the booking is completed.' };

  const rating = Number(formData.get('rating'));
  const comment = ((formData.get('comment') as string) || '').trim() || null;
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { error: 'Please choose a rating from 1 to 5.' };

  const { error } = await supabase.from('reviews').insert({
    booking_id: bookingId,
    listing_id: booking.listing_id,
    client_id: profile.id,
    rating,
    comment,
    status: 'pending',
  });

  if (error) {
    if (error.code === '23505') return { error: 'You have already reviewed this booking.' };
    return { error: error.message };
  }
  revalidatePath(`/client/bookings/${bookingId}`);
  return { ok: true };
}
