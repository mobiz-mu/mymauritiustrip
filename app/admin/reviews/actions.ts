'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/guards';

export async function setReviewStatus(formData: FormData) {
  await requireRole('admin');
  const id = formData.get('review_id') as string;
  const status = formData.get('status') as string; // approved | rejected | pending
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_set_review_status', { p_review_id: id, p_status: status });
  revalidatePath('/admin/reviews');
  redirect(`/admin/reviews?${error ? 'error=' + encodeURIComponent(error.message) : 'ok=1'}`);
}
