import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import MediaManager from './manager';

export const dynamic = 'force-dynamic';

export default async function ListingMediaPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole('provider');
  const { id } = await params;
  const supabase = await createClient();

  const { data: listing } = await supabase.from('listings').select('id, title').eq('id', id).single();
  if (!listing) notFound();

  const { data: media } = await supabase
    .from('listing_media')
    .select('id, type, status, is_cover, thumbnail_url, url, caption')
    .eq('listing_id', id)
    .order('position', { ascending: true });

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <a href="/provider/listings" className="text-sm text-ocean">← My listings</a>
      <h1 className="mt-2 mb-6 text-xl font-semibold">Media — {listing.title}</h1>
      <MediaManager listingId={id} media={media ?? []} />
    </main>
  );
}
