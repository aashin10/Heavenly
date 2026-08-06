# Services Portal — End-to-End Completion Roadmap

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement each slice. This document is the **roadmap**; each slice has (or gets) its own task-level plan file in this directory. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take the services portal from "backend complete, frontend half-wired" to a fully working request → tender → bid → evaluate → award pipeline, browser-verified end to end against the real API.

**Architecture:** Angular 17 (SSR) talking to a .NET 10 Clean-Architecture/CQRS API over PostgreSQL. The backend pipeline (B2.1–B2.7) is already built and tested; the remaining work is (a) three genuine backend gaps that block the admin surface, and (b) wiring eleven frontend screens off `localStorage` onto the real endpoints, one slice at a time behind the existing `useRealApi` flag.

**Tech Stack:** .NET 10 · EF Core 10 + Npgsql · MediatR · FluentValidation · xUnit + Testcontainers · Angular 17 · RxJS · Karma/Jasmine · Supabase Postgres (dev)

---

## Global Constraints

Every task's requirements implicitly include this section.

- **Repos:** frontend `aashin10/Heavenly`, backend `aashin10/Heavenly-Job-Backend`. **Since Slice 1, both repos' integration branch for this roadmap is `dev-agentic`** (user instruction, 2026-08-02) — feature branches cut from and merge into `dev-agentic`, not `dev-non-test`/`develop`/`main`.
- ~~The local backend checkout is on `main`…~~ **Resolved in Slice 1** — both checkouts have been on `dev-agentic` since.
- **`useRealApi` stays committed as `false`** until Slice 10. Every wired service keeps its mock path working unchanged so a fresh clone runs with no backend.
- **Wire format:** `camelCase` JSON; enums as lowercase `snake_case` strings; dates ISO 8601 UTC; money as integer minor units via the `Money` value object; IDs opaque strings.
- **Errors:** RFC 9457 Problem Details via `GlobalExceptionHandler`. New endpoints throw `ValidationException` / `NotFoundException` / `ForbiddenException` / `ConflictException` / `DomainException` — never return bespoke shapes. `AuthController`'s legacy shapes are out of scope for this roadmap.
- **Backend tests:** every new endpoint gets integration tests in `tests/Heavenly-Job.IntegrationTests/`, `[Collection(DatabaseCollection.Name)]`, each test seeding uniquely-keyed rows (`UniqueEmail("prefix")`). Run with `dotnet test`. The suite is **215 tests** as of 2026-08-06 and must stay green.
- **Frontend tests:** Karma + Jasmine (`ng test`). **40 specs** as of 2026-08-06 (was 1 when this roadmap was written). New specs go beside the file they cover.
- **Portal modularity:** nothing under `Application/Features/ServicesPortal/` may reference `Job`, `JobApplication`, or `JobDomain` types, and jobs code may not reference ServicesPortal types. `Vendor.UserId → users.id` is the only permitted cross-module FK.
- **Sealed bidding is structural, not a display rule.** Vendor-facing DTOs must have no field capable of carrying another vendor's figures; a rival's bid is `404`, never `403`.
- **Frontend service pattern:** each real-API client is a thin typed `*ApiService` in `src/app/core/api/services-portal/` plus a `*-api.models.ts` of wire DTOs. Existing stateful services keep every mock method unchanged and gain `*Async` siblings that branch on `environment.useRealApi`.
- **Race-condition rule (learned three times in F2.1–F2.4):** never snapshot service state in `ngOnInit()` when an async refresh may still be in flight. Derive page state with `computed()` against the service's own signals.
- **Commits:** conventional-commit prefixes (`feat:`, `fix:`, `docs:`, `chore:`), one commit per completed step group, on a feature branch per slice.
- **`docs/BACKLOG.md` is updated at the end of every slice**, not retroactively — that is the project's stated working rhythm.

---

## Decisions taken during brainstorming

