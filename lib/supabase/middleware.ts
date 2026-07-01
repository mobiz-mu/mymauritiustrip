import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

type CookieToSet = { name: string; value: string; options?: CookieOptions };

// Exact-or-slash prefix so lookalike PUBLIC routes (e.g. /client-signup,
// /provider-signup) are never protected.
function isProtectedPath(path: string): boolean {
  const match = (prefix: string) => path === prefix || path.startsWith(`${prefix}/`);
  return match('/client') || match('/provider') || match('/admin');
}

function redirectToLogin(request: NextRequest): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.searchParams.set('redirect', request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

// Middleware auth/session handling.
// - PUBLIC routes: return immediately. We never construct a Supabase client and
//   never call Supabase Auth, so a transient auth outage can never crash or slow
//   a public page.
// - PROTECTED routes (/client, /provider, /admin and sub-paths): refresh the
//   Supabase session cookie and revalidate the user with getUser() inside a
//   try/catch. Any failure (network, or missing env) redirects safely to
//   /login?redirect=<path> instead of throwing.
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const path = request.nextUrl.pathname;

  // 1) Public route → do nothing auth-related.
  if (!isProtectedPath(path)) {
    return NextResponse.next({ request });
  }

  // 2) Protected route but env is missing → don't crash, send to login.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[middleware] Supabase env missing; redirecting protected route to /login');
    }
    return redirectToLogin(request);
  }

  // 3) Protected route → refresh session cookie + revalidate user.
  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }: CookieToSet) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }: CookieToSet) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return redirectToLogin(request);
    }
  } catch {
    // Network/auth failure — fail safe to login rather than throwing.
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[middleware] auth check failed; redirecting protected route to /login');
    }
    return redirectToLogin(request);
  }

  return response;
}
