'use client';

import { useActionState } from 'react';
import { loginAction, type ActionState } from '../actions';
import { Field, SubmitButton, Alert } from '../ui';

export default function LoginForm({ notice }: { notice: ActionState }) {
  const [state, formAction] = useActionState<ActionState, FormData>(loginAction, notice);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-slate-900">Log in</h1>
      <Alert state={state} />
      <form action={formAction} className="space-y-4">
        <Field label="Email" name="email" type="email" />
        <Field label="Password" name="password" type="password" />
        <SubmitButton label="Log in" />
      </form>
      <div className="flex justify-between text-sm">
        <a href="/forgot-password" className="text-ocean hover:underline">
          Forgot password?
        </a>
        <a href="/client-signup" className="text-ocean hover:underline">
          Create account
        </a>
      </div>
      <p className="text-center text-xs text-slate-500">
        Are you a business?{' '}
        <a href="/provider-signup" className="text-ocean hover:underline">
          List your business
        </a>
      </p>
    </div>
  );
}
