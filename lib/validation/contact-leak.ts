// =====================================================================
// Contact-leak detector. Used on every free-text field that could leak a
// provider's direct contact (listing descriptions, captions, messages) and
// referenced by the chatbot guardrail. Blocks phone numbers, emails, URLs,
// and social handles/platforms. Admins may override on a per-item basis.
// =====================================================================

const PATTERNS: { label: string; re: RegExp }[] = [
  { label: 'email address', re: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i },
  // 7+ digit sequences, with common separators — catches phone/WhatsApp.
  { label: 'phone or WhatsApp number', re: /(?:\+?\d[\d\s().-]{6,}\d)/ },
  { label: 'web address', re: /\b(?:https?:\/\/|www\.)\S+/i },
  { label: 'web address', re: /\b[a-z0-9-]+\.(?:com|net|org|io|mu|fr|co)\b/i },
  {
    label: 'social media',
    re: /\b(?:whatsapp|wa\.me|t\.me|telegram|facebook|fb\.com|instagram|insta|tiktok|snapchat|messenger)\b/i,
  },
  { label: 'social handle', re: /(?:^|\s)@[a-z0-9._]{2,}/i },
];

export type LeakResult =
  | { clean: true }
  | { clean: false; reasons: string[] };

export function detectContactInfo(text: string | null | undefined): LeakResult {
  if (!text) return { clean: true };
  const reasons = new Set<string>();
  for (const { label, re } of PATTERNS) {
    if (re.test(text)) reasons.add(label);
  }
  return reasons.size === 0
    ? { clean: true }
    : { clean: false, reasons: [...reasons] };
}

// Convenience: throws a user-facing message if a leak is found.
export function assertNoContactInfo(text: string | null | undefined, field = 'text') {
  const result = detectContactInfo(text);
  if (!result.clean) {
    throw new Error(
      `Your ${field} appears to contain contact details (${result.reasons.join(', ')}). ` +
        `For your protection and ours, contact details aren't allowed in public content. ` +
        `All communication goes through MyMauritiusTrip.com.`,
    );
  }
}
