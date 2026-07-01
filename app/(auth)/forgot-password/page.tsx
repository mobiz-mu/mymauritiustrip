'use client';

import { useActionState } from 'react';
import { forgotPasswordAction, type ActionState } from '../actions';
import { Field, SubmitButton, Alert } from '../ui';

export default function ForgotPasswordPage() {
  const [state, formAction] = useActionState<ActionState, FormData>(
    forgotPasswordAction,
    null,
  );

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-slate-900">Reset your password</h1>
      <p className="text-sm text-slate-500">
        Enter your email and we'll send you a reset link.
      </p>
      <Alert state={state} />
      <form action={formAction} className="space-y-4">
        <Field label="Email" name="email" type="email" />
        <SubmitButton label="Send reset link" />
      </form>
      <p className="text-center text-sm text-slate-500">
        <a href="/login" className="text-ocean hover:underline">
          Back to login
        </a>
      </p>
    </div>
  );
}
