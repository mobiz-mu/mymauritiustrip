'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/guards';
import { notifyTransferQuote } from '@/lib/email/notify';

function back(msg: string, ok: boolean) {
  redirect(`/admin/transfers/requests?${ok ? 'ok' : 'error'}=${encodeURIComponent(msg)}`);
}

export async function quoteRequest(formData: FormData) {
  await requireRole('admin');
  const requestId = formData.get('request_id') as string;
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_quote_transfer', {
    p_request_id: requestId,
    p_amount: Number(formData.get('amount')),
    p_notes: (formData.get('notes') as string) || null,
  });
  if (!error) {
    await notifyTransferQuote(requestId);
  }
  revalidatePath('/admin/transfers/requests');
  back(error ? error.message : 'Quote saved.', !error);
}

export async function assignRequest(formData: FormData) {
  await requireRole('admin');

  const finalPriceRaw = formData.get('final_price');
  const finalPrice = finalPriceRaw ? Number(finalPriceRaw) : NaN;
  if (!Number.isFinite(finalPrice) || finalPrice <= 0) {
    back('Final price is required and must be greater than 0.', false);
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_assign_transfer', {
    p_request_id: formData.get('request_id') as string,
    p_business_id: formData.get('business_id') as string,
    p_vehicle: (formData.get('vehicle_type') as string) || null,
    p_final_price: finalPrice,
    p_override: formData.get('override') === 'on',
  });
  revalidatePath('/admin/transfers/requests');
  back(error ? error.message : 'Assigned to provider.', !error);
}
