import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireRole } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import SiteHeader from '@/components/public/SiteHeader';
import PublicFooter from '@/components/public/PublicFooter';
import { formatMUR, priceUnitLabel } from '@/components/public/ui';
import BookingForm from './booking-form';

export const dynamic = 'force-dynamic';

export async function generateStaticParams() {
  return [];
}

export default async function BookPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = await requireRole('client'); // redirects to /login if signed out
  const supabase = await createClient();

  const { data: listing } = await supabase
    .from('listings_public')
    .select('id, title, base_price_mur, price_unit')
    .eq('slug', slug)
    .single();
  if (!listing) notFound();

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteHeader />
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-8">
        <Link href={`/listings/${slug}`} className="text-sm text-ocean">← Back to listing</Link>
        <h1 className="mt-2 text-xl font-bold text-slate-900">Request to book</h1>
        <p className="mb-1 text-sm text-slate-600">{listing.title}</p>
        <p className="mb-5 text-sm text-slate-500">
          {formatMUR(Number(listing.base_price_mur))} <span className="text-xs">{priceUnitLabel(listing.price_unit)}</span>
        </p>

        <BookingForm
          slug={slug}
          basePrice={Number(listing.base_price_mur)}
          priceUnit={listing.price_unit}
          defaults={{
            full_name: profile.full_name,
            email: profile.email,
            whatsapp: profile.whatsapp,
            country: profile.country,
          }}
        />
      </main>
      <PublicFooter />
    </div>
  );
}
