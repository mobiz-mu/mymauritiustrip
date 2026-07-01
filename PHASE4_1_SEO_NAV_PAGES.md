# Phase 4.1 — Foundation: SEO + Navigation + New Pages + Commission-hide + Footer

First slice of the final launch upgrade. **Additive and build-safe: no database migrations, no
secrets touched, no email/booking/commission logic changed.** Covers brief sections 1, 3, 4 (partial),
7, 12, 13, 14, 16.

> Roadmap for the rest: **4.2** hero square-panel rotation + Premium Ads + testimonials/reviews section;
> **4.3** admin + provider KPI dashboards; **4.4** contract-PDF upload (migration + RLS), booking
> confirmation emails, first-20-free-premium rule, TripAdvisor/Maps API provisions.

---

## Files changed

```
NEW:
- lib/seo/site.ts                       (central site + SEO config)
- lib/seo/landing.ts                    (per-category metadata)
- lib/seo/jsonld.ts                     (JSON-LD builders)
- components/seo/JsonLd.tsx             (renders <script type=ld+json>)
- components/analytics/GoogleTags.tsx   (GTM + GA4, env-gated, no-op if unset)
- app/about-mauritius/page.tsx          (About Mauritius page)
- app/contact/page.tsx                  (Contact page)
- app/contact/contact-form.tsx          (mailto form, client)

MODIFIED:
- app/layout.tsx                        (title template, OG/Twitter, keywords, Org+WebSite JSON-LD, analytics)
- app/page.tsx                          (homepage title -> absolute, avoids double-branding)
- app/sitemap.ts                        (adds /about-mauritius, /contact)
- app/listings/[slug]/page.tsx          (per-listing generateMetadata + Product/Breadcrumb JSON-LD)
- app/<13 category pages>/page.tsx      (each: + landingMetadata export)
- components/public/SiteHeader.tsx      (mega menu, bigger logo, icon-only auth buttons, flag icons, About/Contact)
- components/public/PublicFooter.tsx    (About/Contact links + Mobiz.mu credit + red 3D heart)
- components/home/sections.tsx          (removed public "15% commission" text)
- .env.local.example                    (adds NEXT_PUBLIC_GTM_ID, NEXT_PUBLIC_GA_ID)

DELETED: none
DATABASE MIGRATIONS: none
```

## What changed
- **§7 Commission hidden from public.** Removed "Pay-on-arrival · 15% commission" from the homepage
  provider band (now "Pay-on-arrival model"). Grep confirms no `15% commission` / `commission fee`
  wording on any public page. (The `/terms` page still discloses, in neutral legal language, that
  providers pay a commission — appropriate legal disclosure, no percentage; provider/admin dashboards
  are unchanged.)
- **§1 & §16 SEO.** Root layout now has a title template (`%s | MyMauritiusTrip`), full description,
  keywords, canonical, robots, Open Graph + Twitter cards, and injects **Organization + WebSite**
  JSON-LD. Each of the **13 category pages** exports intent-rich metadata (title/description/keywords/
  canonical/OG) via `landingMetadata()`. The **listing page** now builds **per-listing**
  `generateMetadata` (title, description, canonical, OG image from Cloudinary when available) and emits
  **Product + BreadcrumbList** JSON-LD (with price/rating when present). About page emits
  **TouristDestination + Breadcrumb**. Sitemap includes the new pages.
- **§1 GTM/GA provision.** `NEXT_PUBLIC_GTM_ID` / `NEXT_PUBLIC_GA_ID` render GTM + GA4 via `next/script`
  only when set — **the site builds and runs with them empty** (no-op).
- **§3 Header.** Bigger logo (h-11/h-12, image-only, no stretch). Desktop **mega menu** with hover
  dropdowns (Stays / Transfers & cars / Experiences) + direct **About Mauritius** and **Contact** links.
  **Icon-only round buttons**: Log in (gold) and Sign up (green). "List your business" is now a light
  nav link, not a heavy button. Mobile hamburger lists everything.
- **§4 Announcement bar.** Icons are now small **3D-style gradient chips** in Mauritius-flag accent
  colors (blue/green/yellow/red) with inset highlight + shadow — pure SVG/CSS, no libraries.
- **§12 About Mauritius** (`/about-mauritius`): premium editorial page — beaches, nature, culture, food,
  travel/safety tips, why-book-local, why-us, category CTAs — SEO-rich, responsive, JSON-LD.
- **§13 Contact** (`/contact`): WhatsApp + email CTAs, a **mailto** message form (no backend), a
  **keyless Google Maps embed** (Mobiz.mu, Mauritius), and an on-platform-communication note.
