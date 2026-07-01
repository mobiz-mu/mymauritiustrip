'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/guards';

export async function respondQuote(formData: FormData) {
  await requireRole('client');
  const supabase = await createClient();
  const { error } = await supabase.rpc('client_respond_quote', {
    p_request_id: formData.get('request_id') as string,
    p_decision: formData.get('decision') as string, // 'accept' | 'reject'
  });
  revalidatePath('/client/quotes');
  redirect(`/client/quotes?${error ? 'error=' + encodeURIComponent(error.message) : 'ok=1'}`);
}