These were open questions; they are now settled and the slices below assume them.

| # | Decision | Rationale |
|---|---|---|
| D1 | **Admin bootstrap = config-seeded admin + role-grant endpoint.** Startup seeds one `Admin` from configuration if absent; an authenticated `Admin` can grant/revoke `ServiceAdmin` on any user. | Nothing in the codebase can create an admin today (`RegisterUserCommandValidator` blocks `UserType.Admin`), so every `/api/service-admin/**` route is unreachable and unverifiable. Config seeding works identically in dev, CI and prod; the grant endpoint means adding an admin doesn't need a redeploy. |
| D2 | **Build backend evaluation scoring to match the mock UI.** New `BidEvaluation` aggregate: criteria scores, overall score, disqualification, value score, negotiation notes, comparison projection. | The `Bid` entity has a status machine only. Trimming the UI would discard a workspace that is already designed and built; wiring status-only would leave the scoring panels on `localStorage` indefinitely. |
| D3 | **Tender draft generation is a deterministic server-side template**, exposed behind `ITenderDraftGenerator`, and the UI label changes from "AI-generated draft" to "Suggested draft". | The mock's `getAIDraft` is a hand-written template already. A real model call would add a secret, per-review cost, latency on the review screen, non-determinism in tests, and would still need a template fallback. The interface seam keeps a model-backed implementation available later. |
| D4 | **Publish happens immediately; the schedule + notification toggles are removed from the publish screen.** | `POST /api/service-admin/tenders/{id}/publish` takes no body, and there is no delivery channel to notify anyone through — email verification (B7) is unbuilt and SMS is blocked on DLT registration (Y5). Shipping controls that silently do nothing is worse than not shipping them. Re-add when a notification channel exists. |
| D5 | **Award notification toggles (`notifyWinner` / `notifyOthers` / `notifyRequester`) are removed for the same reason.** `awardJustification` maps to the existing `Note` field; `contractAmount` is not sent — the backend snapshots the winning bid amount deliberately so the commercial record cannot drift. | Same missing-channel argument. The amount decision is already made and defended in `Award.cs`. |
| D6 | **Saved tenders, "not interested", and per-tender bid status stay mock-only** where they have no endpoint, except bid status which Slice 4 sources from the real Bid API. | Already the documented position in F2.4; saved/dismissed genuinely have no persistence story and are not worth inventing one for in this round. |

---

## Slice sequence

Ordered so that each slice removes a constraint on the ones after it. Ten slices; each ends with a browser-verified deliverable and a `docs/BACKLOG.md` update.

```
1  Admin bootstrap + silent refresh      ✅ DONE 2026-08-02  (B11, F1)
2  Vendor verification queue + review     ✅ DONE 2026-08-03  (F2.5, F9) + post-merge review 08-06 (F16)
3  Model divergences + async convention   ◀── NEXT  (F5, F10, F12, F17)
4  Bid submission + my bids
5  Admin request queue + review
6  Tender create / publish / clarifications
7  Evaluation scoring backend
8  Evaluation frontend
9  Awards
10 Flip the flag + full-pipeline pass
```

**Status as of 2026-08-06.** Slices 1 and 2 are merged into `dev-agentic` on both repos and pushed. Slice 2 additionally went through a four-reviewer post-merge audit, which found and fixed one Critical (F16 — a granted `ServiceAdmin` could not open `/management` at all, because the frontend guard checked `userType` where the backend checks roles) and logged F17–F19. **One item from Slice 2 remains genuinely unverified: the plan's own Task 8 Step 4 item 7 — "log in as the approved vendor and reach `/vendor-dashboard`" — was never performed.** It is the step the plan calls *the gate*. Slice 4 depends on a verified vendor being able to act, so confirm it before or during Slice 4 rather than assuming it.

---

### Slice 1 — Admin bootstrap (B11) + silent token refresh (F1)

