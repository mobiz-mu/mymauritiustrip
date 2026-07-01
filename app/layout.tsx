import type { Metadata } from 'next';
import './globals.css';
import { SITE } from '@/lib/seo/site';
import { JsonLd } from '@/components/seo/JsonLd';
import { organizationLd, websiteLd } from '@/lib/seo/jsonld';
import { GoogleTags, GtmNoScript } from '@/components/analytics/GoogleTags';

// NOTE: do NOT set `export const dynamic` here. The root layout wraps Next's
// built-in not-found / error pages, which Next prerenders statically during the
// build's "check-static-error-page" step. Forcing the root layout dynamic makes
// that static prerender impossible and the build stalls at "Collecting page
// data". Each Supabase/auth-backed page opts into dynamic rendering itself via
// its own `export const dynamic = 'force-dynamic'`.

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: SITE.defaultTitle, template: '%s | MyMauritiusTrip' },
  description: SITE.description,
  keywords: SITE.keywords.slice(),
  applicationName: SITE.name,
  alternates: { canonical: SITE.url },
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    siteName: SITE.name,
    title: SITE.defaultTitle,
    description: SITE.description,
    url: SITE.url,
    locale: SITE.locale,
    images: [{ url: SITE.ogImage }],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE.defaultTitle,
    description: SITE.description,
    images: [SITE.ogImage],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-white text-slate-900 antialiased">
        <GtmNoScript />
        {children}
        <JsonLd data={[organizationLd(), websiteLd()]} />
        <GoogleTags />
      </body>
    </html>
  );
}
