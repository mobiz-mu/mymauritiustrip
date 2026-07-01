# Phase 2.1 — Premium Homepage UI Polish + No-404 Public QA

A full visual polish of the homepage. Frontend only — no backend, auth, booking, commission, review,
email, migration, or database logic was touched. Build-safety guards (`force-dynamic` +
`isBuildPhase()`) are unchanged.

---

## Files changed

```
NEW FILES:
- components/public/SiteHeader.tsx          (premium sticky white header/nav)
- PHASE2_1_HOMEPAGE_POLISH.md

MODIFIED FILES:
- app/page.tsx                              (renders SiteHeader)
- components/home/sections.tsx              (all sections redesigned, light + compact)
- components/home/icons.tsx                 (clean icons, size enforced)
- lib/home/content.ts                       (category order matches the brief)

DELETED FILES:
- (none)
```

## The icon fix (root cause of "huge icons")
Icons now render at an explicit `width`/`height` (default 20px, passed as a `size` prop), not just a
CSS class — so they can never blow up even if a utility class is purged. Geometry was simplified and
centred in the 24×24 box. Sizes used: 16–20px inside cards and pills, 18–20px in category/value
chips. No full-card SVGs anywhere.

## What changed visually
- **Header:** new sticky, translucent-white `SiteHeader` with logo, category links (md+), and
  Log in / Sign up / List your business. Mobile keeps logo + Log in + Sign up (no broken nav).
- **Hero:** light `#eaf5fb → white` gradient with soft glows (no heavy dark block), slate serif
  headline with an ocean accent, compact bordered **search card** (category · region · date ·
  travellers · Search), three CTAs (Explore Mauritius / Request a custom trip / List your business),
  and four trust pills (verified providers · pay on arrival · local support · secure platform
  communication).
- **Categories:** 8 compact white cards (small icon chip, title, one line, hover "Explore →"),
  responsive 4 / 2 / 2 columns. Order matches the brief; every link is an existing route.
- **Featured:** real `ListingCard` grid when listings exist; otherwise four premium gradient preview
  cards + a "Request a trip" line. No provider contact shown.
- **Why book:** five compact luxury trust cards with small elegant icons (5-up on desktop).
- **Request a trip / DMC:** soft-blue light band, services as bordered chips, CTA → `/request-transfer`.
- **Provider CTA:** light white card (replaced the heavy dark navy block) with a gold eyebrow, small
  icons, a tinted stats panel, CTA → `/provider-signup`.
- **Support + footer:** clean light treatment; platform WhatsApp/email only.
- Spacing tightened to `py-12 md:py-16` to remove large blank gaps.

## Palette
White / soft off-white base, ocean `#0b6fb8`, turquoise `#1bc0c9`, gold `#d4af37` (accents only),
slate text. Rounded-2xl/3xl, thin borders, subtle shadows.

## Contact safety
Featured uses `ListingCard` (public `business_name` only). No provider phone/email/WhatsApp/owner
name anywhere — verified by grep. Only the platform's own support contact appears.

---

## Local commands
```bash
npm install
npx tsc --noEmit
npm run build
npm run dev      # http://localhost:3000
```

## Build / type-check status
Verified here by inspection (no `node_modules`/network in this sandbox): import/export parity, brace
balance, `React.ReactNode` replaced with imported `ReactNode`, every link resolves to an existing
route, and the build-phase guards + `force-dynamic` are intact. Please run the commands above to
confirm green locally.

## No-404 route checklist (all must load or redirect)
`/` · `/search` · `/client-signup` · `/provider-signup` · `/login` · `/forgot-password` ·
`/reset-password` · `/request-transfer` · `/terms` · `/privacy` · all category pages
(`/villas-mauritius`, `/apartments-mauritius`, `/studios-mauritius`, `/holiday-homes-mauritius`,
`/car-rental-mauritius`, `/scooter-rental-mauritius`, `/taxi-service-mauritius`,
`/private-driver-mauritius`, `/airport-transfer-mauritius`, `/boat-trips-mauritius`,
`/catamaran-cruise-mauritius`, `/restaurants-mauritius`, `/things-to-do-mauritius`) ·
`/client`, `/provider`, `/admin` (redirect when logged out).

## UI test checklist
1. Icons are small and controlled everywhere (≤20px in cards/pills); no oversized SVGs on desktop or
   mobile.
2. Header is clean on desktop and mobile; logo + Log in + Sign up always visible.
3. Hero search: choose category/region → Search → `/search` filters correctly.
4. Category grid: 4 cols desktop, 2 cols tablet/mobile; all 8 links open existing routes.
5. Featured: shows `ListingCard`s when listings exist, else premium preview cards; no provider
   contact.
6. Provider section is light (not heavy dark navy); CTA → `/provider-signup`.
7. Mobile (≤380px): single/two-column stacks, search card stacks, no horizontal scroll, no huge gaps.
8. `npx tsc --noEmit` and `npm run build` pass; all routes above still load/redirect.
