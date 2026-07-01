import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { CATEGORY_FILTERS, type FilterDef } from './filter-config';
import { imageVariants, videoVariants } from '@/lib/cloudinary/urls';
import { isBuildPhase } from '@/lib/build-phase';

const PAGE_SIZE = 24;

export type CatalogParams = Record<string, string | string[] | undefined>;

export type ListingCardData = {
  id: string;
  slug: string;
  title: string;
  description: string;
  category_id: string;
  location_id: string | null;
  base_price_mur: number;
  price_unit: string;
  rating_avg: number;
  review_count: number;
  is_premium: boolean;
  is_featured: boolean;
  business_name: string;
  business_status: string;
  attributes: Record<string, unknown>;
  cover_card_url: string | null;
};

function one(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return s && s !== '' ? s : undefined;
}
function clean(s: string): string {
  return s.replace(/[%,()]/g, ' ').trim();
}

export async function getReferenceData() {
  if (isBuildPhase()) {
    const empty = new Map<string, never>();
    return { categories: [], locations: [], catBySlug: empty, catById: empty, locById: empty, locBySlug: empty };
  }
  const supabase = await createClient();
  const [{ data: categories }, { data: locations }] = await Promise.all([
    supabase.from('categories').select('id, slug, name').eq('is_active', true).order('sort_order'),
    supabase.from('locations').select('id, slug, name').eq('is_active', true).order('name'),
  ]);
  const catBySlug = new Map((categories ?? []).map((c) => [c.slug, c]));
  const catById = new Map((categories ?? []).map((c) => [c.id, c]));
  const locById = new Map((locations ?? []).map((l) => [l.id, l]));
  const locBySlug = new Map((locations ?? []).map((l) => [l.slug, l]));
  return { categories: categories ?? [], locations: locations ?? [], catBySlug, catById, locById, locBySlug };
}

// Collect the active attribute filters for a given category set.
function activeAttrFilters(categorySlugs: string[], params: CatalogParams) {
  const defs: FilterDef[] = [];
  const seen = new Set<string>();
  for (const slug of categorySlugs) {
    for (const f of CATEGORY_FILTERS[slug] ?? []) {
      if (!seen.has(f.key)) { seen.add(f.key); defs.push(f); }
    }
  }
  const eq: { key: string; value: string }[] = [];
  const arr: { key: string; value: string }[] = [];
  const bool: string[] = [];
  const text: { key: string; value: string }[] = [];
  const mins: { key: string; value: number }[] = [];
  for (const f of defs) {
    const raw = one(params[`f_${f.key}`]);
    if (!raw) continue;
    if (f.type === 'bool' && raw === '1') bool.push(f.key);
    else if (f.type === 'enum') eq.push({ key: f.key, value: raw });
    else if (f.type === 'arrcontains') arr.push({ key: f.key, value: raw });
    else if (f.type === 'text') text.push({ key: f.key, value: clean(raw) });
    else if (f.type === 'min') { const n = Number(raw); if (Number.isFinite(n)) mins.push({ key: f.key, value: n }); }
  }
  return { eq, arr, bool, text, mins };
}

