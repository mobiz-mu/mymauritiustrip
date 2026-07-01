'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { submitTransferRequest, type ReqResult } from './actions';

type Region = { id: string; name: string };

const VEHICLES: { value: string; label: string }[] = [
  { value: '', label: 'No preference' },
  { value: 'luxury', label: 'Luxury vehicle' },
  { value: 'family_car', label: 'Family car' },
  { value: 'suv', label: 'SUV' },
  { value: 'sedan', label: 'Sedan car' },
  { value: 'small_car', label: 'Small car' },
  { value: 'van', label: 'Van' },
  { value: 'minibus', label: 'Minibus' },
  { value: 'coach', label: 'Coach (8+ persons)' },
];

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className="rounded-lg bg-ocean px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
    >
      {pending ? 'Sending…' : 'Send request'}
    </button>
  );
}

const input =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-ocean focus:outline-none';

export default function TransferRequestForm({ regions }: { regions: Region[] }) {
  const [state, action] = useActionState<ReqResult, FormData>(submitTransferRequest, null);

  return (
    <form action={action} className="space-y-4">
      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      {state?.success && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{state.success}</p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <input name="full_name" placeholder="Full name *" className={input} />
        <input name="email" type="email" placeholder="Email *" className={input} />
        <input name="whatsapp" placeholder="WhatsApp" className={input} />
        <input name="country" placeholder="Country" className={input} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <input name="pickup_location" placeholder="Pickup location" className={input} />
        <input name="dropoff_location" placeholder="Drop-off location" className={input} />
        <select name="pickup_region_id" className={input} defaultValue="">
          <option value="">Pickup region</option>
          {regions.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
        <select name="dropoff_region_id" className={input} defaultValue="">
          <option value="">Drop-off region</option>
          {regions.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <input name="pickup_date" type="date" className={input} />
        <input name="pickup_time" type="time" className={input} />
        <input name="passengers" type="number" min={1} placeholder="Passengers" className={input} />
        <input name="luggage" type="number" min={0} placeholder="Luggage" className={input} />
        <select name="preferred_vehicle" className={input} defaultValue="">
          {VEHICLES.map((v) => (
            <option key={v.value} value={v.value}>{v.label}</option>
          ))}
        </select>
        <input name="flight_number" placeholder="Flight number (if airport)" className={input} />
      </div>

      <textarea
        name="needs"
        rows={3}
        placeholder="What do you need? e.g. Full-day North tour for 4, child seat needed *"
        className={input}
      />

      <select name="preferred_currency" className={input} defaultValue="MUR">
        {['MUR', 'EUR', 'USD', 'GBP', 'INR', 'ZAR', 'CHF', 'AED'].map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>

      <Submit />
      <p className="text-xs text-slate-400">
        Need help now? WhatsApp +230 5506 8119 or email info@mymauritiustrip.com.
      </p>
    </form>
  );
}
