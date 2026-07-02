import { requireRole } from '@/lib/auth/guards';
import { getAdminMetrics } from '@/lib/dashboard/metrics';
import { LogoutButton } from '@/components/LogoutButton';
import { StatCard, StatGrid, SectionCard, AlertCard, StatusBadge, QuickLinks, MiniBars, AnalyticsCard } from '@/components/dashboard/kpi';

export const dynamic = 'force-dynamic';

function fmtDate(s: string) {
  try { return new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }); } catch { return ''; }
}

export default async function AdminDashboard() {
  const profile = await requireRole('admin');
  const m = await getAdminMetrics();

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ocean">Admin</p>
          <h1 className="font-serif text-2xl tracking-tight text-slate-900">Dashboard</h1>
          <p className="mt-0.5 text-sm text-slate-500">Signed in as {profile.full_name}</p>
        </div>
        <LogoutButton />
      </div>

      {/* Top KPI summary */}
      <StatGrid>
        <StatCard label="Customers" value={m.customers} accent="ocean" />
        <StatCard label="Providers" value={m.providers} accent="ocean" />
        <StatCard label="Businesses" value={m.businesses} accent="slate" />
        <StatCard label="Listings" value={m.listings} accent="slate" hint={`${m.listingsPublished} published · ${m.listingsPremium} premium`} />
      </StatGrid>

      {/* Action alerts */}
      <h2 className="mb-3 mt-8 font-serif text-lg tracking-tight text-slate-900">Needs attention</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <AlertCard label="Verifications" value={m.verificationsPending} tone="warn" href="/admin/verification" cta="Review provider verifications" />
        <AlertCard label="Payment proofs" value={m.paymentProofsPending} tone="warn" href="/admin/verification" cta="Confirm Rs 499 payments" />
        <AlertCard label="Reviews to moderate" value={m.reviewsPending} tone="warn" href="/admin/reviews" cta="Approve or reject reviews" />
        <AlertCard label="Overdue commissions" value={m.commissionsOverdue} tone="danger" href="/admin/commissions?status=overdue" cta="Chase overdue invoices" />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Booking overview */}
        <SectionCard title="Bookings" action={<a href="/admin/bookings" className="text-xs font-semibold text-ocean hover:underline">Open →</a>}>
          <div className="mb-4 grid grid-cols-2 gap-3">
            <StatCard label="Total" value={m.bookings} accent="ocean" />
            <StatCard label="Pending" value={m.bookingsPending} accent="gold" />
          </div>
          <MiniBars items={[
            { label: 'Pending', value: m.bookingsPending, color: '#d4af37' },
            { label: 'Confirmed', value: m.bookingsConfirmed, color: '#0b6fb8' },
            { label: 'Completed', value: m.bookingsCompleted, color: '#059669' },
            { label: 'Cancelled', value: m.bookingsCancelled, color: '#e11d48' },
          ]} />
        </SectionCard>

        {/* Listings overview */}
        <SectionCard title="Listings" action={<a href="/admin/listings" className="text-xs font-semibold text-ocean hover:underline">Review →</a>}>
          <StatGrid cols={3}>
            <StatCard label="Published" value={m.listingsPublished} accent="emerald" />
            <StatCard label="Pending review" value={m.listingsPending} accent="gold" />
            <StatCard label="Premium" value={m.listingsPremium} accent="gold" />
          </StatGrid>
        </SectionCard>

        {/* Commission / payment */}
        <SectionCard title="Commissions & payments" action={<a href="/admin/commissions" className="text-xs font-semibold text-ocean hover:underline">Open →</a>}>
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Unpaid invoices" value={m.commissionsUnpaid} accent="gold" />
            <StatCard label="Overdue" value={m.commissionsOverdue} accent="red" />
          </div>
        </SectionCard>

        {/* Reviews / newsletter / transfers */}
        <SectionCard title="Community & growth">
          <StatGrid cols={4}>
            <StatCard label="Reviews" value={m.reviews} accent="ocean" href="/admin/reviews" />
            <StatCard label="To moderate" value={m.reviewsPending} accent="gold" href="/admin/reviews" />
            <StatCard label="Newsletter" value={m.newsletter} accent="emerald" href="/admin/newsletter" />
            <StatCard label="Transfers" value={m.transfers} accent="ocean" href="/admin/transfers" hint={`${m.transfersOpen} open`} />
          </StatGrid>
        </SectionCard>
      </div>

      {/* Recent activity */}
      <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <SectionCard title="Latest businesses">
          {m.recentBusinesses.length > 0 ? (
            <ul className="divide-y divide-slate-100">
              {m.recentBusinesses.map((b, i) => (
                <li key={i} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="truncate text-sm font-medium text-slate-800">{b.business_name}</span>
                  <span className="flex shrink-0 items-center gap-2"><StatusBadge status={b.status} /><span className="text-xs text-slate-400">{fmtDate(b.created_at)}</span></span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-slate-400">No businesses yet.</p>}
        </SectionCard>
        <SectionCard title="Latest listings">
          {m.recentListings.length > 0 ? (
            <ul className="divide-y divide-slate-100">
              {m.recentListings.map((l, i) => (
                <li key={i} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="truncate text-sm font-medium text-slate-800">{l.title}</span>
                  <span className="flex shrink-0 items-center gap-2"><StatusBadge status={l.status} /><span className="text-xs text-slate-400">{fmtDate(l.created_at)}</span></span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-slate-400">No listings yet.</p>}
        </SectionCard>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <AnalyticsCard />
        <SectionCard title="Quick links">
          <QuickLinks links={[
            { href: '/admin/verification', label: 'Verification queue' },
            { href: '/admin/listings', label: 'Listings review' },
            { href: '/admin/bookings', label: 'Bookings' },
            { href: '/admin/commissions', label: 'Commissions' },
            { href: '/admin/reviews', label: 'Review moderation' },
            { href: '/admin/transfers', label: 'Taxi & transfers' },
            { href: '/admin/newsletter', label: 'Newsletter' },
          ]} />
        </SectionCard>
      </div>
    </main>
  );
}
