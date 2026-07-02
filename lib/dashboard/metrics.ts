import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { isBuildPhase } from '@/lib/build-phase';

// All queries are head:true count:'exact' (no row payload) and run through the
// normal RLS-aware server client — admin sees all via is_admin() policies;
// providers are additionally scoped by business_id (defense in depth). No
// service-role key is used here.

type Sb = Awaited<ReturnType<typeof createClient>>;

async function countRows(
  supabase: Sb,
  table: string,
  build?: (q: any) => any,
): Promise<number> {
  let q: any = supabase.from(table).select('*', { count: 'exact', head: true });
  if (build) q = build(q);
  const { count } = await q;
  return count ?? 0;
}

export type AdminMetrics = {
  customers: number;
  providers: number;
  businesses: number;
  listings: number;
  listingsPending: number;
  listingsPublished: number;
  listingsPremium: number;
  bookings: number;
  bookingsPending: number;
  bookingsConfirmed: number;
  bookingsCompleted: number;
  bookingsCancelled: number;
  verificationsPending: number;
  paymentProofsPending: number;
  commissionsUnpaid: number;
  commissionsOverdue: number;
  reviews: number;
  reviewsPending: number;
  newsletter: number;
  transfers: number;
  transfersOpen: number;
  contractsPending: number;
  contractsRejected: number;
  contractsMissing: number;
  launchPremiumAwarded: number;
  premiumExpiringSoon: number;
  recentBusinesses: { business_name: string; status: string; created_at: string }[];
  recentListings: { title: string; status: string; created_at: string }[];
};

export function emptyAdminMetrics(): AdminMetrics {
  return {
    customers: 0, providers: 0, businesses: 0, listings: 0, listingsPending: 0,
    listingsPublished: 0, listingsPremium: 0, bookings: 0, bookingsPending: 0,
    bookingsConfirmed: 0, bookingsCompleted: 0, bookingsCancelled: 0,
    verificationsPending: 0, paymentProofsPending: 0, commissionsUnpaid: 0,
    commissionsOverdue: 0, reviews: 0, reviewsPending: 0, newsletter: 0,
    transfers: 0, transfersOpen: 0, contractsPending: 0, contractsRejected: 0,
    contractsMissing: 0, launchPremiumAwarded: 0, premiumExpiringSoon: 0,
    recentBusinesses: [], recentListings: [],
  };
}

export async function getAdminMetrics(): Promise<AdminMetrics> {
  if (isBuildPhase()) return emptyAdminMetrics();
  const supabase = await createClient();
  const c = (t: string, b?: (q: any) => any) => countRows(supabase, t, b);

  const [
    customers, providers, businesses, listings,
    listingsPending, listingsPublished, listingsPremium,
    bookings, bookingsPending, bookingsConfirmed, bookingsCompleted, bookingsCancelled,
    verificationsPending, paymentProofsPending,
    commissionsUnpaid, commissionsOverdue,
    reviews, reviewsPending, newsletter, transfers, transfersOpen,
    contractsPending, contractsRejected, launchPremiumAwarded, premiumExpiringSoon,
    recentBiz, recentLst,
    verifiedBizIds, contractBizIds,
  ] = await Promise.all([
    c('profiles', (q) => q.eq('role', 'client')),
    c('profiles', (q) => q.eq('role', 'provider')),
    c('businesses'),
    c('listings'),
    c('listings', (q) => q.eq('status', 'pending_review')),
    c('listings', (q) => q.eq('status', 'published')),
    c('listings', (q) => q.eq('is_premium', true)),
    c('bookings'),
    c('bookings', (q) => q.eq('status', 'pending')),
    c('bookings', (q) => q.eq('status', 'confirmed')),
    c('bookings', (q) => q.eq('status', 'completed')),
    c('bookings', (q) => q.in('status', ['cancelled', 'provider_rejected'])),
    c('businesses', (q) => q.in('status', ['payment_pending', 'under_review'])),
    c('business_verification_payments', (q) => q.eq('status', 'submitted')),
    c('commission_invoices', (q) => q.in('status', ['sent', 'pending', 'overdue'])),
    c('commission_invoices', (q) => q.eq('status', 'overdue')),
    c('reviews'),
    c('reviews', (q) => q.eq('status', 'pending')),
    c('newsletter_subscribers'),
    c('transfer_requests'),
    c('transfer_requests', (q) => q.in('status', ['new', 'reviewing', 'quoted'])),
    c('provider_contracts', (q) => q.eq('status', 'pending')),
    c('provider_contracts', (q) => q.eq('status', 'rejected')),
    c('listings', (q) => q.eq('premium_source', 'launch_free')),
    c('listings', (q) => q.eq('premium_source', 'launch_free').eq('is_premium', true).gt('premium_expires_at', new Date().toISOString()).lt('premium_expires_at', new Date(Date.now() + 7 * 864e5).toISOString())),
    supabase.from('businesses').select('business_name, status, created_at').order('created_at', { ascending: false }).limit(5),
    supabase.from('listings').select('title, status, created_at').order('created_at', { ascending: false }).limit(5),
    supabase.from('businesses').select('id').eq('status', 'verified'),
    supabase.from('provider_contracts').select('business_id'),
  ]);

  // Verified businesses with no contract row at all.
  const withContract = new Set((contractBizIds.data ?? []).map((r: { business_id: string }) => r.business_id));
  const contractsMissing = (verifiedBizIds.data ?? []).filter((b: { id: string }) => !withContract.has(b.id)).length;

  return {
    customers, providers, businesses, listings,
    listingsPending, listingsPublished, listingsPremium,
    bookings, bookingsPending, bookingsConfirmed, bookingsCompleted, bookingsCancelled,
    verificationsPending, paymentProofsPending, commissionsUnpaid, commissionsOverdue,
    reviews, reviewsPending, newsletter, transfers, transfersOpen,
    contractsPending, contractsRejected, contractsMissing, launchPremiumAwarded, premiumExpiringSoon,
    recentBusinesses: (recentBiz.data as AdminMetrics['recentBusinesses']) ?? [],
    recentListings: (recentLst.data as AdminMetrics['recentListings']) ?? [],
  };
}

