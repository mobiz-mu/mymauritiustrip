import { requireRole } from '@/lib/auth/guards';
import { LogoutButton } from '@/components/LogoutButton';

export const dynamic = 'force-dynamic';

export default async function ClientDashboard() {
  const profile = await requireRole('client');

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Client dashboard</h1>
        <LogoutButton />
      </div>
      <p className="text-slate-600">
        Welcome, {profile.full_name}. This is a Phase 1 placeholder — bookings,
        favourites, trip requests, reviews and messages arrive in later phases.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <a href="/client/bookings" className="inline-block rounded-lg bg-ocean px-4 py-2 text-sm font-semibold text-white">
          My bookings →
        </a>
        <a href="/client/quotes" className="inline-block rounded-lg ring-1 ring-slate-300 px-4 py-2 text-sm font-semibold">
          My transfer quotes →
        </a>
        <a href="/request-transfer" className="inline-block rounded-lg ring-1 ring-slate-300 px-4 py-2 text-sm font-semibold">
          Request a transfer / plan →
        </a>
      </div>
    </main>
  );
}
