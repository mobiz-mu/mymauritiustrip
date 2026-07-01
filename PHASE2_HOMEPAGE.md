# Phase 2 — Premium Homepage / Public Design System

A premium, mobile-first marketplace homepage for MyMauritiusTrip.com. No backend, auth, booking,
commission, review, email, or database logic was changed — this is presentation only, built on the
existing public catalog helpers.

---

## Files changed

```
NEW FILES:
- lib/home/content.ts                 (static category / value-prop / trip-service data)
- components/home/icons.tsx           (inline SVG icon set — no icon dependency)
- components/home/sections.tsx        (all homepage sections, server components)
- components/public/PublicFooter.tsx  (site footer)
- app/terms/page.tsx                  (static legal placeholder)
- app/privacy/page.tsx                (static legal placeholder)
- PHASE2_HOMEPAGE.md

MODIFIED FILES:
- app/page.tsx                        (was a placeholder; now the full homepage)

DELETED FILES:
- (none)
```

No new dependencies. Icons are inline SVG; the display face uses the built-in `font-serif` stack
(`ui-serif`), so there is nothing to install and no font fetch.

## Sections (all 8)
1. **Premium hero** — ocean→turquoise gradient, serif headline with a gold accent, a working search
   card (category + region selects that submit to `/search`, plus when/travellers fields), three CTAs
   (Explore Mauritius / Request a trip / List your business), and a trust strip. A soft SVG wave
   divides the hero from the page.
2. **Category cards** — 8 cards (villas & apartments, car rental, taxi & private driver, catamaran &
   boat trips, restaurants, things to do, airport transfer, wedding & honeymoon). Every card links to
   an existing route (wedding & honeymoon → `/request-transfer`), so there are **no 404s**.
3. **Featured experiences** — renders live published listings via `searchListings` using the existing
   `ListingCard`. If there are none yet, it shows an elegant empty state with category shortcuts and a
   "Request a trip" CTA. No provider contact is ever shown.
4. **Why book with MyMauritiusTrip** — verified providers, pay on arrival, local support, everything
   stays on-platform, curated for Mauritius.
5. **Request your trip / DMC band** — custom itineraries, airport transfers, private drivers, family
   trips, honeymoon planning, group travel → `/request-transfer`.
6. **Provider CTA** — "List your Mauritius tourism business", mentioning verified providers, the
   7-listing cap, one dashboard, and booking requests (no admin-backend detail).
7. **Trust / support** — WhatsApp +230 5506 8119 and info@mymauritiustrip.com, with the reassurance
   that all communication stays on-platform.
8. **Footer** — explore / providers / support / legal links.

## Build-safety & data
- `app/page.tsx` is `export const dynamic = 'force-dynamic'` and fetches `getReferenceData()` +
  `searchListings({})`. Both are already guarded by `isBuildPhase()` (Phase 1.7.4), so during
  `next build` they return empty and the homepage renders its empty state — **no Supabase call, no
  "Collecting page data" hang**. At request time they return live data.
- The two legal pages are fully static (no data), so they prerender instantly.

## Contact safety
The featured cards reuse `ListingCard`, which shows only the public `business_name` — no provider
phone/email/WhatsApp/owner name anywhere. The only contact shown is the platform's own support
(WhatsApp / email), and the support copy reinforces that communication stays on-platform.

## Design notes
Palette: ocean `#0b6fb8`, turquoise `#1bc0c9`, gold `#d4af37`, white, slate. Signature: a layered
lagoon-gradient hero with a soft wave divider; gold is spent only on accents (one hero word, primary
CTA, category icons on dark bands). Mobile-first grids, rounded-2xl/3xl cards, soft shadows.

---

## Local commands
```bash
npm install
npx tsc --noEmit
npm run build
npm run dev   # open http://localhost:3000
```

## Build / type-check status
Verified here by inspection only (this sandbox has no `node_modules` and can't reach npm/Supabase):
- import/export parity checked across all new files,
- brace balance checked,
- every category link resolves to an existing route,
- the homepage uses the build-phase-guarded catalog helpers and is `force-dynamic`, so the 1.7.x
  build fixes still hold.

Please run the three commands above to confirm green locally.

## Test checklist
1. `/` renders the full homepage; hero, categories, featured (or empty state), why-us, request-trip,
   provider, support, footer all present.
2. Hero search: pick a category and/or region → Search → lands on `/search` filtered accordingly.
3. Every category card opens its page with no 404; wedding & honeymoon opens `/request-transfer`.
4. With no published listings, the featured section shows the empty state (still looks premium); with
   listings, it shows up to 8 `ListingCard`s and no provider contact.
5. CTAs: Explore → `/search`, Request a trip → `/request-transfer`, List your business →
   `/provider-signup`; provider login → `/login`.
6. Support shows WhatsApp +230 5506 8119 and info@mymauritiustrip.com; footer legal links open the
   placeholder pages.
7. Mobile (≤380px): single-column layout, search card stacks, nav collapses — no horizontal scroll.
8. `npx tsc --noEmit` and `npm run build` pass; existing routes/flows unchanged.
