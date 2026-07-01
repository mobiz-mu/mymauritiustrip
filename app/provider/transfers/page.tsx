import { requireRole } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { respondAssignment } from './actions';

export const dynamic = 'force-dynamic';

type Job = {
  pickup_location?: string;
  dropoff_location?: string;
  pickup_date?: string;
  pickup_time?: string;
  passengers?: number;
  luggage?: number;
  flight_number?: string;
  needs?: string;
};

export default async function ProviderTransfers({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  await requireRole('provider');
  const flash = await searchParams;
  const supabase = await createClient();

  // RLS returns only assignments for the provider's own business.
  const { data: assignments } = await supabase
    .from('transfer_assignments')
    .select('id, vehicle_type, final_price_mur, status, provider_notes, job_details, created_at')
    .order('created_at', { ascending: false });

  return (
    <main className="mx-auto max-w-2xl px-6 py-12 space-y-4">
      <h1 className="text-xl font-semibold">Assigned transfers</h1>

      {flash?.ok && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">Updated.</p>}
      {flash?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{flash.error}</p>}

      {(!assignments || assignments.length === 0) && (
        <p className="text-slate-500">No transfers assigned to you yet.</p>
      )}

      {assignments?.map((a) => {
        const job = (a.job_details ?? {}) as Job;
        return (
          <div key={a.id} className="rounded-xl ring-1 ring-slate-200 p-4 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium">{a.vehicle_type ?? 'vehicle'} · Rs {a.final_price_mur ?? '—'}</span>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs">{a.status}</span>
            </div>
            <p className="text-slate-600">
              {job.pickup_location ?? '—'} → {job.dropoff_location ?? '—'} · {job.passengers ?? '?'} pax
              {job.pickup_date ? ` · ${job.pickup_date}` : ''}{job.pickup_time ? ` ${job.pickup_time}` : ''}
              {job.flight_number ? ` · flight ${job.flight_number}` : ''}
            </p>
            {job.needs && <p className="text-slate-500">{job.needs}</p>}

            <div className="flex flex-wrap gap-2 pt-1">
              {a.status === 'offered' && (
                <>
                  <form action={respondAssignment}>
                    <input type="hidden" name="assignment_id" value={a.id} />
                    <input type="hidden" name="decision" value="accepted" />
                    <button className="rounded bg-green-600 px-3 py-1 text-xs font-semibold text-white">Accept</button>
                  </form>
                  <form action={respondAssignment}>
                    <input type="hidden" name="assignment_id" value={a.id} />
                    <input type="hidden" name="decision" value="rejected" />
                    <button className="rounded bg-red-600 px-3 py-1 text-xs font-semibold text-white">Reject</button>
                  </form>
                </>
              )}
              {a.status === 'accepted' && (
                <form action={respondAssignment} className="flex items-center gap-2">
                  <input type="hidden" name="assignment_id" value={a.id} />
                  <input type="hidden" name="decision" value="completed" />
                  <input name="notes" placeholder="Completion note (optional)" className="rounded border border-slate-300 px-2 py-1 text-xs" />
                  <button className="rounded bg-ocean px-3 py-1 text-xs font-semibold text-white">Mark completed</button>
                </form>
              )}
            </div>

            <p className="text-[11px] text-slate-400">
              Client contact stays with MyMauritiusTrip.com. Questions? WhatsApp +230 5506 8119.
            </p>
          </div>
        );
      })}
    </main>
  );
}
