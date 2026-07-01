'use client';

import { useActionState } from 'react';
import { subscribeToNewsletter, type SubscribeResult } from '@/lib/newsletter/actions';

export default function NewsletterSection() {
  const [state, formAction, pending] = useActionState<SubscribeResult, FormData>(
    subscribeToNewsletter,
    null,
  );

  return (
    <section className="mx-auto max-w-6xl px-4 pb-14 sm:px-6">
      <div className="overflow-hidden rounded-3xl border border-ocean/15 bg-gradient-to-br from-[#eef7fc] to-white px-6 py-10 md:px-12 md:py-12">
        <div className="grid items-center gap-6 md:grid-cols-[1.1fr_1fr]">
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-ocean">Stay in the loop</p>
            <h2 className="font-serif text-2xl tracking-tight text-slate-900 md:text-[28px]">
              Get Mauritius travel deals and new experiences
            </h2>
            <p className="mt-2 max-w-md text-sm text-slate-600">
              Occasional emails with seasonal offers, new stays and island experiences. No spam, unsubscribe anytime.
            </p>
          </div>

          <form action={formAction} className="w-full">
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <input
                type="email"
                name="email"
                required
                placeholder="you@email.com"
                aria-label="Email address"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-ocean focus:ring-2 focus:ring-ocean/30"
              />
              <button
                type="submit"
                disabled={pending}
                className="shrink-0 rounded-xl bg-ocean px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#095a96] disabled:opacity-60"
              >
                {pending ? 'Subscribing…' : 'Subscribe'}
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-400">We respect your privacy. Your email stays on MyMauritiusTrip.com.</p>
            {state?.ok && <p className="mt-1 text-sm font-medium text-emerald-600">{state.ok}</p>}
            {state?.error && <p className="mt-1 text-sm font-medium text-rose-600">{state.error}</p>}
          </form>
        </div>
      </div>
    </section>
  );
}
