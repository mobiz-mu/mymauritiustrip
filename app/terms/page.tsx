import Link from 'next/link';
import PublicShell from '@/components/public/PublicShell';

export const metadata = {
  title: 'Terms of Use | MyMauritiusTrip',
  description: 'The terms governing your use of MyMauritiusTrip.com — bookings, pay-on-arrival, provider obligations, and on-platform communication.',
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
          <h1 className="font-serif text-3xl tracking-tight text-slate-900 md:text-4xl">Terms of Use</h1>
          <p className="mt-2 text-xs text-slate-400">{UPDATED}</p>
        </div>
      </section>

      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-800">
            This document is a launch-ready starting point. Please have it reviewed by a qualified
            Mauritian lawyer and insert your registered legal-entity name and address before public launch.
          </p>

          <p className="mt-5 text-sm leading-relaxed text-slate-600">
            These Terms of Use (&ldquo;Terms&rdquo;) govern your access to and use of MyMauritiusTrip.com
            and related services (the &ldquo;Platform&rdquo;), operated by MyMauritiusTrip.com
            (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;). By using the Platform you agree to these
            Terms. If you do not agree, please do not use the Platform.
          </p>

          <Section n="1" title="Who we are and what we do">
            <p>The Platform is an online marketplace that connects travellers with verified local tourism providers in Mauritius — stays, car rental, taxis and private drivers, airport transfers, catamaran and boat trips, restaurants and experiences. We facilitate discovery and booking requests; the underlying services are provided by independent third-party providers, not by us.</p>
          </Section>
          <Section n="2" title="Definitions">
            <p>&ldquo;Provider&rdquo; means a business listing services on the Platform. &ldquo;Traveller&rdquo; (or &ldquo;you&rdquo;) means a person browsing or booking through the Platform. &ldquo;Listing&rdquo; means a service offered by a Provider. &ldquo;Booking&rdquo; means a request to reserve a Listing.</p>
          </Section>
          <Section n="3" title="Accounts and eligibility">
            <p>You must be at least 18 years old to create an account or make a Booking. You are responsible for the accuracy of the information you provide, for keeping your login credentials secure, and for activity under your account.</p>
          </Section>
          <Section n="4" title="Bookings and pay-on-arrival">
            <p>A Booking is a request that a Provider may accept or decline. Unless stated otherwise, payment is made directly to the Provider on arrival — no card payment is taken by the Platform at booking time. Prices are shown in Mauritian Rupees (MUR) and may be subject to local taxes or fees set by the Provider. The contract for the underlying service is between you and the Provider.</p>
          </Section>
          <Section n="5" title="On-platform communication">
            <p>All communication relating to a Booking should stay on the Platform or with our support team. Provider contact details are not shared publicly. Do not attempt to arrange payment or contact off-platform to circumvent the Platform; doing so may result in suspension and removes the protections the Platform provides.</p>
          </Section>
          <Section n="6" title="Provider obligations">
            <p>Providers must be verified before listing, may hold up to seven active Listings, must describe services accurately, honour accepted Bookings, comply with applicable Mauritian law and licensing, and pay the applicable commission. Providers are solely responsible for the services they deliver.</p>
          </Section>
          <Section n="7" title="Fees and commission">
            <p>Providers pay a one-time verification fee and a commission on completed Bookings, plus any optional premium placement fees, as communicated during onboarding. Travellers do not pay a separate Platform fee to browse or request Bookings.</p>
          </Section>
          <Section n="8" title="Reviews">
            <p>Reviews may be submitted by travellers who completed a Booking and must be honest and lawful. We may remove content that is abusive, misleading, or violates these Terms. Reviews reflect the views of their authors, not us.</p>
          </Section>
          <Section n="9" title="Acceptable use">
            <p>You agree not to misuse the Platform, including by attempting to breach security, scrape data, post unlawful or infringing content, harass others, or interfere with the Platform&rsquo;s operation.</p>
          </Section>
          <Section n="10" title="Intellectual property">
            <p>The Platform, its branding, and its content (excluding Provider-supplied content) are owned by us or our licensors. Providers grant us a licence to display their submitted content for the purpose of operating the Platform.</p>
          </Section>
          <Section n="11" title="Disclaimers and liability">
            <p>The Platform is provided &ldquo;as is&rdquo;. We are an intermediary and do not control and are not responsible for the acts or omissions of Providers or for the quality, safety, or legality of their services. To the maximum extent permitted by law, our liability arising from your use of the Platform is limited, and we are not liable for indirect or consequential losses.</p>
          </Section>
          <Section n="12" title="Indemnity">
            <p>You agree to indemnify us against claims arising from your breach of these Terms or your misuse of the Platform.</p>
          </Section>
          <Section n="13" title="Changes and termination">
            <p>We may update these Terms from time to time; material changes will be reflected by the &ldquo;last updated&rdquo; date. We may suspend or terminate accounts that breach these Terms.</p>
          </Section>
          <Section n="14" title="Governing law">
            <p>These Terms are governed by the laws of the Republic of Mauritius, and the courts of Mauritius have jurisdiction over any dispute.</p>
          </Section>
          <Section n="15" title="Contact">
            <p>Questions about these Terms? Contact us on WhatsApp at +230 5506 8119 or by email at info@mymauritiustrip.com.</p>
          </Section>

          <Link href="/" className="mt-8 inline-block rounded-full bg-ocean px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#095a96]">← Back to home</Link>
        </div>
      </main>
    </PublicShell>
  );
}
