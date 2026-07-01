import type { Metadata } from 'next';
import './globals.css';

// NOTE: do NOT set `export const dynamic` here. The root layout wraps Next's
// built-in not-found / error pages, which Next prerenders statically during the
// build's "check-static-error-page" step. Forcing the root layout dynamic makes
// that static prerender impossible and the build stalls at "Collecting page
// data". Each Supabase/auth-backed page opts into dynamic rendering itself via
// its own `export const dynamic = 'force-dynamic'`, so the app is still fully
// dynamic where it needs to be — without breaking the static error pages.

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: 'MyMauritiusTrip.com',
  description:
    'Book your Mauritius trip in one place. Verified stays, car rentals, boat trips, restaurants and experiences.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-white text-slate-900 antialiased">{children}</body>
    </html>
  );
}
