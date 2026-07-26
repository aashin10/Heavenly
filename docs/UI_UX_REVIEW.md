# Heavenly Corporation — UI/UX Review & Rework Checklist

**Reviewed:** 2026-07-18 · Angular 17 app (`HeavenlyFrontEnd`), all public pages + admin/vendor/service-requester flows (desktop & mobile), full template/style code scan, compared against the live site (heavenlycorporation.com).

**Business context:** Heavenly Corporation, New Delhi (live site: +91 9355633000, 64B Shivaji Enclave Extension, New Delhi 110027). Three current streams — (1) manpower supply & recruitment, (2) transformer rewinding contracts, (3) technician services (AC/plumbing/masonry) — with more streams likely later. The rework adds a services marketplace (requests → tenders → vendor bids) on top of the jobs portal.

---

## 1. Overall Impression

The app has a **strong functional skeleton** — the request→tender→bid workflow, role dashboards, multi-step forms with autosave, and guards are genuinely good product thinking. What holds it back visually is **the absence of a design system**: ~300 emoji used as icons across 39 files, ~700 hard-coded hex colors, no footer, placeholder/fake content, and inconsistent status/color/date treatments. It currently reads as a capable prototype, not a corporate product. The fixes are mostly systematic (tokens, icon library, shared components), not per-page redesigns — which is good news: the layout bones can stay.

**The three changes with the highest professionalism-per-effort:**
1. Replace every emoji with one consistent SVG icon set (you already use Lucide-style SVGs in the navbar — standardize on that).
2. Add a proper global footer and real company content (the missing footer is the single biggest "unfinished" signal).
3. Centralize color/typography into tokens and apply one status-badge + one date-format system everywhere.

---

## 2. Key Findings

### 2.1 Brand & Identity

| # | Finding | Severity | Where |
|---|---------|----------|-------|
| B1 | **Emoji used as iconography throughout** (~300 occurrences, 39 files): section headings ("🔥 Popular Services", "🚀 Quick Services"), tab labels ("💰 Commercial Evaluation"), table flags (🔴 ⚠️ 💰), empty states (giant ⭐), buttons ("📊 Evaluate Bids"), meta rows (📍 💰 🗓️), decoration sparkles ("Transformer Rewinding ✨"). Renders differently per OS, unprofessional for B2B, and mixes with the SVG icons already used in navbar/features section. | 🔴 Critical | `services.page.html`, `live-tenders-dashboard`, `tender-detail`, `management.page.html`, `home.page.ts`, `service.model.ts` + 33 more |
| B2 | **Logo misused**: low-res JPEG with baked-in navy box used as navbar logo, hero image, login/panel brand, and dashboard header decoration. Visible compression artifacts and box seams on gradients; brand mark duplicated 2–3× per screen. | 🔴 Critical | `assets/logo.png`, `assets/heavenly-logo.jpg`, hero of `home.page.html`, all auth pages, dashboard headers |
| B3 | **No footer anywhere.** Pages end abruptly; several pages have 600–900 px of dead space below content. The live site has a proper footer (nav, contact, social, copyright) — the rework regressed it. | 🔴 Critical | global (`app.component.html`) |
| B4 | The logo's **red accent is never used** in the UI; palette is navy-only with random green/purple/yellow appearing ad hoc (Quick Approve green, Publish Now purple). No accent strategy. | 🟡 Moderate | `styles.css`, management pages |
| B5 | **System font stack only** — no brand typeface, flat hierarchy (hero H1 ≈ section titles). | 🟡 Moderate | `styles.css` |
| B6 | Generic SEO/meta: `<title>Heavenly</title>`, no description/OG/theme-color; default favicon. | 🟡 Moderate | `src/index.html` |

### 2.2 Content & Trust

