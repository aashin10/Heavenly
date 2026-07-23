# Heavenly Corporation — Outstanding UI Issues

**Last verified:** 2026-07-19 against `HeavenlyFrontEnd` @ production build (21 routes prerendered, 0 errors).

This is the live defect/debt register. It complements `UI_UX_REVIEW.md` (which is the original review + phase checklist); this file tracks **what is still wrong right now** and why it hasn't been fixed.

Each item states the **evidence** (how it was verified, not assumed), the **user-visible impact**, and the **blocker** if any.

> **A note on method.** Several items in the review were marked complete but were not. Every claim below was re-derived from the code — `grep`/AST scans for the static facts, a running browser with computed styles for the visual ones. Where an earlier tick was wrong, that is called out explicitly, because the pattern matters more than the individual bug: **a checkbox is not evidence.**

---

## 1. BLOCKER — Dead routes silently redirect to the homepage

**Severity: 🔴 Critical · Status: 8 of 12 unresolved · Needs product decision + new screens**

### The mechanism

`src/app/app.routes.ts` terminates with:

```ts
{
  path: '**',
  redirectTo: ''
}
```

Any `routerLink` pointing at an unregistered path therefore **silently lands the user on the homepage**. No 404, no console error, no failed navigation event. This is why twelve broken links survived undetected through five review phases — including one (`IA5`) that was explicitly marked *RESOLVED*.

### Why it went unnoticed

`IA5` was ticked after fixing `services.page.ts:118`. But `/service-login` was referenced in **three** places; the two `routerLink` anchors in the signup templates were never touched. A grep for the string would have caught it. The fix was verified by testing the one code path that had been changed.

### Resolved (6)

| Link | Was | Now |
|---|---|---|
| `/service-login` | vendor-signup.page.html:596 | `/login` + `{ portal: 'services' }` |
| `/service-login` | service-requester-signup.page.html:506 | `/login` + `{ portal: 'services' }` |
| `/my-bids` | vendor-dashboard.page.html:137 | `/vendor/bids` |
| `/vendor-profile/services` | vendor-dashboard.page.html:125 (empty-state CTA) | `/vendor/tenders` — "Browse all tenders" |
| `/request-history` | service-requester-dashboard.page.html:109 | **Link removed** |
| `/drafts` | service-requester-dashboard.page.html:151 | **Link removed** |

The two removals were safe: both were "View All" links above lists that are **not truncated** — `recentRequests` and `drafts` are plain `signal<T[]>` with no `.slice()` anywhere in the component or its service. "View All" would have shown the user exactly what was already on screen.

### Unresolved (8) — these need screens that do not exist

These are **feature work, not UI polish.** They are left in place rather than deleted, because deleting them would silently remove product surface area that someone intended to build.

| Route | Declared in | Missing screen |
|---|---|---|
| `/vendor-profile/basic` | `vendor-dashboard.model.ts` → `PROFILE_SECTIONS` | Vendor profile editor |
| `/vendor-profile/documents` | ″ | ″ |
| `/vendor-profile/services` | ″ | ″ |
| `/vendor-profile/portfolio` | ″ | ″ |
| `/vendor-profile/bank` | ″ | ″ |
| `/my-tenders` | `service-requester-dashboard.model.ts` → `QUICK_ACTIONS` | Requester's tender list |
| `/drafts` | ″ | Standalone drafts screen |
| `/request-history` | ″ | Request history screen |

**The vendor case is the damaging one.** The profile-completion widget is the primary call-to-action on the vendor dashboard — a progress ring, a percentage, and a five-row checklist. **Every single row dead-ends on the homepage.** A vendor who follows the dashboard's main prompt is bounced to the marketing site with no explanation.

### Recommendations

1. ~~**Decide on the vendor profile editor.**~~ **BUILT** (UI_SETS Set 1) — `/vendor-profile/:section`, five sections, completion derived by `shared/utils/vendor-profile-completion.util.ts` and shared with the dashboard widget, which now reflects reality instead of a permanent 0%.
2. ~~**Replace the `**` redirect with a real 404 route.**~~ **BUILT** — `features/not-found/not-found.page.ts`; a missing page now fails loudly.
3. **Add a route-integrity check.** These are statically detectable — a script that cross-references every `routerLink="/…"` and every `route: '/…'` config value against the registered route table would have caught all twelve. Worth wiring into CI.

> **Detection gap worth noting:** the first scan only checked `routerLink="…"` in templates and found 4. The other 8 live in **TypeScript config objects** (`PROFILE_SECTIONS`, `QUICK_ACTIONS`) as `route: '/…'` string properties. Any CI check must cover both forms.

---

## 2. Vendor verification flow ✅ RESOLVED (Set 3)

**Severity: 🔴 Critical · Status: RESOLVED — admin verification queue shipped in UI_SETS Set 3.**

> **Closed end-to-end (2026-07-21).** `/management` now has a **Vendors** tab (queue with stats + status filters) and a `/management/vendors/:id` review page where an admin approves / rejects-with-reason / suspends / reinstates. Every decision is audited (`verificationEvents`, `reviewedBy`). Verified live: a vendor moved pending→verified through the UI then passed `vendorVerifiedGuard` into the portal — no devtools needed. Original findings below, for the record.

