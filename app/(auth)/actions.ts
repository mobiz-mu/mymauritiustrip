'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { homeForRole, type UserRole } from '@/lib/rbac/roles';
import {
  clientSignupSchema,
  providerSignupSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '@/lib/validation/auth';

export type ActionState = { error?: string; success?: string } | null;

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
}

// Turn raw Supabase auth errors into clear, user-facing messages. In particular,
// distinguish "email not confirmed" from "wrong password" instead of always
// showing "invalid credentials".
function authErrorMessage(error: { code?: string; message?: string }): string {
  const code = error.code ?? '';
  const msg = error.message ?? '';
  if (code === 'email_not_confirmed' || /not confirmed/i.test(msg)) {
    return 'Please confirm your email first — check your inbox for the confirmation link.';
  }
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(msg)) {
    return 'Incorrect email or password.';
  }
  if (code === 'user_already_exists' || /already (registered|been registered)/i.test(msg)) {
    return 'An account with this email already exists. Try logging in instead.';
  }
  return msg || 'Something went wrong. Please try again.';
}

// ---------- Client signup ----------
export async function clientSignupAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = clientSignupSchema.safeParse({
    full_name: formData.get('full_name'),
    email: formData.get('email'),
    whatsapp: formData.get('whatsapp'),
    country: formData.get('country'),
    password: formData.get('password'),
    confirm_password: formData.get('confirm_password'),
    accept_terms: formData.get('accept_terms') === 'on',
    preferred_language: formData.get('preferred_language') || undefined,
    preferred_currency: formData.get('preferred_currency') || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const d = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: d.email,
    password: d.password,
    options: {
      emailRedirectTo: `${siteUrl()}/auth/confirm`,
      // role is constrained to client/provider by the DB trigger; admin is impossible here.
      data: {
        role: 'client',
        full_name: d.full_name,
        whatsapp: d.whatsapp,
        country: d.country,
        preferred_language: d.preferred_language ?? 'en',
        preferred_currency: d.preferred_currency ?? 'MUR',
      },
    },
  });
  if (error) return { error: authErrorMessage(error) };
  // Email confirmation disabled -> a session exists immediately, so log in.
  if (data.session) redirect(homeForRole('client'));
  return { success: 'Account created. Check your email to confirm before logging in.' };
}

// ---------- Provider signup ----------
export async function providerSignupAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = providerSignupSchema.safeParse({
    owner_full_name: formData.get('owner_full_name'),
    business_name: formData.get('business_name'),
    business_email: formData.get('business_email'),
    whatsapp: formData.get('whatsapp'),
    category_slug: formData.get('category_slug'),
    location_slug: formData.get('location_slug'),
    brn: formData.get('brn') || undefined,
    password: formData.get('password'),
    confirm_password: formData.get('confirm_password'),
    accept_terms: formData.get('accept_terms') === 'on',
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const d = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: d.business_email,
    password: d.password,
    options: {
      emailRedirectTo: `${siteUrl()}/auth/confirm`,
      data: {
        role: 'provider',
        full_name: d.owner_full_name,
        owner_full_name: d.owner_full_name,
        business_name: d.business_name,
        business_email: d.business_email,
        whatsapp: d.whatsapp,
        category_slug: d.category_slug,
        location_slug: d.location_slug,
        brn: d.brn ?? '',
        country: 'Mauritius',
      },
    },
  });
  if (error) return { error: authErrorMessage(error) };
  if (data.session) redirect(homeForRole('provider'));
  return {
    success:
      'Account created. Check your email to confirm. After confirming, pay the Rs 499 verification fee — listings unlock once admin approves.',
  };
}

// ---------- Login ----------
export async function loginAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: authErrorMessage(error) };

  // Role-based redirect.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let role: UserRole = 'client';
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    if (profile?.role) role = profile.role as UserRole;
  }
  redirect(homeForRole(role));
}

// ---------- Logout ----------
export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

// ---------- Forgot password ----------
export async function forgotPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get('email') });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${siteUrl()}/auth/confirm?next=/reset-password`,
  });
  if (error) return { error: error.message };
  // Always report success to avoid leaking which emails are registered.
  return { success: 'If that email exists, a password reset link has been sent.' };
}

// ---------- Reset password (after clicking the email link) ----------
export async function resetPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get('password'),
    confirm_password: formData.get('confirm_password'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: error.message };
  redirect('/login?reset=1');
}
