'use client';

import { useActionState } from 'react';
import { resetPasswordAction, type ActionState } from '../actions';
import { Field, SubmitButton, Alert } from '../ui';

export default function ResetPasswordPage() {
  const [state, formAction] = useActionState<ActionState, FormData>(
    resetPasswordAction,
    null,
  );

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-slate-900">Set a new password</h1>
      <Alert state={state} />
      <form action={formAction} className="space-y-4">
        <Field label="New password" name="password" type="password" />
        <Field label="Confirm new password" name="confirm_password" type="password" />
        <SubmitButton label="Update password" />
      </form>
    </div>
  );
}
