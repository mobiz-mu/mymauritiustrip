import { requireRole } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import VerificationClient from './client';

export const dynamic = 'force-dynamic';

export default async function VerificationPage() {
  const profile = await requireRole('provider');
  const supabase = await createClient();

  const { data: business } = await supabase
    .from('businesses')
    .select('id, business_name, status, verification_paid, rejected_reason')
    .eq('owner_id', profile.id)
    .single();

  const [{ data: payments }, { data: documents }, { data: contract }] = await Promise.all([
    supabase
      .from('business_verification_payments')
      .select('id, amount_mur, method, status, created_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('business_documents')
      .select('id, doc_type, status, created_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('provider_contracts')
      .select('id, status, admin_note, original_filename, uploaded_at')
      .order('uploaded_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return (
    <VerificationClient
      business={business}
      payments={payments ?? []}
      documents={documents ?? []}
      contract={contract ?? null}
    />
  );
}
