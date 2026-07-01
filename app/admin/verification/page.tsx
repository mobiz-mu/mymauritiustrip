import { requireRole } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { LogoutButton } from '@/components/LogoutButton';

export const dynamic = 'force-dynamic';

const LABEL: Record<string, string> = {
  pending_verification: 'Pending verification',
  payment_pending: 'Payment pending',
  under_review: 'Under review',
  rejected: 'Rejected',
  suspended: 'Suspended',
  verified: 'Verified',
};

export default async function AdminVerificationQueue() {
  await requireRole('admin');
  const supabase = await createClient();

  // Queue = anything not yet verified. Admin can see all business fields.
  const { data: queue } = await supabase
    .from('businesses')
    .select('id, business_name, status, verification_paid, created_at, category_id, location_id')
    .neq('status', 'verified')
    .order('created_at', { ascending: true });

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Verification queue</h1>
        <LogoutButton />
      </div>

      {(!queue || queue.length === 0) && (
        <p className="text-slate-500">No providers waiting for review.</p>
      )}

      <ul className="space-y-2">
        {queue?.map((b) => (
          <li key={b.id}>
            <a
              href={`/admin/verification/${b.id}`}
              className="flex items-center justify-between rounded-xl ring-1 ring-slate-200 px-4 py-3 hover:bg-slate-50"
            >
              <div>
                <p className="font-medium">{b.business_name || '(unnamed business)'}</p>
                <p className="text-xs text-slate-500">
                  {LABEL[b.status] ?? b.status}
                  {b.verification_paid ? ' · fee verified' : ''}
                </p>
              </div>
              <span className="text-sm text-ocean">Review →</span>
            </a>
          </li>
        ))}
      </ul>
    </main>
  );
}