export type ProviderMetrics = {
  business: { id: string; business_name: string; status: string; verification_paid: boolean; is_premium: boolean } | null;
  listings: number;
  listingsPublished: number;
  listingsPending: number;
  listingsPremium: number;
  bookings: number;
  bookingsPending: number;
  bookingsAccepted: number;
  bookingsCompleted: number;
  bookingsCancelled: number;
  reviews: number;
  avgRating: number;
  commissionsUnpaid: number;
  commissionsOverdue: number;
  contractStatus: string | null;
  premiumActive: boolean;
  premiumExpiresAt: string | null;
  premiumSource: string | null;
  recentBookings: { reference: string | null; status: string; created_at: string }[];
};

export async function getProviderMetrics(ownerId: string): Promise<ProviderMetrics> {
  const empty: ProviderMetrics = {
    business: null, listings: 0, listingsPublished: 0, listingsPending: 0, listingsPremium: 0,
    bookings: 0, bookingsPending: 0, bookingsAccepted: 0, bookingsCompleted: 0, bookingsCancelled: 0,
    reviews: 0, avgRating: 0, commissionsUnpaid: 0, commissionsOverdue: 0,
    contractStatus: null, premiumActive: false, premiumExpiresAt: null, premiumSource: null,
    recentBookings: [],
  };
  if (isBuildPhase()) return empty;
  const supabase = await createClient();

  const { data: business } = await supabase
    .from('businesses')
    .select('id, business_name, status, verification_paid, is_premium')
    .eq('owner_id', ownerId)
    .single();
  if (!business) return empty;
  const bid = business.id;

  // listing rating data for this business (max 7 listings). review_count is
  // denormalized on listings, so we never query the raw reviews table (which is
  // RLS-restricted to the review's own client / admin) from the provider side.
  const { data: listingRows } = await supabase
    .from('listings')
    .select('rating_avg, review_count, is_premium, premium_source, premium_expires_at')
    .eq('business_id', bid);

  const c = (t: string, b?: (q: any) => any) => countRows(supabase, t, b);
  const [
    listings, listingsPublished, listingsPending, listingsPremium,
    bookings, bookingsPending, bookingsAccepted, bookingsCompleted, bookingsCancelled,
    commissionsUnpaid, commissionsOverdue, recentBk,
  ] = await Promise.all([
    c('listings', (q) => q.eq('business_id', bid)),
    c('listings', (q) => q.eq('business_id', bid).eq('status', 'published')),
    c('listings', (q) => q.eq('business_id', bid).eq('status', 'pending_review')),
    c('listings', (q) => q.eq('business_id', bid).eq('is_premium', true)),
    c('bookings', (q) => q.eq('business_id', bid)),
    c('bookings', (q) => q.eq('business_id', bid).eq('status', 'pending')),
    c('bookings', (q) => q.eq('business_id', bid).in('status', ['provider_accepted', 'confirmed', 'client_arrived'])),
    c('bookings', (q) => q.eq('business_id', bid).eq('status', 'completed')),
    c('bookings', (q) => q.eq('business_id', bid).in('status', ['cancelled', 'provider_rejected'])),
    c('commission_invoices', (q) => q.eq('business_id', bid).in('status', ['sent', 'pending', 'overdue'])),
    c('commission_invoices', (q) => q.eq('business_id', bid).eq('status', 'overdue')),
    supabase.from('bookings').select('reference, status, created_at').eq('business_id', bid).order('created_at', { ascending: false }).limit(5),
  ]);

  // Reviews + weighted average from denormalized per-listing values.
  let reviews = 0;
  let weight = 0;
  let sum = 0;
  for (const l of listingRows ?? []) {
    const rc = Number(l.review_count) || 0;
    reviews += rc;
    if (rc > 0) { weight += rc; sum += Number(l.rating_avg) * rc; }
  }
  const avgRating = weight > 0 ? Math.round((sum / weight) * 10) / 10 : 0;

  // Premium summary: active = flagged and not expired; soonest active expiry.
  const now = Date.now();
  const activePremium = (listingRows ?? []).filter(
    (l: any) => l.is_premium && (!l.premium_expires_at || new Date(l.premium_expires_at).getTime() > now),
  );
  const premiumActive = activePremium.length > 0;
  const expiries = activePremium
    .map((l: any) => l.premium_expires_at)
    .filter(Boolean)
    .map((d: string) => new Date(d).getTime());
  const premiumExpiresAt = expiries.length ? new Date(Math.min(...expiries)).toISOString() : null;
  const premiumSource = (activePremium.find((l: any) => l.premium_source) as any)?.premium_source ?? null;

  // Latest contract status for this business.
  const { data: contractRow } = await supabase
    .from('provider_contracts')
    .select('status')
    .eq('business_id', bid)
    .order('uploaded_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const contractStatus = (contractRow?.status as string) ?? null;

  return {
    business: business as ProviderMetrics['business'],
    listings, listingsPublished, listingsPending, listingsPremium,
    bookings, bookingsPending, bookingsAccepted, bookingsCompleted, bookingsCancelled,
    reviews, avgRating, commissionsUnpaid, commissionsOverdue,
    contractStatus, premiumActive, premiumExpiresAt, premiumSource,
    recentBookings: (recentBk.data as ProviderMetrics['recentBookings']) ?? [],
  };
}