export async function searchListings(params: CatalogParams, forcedCategorySlugs?: string[]) {
  if (isBuildPhase()) {
    return { items: [] as ListingCardData[], total: 0, page: 1, pageCount: 1, error: null as string | null };
  }
  const supabase = await createClient();
  const ref = await getReferenceData();

  // Category resolution: forced (landing page) wins, else ?category=slug.
  const categorySlugs = forcedCategorySlugs ?? (one(params.category) ? [one(params.category)!] : []);
  const categoryIds = categorySlugs.map((s) => ref.catBySlug.get(s)?.id).filter(Boolean) as string[];

  let q = supabase.from('listings_public').select('*');

  if (categoryIds.length) q = q.in('category_id', categoryIds);

  const locSlug = one(params.location);
  if (locSlug) {
    const locId = ref.locBySlug.get(locSlug)?.id;
    if (locId) q = q.eq('location_id', locId);
  }

  const priceMin = Number(one(params.price_min));
  const priceMax = Number(one(params.price_max));
  if (Number.isFinite(priceMin) && one(params.price_min)) q = q.gte('base_price_mur', priceMin);
  if (Number.isFinite(priceMax) && one(params.price_max)) q = q.lte('base_price_mur', priceMax);

  const ratingMin = Number(one(params.rating_min));
  if (Number.isFinite(ratingMin) && one(params.rating_min)) q = q.gte('rating_avg', ratingMin);

  if (one(params.premium) === '1') q = q.eq('is_premium', true);
  if (one(params.featured) === '1') q = q.eq('is_featured', true);

  const kw = one(params.q);
  if (kw) {
    const safe = clean(kw);
    if (safe) q = q.or(`title.ilike.*${safe}*,description.ilike.*${safe}*`);
  }

  // Attribute filters (JSONB) applied safely in the DB where possible.
  const af = activeAttrFilters(categorySlugs, params);
  for (const b of af.bool) q = q.contains('attributes', { [b]: true });
  for (const e of af.eq) q = q.contains('attributes', { [e.key]: e.value });
  for (const a of af.arr) q = q.contains('attributes', { [a.key]: [a.value] });
  for (const t of af.text) q = q.filter(`attributes->>${t.key}`, 'ilike', `*${t.value}*`);

  // Default ordering: featured, then premium, then rating, then newest.
  q = q
    .order('is_featured', { ascending: false })
    .order('is_premium', { ascending: false });

  const sort = one(params.sort);
  if (sort === 'price_asc') q = q.order('base_price_mur', { ascending: true });
  else if (sort === 'price_desc') q = q.order('base_price_mur', { ascending: false });
  else if (sort === 'rating') q = q.order('rating_avg', { ascending: false });
  else q = q.order('created_at', { ascending: false });

  q = q.limit(300);

  const { data, error } = await q;
  if (error) return { items: [] as ListingCardData[], total: 0, page: 1, pageCount: 1, error: error.message };

  let rows = (data ?? []) as Record<string, unknown>[];

  // Numeric attribute minimums (e.g. seats/guests) — post-filtered because a
  // JSONB text path can't be compared numerically in the DB query.
  if (af.mins.length) {
    rows = rows.filter((r) => {
      const attrs = (r.attributes ?? {}) as Record<string, unknown>;
      return af.mins.every((m) => {
        const v = Number(attrs[m.key]);
        return Number.isFinite(v) && v >= m.value;
      });
    });
  }

  const total = rows.length;
  const page = Math.max(1, Number(one(params.page)) || 1);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Cover image (approved only) for the visible page.
  const ids = pageRows.map((r) => r.id as string);
  const coverById = await getCoverMap(ids);

  const items: ListingCardData[] = pageRows.map((r) => {
    const pubId = coverById.get(r.id as string);
    return {
      id: r.id as string,
      slug: r.slug as string,
      title: r.title as string,
      description: r.description as string,
      category_id: r.category_id as string,
      location_id: (r.location_id as string) ?? null,
      base_price_mur: Number(r.base_price_mur),
      price_unit: r.price_unit as string,
      rating_avg: Number(r.rating_avg),
      review_count: Number(r.review_count),
      is_premium: Boolean(r.is_premium),
      is_featured: Boolean(r.is_featured),
      business_name: r.business_name as string,
      business_status: r.business_status as string,
      attributes: (r.attributes ?? {}) as Record<string, unknown>,
      cover_card_url: pubId ? imageVariants(pubId).card : null,
    };
  });

  return { items, total, page, pageCount, error: null as string | null };
}

