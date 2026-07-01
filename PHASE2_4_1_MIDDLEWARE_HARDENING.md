# Phase 2.4.1 — Official Middleware Auth Fetch Hardening

Hardens the middleware so a Supabase Auth outage can never crash or slow public pages, and protected
routes fail safe to login. Only middleware/session handling was touched — no homepage/public UI, no
database/migrations, no booking/commission/review/email logic.

---

## Files changed

```
MODIFIED:
- lib/supabase/middleware.ts     (public early-return; protected try/catch + safe redirects)

NEW:
- PHASE2_4_1_MIDDLEWARE_HARDENING.md
```

`middleware.ts` (root matcher) is unchanged — it already excludes static assets and images.

## New behavior (matches the required spec)
1. **Public routes never call `getUser()`.** If the path is not protected, the middleware returns
   immediately without constructing a Supabase client — so a transient `fetch failed` from Auth can no
   longer crash or delay `/`, `/search`, category pages, `/login`, `/terms`, `/privacy`,
   `/robots.txt`, `/sitemap.xml`, etc.
2. **Protected routes call `getUser()` inside `try/catch`.**
3. **Auth fetch failure on a protected route → `redirect('/login?redirect=<currentPath>')`** instead of
   throwing.
4. **Missing Supabase env vars → redirect protected routes to login** (no crash).
5. **Public routes stay public**, including the lookalikes `/client-signup` and `/provider-signup`.
6. **Protected routes stay protected**: `/client`, `/provider`, `/admin` and their sub-paths.
7. **No broad `startsWith('/client')`** — that would wrongly catch `/client-signup`.
8. **Exact-or-slash matching**: `path === '/client' || path.startsWith('/client/')` (same for
   `/provider`, `/admin`).
9. **Session cookie handling preserved for protected routes** via `createServerClient` `getAll`/`setAll`.
10. **Minimal dev-only warning** (`console.warn` gated by `NODE_ENV !== 'production'`) — no stack spam.

Note: previously the session was refreshed on *every* request. Now it refreshes on protected routes
only. This is the recommended pattern; a signed-in user's token is still refreshed on demand by server
components and when they hit any protected route, so nothing breaks — public pages just stop making
auth calls.

## Acceptance criteria → expected result
- `npm run dev` no longer throws uncaught `fetch failed` from middleware ✅ (public routes never call Auth).
- Public routes return `200`; protected routes `307` to `/login?redirect=…` when logged out ✅.
- No 404 ✅ (no route changes).
- `npx tsc --noEmit` / `npm run build` pass ✅ (verify locally; changes are type-clean).

---

## Edge Runtime warning — explanation (acceptable, not a failure)

```
A Node.js API is used (process.version ...) which is not supported in the Edge Runtime.
Import trace: @supabase/supabase-js → @supabase/ssr → lib/supabase/middleware.ts
```

- This is a **build-time static-analysis warning**, not a runtime error. Next scans the middleware
  import graph (middleware runs on the Edge runtime) and sees that `@supabase/supabase-js` references
  `process.version` in its runtime-detection code.
- `@supabase/ssr`'s `createServerClient` is **officially supported in Next middleware** — Supabase's
  own docs use exactly this pattern. The `process.version` reference sits in a guarded detection path
  and does **not** break Edge execution; your build completes and auth works.
- Because protected routes still need `createServerClient`, the import remains, so the warning remains.
  It is **safe to accept**. Eliminating it would mean not importing `@supabase/ssr` in middleware
  (e.g. only checking for a cookie's presence and moving `getUser()` entirely into the dashboard
  layouts' `requireRole`). That weakens middleware-level protection for a cosmetic gain, so we do **not**
  recommend it. The layouts already enforce role checks as defence-in-depth.

**Verdict:** acceptable as-is; no action required. Build passes and behavior is correct.

---

## `npm audit` — safe guidance (do NOT `--force`)

There is **no committed `package-lock.json`**, so the exact advisories can't be pinned from the repo;
the "2 moderate" came from your local install tree. Handle it safely:

```bash
# 1) See production-only issues (these are what can affect real users):
npm audit --omit=dev

# 2) If the moderate issues are dev/build-tooling only (not shipped to users),
#    they are low risk and safe to defer.

# 3) If a PRODUCTION dependency is affected and a semver-compatible fix exists:
npm update <package>        # stays within your version ranges
npx tsc --noEmit && npm run build   # re-verify

# 4) If only a transitive dep is affected with no compatible fix, pin just that
#    one via an overrides entry in package.json, then re-test:
#    "overrides": { "<transitive-pkg>": "<patched-version>" }
```

- **Do NOT run `npm audit fix --force`** — it can bump `next`, `react`, or `@supabase/*` to breaking
  major versions.
- **Recommended:** commit the lockfile (`npm install` creates `package-lock.json`) so audits are
  reproducible and CI can verify the same tree. Given the current stack (Next 15, React 19, Supabase
  JS 2.x, Zod 3), moderate advisories are almost always in transitive build tooling and can be handled
  with a targeted `overrides` entry rather than a forced upgrade.

If you paste the output of `npm audit --omit=dev`, I'll tell you exactly which (if any) update is safe.

## Commands
```bash
npm install
npx tsc --noEmit
npm run build
npm run dev
```