| # | Finding | Severity | Where |
|---|---------|----------|-------|
| C1 | **Fake placeholder contact data**: "123 Business Avenue, New York, NY 10001", "+1 (555) 123-4567", "1-800-HEAVENLY", emails @heavenlycorp.com. Real data exists on the live site (Delhi, +91, @heavenlycorporation.com). | 🔴 Critical | `contact.page.html` |
| C2 | **"Map integration would appear here"** literal placeholder box shipped on Contact. | 🔴 Critical | `contact.page.html` |
| C3 | **Mock data chaos across the app**: jobs in USD/US cities, admin tenders in ₹/lakhs, vendor dashboard in OMR/Oman cities, tender browse in Kerala. Undermines credibility even in demo state. | 🟡 Moderate | dashboard/vendor/evaluation mock data |
| C4 | About page tells only the recruitment story — transformer rewinding and the services marketplace (two of three business streams) are absent. Stats (10,000+ jobs, 15+ years, 98%) look invented — verify or remove. | 🟡 Moderate | `about.page.html` |
| C5 | No real photography anywhere; live site's service tiles use photos and look more credible than the rework's emoji cards. | 🟡 Moderate | services/home |
| C6 | Homepage messaging speaks only to "manpower solutions" in hero, then pivots to services marketplace below with no framing of the company's multiple streams. | 🟡 Moderate | `home.page.html` |

### 2.3 Information Architecture & Flows

| # | Finding | Severity | Where |
|---|---------|----------|-------|
| IA1 | **RESOLVED (presentation layer).** ~~Two parallel auth systems visible at once~~: navbar shows jobs-portal session ("AU" avatar) while page shows services-portal session ("Good morning, Sharma Electricals"). Both can be logged in simultaneously; navbar "Dashboard" link goes to the jobs dashboard even when you're a vendor. | 🔴 Critical | `navbar.component.ts`, `auth.service.ts` vs `service-auth.service.ts` |
| IA2 | **Login requires 3 decisions before credentials** (portal toggle → role tab → login/signup). High cognitive load; users won't reliably know "which portal" they belong to. | 🟡 Moderate | `login.page.html` |
| IA3 | Audience mixing on homepage: employer, job-seeker, requester, vendor messages interleaved in one flow ("Easy Job Search" next to "Trusted by Employers"). No clear per-audience paths. | 🟡 Moderate | `home.page.html` |
| IA4 | ~~Admin "Management" reachable only via avatar dropdown; no persistent admin nav; admin page headers alternate between navy band and plain white.~~ **RESOLVED** — role links promoted to top-level nav; evaluation dashboard now uses the same navy band as Management. | 🟢 Minor | `navbar.component.html`, management pages |
| IA5 | ~~Broken route: `goToLogin()` navigates to `/service-login`~~ **NOW FULLY RESOLVED** — the earlier tick was premature: only `services.page.ts` was fixed, while two `routerLink="/service-login"` anchors on the signup pages stayed dead. Both now point at `/login?portal=services`. See **§2.9 Dead routes** for the wider problem this uncovered. | 🟡 Moderate | `services.page.ts`, both signup pages |
| IA6 | ~~"View Details" on tender cards are `<button>`s, not links — no open-in-new-tab, no URL semantics.~~ **RESOLVED** — `app-tender-card` takes a `detailLink` and renders a real anchor. | 🟢 Minor | `tender-browse.page.html` etc. |

### 2.4 Visual Consistency

