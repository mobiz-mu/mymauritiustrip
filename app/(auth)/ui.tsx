'use client';

import { useFormStatus } from 'react-dom';

export function Field({
  label,
  name,
  type = 'text',
  required = true,
  placeholder,
  children,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  children?: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children ?? (
        <input
          name={name}
          type={type}
          required={required}
          placeholder={placeholder}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-ocean focus:outline-none focus:ring-1 focus:ring-ocean"
        />
      )}
    </label>
  );
}

export function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-ocean px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
    >
      {pending ? 'Please wait…' : label}
    </button>
  );
}

export function Alert({ state }: { state: { error?: string; success?: string } | null }) {
  if (!state) return null;
  if (state.error)
    return (
      <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
    );
  if (state.success)
    return (
      <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
        {state.success}
      </p>
    );
  return null;
}
