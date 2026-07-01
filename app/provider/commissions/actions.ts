'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/guards';
import { BUCKETS, buildObjectPath, MAX_UPLOAD_BYTES, ALLOWED_UPLOAD_TYPES } from '@/lib/storage/paths';

export async function uploadCommissionProof(formData: FormData) {
  const profile = await requireRole('provider');
  const invoiceId = formData.get('invoice_id') as string;
  const file = formData.get('file') as File | null;

  const supabase = await createClient();
  const { data: business } = await supabase.from('businesses').select('id').eq('owner_id', profile.id).single();

  const back = (msg: string, ok: boolean) =>
    redirect(`/provider/commissions/${invoiceId}?${ok ? 'ok' : 'error'}=${encodeURIComponent(msg)}`);

  if (!business) back('No business found for your account.', false);
  if (!file || file.size === 0) back('Please choose a file to upload.', false);
  if (file!.size > MAX_UPLOAD_BYTES) back('File exceeds 10 MB.', false);
  if (!ALLOWED_UPLOAD_TYPES.includes(file!.type)) back('Use JPG, PNG, WEBP or PDF.', false);

  const path = buildObjectPath(business!.id, file!.name);
  const { error: upErr } = await supabase.storage
    .from(BUCKETS.commissionProofs)
    .upload(path, file!, { upsert: false, contentType: file!.type });
  if (upErr) back(upErr.message, false);

  const { error } = await supabase.rpc('provider_submit_commission_proof', { p_invoice_id: invoiceId, p_path: path });
  revalidatePath(`/provider/commissions/${invoiceId}`);
  back(error ? error.message : 'Payment proof submitted. An admin will verify it.', !error);
}
