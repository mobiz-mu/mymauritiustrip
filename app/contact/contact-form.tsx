'use client';

import { useState } from 'react';

// No backend: composes a mailto: link from the fields (per the chosen approach).
// The user's own mail client sends the message to support.
const SUPPORT_EMAIL = 'info@mymauritiustrip.com';

export default function ContactForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  const mailto = () => {
    const subject = encodeURIComponent(`Website enquiry from ${name || 'a traveller'}`);
    const body = encodeURIComponent(`Name: ${name}\nEmail: ${email}\n\n${message}`);
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
  };

  const field = 'w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-ocean focus:ring-2 focus:ring-ocean/30';

  return (
    <div className="space-y-3">
      <input className={field} placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} aria-label="Your name" />
      <input className={field} type="email" placeholder="Your email" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Your email" />
      <textarea className={`${field} min-h-[120px] resize-y`} placeholder="How can we help?" value={message} onChange={(e) => setMessage(e.target.value)} aria-label="Message" />
      <button
        type="button"
        onClick={mailto}
        disabled={!message.trim()}
        className="w-full rounded-xl bg-ocean px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#095a96] disabled:opacity-60 sm:w-auto"
      >
        Send via email
      </button>
      <p className="text-xs text-slate-400">This opens your email app with the message pre-filled. Your enquiry stays with MyMauritiusTrip support.</p>
    </div>
  );
}
