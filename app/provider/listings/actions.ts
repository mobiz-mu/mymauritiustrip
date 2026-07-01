'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/guards';
import { validateAttributes } from '@/lib/validation/listing-attributes';
import { collectAttributes } from '@/lib/validation/attribute-ui';
import { detectContactInfo } from '@/lib/validation/contact-leak';

export type FormResult = { error?: string } | null;

const PRICE_UNITS = ['per_day', 'per_night', 'per_person', 'per_trip', 'per_booking', 'half_day', 'full_day'];

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70);
}
function toLines(v: FormDataEntryValue | null): string[] {
  if (!v) return [];
  return String(v)
    .split(/[\n,]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

type Parsed = {
  category_slug: string;
  category_id: string;
  location_id: string | null;
  title: string;
  description: string;
  base_price_mur: number;
  price_unit: string;
  included: string[];
  not_included: string[];
  rules: string | null;
  cancellation_policy: string | null;
  seo_title: string | null;
  seo_description: string | null;
  attributes: Record<string, unknown>;
};

async function parseForm(formData: FormData): Promise<{ error: string } | { data: Parsed }> {
  const supabase = await createClient();
  const title = (formData.get('title') as string)?.trim();
  const description = (formData.get('description') as string)?.trim();
  const categorySlug = formData.get('category_slug') as string;
  const locationId = (formData.get('location_id') as string) || null;
  const price = Number(formData.get('base_price_mur'));
  const priceUnit = formData.get('price_unit') as string;

  if (!title || !description) return { error: 'Title and description are required.' };
  if (!categorySlug) return { error: 'Please choose a category.' };
  if (!Number.isFinite(price) || price <= 0) return { error: 'Base price (MUR) must be greater than 0.' };
  if (!PRICE_UNITS.includes(priceUnit)) return { error: 'Please choose a valid price unit.' };

  // Contact-leak (friendly pre-check; DB guard is the backstop).
  for (const [label, text] of [['title', title], ['description', description]] as const) {
    const r = detectContactInfo(text);
    if (!r.clean) {
      return { error: `Your ${label} contains contact details (${r.reasons.join(', ')}). These aren't allowed in public content.` };
    }
  }

  // Resolve category id.
  const { data: cat } = await supabase.from('categories').select('id').eq('slug', categorySlug).single();
  if (!cat) return { error: 'Unknown category.' };

  // Strict per-category attribute validation (zod is the source of truth).
  const attrs = collectAttributes(categorySlug, formData);
  const v = validateAttributes(categorySlug, attrs);
  if (!v.success) return { error: `Attributes: ${v.error}` };

  return {
    data: {
      category_slug: categorySlug,
      category_id: cat.id,
      location_id: locationId,
      title,
      description,
      base_price_mur: price,
      price_unit: priceUnit,
      included: toLines(formData.get('included')),
      not_included: toLines(formData.get('not_included')),
      rules: (formData.get('rules') as string) || null,
      cancellation_policy: (formData.get('cancellation_policy') as string) || null,
      seo_title: (formData.get('seo_title') as string) || null,
      seo_description: (formData.get('seo_description') as string) || null,
      attributes: v.data,
    },
  };
}

export async function createListing(_prev: FormResult, formData: FormData): Promise<FormResult> {
  const profile = await requireRole('provider');
  const supabase = await createClient();

  const { data: business } = await supabase
    .from('businesses')
    .select('id, status')
    .eq('owner_id', profile.id)
    .single();
  if (!business) return { error: 'No business found for your account.' };
  if (business.status !== 'verified') {
    return { error: 'Only verified providers can create listings. Complete verification first.' };
  }

  const { count } = await supabase
    .from('listings')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', business.id);
  if ((count ?? 0) >= 7) {
    return { error: 'You have reached the maximum of 7 listings.' };
  }

  const parsed = await parseForm(formData);
  if ('error' in parsed) return { error: parsed.error };
  const d = parsed.data;

  const slug = `${slugify(d.title)}-${Math.random().toString(36).slice(2, 7)}`;
  const { data: inserted, error } = await supabase
    .from('listings')
    .insert({
      business_id: business.id,
      category_id: d.category_id,
      location_id: d.location_id,
      title: d.title,
      slug,
      description: d.description,
      status: 'draft',
      base_price_mur: d.base_price_mur,
      price_unit: d.price_unit,
      attributes: d.attributes,
      included: d.included,
      not_included: d.not_included,
      rules: d.rules,
      cancellation_policy: d.cancellation_policy,
      seo_title: d.seo_title,
      seo_description: d.seo_description,
    })
    .select('id')
    .single();

  if (error) return { error: error.message };
  redirect(`/provider/listings/${inserted!.id}/media`);
}

export async function updateListing(listingId: string, _prev: FormResult, formData: FormData): Promise<FormResult> {
  await requireRole('provider');
  const supabase = await createClient();

  const { data: current } = await supabase.from('listings').select('id, status').eq('id', listingId).single();
  if (!current) return { error: 'Listing not found.' };

  const parsed = await parseForm(formData);
  if ('error' in parsed) return { error: parsed.error };
  const d = parsed.data;

  // Editing a non-draft listing resubmits it for review (admin re-approves).
  const nextStatus = current.status === 'draft' ? 'draft' : 'pending_review';

  const { error } = await supabase
    .from('listings')
    .update({
      category_id: d.category_id,
      location_id: d.location_id,
      title: d.title,
      description: d.description,
      status: nextStatus,
      base_price_mur: d.base_price_mur,
      price_unit: d.price_unit,
      attributes: d.attributes,
      included: d.included,
      not_included: d.not_included,
      rules: d.rules,
      cancellation_policy: d.cancellation_policy,
      seo_title: d.seo_title,
      seo_description: d.seo_description,
    })
    .eq('id', listingId);

  if (error) return { error: error.message };
  revalidatePath(`/provider/listings/${listingId}/edit`);
  redirect(`/provider/listings?ok=${encodeURIComponent('Listing saved.')}`);
}

export async function submitForReview(formData: FormData) {
  await requireRole('provider');
  const listingId = formData.get('listing_id') as string;
  const supabase = await createClient();
  const { error } = await supabase.rpc('provider_submit_listing', { p_listing_id: listingId });
  revalidatePath('/provider/listings');
  redirect(`/provider/listings?${error ? 'error=' + encodeURIComponent(error.message) : 'ok=' + encodeURIComponent('Submitted for review.')}`);
}
