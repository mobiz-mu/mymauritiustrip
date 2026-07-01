'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/guards';
import { notifyBookingStatusChange } from '@/lib/email/notify';

export async function setBookingStatus(formData: FormData) {
  await requireRole('admin');
  const id = formData.get('booking_id') as string;
  const status = formData.get('status') as string;
  const note = (formData.get('note') as string) || null;
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_set_booking_status', { p_booking_id: id, p_status: status, p_note: note });
  if (!error) {
    // Same client/provider/review emails as the provider path (service-role lookups inside).
    await notifyBookingStatusChange(id);
  }
  revalidatePath(`/admin/bookings/${id}`);
  redirect(`/admin/bookings/${id}?${error ? 'error=' + encodeURIComponent(error.message) : 'ok=1'}`);
}
