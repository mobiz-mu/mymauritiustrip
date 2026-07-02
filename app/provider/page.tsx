import { requireRole } from '@/lib/auth/guards';
import { getProviderMetrics } from '@/lib/dashboard/metrics';
import { LogoutButton } from '@/components/LogoutButton';
import { StatCard, StatGrid, SectionCard, AlertCard, StatusBadge, QuickLinks, MiniBars } from '@/components/dashboard/kpi';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, string> = {
  pending_verification: 'Pending verification',
  payment_pending: 'Payment pending',
  under_review: 'Under review',
  verified: 'Verified',
  rejected: 'Rejected',
  suspended: 'Suspended',
};

function fmtDate(s: string) {
  try { return new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }); } catch { return ''; }
}

export default async function ProviderDashboard() {
  const profile = await requireRole('provider');
  const m = await getProviderMetrics(profile.id);
  const verified = m.business?.status === 'verified';

  // Next-steps checklist (based on real state)
  const steps: { label: string; done: boolean; active: boolean; href: string }[] = [
    { label: 'Complete Rs 499 verification', done: verified, active: !verified, href: '/provider/verification' },
    { label: 'Create your first listing', done: m.listings > 0, active: verified && m.listings === 0, href: '/provider/listings' },
    { label: 'Get a listing published', done: m.listingsPublished > 0, active: verified && m.listings > 0 && m.listingsPublished === 0, href: '/provider/listings' },
    { label: 'Respond to booking requests', done: false, active: m.bookingsPending > 0, href: '/provider/bookings' },
  ];

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ocean">Provider</p>
          <h1 className="font-serif text-2xl tracking-tight text-slate-900">{m.business?.business_name ?? 'Your business'}</h1>
          <p className="mt-0.5 flex items-center gap-2 text-sm text-slate-500">
            Status: <StatusBadge status={m.business?.status ?? 'pending_verification'} />
            {m.business?.is_premium && <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[11px] font-semibold text-[#8a6d1a]">Premium</span>}
          </p>
        </div>
        <LogoutButton />
      </div>

      {!verified && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          <p className="font-semibold">Listing creation is locked</p>
          <p className="mt-1 text-amber-800">Your Rs 499 verification fee must be approved by admin before you can publish. Each verified account can publish up to 7 listings.</p>
          <a href="/provider/verification" className="mt-3 inline-block rounded-lg bg-ocean px-4 py-2 text-xs font-semibold text-white">Go to verification →</a>
        </div>
      )}

      {/* Listings + rating */}
      <StatGrid>
        <StatCard label="Listings" value={m.listings} accent="ocean" hint="of 7 allowed" href="/provider/listings" />
        <StatCard label="Published" value={m.listingsPublished} accent="emerald" href="/provider/listings" />
        <StatCard label="Pending review" value={m.listingsPending} accent="gold" href="/provider/listings" />
        <StatCard label="Avg rating" value={m.avgRating > 0 ? `${m.avgRating}★` : '—'} accent="gold" hint={`${m.reviews} review${m.reviews === 1 ? '' : 's'}`} href="/provider/reviews" />
      </StatGrid>

      <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Bookings */}
        <SectionCard title="Bookings" action={<a href="/provider/bookings" className="text-xs font-semibold text-ocean hover:underline">Open →</a>}>
          <div className="mb-4 grid grid-cols-2 gap-3">
            <StatCard label="Total" value={m.bookings} accent="ocean" />
            <StatCard label="Pending" value={m.bookingsPending} accent="gold" />
          </div>
          <MiniBars items={[
            { label: 'Pending', value: m.bookingsPending, color: '#d4af37' },
            { label: 'Accepted', value: m.bookingsAccepted, color: '#0b6fb8' },
            { label: 'Completed', value: m.bookingsCompleted, color: '#059669' },
            { label: 'Cancelled', value: m.bookingsCancelled, color: '#e11d48' },
          ]} />
        </SectionCard>

        {/* Next steps checklist */}
        <SectionCard title="Next steps">
          <ul className="space-y-2.5">
            {steps.map((s) => (
              <li key={s.label} className={`flex items-center justify-between rounded-xl border px-3 py-2.5 ${s.active ? 'border-ocean/30 bg-ocean/5' : 'border-slate-200 bg-white'}`}>
                <span className="flex items-center gap-2.5 text-sm">
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${s.done ? 'bg-emerald-500 text-white' : s.active ? 'bg-ocean text-white' : 'bg-slate-200 text-slate-500'}`}>{s.done ? '✓' : ''}</span>
                  <span className={s.done ? 'text-slate-400 line-through' : 'text-slate-800'}>{s.label}</span>
                </span>
                {s.active && <a href={s.href} className="shrink-0 text-xs font-semibold text-ocean hover:underline">Go →</a>}
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      {/* Commission alerts + recent bookings */}
      <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <SectionCard title="Commissions">
          <div className="grid grid-cols-1 gap-3">
            <AlertCard label="Unpaid invoices" value={m.commissionsUnpaid} tone="warn" href="/provider/commissions" cta="Upload payment proof" />
            <AlertCard label="Overdue" value={m.commissionsOverdue} tone="danger" href="/provider/commissions" cta="Settle to avoid suspension" />
          </div>
        </SectionCard>

        <SectionCard title="Recent booking requests" action={<a href="/provider/bookings" className="text-xs font-semibold text-ocean hover:underline">All →</a>}>
          {m.recentBookings.length > 0 ? (
            <ul className="divide-y divide-slate-100">
              {m.recentBookings.map((b, i) => (
                <li key={i} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="truncate text-sm font-medium text-slate-800">{b.reference ?? 'Booking'}</span>
                  <span className="flex shrink-0 items-center gap-2"><StatusBadge status={b.status} /><span className="text-xs text-slate-400">{fmtDate(b.created_at)}</span></span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-slate-400">No booking requests yet.</p>}
        </SectionCard>
      </div>

      <div className="mt-8">
        <SectionCard title="Quick links">
          <QuickLinks links={[
            { href: '/provider/listings', label: 'Manage listings' },
            { href: '/provider/listings', label: 'Add / edit media' },
            { href: '/provider/bookings', label: 'Bookings' },
            { href: '/provider/verification', label: 'Verification' },
            { href: '/provider/commissions', label: 'Commissions' },
            { href: '/provider/reviews', label: 'Reviews' },
            { href: '/provider/transfers', label: 'Assigned transfers' },
          ]} />
        </SectionCard>
      </div>
    </main>
  );
}
