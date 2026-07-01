'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { ATTRIBUTE_UI, type AttrField } from '@/lib/validation/attribute-ui';
import type { FormResult } from './actions';

type Option = { slug?: string; id: string; name: string };
type Initial = {
  category_slug?: string;
  location_id?: string;
  title?: string;
  description?: string;
  base_price_mur?: number;
  price_unit?: string;
  included?: string[];
  not_included?: string[];
  rules?: string | null;
  cancellation_policy?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  attributes?: Record<string, unknown>;
};

const PRICE_UNITS: { value: string; label: string }[] = [
  { value: 'per_night', label: 'per night' },
  { value: 'per_day', label: 'per day' },
  { value: 'per_person', label: 'per person' },
  { value: 'per_trip', label: 'per trip' },
  { value: 'per_booking', label: 'per booking' },
  { value: 'half_day', label: 'half day' },
  { value: 'full_day', label: 'full day' },
];

const input = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-ocean focus:outline-none';

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="rounded-lg bg-ocean px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
      {pending ? 'Saving…' : label}
    </button>
  );
}

function AttributeField({ f, initial }: { f: AttrField; initial: Record<string, unknown> }) {
  const name = `attr_${f.key}`;
  const v = initial[f.key];
  if (f.type === 'bool') {
    return (
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name={name} defaultChecked={Boolean(v)} /> {f.label}
      </label>
    );
  }
  if (f.type === 'number') {
    return (
      <label className="block text-sm">
        <span className="mb-1 block text-slate-600">{f.label}{f.optional ? '' : ' *'}</span>
        <input type="number" name={name} min={f.min} defaultValue={v != null ? String(v) : ''} className={input} />
      </label>
    );
  }
  if (f.type === 'enum') {
    return (
      <label className="block text-sm">
        <span className="mb-1 block text-slate-600">{f.label}{f.optional ? '' : ' *'}</span>
        <select name={name} defaultValue={(v as string) ?? ''} className={input}>
          <option value="">Select…</option>
          {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </label>
    );
  }
  if (f.type === 'multienum') {
    const arr = Array.isArray(v) ? (v as string[]) : [];
    return (
      <div className="block text-sm">
        <span className="mb-1 block text-slate-600">{f.label} *</span>
        <div className="flex flex-wrap gap-2">
          {f.options.map((o) => (
            <label key={o} className="flex items-center gap-1 rounded border border-slate-200 px-2 py-1">
              <input type="checkbox" name={name} value={o} defaultChecked={arr.includes(o)} /> {o}
            </label>
          ))}
        </div>
      </div>
    );
  }
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-slate-600">{f.label}{f.optional ? '' : ' *'}</span>
      <input type="text" name={name} defaultValue={(v as string) ?? ''} className={input} />
    </label>
  );
}

export default function ListingForm({
  action,
  categories,
  locations,
  initial,
  submitLabel = 'Save listing',
}: {
  action: (prev: FormResult, formData: FormData) => Promise<FormResult>;
  categories: Option[];
  locations: Option[];
  initial?: Initial;
  submitLabel?: string;
}) {
  const [state, formAction] = useActionState<FormResult, FormData>(action, null);
  const [category, setCategory] = useState(initial?.category_slug ?? '');
  const attrs = (initial?.attributes ?? {}) as Record<string, unknown>;
  const fields = ATTRIBUTE_UI[category] ?? [];

  return (
    <form action={formAction} className="space-y-5">
      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}

      <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
        Do not include phone numbers, WhatsApp, email, websites, or social links anywhere in this
        listing. Contact details are blocked and all communication stays on MyMauritiusTrip.com.
      </div>

      <label className="block text-sm">
        <span className="mb-1 block text-slate-600">Category *</span>
        <select
          name="category_slug"
          required
          defaultValue={initial?.category_slug ?? ''}
          onChange={(e) => setCategory(e.target.value)}
          className={input}
        >
          <option value="">Select a category…</option>
          {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
        </select>
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-slate-600">Location</span>
        <select name="location_id" defaultValue={initial?.location_id ?? ''} className={input}>
          <option value="">Select a location…</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-slate-600">Title *</span>
        <input name="title" required defaultValue={initial?.title ?? ''} className={input} />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-slate-600">Description *</span>
        <textarea name="description" required rows={4} defaultValue={initial?.description ?? ''} className={input} />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Base price (MUR) *</span>
          <input name="base_price_mur" type="number" min={1} step="0.01" required defaultValue={initial?.base_price_mur ?? ''} className={input} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Price unit *</span>
          <select name="price_unit" defaultValue={initial?.price_unit ?? 'per_night'} className={input}>
            {PRICE_UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
          </select>
        </label>
      </div>

      {category && fields.length > 0 && (
        <fieldset className="rounded-xl ring-1 ring-slate-200 p-4">
          <legend className="px-1 text-sm font-medium">{category} details</legend>
          <div className="grid grid-cols-2 gap-3">
            {fields.map((f) => <AttributeField key={f.key} f={f} initial={attrs} />)}
          </div>
        </fieldset>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Included (one per line)</span>
          <textarea name="included" rows={3} defaultValue={(initial?.included ?? []).join('\n')} className={input} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Not included (one per line)</span>
          <textarea name="not_included" rows={3} defaultValue={(initial?.not_included ?? []).join('\n')} className={input} />
        </label>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block text-slate-600">Rules / terms</span>
        <textarea name="rules" rows={2} defaultValue={initial?.rules ?? ''} className={input} />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-slate-600">Cancellation policy</span>
        <textarea name="cancellation_policy" rows={2} defaultValue={initial?.cancellation_policy ?? ''} className={input} />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">SEO title</span>
          <input name="seo_title" defaultValue={initial?.seo_title ?? ''} className={input} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">SEO description</span>
          <input name="seo_description" defaultValue={initial?.seo_description ?? ''} className={input} />
        </label>
      </div>

      <Submit label={submitLabel} />
    </form>
  );
}
