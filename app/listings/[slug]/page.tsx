import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getListingDetail } from '@/lib/public/catalog';
import { SITE, canonical } from '@/lib/seo/site';
import { JsonLd } from '@/components/seo/JsonLd';
import { productLd, breadcrumbLd } from '@/lib/seo/jsonld';
import { WHATSAPP, SUPPORT_EMAIL } from '@/components/public/PublicHeader';
import SiteHeader from '@/components/public/SiteHeader';
import PublicFooter from '@/components/public/PublicFooter';
import Gallery from '@/components/public/Gallery';
import { Badges, Stars, formatMUR, priceUnitLabel } from '@/components/public/ui';

export const dynamic = 'force-dynamic';

type SeoMedia = {
  is_cover?: boolean | null;
  full_url?: string | null;
  gallery_url?: string | null;
  preview_url?: string | null;
  poster_url?: string | null;
};

function coverImage(images: SeoMedia[] | undefined): string {
  const cover = images?.find((m) => Boolean(m.is_cover)) ?? images?.[0];
  return (
    cover?.full_url ??
    cover?.gallery_url ??
    cover?.preview_url ??
    cover?.poster_url ??
    SITE.ogImage
  );
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await getListingDetail(slug);
  if (!data) return { title: 'Listing not found' };
  const { listing: l, categoryName, locationName, images } = data;
  const title = `${l.title}${locationName ? ` â€” ${locationName}` : ''}, Mauritius`;
  const description = String(l.description ?? SITE.description).replace(/\s+/g, ' ').trim().slice(0, 160);
  const url = canonical(`/listings/${l.slug}`);
  const image = coverImage(images);
  return {
    title: { absolute: `${title} | ${SITE.name}` },
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'website', siteName: SITE.name, images: [{ url: image }] },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
    other: { 'og:category': categoryName ?? 'Mauritius' },
  };
}

// Dynamic route: nothing is prerendered at build; every listing renders on
// demand at request time. The empty generateStaticParams makes "Collecting page
// data" do zero work (no data fetch) for this segment.
export async function generateStaticParams() {
  return [];
}

function prettify(key: string) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function AttributeList({ attributes }: { attributes: Record<string, unknown> }) {
  const entries = Object.entries(attributes).filter(([, v]) => v !== false && v !== '' && v != null);
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {entries.map(([k, v]) => {
        let label: string;
        if (v === true) label = prettify(k);
        else if (Array.isArray(v)) label = `${prettify(k)}: ${v.join(', ')}`;
        else label = `${prettify(k)}: ${String(v)}`;
        return (
          <span key={k} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">{label}</span>
        );
      })}
    </div>
  );
}