// Cover public_id per listing: prefer is_cover, else first image by position.
async function getCoverMap(listingIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!listingIds.length) return map;
  const supabase = await createClient();
  const { data } = await supabase
    .from('listing_media_public')
    .select('listing_id, cloudinary_id, is_cover, position, type')
    .in('listing_id', listingIds)
    .eq('type', 'image')
    .order('is_cover', { ascending: false })
    .order('position', { ascending: true });
  for (const m of data ?? []) {
    if (!map.has(m.listing_id)) map.set(m.listing_id, m.cloudinary_id);
  }
  return map;
}

export type DetailMedia = {
  id: string;
  type: 'image' | 'video';
  caption: string | null;
  alt_text: string | null;
  is_cover: boolean;
  gallery_url: string;
  full_url: string;
  poster_url: string;
  preview_url: string;
};

export async function getListingDetail(slug: string) {
  if (isBuildPhase()) return null;
  const supabase = await createClient();
  const { data: listing } = await supabase.from('listings_public').select('*').eq('slug', slug).single();
  if (!listing) return null;

  const ref = await getReferenceData();
  const category = ref.catById.get(listing.category_id) ?? null;
  const location = listing.location_id ? ref.locById.get(listing.location_id) ?? null : null;

  const [{ data: mediaRows }, { data: reviews }] = await Promise.all([
    supabase
      .from('listing_media_public')
      .select('id, type, cloudinary_id, caption, alt_text, is_cover, position')
      .eq('listing_id', listing.id)
      .order('is_cover', { ascending: false })
      .order('position', { ascending: true }),
    supabase
      .from('reviews_public')
      .select('id, rating, comment, created_at, reply_body')
      .eq('listing_id', listing.id)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  const media: DetailMedia[] = (mediaRows ?? []).map((m) => {
    const iv = imageVariants(m.cloudinary_id);
    const vv = videoVariants(m.cloudinary_id);
    return {
      id: m.id,
      type: m.type,
      caption: m.caption,
      alt_text: m.alt_text,
      is_cover: m.is_cover,
      gallery_url: iv.gallery,
      full_url: iv.full,
      poster_url: vv.poster,
      preview_url: vv.preview,
    };
  });

  const reviewsWithReplies = (reviews ?? []).map((r) => ({ ...r, reply: r.reply_body ?? null }));

  return {
    listing,
    categoryName: category?.name ?? null,
    locationName: location?.name ?? null,
    images: media.filter((m) => m.type === 'image'),
    videos: media.filter((m) => m.type === 'video'),
    reviews: reviewsWithReplies,
  };
}

export type PublicReview = {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  reply_body: string | null;
  listingTitle: string | null;
  listingSlug: string | null;
};

// Latest approved public reviews for the homepage testimonials section.
// Reads reviews_public (approved + published + verified only). No reviewer
// identity is exposed by the view, so we attribute to "Verified traveller".
export async function getLatestReviews(limit = 9): Promise<PublicReview[]> {
  if (isBuildPhase()) return [];
  const supabase = await createClient();
  const { data: reviews } = await supabase
    .from('reviews_public')
    .select('id, listing_id, rating, comment, created_at, reply_body')
    .not('comment', 'is', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  const rows = reviews ?? [];
  const listingIds = Array.from(new Set(rows.map((r) => r.listing_id).filter(Boolean)));
  const titleById = new Map<string, { title: string; slug: string }>();
  if (listingIds.length > 0) {
    const { data: listings } = await supabase
      .from('listings_public')
      .select('id, title, slug')
      .in('id', listingIds);
    for (const l of listings ?? []) titleById.set(l.id, { title: l.title, slug: l.slug });
  }

  return rows
    .filter((r) => typeof r.comment === 'string' && r.comment.trim().length > 0)
    .map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      created_at: r.created_at,
      reply_body: r.reply_body ?? null,
      listingTitle: titleById.get(r.listing_id)?.title ?? null,
      listingSlug: titleById.get(r.listing_id)?.slug ?? null,
    }));
}
