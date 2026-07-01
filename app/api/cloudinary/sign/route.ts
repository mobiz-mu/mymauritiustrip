import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { signCloudinaryParams } from '@/lib/cloudinary/sign';

// POST { listingId, resourceType: 'image'|'video' }
// Returns signed params for a direct browser upload, but only if the caller is
// a verified provider who owns the listing and is under the media count limit.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const { listingId, resourceType } = await request.json();
  if (!listingId || (resourceType !== 'image' && resourceType !== 'video')) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  // Ownership + verified business (RLS already scopes, but check explicitly).
  const { data: listing } = await supabase
    .from('listings')
    .select('id, business_id, businesses!inner(owner_id, status)')
    .eq('id', listingId)
    .single();

  const biz = (listing as unknown as { businesses?: { owner_id: string; status: string } } | null)
    ?.businesses;
  if (!listing || !biz || biz.owner_id !== user.id) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  }
  if (biz.status !== 'verified') {
    return NextResponse.json({ error: 'Business not verified' }, { status: 403 });
  }

  // Count limit (12 images / 3 videos).
  const { count } = await supabase
    .from('listing_media')
    .select('id', { count: 'exact', head: true })
    .eq('listing_id', listingId)
    .eq('type', resourceType);

  const limit = resourceType === 'image' ? 12 : 3;
  if ((count ?? 0) >= limit) {
    return NextResponse.json(
      { error: `Limit reached (${limit} ${resourceType}s).` },
      { status: 409 },
    );
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = `listings/${listingId}`;
  const signature = signCloudinaryParams({ folder, timestamp });

  return NextResponse.json({
    cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    timestamp,
    folder,
    signature,
    resourceType,
  });
}
