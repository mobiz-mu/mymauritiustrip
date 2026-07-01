import { createClient } from '@/lib/supabase/server';
import ProviderSignupForm from './form';
import { isBuildPhase } from '@/lib/build-phase';

export const dynamic = 'force-dynamic';

export default async function ProviderSignupPage() {
  let categories: { slug: string; name: string }[] = [];
  let locations: { slug: string; name: string }[] = [];
  if (!isBuildPhase()) {
    const supabase = await createClient();
    const [c, l] = await Promise.all([
      supabase.from('categories').select('slug, name').eq('is_active', true).order('sort_order'),
      supabase.from('locations').select('slug, name').eq('is_active', true).order('name'),
    ]);
    categories = c.data ?? [];
    locations = l.data ?? [];
  }

  return <ProviderSignupForm categories={categories} locations={locations} />;
}