**Plan file:** [`2026-08-02-slice-1-admin-bootstrap.md`](2026-08-02-slice-1-admin-bootstrap.md) — full task detail.

**Why first:** every `/api/service-admin/**` route is `[Authorize(Roles = "ServiceAdmin,Admin")]` and no such account can be created. Until one exists, slices 2 and 5–9 cannot be wired *or* verified, and the F2.4 vendor happy path stays untested. Silent refresh rides along because every subsequent verification session runs longer than the 60-minute access-token lifetime.

**Backend delivers**
- `AdminSeedSettings` bound from `AdminSeed:*`; `AdminSeeder` hosted startup step that creates one `Admin` user + `user_roles` row if the configured email is absent, and is a no-op otherwise. Never overwrites an existing account's password.
- `GET /api/admin/users?email=` — find a user to promote (Admin only).
- `POST /api/admin/users/{userId}/roles` `{ role }` — grant, records `GrantedBy`.
- `DELETE /api/admin/users/{userId}/roles/{role}` — revoke, refuses to remove a user's primary `UserType` and refuses to remove the last `Admin`.

**Frontend delivers**
- `authInterceptor` catches 401 on non-auth endpoints, calls `POST /auth/refresh` **once**, retries the original request with the new token, and only clears + redirects if the refresh itself fails. Concurrent 401s share one in-flight refresh (single-flight via `shareReplay`), so ten parallel dashboard calls don't fire ten refreshes and rotate the token out from under each other.
- `auth.interceptor.spec.ts` — the first real frontend test.

**Verification gate:** seed an admin locally, log in as it, promote a second account to `ServiceAdmin`, and call `GET /api/service-admin/vendors` successfully. In the browser: let an access token expire (or hand-corrupt it), make a request, and watch it refresh and retry instead of bouncing to `/login`.

---

### Slice 2 — Vendor verification queue + review (F2.5, F9)

**Screens:** `/management` Vendors tab, `/management/vendors/:id`
**Endpoints:** `GET /api/service-admin/vendors` · `GET .../{vendorId}` · `POST .../{vendorId}/approve|reject|suspend|reinstate`
**Files:** create `src/app/core/api/services-portal/vendor-admin-api.{service,models}.ts`; modify `src/app/core/services/vendor-admin.service.ts`, `src/app/features/management/vendors/vendor-review.page.ts`, and the management page's vendors tab.

**Why second:** this is what makes a *verified vendor* exist through the UI. It closes the gap F2.4 recorded honestly — that the vendor tender-browse happy path could not be verified because verification required a raw DB write. Everything from Slice 4 on depends on having one.

**Also in this slice — F9.** `VendorAdminService.updateStatus()` currently permits any status from any other. The server enforces reject-only-from-pending, suspend-only-from-verified, reinstate-only-from-suspended, approve-from-pending-or-rejected. Once wired, illegal transitions start returning 409 instead of silently succeeding, so the client must offer only the legal actions for the current status. Add a pure `legalVendorActions(status)` helper with its own spec — it is exactly the kind of rule that drifts if it lives in a template.

**Verification gate:** register a vendor through the real signup, see it appear in the queue with correct per-status counts, approve it, and confirm the vendor passes `vendorVerifiedGuard` into the portal — then confirm the disallowed buttons are absent for each status.

---

### Slice 3 — Model divergences (F5, F10) + the async UI convention (F12, F17)

**Plan file:** [`2026-08-06-slice-3-model-divergences.md`](2026-08-06-slice-3-model-divergences.md) — full task detail.

**Files:** `src/app/features/dashboard/vendor-dashboard/vendor-dashboard.model.ts`, `src/app/core/models/service.model.ts`, `src/app/features/management/management.model.ts`, `src/app/core/services/service-auth.service.ts`, `src/app/core/utils/request-state.ts` *(new)*, the two `features/management/vendors/` screens, plus every consumer the compiler flags.

