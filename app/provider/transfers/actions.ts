'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/guards';

export async function respondAssignment(formData: FormData) {
  await requireRole('provider');
  const supabase = await createClient();
  const { error } = await supabase.rpc('provider_respond_assignment', {
    p_assignment_id: formData.get('assignment_id') as string,
    p_decision: formData.get('decision') as string, // accepted | rejected | completed
    p_notes: (formData.get('notes') as string) || null,
  });
  revalidatePath('/provider/transfers');
  redirect(
    `/provider/transfers?${error ? 'error=' + encodeURIComponent(error.message) : 'ok=1'}`,
  );
}
