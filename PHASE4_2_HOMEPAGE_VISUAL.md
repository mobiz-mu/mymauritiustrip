# Phase 4.2 — Homepage visual: hero rotation, Premium Ads, testimonials, announcement polish

Frontend-only visual upgrade of the homepage. **No database migration. No secrets. No dashboard or
backend work** (those stay in 4.3 / 4.4). SEO from Phase 4.1 is untouched.

---

## Files changed

```
NEW:
- components/home/HeroPanels.tsx        (client) 1 vertical + 3 horizontal SQUARE panels, rotate 5 imgs / 6s
- components/home/PremiumAds.tsx        (client) "Premium Ads" section: 2×5 grid, green badge, slider + arrows
- components/home/Testimonials.tsx      (server) latest approved reviews grid + TripAdvisor provision + empty state
- public/home/hero-sunrise.svg          sunrise-beach scene (hero rotation)
- public/home/sunset-sail.svg           sunset scene
- public/home/lagoon.svg                bright-lagoon scene

MODIFIED:
- app/page.tsx                          fetch premium ads + latest reviews; render <PremiumAds/> below hero, <Testimonials/> before newsletter
- components/home/sections.tsx          HomeHero: sunrise background + sun glow; static collage -> <HeroPanels/>; 3rd button now grass-green
- lib/public/catalog.ts                 + getLatestReviews() + PublicReview type (build-guarded, reads reviews_public)
- .env.local.example                    + NEXT_PUBLIC_TRIPADVISOR_URL (optional)

DELETED: none
DATABASE MIGRATIONS: none
```

## What changed (by brief section)

- **§1 Hero upgrade.** Background is now a **soft golden sunrise** wash (`from-[#fff3da] via-[#eaf5fb]
  to-white`) with a warm sun-glow and turquoise glow — a Mauritius morning feel that stays light enough
  for crisp text. Fully responsive; search box and copy unchanged in behavior. **Hero buttons are now
  blue / saffron / grass-green** (Explore = ocean, Request a custom trip = gold, List your business =
  `emerald-600`).
- **§2 Square rotating panels.** New `HeroPanels` renders **one vertical + three horizontal** panels with
  **square corners** (`rounded-none`). Each panel **crossfades through 5 local scenes every 6s**. It is
  hydration-safe (deterministic initial frame = index 0), has a **fixed container height** (no layout
  shift), respects **`prefers-reduced-motion`**, and uses only tiny local SVGs (no eager image weight, no
  remote hotlinks, no carousel library).
- **§3 Premium Ads (below the search).** New `PremiumAds` section directly under the hero. **2 rows of 5
  (10 per page)** on desktop, 2-up on mobile — no overflow. Each card: square image, title,
  category · location, price, and a **green "Premium Ad" badge**, linking to `/listings/[slug]`. **Data
  uses the real `is_premium` field** via `searchListings({ premium: '1' })` (approved/published/verified
  only — the public view enforces this). If **>10** premium ads exist it **auto-slides every 10s** with
  **accessible prev/next arrows**. Fallbacks: if there are no premium listings it shows recent approved
  listings **without** the Premium-Ad badge (honest) and a subtle "list your business" note; if there are
  no listings at all it shows a clean "Available soon" placeholder row. **No provider contact, no
  commission text, no fake data.**
- **§4 Testimonials.** New `Testimonials` section shows the **latest approved reviews** from
  `reviews_public` (approved + published + verified). Each card has stars, a comment snippet, a
  **"Verified traveller"** label (the public view exposes no reviewer identity, so nothing private
  leaks), and a link to the listing. If there are no reviews yet it shows a **premium empty state** (no
  invented names or quotes). **TripAdvisor** is an **official, env-gated provision**: set
  `NEXT_PUBLIC_TRIPADVISOR_URL` to your real profile URL and a "Read us on TripAdvisor" button appears;
  unset, nothing renders. **No scraping, no fake TripAdvisor data.**
- **§5 Announcement-bar icons.** Kept the **3D-style flag-color chips** shipped in 4.1 (small gradient
  chips in Mauritius red/blue/yellow/green with an inset highlight + soft shadow, pure SVG/CSS). They
  already meet this spec — lightweight, no layout jump, good on mobile — so no change was needed here.

