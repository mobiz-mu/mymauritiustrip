# Phase 2.3 — Premium Marketplace Homepage Final Upgrade + Newsletter

Homepage/public UI upgrade plus a newsletter backend (table + server action + admin page). No other
backend/auth/booking/commission/review/email logic was touched. Homepage stays `force-dynamic` with
the `isBuildPhase()` guards intact, and every link resolves to an existing route (no 404s).

---

## Files changed

```
NEW FILES:
- db/22_newsletter_subscribers.sql              (table + RLS: public insert, admin read)
- lib/newsletter/actions.ts                     (subscribe server action)
- components/home/NewsletterSection.tsx         (premium subscribe section, client)
- components/home/BannerCarousel.tsx            (auto-sliding banner ads, client)
- components/home/marketplace.tsx               (category marketplace section + premium card)
- app/admin/newsletter/page.tsx                 (admin-only subscriber list)
- public/home/mmt-logo.png                      (PLACEHOLDER logo — replace with your real logo)
- public/home/banners/banner-1..6.svg           (2000x800 placeholder banners + README)

MODIFIED FILES:
- app/page.tsx                                  (banner + 4 marketplace sections + newsletter)
- app/admin/page.tsx                            (link to /admin/newsletter)
- components/public/SiteHeader.tsx              (logo image, button colors, icon announce bar)
- components/public/PublicFooter.tsx            (ocean→turquoise gradient, logo, white text)
- components/home/sections.tsx                  (hero button colors, compact one-row Featured)
- PHASE1_SETUP.md                               (migration 22 added to run-list)

DELETED FILES:
- (none)
```

## 1. Header — logo + button colors
- **Logo is now image-only** (no text) using `/home/mmt-logo.png`, height-locked (`h-9/h-10 w-auto`,
  no stretch), aligned on mobile and desktop. **A placeholder `mmt-logo.png` is included so nothing
  is broken** — replace `public/home/mmt-logo.png` with your real logo (same path/name) to finalise.
- Buttons: **Log in = gold/yellow**, **Sign up = green**, **List your business = ocean blue**, all
  rounded with hover states. Mobile menu uses the same colors.

## 2. Announcement bar icons
Replaced plain ticks with four distinct small white icons (shield = verified, wallet = pay on arrival,
chat = WhatsApp support, lock = secure communication). Two show on mobile, all four on desktop.

## 3. Hero buttons
Explore Mauritius = **ocean**, Request a custom trip = **gold**, List your business = **ocean
outline**. Larger touch targets, no overlap, wrap cleanly on mobile.

## 4. Banner ad carousel
New `BannerCarousel` placed **after “Browse by category”, before “Featured”**. Image-only, `aspect-[5/2]`
(≈2000×800, not too tall), **auto-slides every 10s**, six banners, dots + hover prev/next arrows,
fully responsive, no carousel library. Replace `public/home/banners/banner-1..6.svg` with real
2000×800 images (same names) to upgrade.

## 5. Featured — compact one-row
“Handpicked / Featured experiences” is now a **compact single row**: 4 cards on desktop, 2-up on
mobile, smaller image height, premium compact cards. Shows real listings if present, else four premium
preview cards. No huge blank space.

## 6. Marketplace category sections
Four dedicated sections — **Villas & apartments, Car rental, Restaurants, Catamaran & boat trips** —
each: premium listings first, then the rest, capped at 4; 4-up desktop / 2-up mobile; **1:1 image**
(falls back to category art when a listing has no cover), **Premium badge** when `is_premium`,
category + location, price, rating (when reviewed), and **category-specific feature chips** read
safely from listing JSONB attributes:
- Villas: rooms, bathrooms, pool, guests
- Car rental: seats, transmission, A/C, luggage
- Restaurants: cuisine, capacity
- Catamaran: duration, capacity, route

Missing attributes are hidden gracefully (no broken placeholders). If a category has no listings yet,
premium “coming soon” preview cards are shown instead. **No provider contact is ever rendered.**

## 7. Newsletter (before footer) + backend
- **Section**: premium soft-blue block, title “Get Mauritius travel deals and new experiences”, email
  input + Subscribe button + privacy reassurance, responsive, with inline success/error messages.
- **Migration `db/22_newsletter_subscribers.sql`**: table `newsletter_subscribers (id, email unique,
  source default 'homepage', status default 'active', user_agent, created_at)` with an email-format
  check. RLS: **public (anon + authenticated) may INSERT only**; **admins may SELECT** (via
  `acting_as_admin()`); **no public SELECT**. A `before insert` trigger forces `status='active'`,
  clamps `source`, and normalises the email — so a public insert is effectively email + source only.