**Why here:** Slice 4 sends and receives `BidStatus` values over the wire, and adds three more async screens. Wiring bids before fixing the enums bakes a translation layer into the API client — precisely what the wire-format conventions exist to avoid. Adding three screens before the busy/loading/error convention exists means retrofitting five screens later instead of two now.

> ⚠️ **This section was written before Slices 1–2 shipped, and three of its original claims were wrong.** Corrected 2026-08-06 after verifying against the code; the detail and evidence are in the plan file's "Context" section.
> - `vendor.model.ts`'s `BidStatus` is **already canonical**. The divergent copy is an inline union in `vendor-dashboard.model.ts:23`.
> - `BudgetVisibility` and `TenderType` are **not duplicated** — they exist only in `management.model.ts`. Only `ServiceCategory` and `RequesterType` are declared twice.
> - The two `ServiceRequest` types are **not** one concept declared twice. The backend deliberately models three shapes (`ServiceRequestDto`, `ServiceRequestAdminDto`, `ServiceRequestSummaryDto`); two client types is correct, and sharing the bare name is the defect. The slice **renames** rather than merges.
>
> It also **missed** a divergence that would have bitten Slice 5: `management.model.ts`'s `ServiceRequestStatus` has a phantom `rejected` (no such server state — the admin actions are start-review/approve/request-changes/close) and is missing `cancelled`, which the server does send.

**Delivers**
- `VendorBid.status` uses the canonical `BidStatus`, matching `Domain/Enums/BidStatus.cs`.
- `ServiceRequestStatus` matches `ServiceRequestStatus.cs` — phantom `rejected` gone, `cancelled` present.
- Management's request type renamed `AdminServiceRequest`, so an import from the wrong module is a compile error rather than a silent shape mismatch.
- `ServiceCategory` / `RequesterType` declared once; `'organization'` deleted. `BudgetVisibility` / `TenderType` moved to core for Slice 6.
- The requester address collapses from `address` / `businessAddress` / `registeredAddress` to one `address`, matching what B2.3 has always returned.
- **New:** `core/utils/request-state.ts` — the one `{ loading, error, begin/isCurrent/succeed/fail }` primitive, applied to the vendor queue and review screens. Closes F12, and F17's loading/error/409 halves.

**Verification gate:** `npx ng build` clean, the full spec suite green, the already-wired screens still working against the real API — and two things no unit test can prove: a **stopped backend** produces an error state rather than a fabricated "0 pending / no vendors here", and a **double-clicked Approve** produces exactly one POST.

---

### Slice 4 — Bid submission + my bids (F2.6)

**Screens:** E4 `/vendor/tenders/:id/bid`, E5 `/vendor/bids`, E6 `/vendor/bids/:id`
**Endpoints:** `GET|PUT /api/bids/drafts/{tenderId}` · `POST /api/bids/tenders/{tenderId}` · `GET /api/bids/mine` · `GET /api/bids/mine/stats` · `GET /api/bids/{bidId}` · `POST /api/bids/{bidId}/withdraw`
**Files:** create `bid-api.{service,models}.ts`; modify `src/app/features/vendor/vendor.service.ts` and the three pages.

**Notes that will bite if missed**
- **Use `core/utils/request-state.ts` for all three screens' loading/error/in-flight states** — Slice 3 built it precisely so these three don't each invent their own. A screen that hand-rolls a `loading` boolean here is a review finding, not a style preference.
- Bid drafts are keyed by `tenderId`, exactly like service-request drafts are keyed by `serviceId`. The same substitution F2.3 used applies: the opaque draft handle in the UI *is* the tender id.
- Submission is gated server-side on window + eligibility + no-duplicate. `confirmEligibility` is an attestation, not the check — a vendor who ticks it but lacks required insurance still gets refused, and the UI must surface that refusal rather than assuming success.
- Withdrawal is only legal while the bid window is open; after that the endpoint 409s. Hide the control rather than letting it fail.
- `GET /api/bids/mine/stats` replaces the vendor dashboard's four separately-computed counters with one call.
- Per-tender bid status (`getMyBidStatus`) moves from mock to the real Bid API here — the one D6 exception.

