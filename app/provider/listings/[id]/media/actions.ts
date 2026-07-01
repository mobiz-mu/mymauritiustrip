'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/guards';
import { assertNoContactInfo } from '@/lib/validation/contact-leak';
import { bestThumb } from '@/lib/cloudinary/urls';

export type MediaInput = {
  listingId: string;
  type: 'image' | 'video';
  public_id: string;
  secure_url: string;
  width?: number;
  height?: number;
  bytes?: number;
  format?: string;
  duration?: number;
  alt_text?: string;
  caption?: string;
};

export async function saveMedia(media: MediaInput): Promise<{ error?: string; success?: boolean }> {
  await requireRole('provider');
  const supabase = await createClient();

  if (!media.public_id || !media.secure_url) return { error: 'Missing upload data.' };

  // DB also guards these, but give a friendly message first.
  try {
    assertNoContactInfo(media.caption, 'caption');
    assertNoContactInfo(media.alt_text, 'alt text');
  } catch (e) {
    return { error: (e as Error).message };
  }

  // Is this the first image? Make it the cover.
  let isCover = false;
  if (media.type === 'image') {
    const { count } = await supabase
      .from('listing_media')
      .select('id', { count: 'exact', head: true })
      .eq('listing_id', media.listingId)
      .eq('type', 'image');
    isCover = (count ?? 0) === 0;
  }

  // Insert as pending (admin approves). RLS ensures the caller owns the listing;
  // the media-count trigger enforces 12 photos / 3 videos.
  const { error } = await supabase.from('listing_media').insert({
    listing_id: media.listingId,
    type: media.type,
    cloudinary_id: media.public_id,
    url: media.secure_url,
    thumbnail_url: bestThumb(media.public_id, media.type),
    poster_url: media.type === 'video' ? bestThumb(media.public_id, 'video') : null,
    width: media.width ?? null,
    height: media.height ?? null,
    bytes: media.bytes ?? null,
    format: media.format ?? null,
    duration_seconds: media.duration ?? null,
    alt_text: media.alt_text ?? null,
    caption: media.caption ?? null,
    is_cover: isCover,
    status: 'pending',
  });

  if (error) return { error: error.message };
  revalidatePath(`/provider/listings/${media.listingId}/media`);
  return { success: true };
}

export async function deleteMedia(formData: FormData) {
  await requireRole('provider');
  const supabase = await createClient();
  const id = formData.get('media_id') as string;
  const listingId = formData.get('listing_id') as string;
  await supabase.from('listing_media').delete().eq('id', id);
  revalidatePath(`/provider/listings/${listingId}/media`);
}

export async function setCover(formData: FormData) {
  await requireRole('provider');
  const supabase = await createClient();
  const id = formData.get('media_id') as string;
  const listingId = formData.get('listing_id') as string;
  // is_cover is content (not status), so providers may set it on their own media.
  await supabase.from('listing_media').update({ is_cover: false }).eq('listing_id', listingId);
  await supabase.from('listing_media').update({ is_cover: true }).eq('id', id);
  revalidatePath(`/provider/listings/${listingId}/media`);
}
