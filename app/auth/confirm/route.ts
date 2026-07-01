import { type NextRequest, NextResponse } from 'next/server';
import { type EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { homeForRole, type UserRole } from '@/lib/rbac/roles';

// Handles email-confirmation and password-recovery links. Supabase may send
// either a PKCE link (?code=...) or an OTP link (?token_hash=...&type=...),
// depending on the email template / project settings — we accept BOTH so
// confirmation works regardless of configuration. Recovery links carry
// ?next=/reset-password.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = searchParams.get('next');

  const supabase = await createClient();

  let verified = false;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    verified = !error;
  } else if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    verified = !error;
  }

  if (!verified) {
    return NextResponse.redirect(`${origin}/login?error=verification_failed`);
  }

  // Password-recovery flow: go set a new password (session is now established).
  if (next) return NextResponse.redirect(`${origin}${next}`);

  // Normal email confirmation: route to the role's home.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let role: UserRole = 'client';
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role) role = profile.role as UserRole;
  }
  return NextResponse.redirect(`${origin}${homeForRole(role)}`);
}