**Verification gate:** as a verified vendor, draft a bid across page reloads, submit it, see it in `/vendor/bids` with the right status, open the detail, withdraw it while the window is open, and confirm the withdraw control disappears once closed.

---

### Slice 5 — Admin service-request queue + review (F2.7)

**Screens:** F1 `/management` service-requests tab, F2 `/management/review/:id`
**Endpoints:** `GET /api/service-admin/service-requests` (+ counts) · `GET .../{requestId}` · `POST .../{requestId}/start-review|approve|request-changes|close`
**Files:** create `service-request-admin-api.{service,models}.ts`; modify `src/app/features/management/service-request-management.service.ts` and `review/service-request-review.page.ts`.

**Also in this slice — D3, the tender draft generator.** Backend: `ITenderDraftGenerator` + `TenderDraftGenerator` producing a `TenderDraftDto` from an approved request's `formData`, exposed as `GET /api/service-admin/service-requests/{requestId}/tender-draft`. Frontend: `getAIDraft()` is replaced by a call to it, and the panel is relabelled "Suggested draft".

**Notes**
- `internalNotes` must never reach the requester — the backend asserts this in tests; the admin UI is the only place it may be shown.
- The changes-required round trip works on the *same* request: same id, same number, same history, review note cleared on resubmit. The UI must not create a new request.
- Requester contact details on the admin DTO are a join, not stored columns — they are read-only in this screen.

**Verification gate:** submit a request as a requester, see it in the admin queue with correct counts, start review, request changes, watch the requester's `/my-requests` reflect it, resubmit, then approve — all on one request row.

---

### Slice 6 — Tender create / publish / clarifications (F2.8)

**Screens:** F3 `/management/publish/:id`
**Endpoints:** `GET /api/service-admin/tenders` · `GET .../{tenderId}` · `GET .../by-request/{serviceRequestId}` · `POST .../` · `PUT .../{tenderId}` · `POST .../{tenderId}/publish|close|cancel` · `GET .../{tenderId}/clarifications` · `POST .../clarifications/{clarificationId}/answer`
**Files:** create `tender-admin-api.{service,models}.ts`; modify `src/app/features/management/service-request-management.service.ts` (tender half) and `publish/tender-publish.page.ts`.

**Notes**
- Publishing is gated on a coherent bid window and on budget figures matching the visibility setting; a 400 here is a real validation failure and must bind to the offending field, not toast generically.
- Publishing also moves the source request to `published` — the UI must not issue a second call to do that.
- A published tender cannot be edited. The edit affordance must disappear on publish, not fail on save.
- Clarification answers are public to all bidders and the asker is never named. Pending questions are hidden from vendors but visible here.
- **D4 applies:** delete the schedule and notification controls from this screen.

**Verification gate:** create a tender from an approved request, edit it as a draft, fail a publish deliberately (bid window in the past) and see the field-level error, fix and publish, then answer a vendor's clarification and confirm it appears in the vendor's tender detail without the asker's identity.

---

### Slice 7 — Evaluation scoring backend (B12)

**The one genuinely new backend aggregate in this roadmap.** Write its plan file at the **start of Slice 6**, one slice ahead of implementation — it is the item most likely to overrun, and a slice of lead time means implementation starts from a settled shape rather than a blank page. `evaluation.model.ts` is already a complete specification of what it must carry, so the design work is reconciliation, not invention.

