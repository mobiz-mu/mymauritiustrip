import CatalogPage from '@/components/public/CatalogPage';
import type { CatalogParams } from '@/lib/public/catalog';

export const dynamic = 'force-dynamic';

export default async function SearchPage({ searchParams }: { searchParams: Promise<CatalogParams> }) {
  const sp = await searchParams;
  return (
    <CatalogPage
      searchParams={sp}
      basePath="/search"
      title="Explore Mauritius"
      intro="Stays, transfers, cruises, cars, restaurants and experiences — all in one place."
    />
  );
}
