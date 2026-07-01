# Phase 1.8.2 — Auth Routing + Signup/Login UX Cleanup

Code-only (no migration). Makes route protection precise, fixes the email-confirmation callback so it
works with either Supabase link style, and turns vague auth errors into clear messages.

---

## Files changed

```
NEW FILES:
- app/(auth)/login/form.tsx
- PHASE1_8_2_AUTH.md

MODIFIED FILES:
- lib/supabase/middleware.ts
- app/auth/confirm/route.ts
- app/(auth)/actions.ts
- app/(auth)/login/page.tsx
- PHASE1_SETUP.md

DELETED FILES:
- (none)
```

## 1) Route protection fix (permanent)
`middleware.ts` previously used `path.startsWith('/client')`, which also matched `/client-signup`
and `/provider-signup`. It now uses exact-or-sub-path matching:

```ts
const isProtectedPrefix = (prefix: string) => path === prefix || path.startsWith(`${prefix}/`);
const isProtected = isProtectedPrefix('/client') || isProtectedPrefix('/provider') || isProtectedPrefix('/admin');
```

So `/client-signup`, `/provider-signup`, `/login` are public; `/client`, `/provider`, `/admin` (and
their sub-paths) are protected.

## 2) `/auth/confirm` callback — root cause of `verification_failed`
The confirmation link was arriving as `/auth/confirm?code=...` (PKCE), but the route only handled
`?token_hash=...&type=...` (OTP), so it always fell through to `?error=verification_failed`. The
route now **accepts both**: if `code` is present it calls `exchangeCodeForSession`; otherwise it uses
`verifyOtp`. Recovery links (`?next=/reset-password`) still establish the session and redirect to set
a new password. Only genuine failures redirect to `?error=verification_failed`.

## 3) Clearer signup/login messages
- New `authErrorMessage()` maps Supabase errors: email-not-confirmed → "Please confirm your email
  first…", invalid credentials → "Incorrect email or password.", already-registered → "An account
  with this email already exists." (no more blanket "invalid credentials").
- **Signup is session-aware:** if email confirmation is **off**, `signUp` returns a session, so we log
  the user straight into their dashboard instead of telling them to "check your email." If it's
  **on**, we show the confirmation message.
- The **login page** now reads `?error=` / `?reset=1` and shows a friendly notice above the form
  (split into a server wrapper `page.tsx` + client `form.tsx`).

## 4) Profile creation
Confirmed: the `handle_new_user()` trigger fires `after insert on auth.users`, so a `profiles` row is
created at signup (before confirmation). Role-based redirects therefore work as soon as the session
exists.

---

## Required Supabase Auth settings
Dashboard → Authentication → URL Configuration:
- **Site URL (local):** `http://localhost:3000`
- **Redirect URLs (add all):**
  - `http://localhost:3000/auth/callback`
  - `http://localhost:3000/auth/confirm`
  - `http://localhost:3000/reset-password`
- For production, add the same three under your real domain.

Email confirmation toggle: Authentication → Providers → Email → "Confirm email".
- **OFF** → signup logs in immediately (fastest for local testing).
- **ON** → signup shows "check your email"; the confirmation link now works because `/auth/confirm`
  handles the `code` it receives. Make sure the three redirect URLs above are present.

---

## Commands
```bash
npm install
npx tsc --noEmit
npm run build
```

## Troubleshooting (local)
- **Where are users?** Supabase Dashboard → Authentication → Users.
- **Manually confirm a user:** open the user → "Confirm email" (or toggle email confirmation OFF for
  local dev). SQL alternative: `update auth.users set email_confirmed_at = now() where email = 'you@example.com';`
- **Delete / recreate a test user:** Authentication → Users → delete the row (the `profiles` row is
  removed by cascade); sign up again. To wipe a profile only: `delete from auth.users where email='…';`
- **Login says "Incorrect email or password":** the password is wrong **or** the account isn't
  confirmed. With confirmation ON and an unconfirmed user, you'll now see "Please confirm your email
  first" instead. Confirm the user (above) or toggle confirmation OFF.
- **Confirmation link shows `verification_failed`:** ensure `http://localhost:3000/auth/confirm` is in
  the Redirect URLs and the Site URL matches the origin you're testing from. Links are single-use and
  expire — request a fresh one by signing up / using "Forgot password".
- **Signed up but stuck on "check your email" in local dev:** turn email confirmation OFF, or confirm
  the user manually, then log in.

## Test checklist
1. `/client-signup`, `/provider-signup`, `/login` load without being redirected to `/login`.
2. `/client`, `/provider`, `/admin` redirect to `/login?redirect=…` when logged out.
3. Confirmation **OFF**: client signup → lands on `/client`; provider signup → lands on `/provider`.
4. Confirmation **ON**: signup shows the confirm message; clicking the email link lands on the role
   home (no `verification_failed`).
5. Wrong password → "Incorrect email or password."; unconfirmed (confirmation ON) → "Please confirm
   your email first."
6. Forgot password → email link → `/reset-password` → set password → `/login?reset=1` shows "password
   updated."
7. `npx tsc --noEmit` and `npm run build` pass.
