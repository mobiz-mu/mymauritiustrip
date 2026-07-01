'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { createBooking, type BookingFormResult } from './actions';
import { formatMUR, priceUnitLabel } from '@/components/public/ui';

const input = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-ocean focus:outline-none';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="w-full rounded-lg bg-ocean px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
      {pending ? 'Sending request…' : 'Send booking request'}
    </button>
  );
}

const UNIT_HINT: Record<string, string> = {
  per_night: 'Nights',
  per_day: 'Days',
  per_trip: 'Trips',
  per_booking: 'Units',
  half_day: 'Sessions',
  full_day: 'Days',
};

export default function BookingForm({
  slug,
  basePrice,
  priceUnit,
  defaults,
}: {
  slug: string;
  basePrice: number;
  priceUnit: string;
  defaults: { full_name: string; email: string; whatsapp: string | null; country: string | null };
}) {
  const action = createBooking.bind(null, slug);
  const [state, formAction] = useActionState<BookingFormResult, FormData>(action, null);

  const perPerson = priceUnit === 'per_person';
  const [people, setPeople] = useState(1);
  const [qty, setQty] = useState(1);
  const units = perPerson ? people : qty;
  const estimate = basePrice * Math.max(1, units);

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}

      <label className="block text-sm">
        <span className="mb-1 block text-slate-600">Preferred date *</span>
        <input name="arrival_date" type="date" required className={input} />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Guests</span>
          <input name="num_people" type="number" min={1} value={people} onChange={(e) => setPeople(Number(e.target.value) || 1)} className={input} />
        </label>
        {!perPerson && (
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">{UNIT_HINT[priceUnit] ?? 'Quantity'}</span>
            <input name="quantity" type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value) || 1)} className={input} />
          </label>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Full name *</span>
          <input name="full_name" required defaultValue={defaults.full_name} className={input} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Email *</span>
          <input name="email" type="email" required defaultValue={defaults.email} className={input} />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">WhatsApp</span>
          <input name="whatsapp" defaultValue={defaults.whatsapp ?? ''} className={input} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Country</span>
          <input name="country" defaultValue={defaults.country ?? ''} className={input} />
        </label>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block text-slate-600">Special request</span>
        <textarea name="special_request" rows={3} className={input} placeholder="Anything we should know?" />
      </label>

      <div className="rounded-xl bg-slate-50 p-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-slate-500">Estimated total</span>
          <span className="font-bold text-slate-900">{formatMUR(estimate)} <span className="text-xs font-normal text-slate-500">{priceUnitLabel(priceUnit)}</span></span>
        </div>
        <p className="mt-1 text-xs text-slate-400">
          Pay on arrival. Final amount is confirmed by the provider; this is an estimate only.
        </p>
      </div>

      <Submit />
      <p className="text-center text-[11px] text-slate-400">
        Your request goes through MyMauritiusTrip.com. Provider contact details are never shared directly.
      </p>
    </form>
  );
}
