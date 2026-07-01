'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/guards';

export async function setCommissionStatus(formData: FormData) {
  await requireRole('admin');
  const id = formData.get('invoice_id') as string;
  const status = formData.get('status') as string; // paid | pending | disputed | cancelled | submitted
  const note = (formData.get('note') as string) || null;
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_set_commission_status', {
    p_invoice_id: id,
    p_status: status,
    p_note: note,
  });
  revalidatePath(`/admin/commissions/${id}`);
  redirect(`/admin/commissions/${id}?${error ? 'error=' + encodeURIComponent(error.message) : 'ok=1'}`);
}

export async function refreshOverdue() {
  await requireRole('admin');
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('mark_commissions_overdue');
  const msg = error ? 'error=' + encodeURIComponent(error.message) : 'swept=' + encodeURIComponent(String(data ?? 0));
  revalidatePath('/admin/commissions');
  redirect(`/admin/commissions?${msg}`);
}
