'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/guards';

export async function replyToReview(formData: FormData) {
  const profile = await requireRole('provider');
  const reviewId = formData.get('review_id') as string;
  const body = ((formData.get('body') as string) || '').trim();
  const supabase = await createClient();

  const back = (msg: string, ok: boolean) =>
    redirect(`/provider/reviews?${ok ? 'ok' : 'error'}=${encodeURIComponent(msg)}`);

  if (!body) back('Reply cannot be empty.', false);

  const { data: business } = await supabase.from('businesses').select('id').eq('owner_id', profile.id).single();
  if (!business) back('No business found.', false);

  // One reply per review (unique review_id). DB triggers enforce ownership and
  // block contact details in the body.
  const { error } = await supabase
    .from('review_replies')
    .upsert({ review_id: reviewId, business_id: business!.id, body }, { onConflict: 'review_id' });

  revalidatePath('/provider/reviews');
  back(error ? error.message : 'Reply saved.', !error);
}
