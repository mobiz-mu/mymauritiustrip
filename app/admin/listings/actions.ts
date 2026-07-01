'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/guards';

function back(listingId: string, msg: string, ok: boolean) {
  redirect(`/admin/listings/${listingId}?${ok ? 'ok' : 'error'}=${encodeURIComponent(msg)}`);
}

export async function setListingStatus(formData: FormData) {
  await requireRole('admin');
  const listingId = formData.get('listing_id') as string;
  const status = formData.get('status') as string; // published | rejected | hidden | suspended | draft
  const reason = (formData.get('reason') as string) || null;
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_set_listing_status', {
    p_listing_id: listingId,
    p_status: status,
    p_reason: reason,
  });
  revalidatePath(`/admin/listings/${listingId}`);
  back(listingId, error ? error.message : `Listing ${status}.`, !error);
}

export async function setFlags(formData: FormData) {
  await requireRole('admin');
  const listingId = formData.get('listing_id') as string;
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_set_listing_flags', {
    p_listing_id: listingId,
    p_featured: formData.get('featured') === 'on',
    p_premium: formData.get('premium') === 'on',
  });
  revalidatePath(`/admin/listings/${listingId}`);
  back(listingId, error ? error.message : 'Flags updated.', !error);
}

export async function setMediaStatus(formData: FormData) {
  await requireRole('admin');
  const listingId = formData.get('listing_id') as string;
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_set_media_status', {
    p_media_id: formData.get('media_id') as string,
    p_status: formData.get('status') as string,
  });
  revalidatePath(`/admin/listings/${listingId}`);
  back(listingId, error ? error.message : 'Media updated.', !error);
}

export async function setMediaCover(formData: FormData) {
  await requireRole('admin');
  const listingId = formData.get('listing_id') as string;
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_set_cover_media', {
    p_media_id: formData.get('media_id') as string,
  });
  revalidatePath(`/admin/listings/${listingId}`);
  back(listingId, error ? error.message : 'Cover set.', !error);
}
