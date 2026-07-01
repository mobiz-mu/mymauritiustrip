import { createClient } from '@/lib/supabase/server';
import TransferRequestForm from './form';
import { isBuildPhase } from '@/lib/build-phase';
import PublicShell from '@/components/public/PublicShell';

export const dynamic = 'force-dynamic';

export default async function RequestTransferPage() {
  let regions: { id: string; name: string }[] = [];
  if (!isBuildPhase()) {
    const supabase = await createClient();
    const { data } = await supabase
      .from('pickup_regions')
      .select('id, name')
      .eq('is_active', true)
      .order('sort_order');
    regions = data ?? [];
  }

  return (
    <PublicShell>
      <section className="relative overflow-hidden bg-gradient-to-b from-[#eaf5fb] via-[#f5fafd] to-white">
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-turquoise/20 blur-3xl" aria-hidden="true" />
        <div className="mx-auto max-w-2xl px-6 py-10 md:py-14">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-ocean">Local trip planning</p>
          <h1 className="font-serif text-3xl tracking-tight text-slate-900 md:text-4xl">Request a transfer or custom plan</h1>
          <p className="mt-3 text-sm text-slate-600">
            Tell us what you need — an airport transfer, a private driver for the day, a group coach, or a
            full Mauritius itinerary. Our local team plans it, assigns a verified driver, and sends you a
            quote. Book online, pay on arrival.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {['Verified local providers', 'Pay on arrival', 'Local support', 'No contact details shared'].map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm ring-1 ring-slate-200">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="text-turquoise" aria-hidden="true"><path d="M5 12l4.5 4.5L19 7" /></svg>
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-2xl px-6 py-10">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <TransferRequestForm regions={regions ?? []} />
        </div>
      </main>
    </PublicShell>
  );
}
