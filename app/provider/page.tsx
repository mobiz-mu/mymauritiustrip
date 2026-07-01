import { requireRole } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { LogoutButton } from '@/components/LogoutButton';

const STATUS_LABEL: Record<string, string> = {
  pending_verification: 'Pending verification',
  payment_pending: 'Payment pending',
  under_review: 'Under review',
  verified: 'Verified',
  rejected: 'Rejected',
  suspended: 'Suspended',
};

export const dynamic = 'force-dynamic';

export default async function ProviderDashboard() {
  const profile = await requireRole('provider');
  const supabase = await createClient();
  const { data: business } = await supabase
    .from('businesses')
    .select('business_name, status, verification_paid')
    .eq('owner_id', profile.id)
    .single();

  const verified = business?.status === 'verified';

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Provider dashboard</h1>
        <LogoutButton />
      </div>

      <div className="rounded-xl ring-1 ring-slate-200 p-5">
        <p className="text-sm text-slate-500">Business</p>
        <p className="text-lg font-medium">{business?.business_name ?? '—'}</p>
        <p className="mt-2 text-sm">
          Status:{' '}
          <span className={verified ? 'text-green-600 font-medium' : 'text-amber-600 font-medium'}>
            {STATUS_LABEL[business?.status ?? ''] ?? business?.status}
          </span>
        </p>
      </div>

      {!verified && (
        <div className="mt-4 rounded-xl bg-amber-50 p-5 text-sm text-amber-800">
          Listing creation is locked until your Rs 499 verification fee is approved
          by admin. Each verified account can publish up to 7 listings.
          <div className="mt-3">
            <a
              href="/provider/verification"
              className="inline-block rounded-lg bg-ocean px-4 py-2 text-xs font-semibold text-white"
            >
              Go to verification →
            </a>
          </div>
        </div>
      )}

      {verified && (
        <div className="mt-4 space-y-2 text-sm text-slate-600">
          <p>You're verified. Create and manage up to 7 listings.</p>
          <div className="flex flex-wrap gap-2">
            <a href="/provider/listings" className="inline-block rounded-lg bg-ocean px-4 py-2 text-xs font-semibold text-white">
              My listings →
            </a>
            <a href="/provider/bookings" className="inline-block rounded-lg ring-1 ring-slate-300 px-4 py-2 text-xs font-semibold">
              Booking requests →
            </a>
            <a href="/provider/commissions" className="inline-block rounded-lg ring-1 ring-slate-300 px-4 py-2 text-xs font-semibold">
              Commissions →
            </a>
            <a href="/provider/reviews" className="inline-block rounded-lg ring-1 ring-slate-300 px-4 py-2 text-xs font-semibold">
              Reviews →
            </a>
            <a href="/provider/transfers" className="inline-block rounded-lg ring-1 ring-slate-300 px-4 py-2 text-xs font-semibold">
              Assigned transfers →
            </a>
          </div>
        </div>
      )}
    </main>
  );
}
