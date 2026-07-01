import 'server-only';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isBuildPhase } from '@/lib/build-phase';
import { homeForRole, type UserRole } from '@/lib/rbac/roles';

export type Profile = {
  id: string;
  role: UserRole;
  full_name: string;
  email: string;
  whatsapp: string | null;
  country: string | null;
  preferred_language: string | null;
  preferred_currency: string | null;
};

// Returns the authenticated user's profile, or null if signed out.
export async function getSessionProfile(): Promise<Profile | null> {
  if (isBuildPhase()) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, full_name, email, whatsapp, country, preferred_language, preferred_currency')
    .eq('id', user.id)
    .single();

  return (profile as Profile) ?? null;
}

// Require a signed-in user; redirect to /login otherwise.
export async function requireUser(): Promise<Profile> {
  const profile = await getSessionProfile();
  if (!profile) redirect('/login');
  return profile;
}

// Require a specific role. Admin passes every role check. Mismatches are sent
// to their own role home (never silently shown another role's dashboard).
export async function requireRole(role: UserRole): Promise<Profile> {
  const profile = await requireUser();
  if (profile.role === 'admin') return profile; // admin is allowed everywhere
  if (profile.role !== role) redirect(homeForRole(profile.role));
  return profile;
}

// Provider posting lock: a provider may only reach listing-creation surfaces
// once their business is 'verified' (Rs 499 approved by admin). Returns the
// business row; redirects unverified providers to the verification page.
export async function requireVerifiedProvider(): Promise<{
  profile: Profile;
  business: { id: string; status: string; verification_paid: boolean };
}> {
  const profile = await requireRole('provider');
  const supabase = await createClient();
  const { data: business } = await supabase
    .from('businesses')
    .select('id, status, verification_paid')
    .eq('owner_id', profile.id)
    .single();

  if (!business) redirect('/provider'); // shell missing — back to dashboard
  if (profile.role !== 'admin' && business.status !== 'verified') {
    redirect('/provider/verification');
  }
  return { profile, business };
}