`Vendor.verificationStatus` is `'pending' | 'verified' | 'rejected' | 'suspended'`, and `vendorVerifiedGuard` gates `/vendor-dashboard` and `/vendor` on it. But:

- There is **no admin screen to move a vendor from `pending` to `verified`.** `/management` covers jobs and service requests only.
- ~~There is no vendor profile editor~~ **RESOLVED (Set 1)** — a `pending` vendor can now supply documents via `/vendor-profile/documents`, and `/verification-pending` links there with a "Complete Your Profile" CTA.
- ~~`/verification-pending` is a terminal screen with no path forward.~~ **Partially resolved** — it now routes into the profile editor. The remaining hole is the admin side (below).

As it stands a vendor can register and then **cannot progress**, and an admin has no way to unblock them. This is the single largest functional hole in the app.

---

## 3. Two divergent `ServiceRequest` models

**Severity: 🟡 Moderate · Status: unresolved · Backend design risk**

The same domain entity is declared twice with materially different shapes:

| | `core/models/service.model.ts:324` | `features/management/management.model.ts:54` |
|---|---|---|
| Identity | `id` | `id` **+ `requestNumber`** |
| Service ref | `serviceType` | `serviceId` |
| Status type | `RequestStatus` | `ServiceRequestStatus` |
| Requester | `requesterId` only | `requesterId`, `requesterName`, `requesterEmail`, `requesterPhone`, `requesterType` |
| Location | *absent* | `location`, `address`, `city`, `state`, `pincode` |
| Urgency | *absent* | `'low' \| 'medium' \| 'high' \| 'urgent'` |
| Comment in source | `// Additional fields will be added in Phase 2` | — |

`ServiceCategory`, `RequesterType` and `BudgetVisibility` are **also each declared twice**, in both files, with `RequesterType` genuinely disagreeing:

```ts
// core/models/service.model.ts:14
export type RequesterType = 'individual' | 'sme' | 'large_organization';

// features/management/management.model.ts:50
export type RequesterType = 'individual' | 'sme' | 'organization';
```

`'large_organization'` vs `'organization'` — a requester created through signup cannot round-trip through the management screens without a silent mismatch. TypeScript does not catch this because the two types are never assigned to each other; they meet only through `localStorage` JSON.

**This must be resolved before the backend contract is written**, or the API will inherit the ambiguity. Recommendation: one canonical `ServiceRequest` in `core/models`, with the management screens consuming a projection of it. See `docs/backend/` — the API contract deliberately picks one shape and notes the divergence.

---

## 4. Mock auth ignores passwords entirely

**Severity: 🟡 Moderate (demo-only) · Status: expected, but load-bearing**

`service-auth.service.ts`:

```ts
loginServiceRequester(email: string, _password: string): boolean {
loginVendor(email: string, _password: string): boolean {
```

The underscore prefix is honest — the password parameter is **accepted and discarded**. Any password logs you in as any known email. Same story in the jobs portal (`auth.service.ts:91` compares against a plaintext password held in `localStorage`).

This is fine for a prototype and is *why* the backend work is starting. Flagged here because:
- No password rules, reset flow, or lockout exist to port — they must be **designed, not migrated**.
- `heavenly_users` in `localStorage` holds **plaintext passwords**. Anyone who has opened the demo has them in their browser. Do not seed production from this data.

---

## 5. Two unmerged auth stores

**Severity: 🟡 Moderate · Status: deferred by decision (C1)**

`AuthService` (jobs) and `ServiceAuthService` (services) are separate stores with separate `localStorage` keys, and a user can be logged into **both simultaneously**. The *presentation* was unified in Phase C — the navbar derives a single `SessionView` and one identity is shown — but the data layer was deliberately left alone as backend work.

Relevant now because the backend contract has to decide: **one account with multiple roles, or two account namespaces?** The API docs assume **one account, many roles** — see `docs/backend/01-API-AUTH.md §2`. That is a change from today's frontend behaviour and will require the two services to be collapsed.

---

## 6. Remaining design-system gaps (A6)

**Severity: 🟢 Minor · Status: partially resolved**

Resolved: button set, `empty-state`, `status-badge` (now on all 9 consumers), the hex→token migration (540 values, 0 raw hex left in page SCSS), shadows (`--shadow-sm/md/lg/xl`), focus rings (`--ring-brand/danger/inverse`).

**Still local to each screen:**

| Pattern | Consequence |
|---|---|
| Card | Every screen restyles padding, radius, border, hover |
| Form field (label/help/error) | Error text placement and colour vary per form |
| Modal | Overlay opacity, max-width, close-button position all differ |
| Table | Header weight, zebra striping, cell padding differ between management and evaluation |

Not urgent — nothing is broken — but each new screen currently pays the cost of reinventing these, and they will drift again.

---

## 7. Deferred with reasons