- **Server action** `subscribeToNewsletter` validates the email, captures user-agent, inserts via the
  cookie Supabase client, and treats duplicate emails as success.
- **Admin page** `/admin/newsletter` (admin-only, `force-dynamic`) lists email / source / status /
  date; linked from the admin dashboard.

### SQL to run (Supabase SQL editor)
Run the full file `db/22_newsletter_subscribers.sql` once. It is idempotent
(`create table if not exists`, `drop policy if exists`, `create or replace function`).

## 8. Footer
Rebuilt with the **ocean→turquoise gradient** (matching the announcement bar), white text, logo image
(inverted to white), explore/provider/support/legal columns, WhatsApp +230 5506 8119,
info@mymauritiustrip.com, terms/privacy, copyright, mobile-stacked.

## Contact-safety
Marketplace and featured cards render only public fields (`business_name` is not even shown on these
compact cards; title/location/category/price/rating/attributes only). No provider
phone/email/WhatsApp/owner name anywhere — verified by grep. Only the platform WhatsApp/email appear.

---

## PowerShell merge into your local project
```powershell
$src = "$env:USERPROFILE\Downloads\mymauritiustrip\mymauritiustrip"   # adjust to where you extracted
$dst = "C:\Dev\mymauritiustrip"

# new image assets (logo + banners)
robocopy "$src\public\home" "$dst\public\home" /E

# new code
robocopy "$src\lib\newsletter" "$dst\lib\newsletter" /E
robocopy "$src\app\admin\newsletter" "$dst\app\admin\newsletter" /E
Copy-Item "$src\components\home\NewsletterSection.tsx" "$dst\components\home\NewsletterSection.tsx" -Force
Copy-Item "$src\components\home\BannerCarousel.tsx"    "$dst\components\home\BannerCarousel.tsx" -Force
Copy-Item "$src\components\home\marketplace.tsx"       "$dst\components\home\marketplace.tsx" -Force
Copy-Item "$src\db\22_newsletter_subscribers.sql"     "$dst\db\22_newsletter_subscribers.sql" -Force

# modified files
Copy-Item "$src\app\page.tsx"                         "$dst\app\page.tsx" -Force
Copy-Item "$src\app\admin\page.tsx"                   "$dst\app\admin\page.tsx" -Force
Copy-Item "$src\components\public\SiteHeader.tsx"     "$dst\components\public\SiteHeader.tsx" -Force
Copy-Item "$src\components\public\PublicFooter.tsx"   "$dst\components\public\PublicFooter.tsx" -Force
Copy-Item "$src\components\home\sections.tsx"         "$dst\components\home\sections.tsx" -Force
Copy-Item "$src\PHASE1_SETUP.md"                      "$dst\PHASE1_SETUP.md" -Force
Copy-Item "$src\PHASE2_3_HOMEPAGE_MARKETPLACE.md"     "$dst\PHASE2_3_HOMEPAGE_MARKETPLACE.md" -Force
```
Then replace `public\home\mmt-logo.png` with your real logo. Your `.env.local`, `node_modules`,
`.next` are never touched; nothing is deleted.

## Commands
```bash
npm install
npx tsc --noEmit
npm run build
npm run dev      # http://localhost:3000
```
Then run `db/22_newsletter_subscribers.sql` in Supabase, and test subscribing on the homepage →
check `/admin/newsletter` as an admin.

## Build / type-check status
Verified here by inspection (no `node_modules`/network in this sandbox): brace balance on every file,
import/export parity, `useActionState` (React 19) for the form, all assets present (logo + 6 banners),
`force-dynamic` + four `isBuildPhase()` guards intact, and **every link resolves** (including
`/listings/[slug]` and `/admin/newsletter`). Please run the commands above to confirm green.

## No-404 route checklist
`/` · `/search` · `/client-signup` · `/provider-signup` · `/login` · `/forgot-password` ·
`/reset-password` · `/request-transfer` · `/terms` · `/privacy` · all category pages ·
`/listings/[slug]` · `/client` · `/provider` · `/admin` · **`/admin/newsletter`** (admin-only).

## Mobile checklist
Announcement bar (2 items) · logo + hamburger menu · hero stacks · search form stacks · banner
carousel keeps 5:2 ratio (not too tall) · category cards 2-up · featured one-row 2-up · marketplace
sections 2-up · newsletter input + button stack · gradient footer stacks. No horizontal overflow, no
clipped buttons, no oversized icons.

## Visual checklist
Header premium with correct button colors + image logo · improved announce icons · hero buttons
recolored · banner carousel present and auto-sliding · compact one-row featured · four marketplace
sections with premium cards + attribute chips · newsletter saves to Supabase · gradient footer ·
aligned spacing throughout.