## Contact-safety & commission
Grep-clean: the new components contain no phone/WhatsApp/email/owner fields and no commission/"15%"
wording. Premium Ad cards show only public listing data (title, category, location, price, cover image).

## Migration & env
- **Migration:** none. Premium Ads use the existing `is_premium` field; testimonials use the existing
  `reviews_public` view.
- **Env added (optional):** `NEXT_PUBLIC_TRIPADVISOR_URL` — leave empty to hide the button; the site
  builds/runs fine unset.
- **First-20-free-premium:** display support is ready now — an admin who sets `is_premium = true` on a
  listing makes it appear in Premium Ads immediately. **Full automation (auto-expiry, eligibility
  tracking) needs a migration and is deferred to Phase 4.4** as agreed.

---

## PowerShell merge
Extract the zip, then copy into `C:\Dev\mymauritiustrip`:
```powershell
$src = "$env:USERPROFILE\Downloads\mymauritiustrip\mymauritiustrip"   # adjust to your extract path
$dst = "C:\Dev\mymauritiustrip"

# new components
Copy-Item "$src\components\home\HeroPanels.tsx"    "$dst\components\home\HeroPanels.tsx" -Force
Copy-Item "$src\components\home\PremiumAds.tsx"     "$dst\components\home\PremiumAds.tsx" -Force
Copy-Item "$src\components\home\Testimonials.tsx"   "$dst\components\home\Testimonials.tsx" -Force

# new hero SVGs
Copy-Item "$src\public\home\hero-sunrise.svg"      "$dst\public\home\hero-sunrise.svg" -Force
Copy-Item "$src\public\home\sunset-sail.svg"       "$dst\public\home\sunset-sail.svg" -Force
Copy-Item "$src\public\home\lagoon.svg"            "$dst\public\home\lagoon.svg" -Force

# modified files
Copy-Item "$src\app\page.tsx"                      "$dst\app\page.tsx" -Force
Copy-Item "$src\components\home\sections.tsx"      "$dst\components\home\sections.tsx" -Force
Copy-Item "$src\lib\public\catalog.ts"             "$dst\lib\public\catalog.ts" -Force
Copy-Item "$src\.env.local.example"                "$dst\.env.local.example" -Force
Copy-Item "$src\PHASE4_2_HOMEPAGE_VISUAL.md"       "$dst\PHASE4_2_HOMEPAGE_VISUAL.md" -Force
```
Your `.env.local`, `node_modules`, `.next` are untouched; nothing is deleted.

## Commands
```bash
npm install
npx tsc --noEmit
npm run build
npm run dev
```

## Build / type-check status
Inspection-verified here (no `node_modules`/network in this sandbox): brace + paren balance on every
changed file; import/export parity (`PremiumAd` type, `Testimonials` default, `getLatestReviews`,
`formatMUR`/`priceUnitLabel`); **client components receive only plain serializable props** (PremiumAds
gets a plain array + string — no Maps crossing the server/client boundary); HeroPanels initial frame is
deterministic (no hydration mismatch); `force-dynamic` + `isBuildPhase` guards intact; every referenced
SVG exists; `line-clamp` is native in your Tailwind 3.4.15. Please run the commands above to confirm
green.

## Known warnings (unchanged, non-blocking)
- `@supabase/ssr` Edge `process.version` warning (from earlier phases).
- Occasional webpack "big string" cache warning.
Neither fails the build.

## No-404 checklist
No routes were added or removed. All Phase 4.1 routes remain, including `/about-mauritius` and
`/contact`. Re-run `scripts/smoke-routes.*` (public 200, protected redirect).

## Manual QA
Hero shows sunrise wash; the four square panels crossfade every 6s with no jump; **Premium Ads** sits
directly below the search with green badges, working arrows and 10s auto-slide (when >10);
**Testimonials** renders real approved reviews or the clean empty state; announcement chips stay small
and premium; no horizontal overflow on mobile.

## Follow-ups (later phases, unchanged)
- **4.3** admin + provider KPI dashboards.
- **4.4** contract-PDF upload (migration + RLS), booking confirmation emails (no-op safe), first-20-free
  premium **automation** (migration + admin fields), any deeper Maps/TripAdvisor API embeds.