**Delivers — `BidEvaluation`**, one per bid, owned by the tender's evaluation flow:
- Technical scoring: `complianceScore`, `experienceRating`, `technicalApproachRating`, `timelineRating`, derived `overallScore`, `notes`, `status` (`draft | submitted`), `evaluatedById`, `evaluatedAt`.
- Disqualification: reason (`non_compliance | missing_documents | inadequate_experience | unrealistic_timeline | eligibility_issue | other`) + mandatory explanation. Disqualifying is a terminal technical verdict, distinct from rejecting the bid.
- Commercial: `valueScore`, set only once the technical phase is complete.
- Negotiation: append-only notes with `channel` (`phone | email | meeting | video | platform`), optional `negotiatedAmount`, actor and timestamp.
- Comparison projection returning the shape `BidComparison` needs, computed server-side so two admins comparing the same tender see identical numbers.

**Endpoints** under `/api/service-admin/evaluations`: get/save/submit a technical evaluation, disqualify a bid, set a value score, add a negotiation note, and get the comparison matrix for a tender.

**Sealed-bid rules extend, they do not relax**
- The existing rule stands: reading or evaluating a tender's bids is **409 while the bid window is open**.
- New rule: **commercial figures and `valueScore` are unavailable until every submitted bid has a technical verdict** (submitted evaluation or disqualification). The `commercialStatus` states (`sealed | opened | evaluated`) are server-owned, and the sealed state must be enforced by the DTO type having no commercial field — same structural technique B2.5 used for budget visibility. A boolean guard is not a seal.
- `overallScore` is computed server-side from the four ratings. A client-supplied overall score is ignored, not trusted.

**Verification gate:** integration tests covering each transition plus the seal (a request for commercial data mid-technical-phase returns a DTO with no commercial fields, and the figures appear nowhere in the payload), then a live pass creating two bids and scoring both.

---

### Slice 8 — Evaluation frontend (F2.9)

**Screens:** F4 `/management/evaluation`, F5 `/management/evaluation/:id`, F6 `…/:id/technical/:bidId`, F7 `…/:id/commercial/:bidId`
**Files:** create `evaluation-api.{service,models}.ts`; modify `src/app/features/management/evaluation/evaluation.service.ts` and the four pages.

**Notes**
- `EvaluationPhase` is derived from tender status + bid verdict counts. Derive it server-side and send it, rather than recomputing in the client from partial data — two screens currently compute it independently.
- The commercial screen must handle "sealed" as a *first-class rendered state*, not an error. When the API returns a DTO with no commercial fields, that is the correct answer, and the screen shows the seal.
- Bid counts on the live-tenders dashboard come from `GET /api/service-admin/bids/tenders/{tenderId}/count`, which stays available while the window is open — that is deliberate, it says how contested the work is without revealing a price.

**Verification gate:** walk a tender with two bids from bid-close through technical scoring, disqualify one, open commercials, set value scores, shortlist, and confirm the comparison matrix matches what the API returns.

---

### Slice 9 — Awards (F2.10)

**Screens:** admin award action on the evaluation screen; vendor awards list; requester award view on the request detail.
**Endpoints:** `POST /api/service-admin/awards/bids/{bidId}` · `GET /api/service-admin/awards` (+ `by-tender`) · `POST .../{awardId}/start|complete|cancel` · `GET /api/awards/mine` · `GET /api/awards/{awardId}` · `GET /api/service-requests/{serviceRequestId}/award`
**Files:** create `award-api.{service,models}.ts`; modify `evaluation.service.ts`, `vendor.service.ts`, and the requester request-detail page.

**Notes**
- Awarding is one transaction: winner awarded, every other live bid rejected, tender marked awarded, award created. The UI issues **one** call and refreshes; it must not try to reject losers itself.
- Losing bids carry a deliberately generic reason. Do not surface a "why did I lose" affordance that the API cannot answer.
- A losing vendor gets 404 on the award and never learns the winning amount. The requester sees it in full.
- Completing or cancelling an award closes the underlying request — the UI must reflect that without a second call.
- **D5 applies:** drop the notification toggles; map `awardJustification` to `Note`; do not send `contractAmount`.

