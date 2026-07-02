import Link from 'next/link';
import type { ReactNode } from 'react';

// Presentational, dependency-free dashboard primitives. Brand palette:
// ocean (sea blue), gold (saffron), emerald (grass green).

const ACCENT: Record<string, { chip: string; text: string }> = {
  ocean: { chip: 'bg-ocean/10 text-ocean', text: 'text-ocean' },
  gold: { chip: 'bg-gold/15 text-[#8a6d1a]', text: 'text-[#8a6d1a]' },
  emerald: { chip: 'bg-emerald-500/10 text-emerald-700', text: 'text-emerald-700' },
  slate: { chip: 'bg-slate-100 text-slate-600', text: 'text-slate-700' },
  red: { chip: 'bg-red-500/10 text-red-600', text: 'text-red-600' },
};

export type Accent = keyof typeof ACCENT;

export function StatCard({
  label, value, accent = 'slate', hint, href, icon,
}: {
  label: string; value: number | string; accent?: Accent; hint?: string; href?: string; icon?: ReactNode;
}) {
  const a = ACCENT[accent] ?? ACCENT.slate;
  const body = (
    <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        {icon && <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${a.chip}`}>{icon}</span>}
      </div>
      <span className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{value}</span>
      {hint && <span className="mt-1 text-[11px] text-slate-400">{hint}</span>}
    </div>
  );
  return href ? <Link href={href} className="block h-full">{body}</Link> : body;
}

export function StatGrid({ children, cols = 4 }: { children: ReactNode; cols?: 3 | 4 }) {
  const grid = cols === 3 ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-4';
  return <div className={`grid grid-cols-2 gap-3 ${grid}`}>{children}</div>;
}

export function SectionCard({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-serif text-lg tracking-tight text-slate-900">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function AlertCard({
  label, value, tone = 'warn', href, cta,
}: {
  label: string; value: number; tone?: 'warn' | 'danger' | 'ok'; href: string; cta: string;
}) {
  const tones = {
    warn: 'border-amber-200 bg-amber-50 text-amber-900',
    danger: 'border-red-200 bg-red-50 text-red-900',
    ok: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  } as const;
  const active = value > 0;
  return (
    <Link
      href={href}
      className={`flex items-center justify-between rounded-2xl border p-4 transition hover:shadow-sm ${active ? tones[tone] : 'border-slate-200 bg-white text-slate-500'}`}
    >
      <div>
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs opacity-80">{active ? cta : 'Nothing pending'}</p>
      </div>
      <span className={`ml-3 rounded-full px-3 py-1 text-lg font-bold ${active ? 'bg-white/60' : 'bg-slate-100'}`}>{value}</span>
    </Link>
  );
}

const BADGE: Record<string, string> = {
  verified: 'bg-emerald-100 text-emerald-700', published: 'bg-emerald-100 text-emerald-700',
  approved: 'bg-emerald-100 text-emerald-700', confirmed: 'bg-emerald-100 text-emerald-700',
  completed: 'bg-ocean/10 text-ocean', paid: 'bg-emerald-100 text-emerald-700',
  pending: 'bg-amber-100 text-amber-700', pending_review: 'bg-amber-100 text-amber-700',
  pending_verification: 'bg-amber-100 text-amber-700', payment_pending: 'bg-amber-100 text-amber-700',
  under_review: 'bg-amber-100 text-amber-700', draft: 'bg-slate-100 text-slate-600',
  provider_accepted: 'bg-ocean/10 text-ocean', client_arrived: 'bg-ocean/10 text-ocean',
  rejected: 'bg-red-100 text-red-700', provider_rejected: 'bg-red-100 text-red-700',
  cancelled: 'bg-red-100 text-red-700', overdue: 'bg-red-100 text-red-700',
  suspended: 'bg-red-100 text-red-700', hidden: 'bg-slate-100 text-slate-600',
};

export function StatusBadge({ status }: { status: string }) {
  const cls = BADGE[status] ?? 'bg-slate-100 text-slate-600';
  return <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${cls}`}>{status.replace(/_/g, ' ')}</span>;
}

export function QuickLinks({ links }: { links: { href: string; label: string }[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {links.map((l, index) => (
        <Link key={l.href + "-" + l.label + "-" + index} href={l.href} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-ocean/40 hover:text-ocean">
          {l.label} â†’
        </Link>
      ))}
    </div>
  );
}

// Simple CSS bar breakdown (no chart library).
export function MiniBars({ items }: { items: { label: string; value: number; color: string }[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="space-y-2.5">
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-3">
          <span className="w-28 shrink-0 text-xs text-slate-500">{it.label}</span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full" style={{ width: `${(it.value / max) * 100}%`, backgroundColor: it.color }} />
          </div>
          <span className="w-8 shrink-0 text-right text-xs font-semibold text-slate-700">{it.value}</span>
        </div>
      ))}
    </div>
  );
}

export function AnalyticsCard() {
  const gtm = process.env.NEXT_PUBLIC_GTM_ID;
  const ga = process.env.NEXT_PUBLIC_GA_ID;
  const enabled = Boolean(gtm || ga);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-lg tracking-tight text-slate-900">Analytics</h2>
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
          {enabled ? 'Enabled' : 'Not configured'}
        </span>
      </div>
      <p className="mt-2 text-sm text-slate-600">
        {enabled
          ? `Traffic is tracked via ${[gtm && 'Google Tag Manager', ga && 'Google Analytics'].filter(Boolean).join(' + ')}. View reports in your Google dashboard.`
          : 'Google Analytics tracking is enabled when NEXT_PUBLIC_GTM_ID or NEXT_PUBLIC_GA_ID is configured in your environment.'}
      </p>
    </div>
  );
}

