import { requireRole } from '@/lib/auth/guards';
import { LogoutButton } from '@/components/LogoutButton';

export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  const profile = await requireRole('admin');
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Admin dashboard</h1>
        <LogoutButton />
      </div>
      <p className="text-slate-600">
        Signed in as {profile.full_name}. Approvals, verification payments,
        listings, bookings and commission tools arrive in Phase 5.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <a
          href="/admin/verification"
          className="inline-block rounded-lg bg-ocean px-4 py-2 text-sm font-semibold text-white"
        >
          Open verification queue →
        </a>
        <a
          href="/admin/transfers"
          className="inline-block rounded-lg ring-1 ring-slate-300 px-4 py-2 text-sm font-semibold"
        >
          Taxi & Transfers (DMC) →
        </a>
        <a
          href="/admin/listings"
          className="inline-block rounded-lg ring-1 ring-slate-300 px-4 py-2 text-sm font-semibold"
        >
          Listings review →
        </a>
        <a
          href="/admin/bookings"
          className="inline-block rounded-lg ring-1 ring-slate-300 px-4 py-2 text-sm font-semibold"
        >
          Bookings →
        </a>
        <a
          href="/admin/commissions"
          className="inline-block rounded-lg ring-1 ring-slate-300 px-4 py-2 text-sm font-semibold"
        >
          Commissions →
        </a>
        <a
          href="/admin/reviews"
          className="inline-block rounded-lg ring-1 ring-slate-300 px-4 py-2 text-sm font-semibold"
        >
          Review moderation →
        </a>
        <a
          href="/admin/newsletter"
          className="inline-block rounded-lg ring-1 ring-slate-300 px-4 py-2 text-sm font-semibold"
        >
          Newsletter subscribers →
        </a>
      </div>
    </main>
  );
}