**Verification gate:** award one of two bids, confirm the loser sees `rejected` with the generic reason and 404s on the award, confirm the requester sees the award in full, then start → complete it and watch `activeProjects` go 1 → 0 while `wonBids` stays 1.

---

### Slice 10 — Flip the flag and walk the pipeline

**Delivers**
- `useRealApi` default reviewed: keep committed `false` for a no-backend clone, and add `src/environments/environment.development.ts` (or an `angular.json` `fileReplacements` entry) so `ng serve` uses the real API without an uncommitted edit. This removes the recurring "don't commit the flag flip" hazard.
- One documented end-to-end browser pass: requester submits → admin reviews and approves → admin creates and publishes a tender → verified vendor browses, asks a clarification, and bids → admin evaluates and awards → vendor and requester both see the award → admin completes it.
- `docs/BACKLOG.md` rewritten to reflect the new state; `docs/backend/00-SCREEN-INVENTORY.md` API-status column brought up to date.
- Open items explicitly carried forward, not silently dropped: B3 password reset, B7 email verification, B8 rate limiting, B10 file upload (which still blocks vendor documents), F3 auth-store collapse, F4 login simplification, F6 design-system consolidation, and the Supabase password rotation.

---

## Risks and how each is contained

| Risk | Containment |
|---|---|
| **Slice 7 (evaluation backend) overruns.** It is the only greenfield aggregate and lands late. | Write its plan file during Slice 6, so implementation starts from a settled shape. If it still overruns, Slice 9 (awards) can be pulled ahead of 7–8 without breaking anything — awarding a bid depends on bid status, not on scoring. |
| **The seal leaks.** Commercial figures reaching a client before the technical phase closes is the most damaging possible bug here. | Enforce structurally: sealed DTOs are a separate type with no commercial field, so the compiler guarantees it. Assert absence of the figures in the raw payload, not just the flag. |
| **Guard/rehydration races.** Three were found in F2.1–F2.4; the audit was never completed app-wide. | Every slice that touches a guarded page derives state via `computed()`, never a one-time read in `ngOnInit()`. Slice 2 is the natural place to sweep the remaining admin pages since it is the first admin slice. |
| **`main` vs `develop` confusion on the backend.** The local checkout is on `main` with no ServicesPortal code; running the API from it would appear to delete half the product. | Slice 1 Task 1 switches it and verifies the ServicesPortal controllers are present before anything else runs. |
| **Supabase credentials are in an archived chat transcript.** | Rotate in Slice 1 alongside the admin-seed secret, since both are `dotnet user-secrets` operations on the same connection. |
| **Wiring reveals backend bugs.** It has every single time — the non-idempotent draft delete, the missing requester `email`/`phone`, the JWT key divergence. | Budget for it: each frontend slice may include a small backend fix + regression tests. That is the process working, not scope creep. |

---

## What this roadmap deliberately excludes

Named so their absence is a decision rather than an oversight:

- **Jobs portal** (C1–C4) — a separate bounded context, independently buildable.
- **Deployment** (Cloud Run + Cloud SQL, Y1) — a phase of its own, and billable; the provisioning script is ready and unrun.
- **B10 file upload (GCS signed URLs)** — vendor documents and bid/tender attachments stay non-persisting with an explanatory toast, as F2.1 already ships them. This is the largest known hole left at the end of Slice 10.
- **B3 password reset, B7 email verification, B8 rate limiting** — real gaps, but none blocks the pipeline.
- **F3 auth-store collapse, F4 login simplification, F6 design-system consolidation** — quality work that would churn every screen this roadmap touches. Cheaper after.
- **Contact form and service-catalogue endpoints** — public marketing surface, unrelated to the portal pipeline.
- **A frontend test suite beyond the specs each slice adds.** Slices 1–3 seed the habit (interceptor, transition rules, model invariants); a broader suite is its own project.
