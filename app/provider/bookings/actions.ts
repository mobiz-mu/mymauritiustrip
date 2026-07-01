'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/guards';
import { notifyBookingStatusChange } from '@/lib/email/notify';

export async function respondBooking(formData: FormData) {
  await requireRole('provider');
  const id = formData.get('booking_id') as string;
  const action = formData.get('action') as string; // accept | reject | suggest_date | arrived | completed
  const suggested = (formData.get('suggested_date') as string) || null;
  const note = (formData.get('note') as string) || null;

  const supabase = await createClient();
  const { error } = await supabase.rpc('provider_respond_booking', {
    p_booking_id: id,
    p_action: action,
    p_suggested_date: suggested,
    p_note: note,
  });

  if (!error) {
    // Best-effort: notify client of the new status; on arrived/completed also
    // emails the provider their commission invoice; on completed sends the
    // client a review request. All recipient lookups happen via service-role
    // inside notify (providers can't read the bookings table directly).
    await notifyBookingStatusChange(id);
  }

  revalidatePath(`/provider/bookings/${id}`);
  redirect(`/provider/bookings/${id}?${error ? 'error=' + encodeURIComponent(error.message) : 'ok=1'}`);
}
