'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/guards';

function back(businessId: string, msg: string, ok: boolean) {
  const key = ok ? 'ok' : 'error';
  redirect(`/admin/verification/${businessId}?${key}=${encodeURIComponent(msg)}`);
}

export async function setPaymentStatus(formData: FormData) {
  await requireRole('admin');
  const businessId = formData.get('business_id') as string;
  const paymentId = formData.get('payment_id') as string;
  const decision = formData.get('decision') as string; // 'verified' | 'rejected'
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_set_payment_status', {
    p_payment_id: paymentId,
    p_status: decision,
  });
  revalidatePath(`/admin/verification/${businessId}`);
  back(businessId, error ? error.message : `Payment marked ${decision}.`, !error);
}

export async function setDocumentStatus(formData: FormData) {
  await requireRole('admin');
  const businessId = formData.get('business_id') as string;
  const docId = formData.get('doc_id') as string;
  const decision = formData.get('decision') as string; // 'approved' | 'rejected'
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_set_document_status', {
    p_doc_id: docId,
    p_status: decision,
  });
  revalidatePath(`/admin/verification/${businessId}`);
  back(businessId, error ? error.message : `Document ${decision}.`, !error);
}

export async function approveProvider(formData: FormData) {
  await requireRole('admin');
  const businessId = formData.get('business_id') as string;
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_approve_provider', { p_business_id: businessId });
  revalidatePath(`/admin/verification/${businessId}`);
  back(businessId, error ? error.message : 'Provider approved and set to verified.', !error);
}

export async function rejectProvider(formData: FormData) {
  await requireRole('admin');
  const businessId = formData.get('business_id') as string;
  const reason = (formData.get('reason') as string) || '';
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_reject_provider', {
    p_business_id: businessId,
    p_reason: reason,
  });
  revalidatePath(`/admin/verification/${businessId}`);
  back(businessId, error ? error.message : 'Provider rejected.', !error);
}

export async function suspendProvider(formData: FormData) {
  await requireRole('admin');
  const businessId = formData.get('business_id') as string;
  const reason = (formData.get('reason') as string) || '';
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_suspend_provider', {
    p_business_id: businessId,
    p_reason: reason,
  });
  revalidatePath(`/admin/verification/${businessId}`);
  back(businessId, error ? error.message : 'Provider suspended.', !error);
}
