'use client';

import { useActionState } from 'react';
import { providerSignupAction, type ActionState } from '../actions';
import { Field, SubmitButton, Alert } from '../ui';

type Option = { slug: string; name: string };

export default function ProviderSignupForm({
  categories,
  locations,
}: {
  categories: Option[];
  locations: Option[];
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    providerSignupAction,
    null,
  );

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-slate-900">List your business</h1>
      <p className="text-sm text-slate-500">
        Create your account, then pay the one-time Rs 499 verification fee.
        Listings unlock after admin approval (max 7 per account).
      </p>
      <Alert state={state} />
      <form action={formAction} className="space-y-4">
        <Field label="Owner full name" name="owner_full_name" />
        <Field label="Business name" name="business_name" />
        <Field label="Business email" name="business_email" type="email" />
        <Field label="WhatsApp number" name="whatsapp" placeholder="+230…" />
        <Field label="Business category" name="category_slug">
          <select
            name="category_slug"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-ocean focus:outline-none"
          >
            <option value="">Select a category…</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Business location" name="location_slug">
          <select
            name="location_slug"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-ocean focus:outline-none"
          >
            <option value="">Select a location…</option>
            {locations.map((l) => (
              <option key={l.slug} value={l.slug}>
                {l.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="BRN / registration number (optional)" name="brn" required={false} />
        <Field label="Password" name="password" type="password" />
        <Field label="Confirm password" name="confirm_password" type="password" />
        <label className="flex items-start gap-2 text-sm text-slate-600">
          <input type="checkbox" name="accept_terms" className="mt-1" />
          <span>
            I accept the{' '}
            <a href="/partner-terms" className="text-ocean hover:underline">
              provider terms
            </a>
            .
          </span>
        </label>
        <SubmitButton label="Create business account" />
      </form>
      <p className="text-center text-sm text-slate-500">
        Looking to book instead?{' '}
        <a href="/client-signup" className="text-ocean hover:underline">
          Sign up as a traveller
        </a>
      </p>
    </div>
  );
}
