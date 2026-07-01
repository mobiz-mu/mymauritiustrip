import CatalogPage from '@/components/public/CatalogPage';
import type { CatalogParams } from '@/lib/public/catalog';
import { LANDING_CATEGORIES } from '@/lib/public/filter-config';

export const dynamic = 'force-dynamic';

const SLUG = 'car-rental-mauritius';

export default async function Page({ searchParams }: { searchParams: Promise<CatalogParams> }) {
  const sp = await searchParams;
  const cfg = LANDING_CATEGORIES[SLUG];
  return (
    <CatalogPage
      searchParams={sp}
      basePath={`/${SLUG}`}
      forcedSlugs={cfg.slugs}
      title={cfg.title}
    />
  );
}
