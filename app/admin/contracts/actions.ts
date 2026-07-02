'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/guards';

function back(msg: string, ok: boolean) {
  const key = ok ? 'ok' : 'error';
  redirect(`/admin/contracts?${key}=${encodeURIComponent(msg)}`);
}

// Approve or reject a provider contract. Admin-only; writes through the
// RLS-aware client (admin passes provider_contracts_admin_all). reviewed_by is
// the acting admin's profile id.
export async function reviewContract(formData: FormData) {
  const admin = await requireRole('admin');
  const id = formData.get('contract_id') as string;
  const decision = formData.get('decision') as string; // 'approved' | 'rejected'
  const note = ((formData.get('admin_note') as string) || '').trim() || null;
  if (!id || (decision !== 'approved' && decision !== 'rejected')) back('Invalid request.', false);

  const supabase = await createClient();
  const { error } = await supabase
    .from('provider_contracts')
    .update({
      status: decision,
      admin_note: note,
      reviewed_at: new Date().toISOString(),
      reviewed_by: admin.id,
    })
    .eq('id', id);

  revalidatePath('/admin/contracts');
  back(error ? error.message : `Contract ${decision}.`, !error);
}
