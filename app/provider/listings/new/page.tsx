import { requireVerifiedProvider } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import ListingForm from '../listing-form';
import { createListing } from '../actions';

export const dynamic = 'force-dynamic';

export default async function NewListingPage() {
  // Redirects unverified providers to /provider/verification.
  const { business } = await requireVerifiedProvider();
  const supabase = await createClient();

  const { count } = await supabase
    .from('listings')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', business.id);

  if ((count ?? 0) >= 7) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-12">
        <a href="/provider/listings" className="text-sm text-ocean">← My listings</a>
        <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
          You've reached the maximum of 7 listings. Delete or edit an existing listing to add a new one.
        </p>
      </main>
    );
  }

  const [{ data: categories }, { data: locations }] = await Promise.all([
    supabase.from('categories').select('slug, name').eq('is_active', true).order('sort_order'),
    supabase.from('locations').select('id, name').eq('is_active', true).order('name'),
  ]);

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <a href="/provider/listings" className="text-sm text-ocean">← My listings</a>
      <h1 className="mt-2 mb-6 text-xl font-semibold">New listing</h1>
      <ListingForm
        action={createListing}
        categories={(categories ?? []).map((c) => ({ id: c.slug, slug: c.slug, name: c.name }))}
        locations={locations ?? []}
        submitLabel="Create draft"
      />
    </main>
  );
}