| # | Finding | Severity | Where |
|---|---------|----------|-------|
| V1 | ~~**~700 hard-coded hex colors** across page SCSS~~ **RESOLVED** — 540 hex values migrated to tokens (gray/slate and green/emerald ramps collapsed onto one scale); 88 shadows folded onto `--shadow-*`; focus rings tokenised. Zero raw hex left in page SCSS. | 🔴 Critical | all page `.scss` |
| V2 | ~~**Status badges styled differently per page**~~ **RESOLVED** — the shared badge was used on 2 screens while 6 hand-rolled their own (five different pill geometries). All six migrated; component extended to 30 statuses / 6 tones, optional icon, `label` override for audience-specific wording. All tones pass WCAG AA. | 🟡 Moderate | `status-badge.component.ts` |
| V3 | ~~Raw enum values leak into UI~~ **RESOLVED** — verified: no raw enums reach any template. | 🟡 Moderate | — |
| V4 | ~~Dates inconsistent~~ **RESOLVED** — found 9 competing implementations (one on `en-US`, one on browser locale). Now one `date-format.util` + `appDate`/`appDateTime` pipes. | 🟢 Minor | `shared/utils/date-format.util.ts` |
| V5 | ~~Inconsistent iconography within single screens~~ **RESOLVED** — verified zero emoji app-wide; all iconography is `<app-icon>`. | 🟡 Moderate | — |
| V6 | ~~Repeated inline SVGs pasted verbatim~~ **RESOLVED** — 129 inline SVGs (50 distinct shapes; the same clock pasted 8×) replaced with `<app-icon>`; 14 icons registered. Only a progress-ring `<svg>` remains, correctly (not an icon). | 🟢 Minor | 18 templates |
| V7 | ~~Checkbox filter labels "Ac Servicing" — casing errors~~ **RESOLVED** — acronym-aware `humanizeEnum` (AC, CCTV, HVAC, kVA…); filters already use styled controls, not native ones. | 🟢 Minor | `shared/utils/humanize.util.ts` |

### 2.5 Bugs Observed While Browsing

| # | Bug | Where |
|---|-----|-------|
| BG1 | ~~"⏰ Closes Closed" on expired tenders~~ **FIXED & verified** — guarded by `isBidWindowClosed()`. | `tender-detail.page.html` |
| BG2 | ~~Negative countdowns~~ **FIXED & verified** — `timeRemaining` clamps expired to "Closed". | `time-remaining.pipe.ts` |
| BG3 | ~~Form stepper desync~~ **NOT A BUG — retracted.** Re-tested: the stepper and progress advance correctly (step 1 → completed, step 2 → active, 25% → 50%). The original observation was a screenshot captured mid-transition. | `quick-service-form` |
| BG4 | ~~Step content stuck faded~~ **NOT A BUG — retracted.** The `fadeIn` animation completes normally in a visible browser. The faded capture was an artifact of the automation tab being backgrounded (`visibilityState: hidden` pauses CSS animations, freezing `currentTime` at 0). | `quick-service-form` |
| BG5 | ~~Monospace text in textareas~~ **FIXED & verified** — `button, input, textarea, select { font-family: inherit }`. | `styles.css` |
| BG6 | ~~Ring 75% vs "2 of 5 sections"~~ **FIXED & verified** — both derive from the same checklist. | `vendor-dashboard.page.ts` |
| BG7 | ~~"URGENT" ribbon overlaps the category chip~~ **FIXED & verified** — badge sits in normal flow, not absolutely positioned. | `vendor-dashboard` |
| BG8 | ~~Login/role tabs have no accessible names~~ **FIXED & verified** — `role="tablist"` + `aria-label` on every tab. | `login.page.html` |
| BG9 | ~~Profile renders empty divider rows~~ **FIXED & verified** — each field guarded by `@if`. | `profile.page.html` |
| BG10 | ~~Stale "Shortlisted: 2 vendors" vs "No Vendors Shortlisted"~~ **NOT REPRODUCIBLE** — the page derives the count from the bids, and the mock tender declaring 2 does have 2 shortlisted bids. | evaluation mocks |

### 2.9 Dead routes (found during the V/BG sweep) — **BLOCKER**

`app.routes.ts` ends in `{ path: '**', redirectTo: '' }`, so **any link to an unregistered route silently lands the user on the homepage** — no error, no 404, nothing to notice in testing. Twelve such links existed. Four were fixable and are fixed; two dead "View All" links were removed (the lists they pointed past were already complete, so nothing was lost).

**The remaining 8 point at screens that do not exist.** These are feature work, not UI polish — they need product decisions and new components, so they are left in place and logged rather than silently deleted:

| Link | Where | What's missing |
|------|-------|----------------|
| `/vendor-profile/basic` | `vendor-dashboard.model.ts` | Vendor profile editor — **all five** profile-completion checklist rows link into it |
| `/vendor-profile/documents` | ” | ” |
| `/vendor-profile/services` | ” | ” |
| `/vendor-profile/portfolio` | ” | ” |
| `/vendor-profile/bank` | ” | ” |
| `/my-tenders` | `service-requester-dashboard.model.ts` | Requester's tender list ("Active Tenders" quick action) |
| `/drafts` | ” | Standalone drafts screen ("Draft Requests" quick action) |
| `/request-history` | ” | Request history screen ("Request History" quick action) |

The vendor one is the most damaging: the profile-completion widget is the dashboard's main call to action, and **every** row of it currently dead-ends on the homepage. Worth deciding whether to build the editor or hide the widget until it exists.

Consider replacing the `**` redirect with a real 404 route — the silent bounce is what let twelve broken links survive this long.

---

### 2.6 Accessibility (spot checks)

- Unnamed tab controls on login (BG8); emoji conveying meaning (flags, status) with no text alternative — screen readers read "police car light" for urgent.
- Buttons used where links belong (IA6); no visible focus styles beyond browser default on dark navy (hard to see).
- Light-gray-on-white meta text (`--gray-400`/`500` on white) borderline for WCAG AA at small sizes; verify contrast of chips (yellow badge text on cream).
- Touch targets on mobile Popular-Services row are fine, but the floating "?" FAB overlaps card content on mobile (services page).

### 2.7 Mobile

- Hero H1 doesn't scale down (4 huge wrapped lines fill the first screen); giant blurry logo image below.
- Popular Services becomes horizontal scroll with a visible scrollbar and cards cut mid-word; help FAB overlaps last card.
- Nav drawer itself is clean and works well.

### 2.8 What Works Well (keep)

- Request → tender → bid product model; role-scoped dashboards and guards.
- Multi-step forms with stepper, autosave ("Last saved: just now"), draft expiry, progress bars, "What to expect" pre-form modal, eligibility box on tender detail, breadcrumbs on the form.
- Services taxonomy (Quick / Home & Office / Industrial & Technical) with form-complexity messaging ("5–10 min form", "Detailed specs required").
- Lazy-loaded feature routing; standalone components; signals; the codebase structure is clean and modern.
- KPI-card + filter-pill + table pattern on management pages is the right shape — it just needs the visual system.

---

## Progress Log