export default async function ListingDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getListingDetail(slug);
  if (!data) notFound();

  const { listing: l, categoryName, locationName, images, videos, reviews } = data;
  const verified = l.business_status === 'verified';

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteHeader />
      <JsonLd
        data={[
          productLd({
            name: l.title,
            description: String(l.description ?? SITE.description).replace(/\s+/g, ' ').trim().slice(0, 300),
            slug: l.slug,
            image: coverImage(images),
            price: l.base_price_mur,
            ratingValue: l.rating_avg,
            reviewCount: l.review_count,
            category: categoryName,
            brand: l.business_name,
          }),
          breadcrumbLd([
            { name: 'Home', path: '/' },
            { name: categoryName ?? 'Listings', path: '/search' },
            { name: l.title, path: `/listings/${l.slug}` },
          ]),
        ]}
      />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 space-y-6">
        <div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">{categoryName} Â· {locationName ?? 'Mauritius'}</p>
            <Badges verified={verified} premium={l.is_premium} featured={l.is_featured} />
          </div>
          <h1 className="mt-1 font-serif text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">{l.title}</h1>
          <div className="mt-1"><Stars rating={Number(l.rating_avg)} count={Number(l.review_count)} /></div>
        </div>

        <Gallery images={images} videos={videos} />

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-[1fr_300px]">
          <div className="space-y-6">
            <section>
              <h2 className="mb-1 font-semibold">About</h2>
              <p className="whitespace-pre-line text-sm text-slate-700">{l.description}</p>
            </section>

            <section>
              <h2 className="mb-2 font-semibold">Features</h2>
              <AttributeList attributes={(l.attributes ?? {}) as Record<string, unknown>} />
            </section>

            {Array.isArray(l.included) && l.included.length > 0 && (
              <section>
                <h2 className="mb-2 font-semibold">What's included</h2>
                <ul className="list-inside list-disc text-sm text-slate-700">
                  {l.included.map((x: string, i: number) => <li key={i}>{x}</li>)}
                </ul>
              </section>
            )}
            {Array.isArray(l.not_included) && l.not_included.length > 0 && (
              <section>
                <h2 className="mb-2 font-semibold">Not included</h2>
                <ul className="list-inside list-disc text-sm text-slate-500">
                  {l.not_included.map((x: string, i: number) => <li key={i}>{x}</li>)}
                </ul>
              </section>
            )}
            {l.rules && (
              <section>
                <h2 className="mb-1 font-semibold">Rules / terms</h2>
                <p className="whitespace-pre-line text-sm text-slate-700">{l.rules}</p>
              </section>
            )}
            {l.cancellation_policy && (
              <section>
                <h2 className="mb-1 font-semibold">Cancellation policy</h2>
                <p className="whitespace-pre-line text-sm text-slate-700">{l.cancellation_policy}</p>
              </section>
            )}

            <section>
              <h2 className="mb-2 font-semibold">Reviews</h2>
              {reviews.length === 0 ? (
                <p className="text-sm text-slate-400">No reviews yet.</p>
              ) : (
                <div className="space-y-3">
                  {reviews.map((r) => (
                    <div key={r.id} className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
                      <p className="text-sm"><span className="text-gold">â˜…</span> {r.rating}/5 <span className="text-xs text-slate-400">Â· Verified guest</span></p>
                      {r.comment && <p className="mt-1 text-sm text-slate-700">{r.comment}</p>}
                      {r.reply && (
                        <div className="mt-2 rounded-lg bg-slate-50 p-2 text-sm">
                          <p className="text-xs font-medium text-slate-500">Response from {l.business_name}</p>
                          <p className="text-slate-700">{r.reply}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Booking / contact rail */}
          <aside id="book" className="space-y-3 sm:sticky sm:top-20 sm:self-start">
            <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
              <p className="text-lg font-bold text-slate-900">
                {formatMUR(Number(l.base_price_mur))} <span className="text-sm font-normal text-slate-500">{priceUnitLabel(l.price_unit)}</span>
              </p>
              <a
                href={`/listings/${slug}/book`}
                className="mt-3 block w-full rounded-lg bg-ocean px-4 py-2.5 text-center text-sm font-semibold text-white"
              >
                Request to Book
              </a>
              <p className="mt-2 text-center text-xs text-slate-400">Pay on arrival Â· no card needed now.</p>
            </div>

            <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
              <p className="text-sm font-medium text-slate-700">Offered by</p>
              <p className="text-sm text-slate-900">{l.business_name} {verified && <span className="text-ocean">âœ“</span>}</p>
              <p className="mt-3 text-xs text-slate-500">Need help choosing?</p>
              <a
                href={`https://wa.me/${WHATSAPP}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 block rounded-lg bg-[#25D366] px-4 py-2 text-center text-sm font-semibold text-white"
              >
                WhatsApp us +230 5506 8119
              </a>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="mt-2 block rounded-lg ring-1 ring-slate-300 px-4 py-2 text-center text-sm font-semibold text-slate-700"
              >
                Email {SUPPORT_EMAIL}
              </a>
              <p className="mt-3 text-[11px] leading-snug text-slate-400">
                All communication stays on MyMauritiusTrip.com. Provider contact details are never shared directly.
              </p>
            </div>
          </aside>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}

