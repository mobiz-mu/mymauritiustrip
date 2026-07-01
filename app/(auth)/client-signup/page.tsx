'use client';

import { useActionState } from 'react';
import { clientSignupAction, type ActionState } from '../actions';
import { Field, SubmitButton, Alert } from '../ui';

const COUNTRIES = ['Mauritius', 'France', 'United Kingdom', 'India', 'South Africa', 'Germany', 'Réunion', 'Switzerland', 'United Arab Emirates', 'Italy', 'Other'];

export default function ClientSignupPage() {
  const [state, formAction] = useActionState<ActionState, FormData>(
    clientSignupAction,
    null,
  );

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-slate-900">Create your account</h1>
      <Alert state={state} />
      <form action={formAction} className="space-y-4">
        <Field label="Full name" name="full_name" />
        <Field label="Email" name="email" type="email" />
        <Field label="WhatsApp number" name="whatsapp" placeholder="+230…" />
        <Field label="Country" name="country">
          <select
            name="country"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-ocean focus:outline-none"
          >
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Password" name="password" type="password" />
        <Field label="Confirm password" name="confirm_password" type="password" />
        <label className="flex items-start gap-2 text-sm text-slate-600">
          <input type="checkbox" name="accept_terms" className="mt-1" />
          <span>
            I accept the{' '}
            <a href="/terms" className="text-ocean hover:underline">
              terms
            </a>{' '}
            and{' '}
            <a href="/privacy" className="text-ocean hover:underline">
              privacy policy
            </a>
            .
          </span>
        </label>
        <SubmitButton label="Sign up" />
      </form>
      <p className="text-center text-sm text-slate-500">
        Already have an account?{' '}
        <a href="/login" className="text-ocean hover:underline">
          Log in
        </a>
      </p>
    </div>
  );
}
