'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { createReview, type ReviewResult } from '../actions';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="rounded-lg bg-ocean px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
      {pending ? 'Submitting…' : 'Submit review'}
    </button>
  );
}

export default function ReviewForm({ bookingId }: { bookingId: string }) {
  const action = createReview.bind(null, bookingId);
  const [state, formAction] = useActionState<ReviewResult, FormData>(action, null);
  const [rating, setRating] = useState(5);

  if (state?.ok) {
    return (
      <div className="rounded-2xl bg-green-50 p-5 ring-1 ring-green-200 text-sm text-green-800">
        Thanks! Your review was submitted and is awaiting approval.
      </div>
    );
  }

  return (
    <form action={formAction} className="rounded-2xl bg-white p-5 ring-1 ring-slate-200 space-y-3">
      <p className="text-sm font-medium">Leave a review</p>
      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}

      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            type="button"
            key={n}
            onClick={() => setRating(n)}
            className={`text-2xl leading-none ${n <= rating ? 'text-gold' : 'text-slate-300'}`}
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
          >
            ★
          </button>
        ))}
        <span className="ml-2 text-sm text-slate-500">{rating}/5</span>
      </div>
      <input type="hidden" name="rating" value={rating} />

      <textarea
        name="comment"
        rows={3}
        placeholder="Share your experience (no phone numbers, emails or links)"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-ocean focus:outline-none"
      />
      <Submit />
      <p className="text-[11px] text-slate-400">Reviews are checked before they appear publicly.</p>
    </form>
  );
}