- **§14 Footer.** Adds About Mauritius + Contact links and a **"Designed & built by Mobiz.mu"** credit
  with a **red 3D gradient heart**.

## Contact-safety
No provider phone/email/WhatsApp/owner name anywhere; only platform WhatsApp/email appear. Verified by
grep. Listing JSON-LD uses `business_name` (public) as brand only.

## Env vars added (optional)
```
NEXT_PUBLIC_GTM_ID   # e.g. GTM-XXXXXXX  (leave empty to disable)
NEXT_PUBLIC_GA_ID    # e.g. G-XXXXXXXXXX (leave empty to disable)
```
Set these in Vercel when you're ready to track. Nothing breaks if they're empty.

---

## PowerShell merge
Extract the zip, then copy the changed paths into `C:\Dev\mymauritiustrip`:
```powershell
$src = "$env:USERPROFILE\Downloads\mymauritiustrip\mymauritiustrip"   # adjust to your extract path
$dst = "C:\Dev\mymauritiustrip"

# new folders/files
robocopy "$src\lib\seo" "$dst\lib\seo" /E
robocopy "$src\components\seo" "$dst\components\seo" /E
robocopy "$src\components\analytics" "$dst\components\analytics" /E
robocopy "$src\app\about-mauritius" "$dst\app\about-mauritius" /E
robocopy "$src\app\contact" "$dst\app\contact" /E

# modified single files
Copy-Item "$src\app\layout.tsx"                       "$dst\app\layout.tsx" -Force
Copy-Item "$src\app\page.tsx"                         "$dst\app\page.tsx" -Force
Copy-Item "$src\app\sitemap.ts"                       "$dst\app\sitemap.ts" -Force
Copy-Item "$src\app\listings\[slug]\page.tsx"         "$dst\app\listings\[slug]\page.tsx" -Force
Copy-Item "$src\components\public\SiteHeader.tsx"     "$dst\components\public\SiteHeader.tsx" -Force
Copy-Item "$src\components\public\PublicFooter.tsx"   "$dst\components\public\PublicFooter.tsx" -Force
Copy-Item "$src\components\home\sections.tsx"         "$dst\components\home\sections.tsx" -Force
Copy-Item "$src\.env.local.example"                   "$dst\.env.local.example" -Force
Copy-Item "$src\PHASE4_1_SEO_NAV_PAGES.md"            "$dst\PHASE4_1_SEO_NAV_PAGES.md" -Force

# the 13 category landing pages (each gained a metadata export)
$cats = @('car-rental-mauritius','scooter-rental-mauritius','airport-transfer-mauritius','taxi-service-mauritius',
  'private-driver-mauritius','catamaran-cruise-mauritius','boat-trips-mauritius','villas-mauritius',
  'apartments-mauritius','studios-mauritius','holiday-homes-mauritius','restaurants-mauritius','things-to-do-mauritius')
foreach ($c in $cats) { Copy-Item "$src\app\$c\page.tsx" "$dst\app\$c\page.tsx" -Force }
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
Inspection-verified here (no `node_modules`/network in this sandbox): brace balance on every changed
file, import/export parity across the SEO helpers, all header/footer/mega-menu links resolve to real
routes, `next/script` is built-in, and the public commission grep is clean. Please run the commands
above to confirm green.

## Known warnings
- The `@supabase/ssr` **Edge `process.version` warning** from Phase 2.4.1 is unrelated to this phase and
  still expected/acceptable (build passes).
- `next/image` is intentionally not used for the logo (`<img>` with an eslint-disable comment) to keep
  it dependency-free and avoid image-domain config.

## No-404 checklist (re-test)
`/` · `/search` · **`/about-mauritius`** · **`/contact`** · `/client-signup` · `/provider-signup` ·
`/login` · `/forgot-password` · `/reset-password` · `/request-transfer` · all 13 category pages ·
`/listings/<real-slug>` · `/terms` · `/privacy` · `/robots.txt` · `/sitemap.xml` · `/client` ·
`/provider` · `/admin` · `/admin/newsletter`.
(The `scripts/smoke-routes.*` tooling already includes the two new routes if you add them — or just add
`/about-mauritius` and `/contact` to the public list.)

## Visual/QA checklist
Header mega menu opens on hover (desktop) and via hamburger (mobile); logo bigger, not stretched;
round gold/green auth icons; announcement bar 3D flag-color chips; About + Contact pages render and are
responsive; contact form opens the mail app; map embeds; footer shows Mobiz.mu + red heart; no public
commission text; no horizontal overflow on mobile.
