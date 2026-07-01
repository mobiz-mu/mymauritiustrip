import { SITE, canonical } from '@/lib/seo/site';

// Structured data builders (schema.org). Rendered via <JsonLd data={...} />.

export function organizationLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE.legalName,
    url: SITE.url,
    logo: canonical('/home/mmt-logo.png'),
    description: SITE.description,
    areaServed: 'Mauritius',
    contactPoint: [{
      '@type': 'ContactPoint',
      contactType: 'customer support',
      email: SITE.supportEmail,
      availableLanguage: ['en', 'fr'],
    }],
  };
}

export function websiteLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE.name,
    url: SITE.url,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE.url}/search?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

export function travelAgencyLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'TravelAgency',
    name: SITE.legalName,
    url: SITE.url,
    image: canonical(SITE.ogImage),
    areaServed: { '@type': 'Country', name: 'Mauritius' },
    description: SITE.description,
  };
}

export function touristDestinationLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'TouristDestination',
    name: 'Mauritius',
    description: 'Mauritius is an Indian Ocean island known for turquoise lagoons, white-sand beaches, coral reefs, mountains and a rich multicultural heritage.',
    url: canonical('/about-mauritius'),
    touristType: ['Beach', 'Honeymoon', 'Family', 'Adventure', 'Culinary'],
  };
}

export function breadcrumbLd(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: canonical(it.path),
    })),
  };
}

export function productLd(opts: {
  name: string; description: string; slug: string; image?: string | null;
  price?: number; ratingValue?: number; reviewCount?: number; category?: string | null; brand?: string | null;
}) {
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: opts.name,
    description: opts.description,
    url: canonical(`/listings/${opts.slug}`),
    category: opts.category ?? undefined,
    image: opts.image ? [opts.image] : [canonical(SITE.ogImage)],
  };
  if (opts.brand) ld.brand = { '@type': 'Brand', name: opts.brand };
  if (opts.price && opts.price > 0) {
    ld.offers = {
      '@type': 'Offer',
      price: Math.round(opts.price),
      priceCurrency: 'MUR',
      availability: 'https://schema.org/InStock',
      url: canonical(`/listings/${opts.slug}`),
    };
  }
  if (opts.ratingValue && opts.reviewCount && opts.reviewCount > 0) {
    ld.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: opts.ratingValue,
      reviewCount: opts.reviewCount,
    };
  }
  return ld;
}
