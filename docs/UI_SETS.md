# Pending UI Implementation — Set Plan

**Authored:** 2026-07-19. The screens below **do not exist**; every one of them is already linked from shipped UI (the dead-route inventory in [UI_ISSUES.md §1](UI_ISSUES.md)) or is required for an existing flow to terminate sensibly. Grouped into four sets, ordered by user damage. One set is implemented at a time; each set leaves the app consistent and shippable.

Design ground rules for all sets — these are the "current UI and approaches" being matched:

- **Visual system:** design tokens only (no raw hex), `<app-icon>` for all iconography, `app-status-badge` for statuses, `app-empty-state` for empty lists, buttons from the global `.btn-*` system, management-style navy `page-header` band for full-page workspaces.
- **Code system:** standalone components, signals + `computed` for state, new control flow (`@if/@for/@switch`), lazy-loaded feature routes, reactive forms for anything with validation, `appDate`/`appDateTime` pipes for dates, SEO `title` + `data.description` on every route.
- **Derive, don't store** (the BG6 lesson): anything displayed in two places is computed from one source.
- **No dead ends:** every new route is registered before anything links to it; the 404 page (Set 1) makes any future miss loud instead of silent.

---

## Set 1 — Vendor Profile Editor + real 404 ✅ **done**

**Why first:** the profile-completion widget is the vendor dashboard's primary CTA and all five rows dead-end on the homepage. It also blocks the verification loop — a `pending` vendor has no way to supply missing documents ([UI_ISSUES.md §2](UI_ISSUES.md)). The 404 page rides along because it converts the whole class of silent dead links into visible failures during development of Sets 2–4.

| Piece | Route | Notes |
|---|---|---|
| Profile shell | `/vendor-profile` → redirects to `basic` | Navy page-header; left section nav with live complete/incomplete indicators (desktop) that collapses to scrollable chips (mobile) |
| Basic Information | `/vendor-profile/basic` | Business identity + contact (matches signup steps 1–2 fields) |
| Business Documents | `/vendor-profile/documents` | Four document slots; mock upload until the API exists |
| Services Offered | `/vendor-profile/services` | Capability checkboxes from the `SERVICES` catalogue + service-area chips |
| Portfolio | `/vendor-profile/portfolio` | Past-work entries — **model does not exist**; minimal `PortfolioEntry` added (title, description, year, client) |
| Bank Details | `/vendor-profile/bank` | Four fields; account number masked at rest, revealed only while editing |
| 404 page | `**` | Replaces the silent `redirectTo: ''` |

**Architecture decisions**

- **Guard is `vendorGuard` (any verification status), not `vendorVerifiedGuard`** — pending vendors *must* reach this page; completing it is how they get verified. The guard already exists, unused until now.
- **Completion rules move to one shared util** (`shared/utils/vendor-profile-completion.util.ts`) consumed by both the dashboard widget and the profile page. Today the dashboard's `PROFILE_SECTIONS` is hard-coded `isComplete: false` forever — the ring can never move. Same rules as the API contract ([02 §profileCompletion](backend/02-API-VENDOR-DASHBOARD.md)) so frontend and backend can't drift.
- Sections are standalone components with inline templates (the established pattern from the evaluation tabs), one reactive form each, saving through the existing `ServiceAuthService.updateVendorProfile`.
- Wiring: navbar `profileLink` for vendors → `/vendor-profile` (currently `null` with a comment explaining the page didn't exist); verification-pending gets a "Complete your profile" CTA into `/vendor-profile/documents`.

## Set 2 — Requester Request Center ✅ **done**

**Why second:** three dead quick-actions (`/my-tenders`, `/drafts`, `/request-history`) plus the now-confirmed product answer: **a `changes_required` request can be re-edited and resubmitted** — which needs a place to happen. There is currently *no screen where a requester can open one of their own submitted requests.*

**IA decision:** collapse the three dead routes into **one feature** rather than three thin pages:

| Piece | Route | Notes |
|---|---|---|
| My Requests list | `/my-requests` | Tabs: Requests / Drafts. Status filter pills (incl. "Live tenders" = `published`) — this *is* `/my-tenders` and `/request-history` as filters, not pages |
| Request detail | `/my-requests/:id` | Status timeline (`service_request_events` shape from [04](backend/04-API-SERVICE-REQUESTS.md)), submitted data via the existing `formatFormData` sections, actions: **cancel** (while `submitted`/`under_review`), **edit & resubmit** (when `changes_required` — clones `formData` back into a draft and reopens the wizard, per the confirmed flow) |
| Quick-action rewiring | — | Dashboard `QUICK_ACTIONS` routes updated to the new paths |

## Set 3 — Admin Vendor Verification (F8) ✅ **done**

**Why third:** completes the vendor lifecycle end-to-end (register → complete profile → admin verifies → portal). Without it, verification can only be faked in devtools.

| Piece | Route | Notes |
|---|---|---|
| Verification queue | `/management/vendors` | Management tab alongside jobs/requests; KPI cards, filter by status, `app-status-badge` |
| Vendor review | `/management/vendors/:id` | Full profile + documents read-back; approve / reject-with-reason / suspend; writes the `vendor_verification_events` audit shape |

Also in this set: the `/management/settings` dead link (a **fourth** dead-link form — raw `href`) was **removed** — a management settings page is deferred to Set 4 rather than shipping a link to nowhere.

## Set 4 — Flow-completion polish ✅ **done**

Small screens that finish existing flows:

- **Submission confirmation** — not a separate route. Set 2 already lands post-submit on `/my-requests/:id`; Set 4 adds a one-time dismissible success banner there via `?submitted=1` (shows the request number + "what happens next"). A whole confirmation page would have been redundant with the detail page.
- **Vendor rejection/suspension** — folded into `/verification-pending`, made **status-aware** (`@switch` on `verificationStatus`): in-progress / rejected-with-reason-and-resubmit / suspended-with-contact. The guard now routes *any* non-verified vendor here instead of dumping rejected vendors at `/login`. Rejected vendors resubmit via `ServiceAuthService.requestReverification()` → back to `pending` with an audited event the admin sees in the F8 timeline. Also fixed two pre-existing issues on this screen: the raster `logo.png` → `<app-logo>`, and the wrong `@heavenlycorp.com` support address → `info@heavenlycorporation.com`.
- **Requester profile** — new `/service-requester-profile` (single-card editor, type-aware fields for individual/SME/large-org), navbar `profileLink` for requesters now points here (was `null`). Added `sme → SME` to `humanizeEnum`.
- **Management settings** — still deferred; the dead link was removed in Set 3, and no new link was added, so there's no dead end.

---

**Route-integrity note for every set:** dead links have now been found in four syntactic forms — `routerLink` attributes, `route:` config properties, `router.navigate([...])` arrays, and raw `href`. Any new navigation added by these sets must use `routerLink`/`router.navigate` with a registered path, and the 404 page makes misses visible immediately.
