# Phase 2.2 — Full Premium Homepage Redesign (image-led)

A complete visual rework of the homepage into an image-led, Airbnb/Booking-class layout. Frontend
only — no backend, auth, booking, commission, review, email, migration, RLS, or middleware logic was
touched. Build-safety guards (`force-dynamic` + `isBuildPhase()`) are intact, and every link points
to an existing route (no 404s).

---

## Files changed

```
NEW FILES:
- public/home/villas.svg
- public/home/car.svg
- public/home/taxi.svg
- public/home/airport.svg
- public/home/boat.svg
- public/home/restaurants.svg
- public/home/things-to-do.svg
- public/home/wedding.svg
- public/home/hero-villa.svg
- public/home/hero-boat.svg
- public/home/hero-beach.svg
- public/home/README.txt
- PHASE2_2_HOMEPAGE_REDESIGN.md

MODIFIED FILES:
- components/public/SiteHeader.tsx     (announcement bar + sticky nav + mobile menu)
- components/home/sections.tsx         (image-led hero, categories, featured, bands)
- lib/home/content.ts                  (image path per category)

DELETED FILES:
- (none)
```

## Imagery approach (premium without photos)
The homepage is now genuinely **image-led**. Since the project ships no photography, I generated
premium **SVG scene art** (brand-colored lagoon gradients) into `public/home/`. Every card/hero panel
uses one as a CSS `background-image` under a gradient overlay, so it looks finished immediately and
text stays legible. **To drop in real photos:** replace the files in `public/home/` keeping the same
names (e.g. `villas.svg` → `villas.jpg` and update the path in `lib/home/content.ts`), or just
overwrite the `.svg` with optimized JPG/WebP. No code change needed beyond the path. (`README.txt` in
that folder documents this.)

## What was redesigned
- **Announcement bar** — slim ocean→turquoise strip with four trust items (verified providers, pay on
  arrival, local WhatsApp support, secure on-platform communication); shows two on mobile, all four on
  desktop.
- **Header** — sticky, translucent-white, blur. Logo left; centered nav (Stays, Transfers, Things to
  do, Restaurants, Plan my trip) on desktop; Log in / Sign up / List your business on the right. On
  mobile a clean **hamburger menu** (native `<details>`, no JS dependency) drops a panel with all
  links + actions. All menu items map to existing routes.
- **Hero** — two-column: left eyebrow badge + large serif headline + subhead + CTA row (blue primary,
  gold accent, ghost) + trust pills; right an **image collage** (three scene panels). Below sits a
  Booking-style elevated **search panel** (What / Where / When / Travellers / Search).
- **Categories** — eight **image-led cards** (scene image with an icon badge, then title, blurb,
  Explore →), 4/2/2 responsive, equal heights, hover elevation.
- **Featured** — real `ListingCard` grid when listings exist; otherwise five **premium preview cards**
  (Villas by the coast, Private airport transfers, Catamaran lagoon day, Local restaurants, Custom
  island itinerary) — image area + gold badge + title + description + CTA. Never blank.
- **Why book** — five refined trust cards with soft gradient backgrounds and small icons.
- **Plan your trip / DMC** — gradient-framed two-panel block: white copy + CTA on the left, a
  white-on-color checklist of services on the right → `/request-transfer`.
- **Provider CTA** — business card: copy + blue/ghost CTAs on the left, an image panel with floating
  feature chips (verified, 7 listings, dashboard, pay-on-arrival · 15%) on the right.
- **Support** — green WhatsApp button + email button + reassurance copy (platform contact only).
- **Footer** — brand block, explore, providers, support, legal, on-platform note.

## Buttons / system
Primary = solid blue (ocean) with shadow + hover; accent = gold; support = green (WhatsApp); secondary
= white ghost with border. Consistent radius (`rounded-full` actions, `rounded-2xl/3xl` cards), soft
shadows, focus rings on search fields.

## Build-safety & contact-safety
- `app/page.tsx` stays `force-dynamic` and uses the `isBuildPhase()`-guarded catalog helpers — no
  Supabase call during `next build`, no "Collecting page data" hang.
- Featured uses `ListingCard` (public `business_name` only). No provider phone/email/WhatsApp/owner
  name anywhere — only the platform's WhatsApp/email appear. Verified by grep.
- Icons render at explicit pixel sizes (16–20px) — no oversized SVGs.

---

## PowerShell merge into your local project
Extract the zip to a temp folder, then copy the changed paths into `C:\Dev\mymauritiustrip`:

```powershell
$src = "$env:USERPROFILE\Downloads\mymauritiustrip\mymauritiustrip"   # adjust to where you extracted
$dst = "C:\Dev\mymauritiustrip"

# new image assets (whole folder)
robocopy "$src\public\home" "$dst\public\home" /E

# changed source files
Copy-Item "$src\components\public\SiteHeader.tsx" "$dst\components\public\SiteHeader.tsx" -Force
Copy-Item "$src\components\home\sections.tsx"     "$dst\components\home\sections.tsx" -Force
Copy-Item "$src\lib\home\content.ts"              "$dst\lib\home\content.ts" -Force
Copy-Item "$src\PHASE2_2_HOMEPAGE_REDESIGN.md"    "$dst\PHASE2_2_HOMEPAGE_REDESIGN.md" -Force
```
Your `.env.local`, `node_modules`, and `.next` are never touched. No files are deleted.

## Commands
```bash
npm install
npx tsc --noEmit
npm run build
npm run dev      # http://localhost:3000
```

## Build / type-check status
Verified here by inspection (no `node_modules`/network in this sandbox): brace balance, import/export
parity, `IconKey` cast, all 11 SVG assets present, build-phase guards + `force-dynamic` intact, and
**every homepage link resolves to an existing route**. Please run the commands above to confirm green.

## No-404 route checklist
`/` · `/search` · `/client-signup` · `/provider-signup` · `/login` · `/forgot-password` ·
`/reset-password` · `/request-transfer` · `/terms` · `/privacy` · `/villas-mauritius` ·
`/apartments-mauritius` · `/studios-mauritius` · `/holiday-homes-mauritius` · `/car-rental-mauritius` ·
`/scooter-rental-mauritius` · `/taxi-service-mauritius` · `/private-driver-mauritius` ·
`/airport-transfer-mauritius` · `/boat-trips-mauritius` · `/catamaran-cruise-mauritius` ·
`/restaurants-mauritius` · `/things-to-do-mauritius` · `/client` · `/provider` · `/admin` (redirect).

## Test checklist
1. Announcement bar shows; header sticks on scroll without overlap; mobile hamburger opens a clean
   panel and every link works.
2. Hero: collage + elevated search panel; category/region → Search → `/search` filters.
3. Category cards are image-led, equal height, 4/2/2 responsive; all 8 links open existing routes.
4. Featured shows `ListingCard`s when data exists, else five finished preview cards (never blank).
5. Plan-your-trip, provider, and support sections look premium; CTAs go to `/request-transfer`,
   `/provider-signup`, WhatsApp/email.
6. Mobile (≤380px): everything stacks, no overflow, no oversized icons, no huge gaps, footer stacks.
7. No provider contact anywhere; only platform WhatsApp/email.
8. `npx tsc --noEmit` and `npm run build` pass; all routes load/redirect.
