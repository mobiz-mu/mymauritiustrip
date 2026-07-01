'use server';

import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export type SubscribeResult = { ok?: string; error?: string } | null;

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function subscribeToNewsletter(
  _prev: SubscribeResult,
  formData: FormData,
): Promise<SubscribeResult> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return { error: 'Please enter a valid email address.' };
  }

  const hdrs = await headers();
  const userAgent = hdrs.get('user-agent')?.slice(0, 300) ?? null;

  const supabase = await createClient();
  const { error } = await supabase
    .from('newsletter_subscribers')
    .insert({ email, source: 'homepage', user_agent: userAgent });

  if (error) {
    // unique_violation → already on the list; treat as success
    if (error.code === '23505') {
      return { ok: 'You are already subscribed — thank you!' };
    }
    return { error: 'Could not subscribe right now. Please try again later.' };
  }

  return { ok: 'Thanks! You are subscribed to Mauritius travel deals.' };
}
