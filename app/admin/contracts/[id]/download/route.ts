import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { BUCKETS } from '@/lib/storage/paths';

export const dynamic = 'force-dynamic';

// Admin-only. Generates a short-lived (60s) signed URL server-side and redirects
// to it. The signed URL is never rendered in any page or exposed to the public;
// only an authenticated admin who hits this route receives the redirect.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireRole('admin'); // redirects non-admins
  const { id } = await params;

  const supabase = await createClient();
  const { data: contract } = await supabase
    .from('provider_contracts')
    .select('storage_path')
    .eq('id', id)
    .single();
  if (!contract) return NextResponse.json({ error: 'Contract not found' }, { status: 404 });

  const admin = createAdminClient();
  const { data: signed, error } = await admin.storage
    .from(BUCKETS.providerContracts)
    .createSignedUrl(contract.storage_path, 60);
  if (error || !signed) return NextResponse.json({ error: 'Could not generate download link' }, { status: 500 });

  return NextResponse.redirect(signed.signedUrl);
}
