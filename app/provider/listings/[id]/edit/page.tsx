import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import ListingForm from '../../listing-form';
import { updateListing, submitForReview } from '../../actions';

export const dynamic = 'force-dynamic';

export default async function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole('provider');
  const { id } = await params;
  const supabase = await createClient();

  const { data: listing } = await supabase
    .from('listings')
    .select('id, status, rejected_reason, category_id, location_id, title, description, base_price_mur, price_unit, included, not_included, rules, cancellation_policy, seo_title, seo_description, attributes')
    .eq('id', id)
    .single();
  if (!listing) notFound();

  const [{ data: categories }, { data: locations }, { data: cat }] = await Promise.all([
    supabase.from('categories').select('slug, name').eq('is_active', true).order('sort_order'),
    supabase.from('locations').select('id, name').eq('is_active', true).order('name'),
    supabase.from('categories').select('slug').eq('id', listing.category_id).single(),
  ]);

  const boundUpdate = updateListing.bind(null, id);

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <a href="/provider/listings" className="text-sm text-ocean">← My listings</a>
      <div className="mt-2 mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Edit listing</h1>
        <a href={`/provider/listings/${id}/media`} className="text-sm text-ocean">Manage media →</a>
      </div>

      {listing.status === 'rejected' && listing.rejected_reason && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          Rejected: {listing.rejected_reason}
        </p>
      )}
      {listing.status !== 'draft' && (
        <p className="mb-4 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
          Saving changes will resubmit this listing for admin review.
        </p>
      )}

      <ListingForm
        action={boundUpdate}
        categories={(categories ?? []).map((c) => ({ id: c.slug, slug: c.slug, name: c.name }))}
        locations={locations ?? []}
        submitLabel="Save changes"
        initial={{
          category_slug: cat?.slug,
          location_id: listing.location_id ?? undefined,
          title: listing.title,
          description: listing.description,
          base_price_mur: listing.base_price_mur,
          price_unit: listing.price_unit,
          included: listing.included ?? [],
          not_included: listing.not_included ?? [],
          rules: listing.rules,
          cancellation_policy: listing.cancellation_policy,
          seo_title: listing.seo_title,
          seo_description: listing.seo_description,
          attributes: listing.attributes ?? {},
        }}
      />

      {['draft', 'rejected', 'hidden'].includes(listing.status) && (
        <form action={submitForReview} className="mt-4">
          <input type="hidden" name="listing_id" value={id} />
          <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
            Submit for review
          </button>
        </form>
      )}
    </main>
  );
}