| Item | Why it is not done |
|---|---|
| **E5 Imagery** | **Licensing.** The supplied `img/` set is largely watermarked Adobe Stock comps — verified on `services-02` (#254154977), `services-09` (#330979358), `services-15` (#305258776). Only `Sajani_thomas_pic.jpeg` was clean and is in use on About. `services-01.jpg` looks clean but its licence is unconfirmed. The brand social card was built from vector, so sharing previews need no stock imagery. |
| **Skeleton loaders (E4)** | The dashboards already show spinner + text loading states, so this is a refinement rather than the "blank wait" defect the review assumed. |
| **IA2 login cognitive load** | Three decisions before credentials (portal → role → login/signup). Fixing it properly means email-based account-type detection, which needs the backend. Folded into `01-API-AUTH.md`. |

---

## 8. Verified-clean (do not re-litigate)

These were checked directly this pass and are genuinely fine. Recorded so the next review does not re-open them:

| Claim | Evidence |
|---|---|
| Zero emoji in app code | Unicode-range scan over all `.html`/`.ts` → 0 files |
| Zero raw hex in page SCSS | `grep -roh '#[0-9a-fA-F]{3,8}'` over `**/*.scss` → 0 |
| One date system | 0 raw `\| date:` pipes; all through `appDate`/`appDateTime` |
| One badge system | 0 hand-rolled `class="status-badge"`; 9 consumers of `app-status-badge` |
| All icons resolve | Live check across 9 routes: 0 unresolved names, 0 empty renders |
| Badge contrast | All 6 tones measured in-browser: 4.51–9.37 (AA needs 4.5) |
| BG3, BG4 | **Not bugs.** Automation-tab artifacts — `visibilityState: 'hidden'` pauses CSS animations, freezing `currentTime` at 0. Confirmed by fronting the tab. |
| BG10 | **Not reproducible.** The page derives the count from bids; the mock tender declaring `shortlistedCount: 2` does have exactly 2 bids with `shortlisted: true`. |

> **Measurement caveat for future work.** The automation browser reports `innerWidth: 0` and `visibilityState: 'hidden'` when backgrounded, which makes every `getBoundingClientRect().width` read `0` and pauses all CSS animations. Two "bugs" (BG3/BG4) were originally filed from exactly this artifact. **Front the tab and re-measure before believing a layout or animation defect.**

## 9. Fix round — 2026-07-19 (user-reported)

Five reported issues, all fixed and verified in a live browser; one systemic analog found and fixed in the sweep.

| # | Report | Root cause | Fix |
|---|---|---|---|
| 1 | "Hire Manpower" went to Contact | CTA predates the signup deep-link capability | Now `/login?mode=signup&role=employer`; login page honours `mode`/jobs `role` params; `guestGuard` signs out an already-logged-in user who explicitly navigates to signup (toast explains) |
| 2 | Logout left user on the dashboard | Navbar `handleLogout()` cleared stores but never navigated | Navigates to `/login` after clearing both stores |
| 3 | Quick Actions icons missing | Template `@switch`ed on **old** icon names (`document-add`…) after the model was renamed to `file-plus`/`file-text` — no case matched, nothing rendered | Removed the switch; renders `<app-icon [name]="action.icon">` directly |
| 4 | "Equipment type is required" even after choosing | **Missing `formArrayName="equipmentList"`** — `[formGroupName]="$index"` resolved against `step2`, threw `Cannot find control with path: 'step2 -> 0 -> type'`, crashed the options loop (dropdown rendered empty) and never bound the control | Added the wrapper. Verified: options render, error clears on select, step advances |
| 5 | Two logout buttons on requester dashboard | Page header had its own logout beside the navbar dropdown's | Removed page-level buttons on **both** requester and vendor dashboards; dropdown is the single logout |

**Sweep findings (same bug classes, checked app-wide):**

- **`serviceGuestGuard` had the issue-1 trap too**: a signed-in requester clicking "Become a Vendor" was silently bounced to their own dashboard. Now: explicit arrival at a signup page while signed in ends the session and lets them register. Verified live.
- **Careers "Create an account"** now deep-links `/login?mode=signup&role=applicant` using the new capability.
- **`getInitials()` hardened** against null/undefined — a malformed session blanked the entire navbar via a `TypeError`; it now degrades to an empty avatar.
- Checked clean: no other stale `@switch`-on-config blocks; mid-complexity and technical forms bind their FormArrays via direct `[formControl]` references, immune to the issue-4 pattern; all logout call sites navigate; icon registry scan — zero unregistered names.
- **Left as-is deliberately**: the logout button on `/verification-pending` — that screen's primary action is contextual ("wrong account, get me out"), not a duplicate.

**Addendum (found while writing the D2/D3 API contract):** a **13th dead route**, in a third syntactic form the earlier scans missed — `router.navigate(['/services/request/confirmation'])` in `service-request-preview.page.ts`. After a successful submission the requester was silently bounced to the homepage instead of any confirmation. Fixed: submit now lands on the requester dashboard with the request number in the toast. A follow-up scan of **all** `router.navigate(['/…'])` literals found no others. Any future route-integrity check must cover all three forms: `routerLink` attributes, `route:` config properties, and `router.navigate` arrays.