**Visual Consistency (V1–V7) + Bugs (BG1–BG10) sweep: complete, with two blockers logged.**
Verified each item against the code rather than trusting the earlier ticks — three findings had been marked done prematurely. **V1**: 540 hard-coded hex values migrated to tokens (the app was mixing Tailwind's gray *and* slate ramps, and green *and* emerald, which is what made it read as assembled rather than designed); 88 box-shadows folded onto `--shadow-sm/md/lg/xl`, and new `--ring-brand/danger/inverse` focus tokens replace the scattered focus halos. Zero raw hex remains in any page SCSS. **V2**: the shared `app-status-badge` was in use on only 2 screens while 6 others hand-rolled their own — five different pill geometries for the same statuses. All six now use one component, extended to 30 statuses across six semantic tones, with an optional icon and a `label` override for audience-specific wording (a vendor sees their own losing bid as "Not Selected", management sees "Rejected"). All six tones verified at WCAG AA (4.51–9.37). **V4**: found *nine* competing date implementations, not the four the review listed — including one still on `en-US` rendering "March 12, 2026" beside "12 Mar 2026", and one falling back to the browser locale. Replaced with one `date-format.util` + `appDate`/`appDateTime` pipes; no template can invent a pattern now. **V6**: 129 verbatim inline SVGs (50 distinct shapes, the same clock pasted 8 times) replaced by `<app-icon>`, 14 icons added to the registry. **V7**: acronym-aware `humanizeEnum` kills "Ac Servicing"/"Cctv Fire".

**BG1–BG10 re-verified**: all fixed (BG3/BG4 remain correctly retracted as automation artifacts). BG10's mock data is internally consistent — `shortlistedCount: 2` matches its two shortlisted bids.

**Found while sweeping — dead routes.** A contrast audit turned up a `|` divider, but chasing it exposed something worse: **12 links across the app pointed at unregistered routes**, and because `app.routes.ts` ends in `path: '**' → redirectTo: ''`, every one silently dumped the user on the homepage instead of erroring. Four were fixable and are fixed (`/service-login` ×2 → `/login?portal=services`, which IA5 claimed to have resolved but only fixed the one instance in `services.page.ts`; `/my-bids` → `/vendor/bids`; a vendor empty-state CTA). Two dead "View All" links were removed — the lists they pointed past were already complete, so nothing was lost. **The remaining 8 are blockers, not UI work** — see below.

**Phase A — Foundation: complete** (A1, A2, A4, A5 fully; A3 and A6 partially — see status notes below).
Design tokens + Inter typography, `lucide-angular` icon system with `<app-icon>`, SVG logotype replacing the raster logo, and a global footer with real Delhi contact details are all live and verified on desktop + mobile.

**Phase B — Content & Public Pages: complete** (B1–B5).
Real contact data + embedded Google Map; homepage restructured for a multi-stream company (audience paths, config-driven business streams, trust strip); About covering all three streams with defensible facts replacing invented stats; services Popular row unified to the standard card anatomy with mobile FAB clearance; and a new public `/careers` landing at `/careers`.

**Phase C — Auth & IA: UI scope complete** (C2–C5; C1 presentation-layer only).
Navbar shows one session identity with role-aware links, login honours `?portal=`/`?role=` deep links, auth tabs have accessible names, remember-me/forgot-password added, and all auth-page emoji/raster logos are gone. Store unification (C1 data layer) deferred to backend work.

**Information Architecture pass: IA1, IA3, IA4, IA5, IA6 resolved.**
Single session identity with role-aware top-level nav (IA1/IA4), audience paths on the homepage (IA3), `/service-login` fixed (IA5), and tender card actions are real links (IA6). IA2 (login asks three questions before credentials) is blocked on the deferred auth-store unification — the deep-link params added in C3 mitigate it for entry points that know the portal.

**Phase D — App-screen consistency: complete (D1–D7).**
Deadline/expiry countdowns go through one helper (no more "-905 days left"); currency and locations unified to INR / Delhi NCR across jobs, tenders and bids; date formats standardised (seconds removed); category enums humanized; off-palette purple removed in favour of navy/semantic tokens; profile-completion ring derived from its checklist; profile divider rows fixed. D4's two reported stepper bugs were re-tested and **retracted as observation artifacts**.

**Phase E — Platform & polish: complete except imagery.**
Per-route titles + meta descriptions + OG tags via a custom `TitleStrategy`, plus `robots.txt`. Accessibility: icon-only controls (hamburger, help FAB, avatar menu) now have accessible names and `aria-expanded`; contrast audited across chips/badges/meta text with no genuine failures (two apparent ones were gradient false-positives measuring 7.1–12.3:1). Mobile: all five wizards verified at 375px with zero horizontal overflow and tap targets ≥52px. Toasts and the request-form category badge moved onto semantic tokens. **E5 imagery remains blocked** on licensing.

**Phase E review pass — three gaps closed.**
The first pass marked E1 complete while `og:image`, `canonical`, and the sitemap were all missing — and `robots.txt` pointed at a `sitemap.xml` that did not exist. All now delivered and verified in the prerendered output. E6's "one config entry" promise was also found to be unsafe (lucide throws on unknown icons); `<app-icon>` now degrades to a fallback instead.

Verified via clean production build (21 prerendered routes, no errors/warnings), zero console errors, and no horizontal overflow at 375px.

*Note: the dev server must be restarted after pulling these changes — `npm install` added `lucide-angular` and `@fontsource-variable/inter`, and `angular.json` gained a global style entry.*

---

## 3. Work-Item Checklist

Ordered so that foundation work unblocks everything else. **P0 = must do (professional baseline), P1 = should do, P2 = polish.**

### Phase A — Design Foundation (P0)

- [x] **A1. Design tokens.** Rebuild `styles.css` into a token sheet: brand colors (navy `#003664` scale + logo-red accent used sparingly for CTAs/highlights), semantic colors (success/warning/danger/info — one hue each), neutral scale, spacing scale (4/8/12/16/24/32/48/64), radius (sm/md/lg), shadows (1–3 levels), z-index scale. Remove the duplicate `--yellow-*`/`--green-*` definitions.
- [x] **A2. Typography system.** Add a professional typeface (e.g., Inter or Public Sans, self-hosted via `@fontsource`) with a defined scale (display / h1–h4 / body / small / caption) and weights; reduce hero sizes on mobile via `clamp()`. Set `input, textarea, select, button { font: inherit }` (fixes BG5).
- [x] **A3. Icon system — remove all emojis.** Adopt `lucide-angular` (matches the inline SVGs already in navbar/features). Create an `<app-icon name="...">` component; replace all ~300 emoji across the 39 files (service categories, section headings, tabs, badges, table flags, buttons, KPI cards, empty states, meta rows). Kill the "✨" suffixes in `service.model.ts` names. Map service categories → icons in `service.model.ts`/`service-category.util.ts` (snowflake, paint-roller, zap, cctv → camera, etc.).
  - **Status: COMPLETE** — `lucide-angular` installed, `APP_ICONS` registry + `<app-icon>` wrapper built and registered globally; home, services, `service.model.ts` (app-wide icons), navbar and management table flags converted. **Zero emoji remain in any template or TS file** — all ~300 occurrences across 39 files are now `<app-icon>` components backed by an 89-icon curated registry. (Two `content: '\u2713'` checkmarks remain in SCSS, which are legitimate CSS glyphs.)
- [x] **A4. Logo & brand assets.** Export a proper SVG logo (transparent background, horizontal + mark-only variants, light-on-dark version for navbar/footer). Remove the logo-as-hero-image and logo-in-page-headers usage (navbar + footer only). Add a real favicon set + `theme-color`.
- [x] **A5. Global footer component.** Four columns: brand + one-liner + social, Services (top 6 + "All services"), Company (About/Contact/Careers), Contact (Delhi address, +91 phone, email) + legal bar (© year, privacy/terms). Wire into `app.component.html` under the router outlet. This single component removes most of the "unfinished" feel and fixes the dead space at page bottoms.
- [~] **A6. Shared UI kit.** Standardize: one button set (primary/secondary/ghost/danger + sizes), one `status-badge` used everywhere (map status → semantic color; no per-page badge styles), one card, one form-field wrapper (label/help/error), one empty-state component (SVG illustration + title + hint — replaces the giant ⭐), one modal, one table style. Migrate the ~700 hard-coded hex values in page SCSS to tokens as pages get touched.
  - **Status: mostly done.** Global button system, `empty-state`, and `status-badge` (now genuinely used on every screen — see V2) are complete. The **hex→token migration is finished**: 540 values converted, plus 88 shadows onto `--shadow-*` and new `--ring-*` focus tokens; zero raw hex remains in page SCSS. **Still outstanding:** card / form-field / modal / table consolidation — each screen still styles those locally.

### Phase B — Content & Public Pages (P0/P1)

- [x] **B1. (P0) Real contact data everywhere.** Replace NYC/555 placeholders with the real Delhi address, +91 9355633000, real @heavenlycorporation.com mailboxes. Either embed an actual Google Map or delete the "Map integration would appear here" block entirely.
- [x] **B2. (P0) Homepage restructure for a multi-stream company.**
  - Hero: real value prop covering all streams ("Manpower, industrial services & technical contracting") with professional photography or a clean illustration/gradient — never the logo. Dual CTAs: "Hire manpower" / "Request a service".
  - **Audience path cards** (4): Hire Staff · Find Work · Request a Service · Become a Vendor — each with its own CTA into the right funnel (fixes IA3).
  - **Business streams section** designed to scale: card grid driven from a config array (Manpower Supply · Transformer Rewinding · Technical Services · +future) so new streams slot in without redesign.
  - Trust strip: real stats only, client/partner logos if available, "since <year>", service coverage areas.
  - Keep: Why-Choose grid (with Lucide icons), final CTA band.
- [x] **B3. (P1) About page** covering all three streams + company story, team/office photos if available, verified stats, leadership if appropriate. Mission/vision cards can stay but with icons from the system.
- [x] **B4. (P1) Services page cleanup:** remove emoji from section headings and cards; professional icons or small photos per service (live site has photos already — reuse); tighten Popular row (same card anatomy as category cards); fix bottom dead space; keep search + filter pills + help FAB (raise FAB above content on mobile / give the list bottom padding).
- [x] **B5. (P2) Careers/jobs public landing** (the live site's "Explore Jobs" is a 500 right now — the rework should give jobs a public browse or at least a landing explaining the process before login).

### Phase C — Auth & IA (P1)

- [~] **C1. Unify the two auth systems** (single account store with roles), or if that's too deep for now: auto-detect account type by email at login (single email+password form, no portal/role toggles), and show one session identity in the navbar. Fixes IA1/IA2.
  - **Status: UI half done, data half deferred.** The navbar now derives a single `SessionView` from both stores, so only one identity is ever shown and `Dashboard` resolves to the active role's dashboard (IA1 fixed at the presentation layer). Merging the two stores into one account model is a data-layer change and is deferred with the rest of the backend work.
- [x] **C2. Role-aware navbar**: "Dashboard" resolves to the logged-in role's dashboard; admin gets a visible Management entry; vendor gets Tenders/My Bids; requester gets My Requests. Remove the parallel-session display.
- [x] **C3. Fix `/service-login` broken route** (`services.page.ts:118`) → point to `/login` with the services tab preselected (query param).
- [x] **C4. Auth page polish**: add Forgot-password (even a stub flow), "Remember me", accessible names for tabs (fixes BG8), and replace the boxed-JPG logo on the gradient panel.
- [x] **C5. Signup benefit lists**: swap emoji bullets (📋 ✅ 💾 📈) for icon components; fix the low-contrast "verification takes 24–48h" notice.

### Phase D — App Screens Consistency (P1)

- [x] **D1. One status system.** Central map: `submitted/under_review/approved/published/closed/awarded/pending/verified/rejected → {label, semantic color}`. Apply via the shared `status-badge` in management table, evaluation cards/tabs, requester & vendor dashboards, my-bids. Humanize all enum labels (no more `quick_service`).
- [x] **D2. One date/currency system.** `DatePipe` presets: "12 Mar 2026" (dates), "12 Mar, 14:30" (deadlines — no seconds), relative only for < 7 days. Single currency **INR** (₹, Indian digit grouping) across jobs, tenders, bids; one `formatCurrency` helper. Regenerate all mock data to India (Delhi NCR + target cities) — fixes C3 mock chaos.
- [x] **D3. Fix countdown logic**: clamp expired to "Closed"/"Expired" (BG1, BG2); "URGENT" ribbon repositioned so it can't overlap chips (BG7).
- [x] **D4. Form stepper fixes** *(investigated — both reported bugs retracted, see BG3/BG4)*: advance stepper + progress on step change (BG3); fix the stuck fade-in on step content (BG4); align "What to expect" modal bullet list left.
- [x] **D5. Management pages**: consistent page-header treatment (same navy band pattern everywhere); replace flag emojis with icon+tooltip set; move "Quick Approve"/"Publish Now" onto the semantic button system (success = one green, primary = navy; drop the purple or promote it to a real semantic role).
- [x] **D6. Vendor/requester dashboards**: SVG icons in all KPI cards; fix profile-completion math (BG6); remove empty divider rows on profile (BG9); tender cards → clickable links (router links) instead of buttons (IA6).
- [x] **D7. Empty states**: shared component with proper illustration, headline, body, action — evaluation tabs, no-results, drafts, my-bids.

### Phase E — Platform & Polish (P2)

- [x] **E1. SEO/meta**: per-route `title`, meta descriptions, Open Graph + social card image, `lang`, canonical; sitemap/robots.
  - Delivered via `core/seo/seo-title.strategy.ts` (title + description + OG + Twitter card + canonical, query/fragment stripped), `src/robots.txt`, `src/sitemap.xml`, and a vector-built `assets/social-card.png` (1200×630) — no stock imagery needed.
- [x] **E2. Accessibility pass**: visible focus rings (light ring on navy, navy ring on white), aria-labels on icon-only buttons, tab semantics on login, contrast check on all chips/badges and gray meta text, `prefers-reduced-motion` for the form/step animations.
- [x] **E3. Mobile pass**: `clamp()` hero type; Popular row → 2-col grid or snap-scroll without visible scrollbar; FAB spacing; test all wizards at 375px.
- [x] **E4. Micro-interactions** *(toasts + states done; skeleton loaders deferred — see status)*: consistent hover/active/disabled states from tokens; skeleton loaders for dashboards/lists instead of blank waits; toast styling aligned to semantic colors.
  - **Status:** toasts now use `--success/danger/warning/info-solid` with a semantic icon per type and `role="alert"` on errors; buttons/disabled states come from the token button system. **Skeleton loaders not added** — the audit found the dashboards and evaluation screens already show spinner + text loading states, so this is a refinement rather than the "blank wait" defect the review assumed.
- [ ] **E5. Imagery** — **BLOCKED on licensing.** Commission/select a small photo set (manpower/interview, transformer workshop, technicians) used consistently (hero, streams, about), with a consistent duotone/overlay treatment.
  - **Status:** the supplied `img/` set is largely **watermarked Adobe Stock comps** (verified on `services-02` #254154977, `services-09` #330979358, `services-15` #305258776) and cannot ship. Only `Sajani_thomas_pic.jpeg` was clean and is in use on About. `services-01.jpg` looks clean but its licence is unconfirmed. A brand social card (`assets/social-card.png`) was produced from vector, so no stock imagery is required for sharing previews.
- [x] **E6. Extensibility guardrail**: streams/services/categories rendered from typed config — adding "Solar Installation" or any new stream = one config entry + one icon, no layout edits.
  - **Hardened during review:** lucide *throws* on an unregistered icon name, so a one-character typo in a config entry would have taken down the whole view. `<app-icon>` now validates against `APP_ICONS` and falls back to `circle-help` with a dev-mode warning. Verified by injecting a bogus icon name: the page rendered completely and logged the warning instead of crashing.

---

## 4. Suggested Order of Execution

1. **A1–A4** (tokens, type, icons, logo) — unblock everything, biggest visual jump.
2. **A5 + B1** (footer + real contact) — kills the "unfinished" feel.
3. **B2** (homepage) — the first impression for every audience.
4. **D1–D4** (status/date/currency/bug fixes) — app screens snap into coherence.
5. **C1–C3** (auth/IA) — deeper refactor, schedule deliberately.
6. **B3/B4, D5–D7, E-phase** — steady polish.

---

*Generated from a full walkthrough on 2026-07-18: 8 public pages, 9 authenticated screens across admin/vendor/requester roles, mobile spot-checks at 375px, code scan of 149 TS/HTML files + 17k lines of SCSS, and the production site for brand/content reference.*
