import Link from 'next/link';
import PublicShell from '@/components/public/PublicShell';

export const metadata = {
  title: 'Privacy Policy | MyMauritiusTrip',
  description: 'How MyMauritiusTrip.com collects, uses, and protects your personal data, and the choices you have.',
};

const UPDATED = 'Last updated: 1 July 2026';

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="font-serif text-lg font-semibold text-slate-900">{n}. {title}</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-slate-600">{children}</div>
    </section>
  );
}

export default function Page() {
  return (
    <PublicShell>
      <section className="relative overflow-hidden bg-gradient-to-b from-[#eaf5fb] via-[#f5fafd] to-white">
        <div className="mx-auto max-w-3xl px-6 py-10 md:py-14">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-ocean">Legal</p>
          <h1 className="font-serif text-3xl tracking-tight text-slate-900 md:text-4xl">Privacy Policy</h1>
          <p className="mt-2 text-xs text-slate-400">{UPDATED}</p>
        </div>
      </section>

      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-800">
            This document is a launch-ready starting point. Please have it reviewed by a qualified lawyer
            to confirm compliance with the Mauritius Data Protection Act and any other laws that apply to
            your users before public launch.
          </p>

          <p className="mt-5 text-sm leading-relaxed text-slate-600">
            This Privacy Policy explains how MyMauritiusTrip.com (&ldquo;we&rdquo;, &ldquo;us&rdquo;)
            collects, uses, and protects personal data when you use the Platform, and the choices you have.
          </p>

          <Section n="1" title="Data we collect">
            <p>Account data (name, email, and, for providers, business details); booking data you submit; newsletter email if you subscribe; content you post such as reviews; and technical/usage data such as device and log information used to operate and secure the Platform.</p>
          </Section>
          <Section n="2" title="How we use your data">
            <p>To provide the Platform and process booking requests; to connect travellers and providers for confirmed bookings; to send service messages and, where you opt in, occasional travel offers; to prevent fraud and abuse; to comply with legal obligations; and to improve the Platform.</p>
          </Section>
          <Section n="3" title="Legal bases">
            <p>We process data to perform our contract with you, with your consent (for example, newsletter emails), to meet legal obligations, and for our legitimate interests in operating and securing the Platform.</p>
          </Section>
          <Section n="4" title="Sharing your data">
            <p>For a confirmed booking, the relevant provider receives the information needed to deliver the service. We also use trusted service providers that process data on our behalf — for hosting and database (Supabase), media hosting (Cloudinary), and email delivery (Resend). We do not sell your personal data. We do not publicly expose provider contact details, and provider details are not shared with travellers except as needed to fulfil a confirmed booking.</p>
          </Section>
          <Section n="5" title="Cookies">
            <p>We use strictly necessary cookies for authentication and security. We keep non-essential tracking to a minimum; where required, we will ask for your consent.</p>
          </Section>
          <Section n="6" title="Data retention">
            <p>We keep personal data only as long as necessary for the purposes above or as required by law, then delete or anonymise it. You may ask us to delete your account data, subject to legal retention requirements.</p>
          </Section>
          <Section n="7" title="Security">
            <p>We use access controls, row-level security, and encrypted connections to protect data. No system is completely secure, but we work to protect your information and to limit access to those who need it.</p>
          </Section>
          <Section n="8" title="Your rights">
            <p>Subject to applicable law, you may request access to, correction of, or deletion of your personal data, object to certain processing, and withdraw consent (for example, unsubscribe from emails at any time). Contact us using the details below to exercise these rights.</p>
          </Section>
          <Section n="9" title="Children">
            <p>The Platform is intended for users aged 18 and over. We do not knowingly collect data from children.</p>
          </Section>
          <Section n="10" title="International transfers">
            <p>Some service providers may process data outside Mauritius. Where they do, we take steps intended to ensure your data remains protected.</p>
          </Section>
          <Section n="11" title="Changes">
            <p>We may update this Policy from time to time; material changes will be reflected by the &ldquo;last updated&rdquo; date above.</p>
          </Section>
          <Section n="12" title="Contact">
            <p>For privacy questions or requests, contact us on WhatsApp at +230 5506 8119 or by email at info@mymauritiustrip.com.</p>
          </Section>

          <Link href="/" className="mt-8 inline-block rounded-full bg-ocean px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#095a96]">← Back to home</Link>
        </div>
      </main>
    </PublicShell>
  );
}
