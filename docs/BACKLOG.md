# Heavenly — Consolidated Backlog

**Last updated:** 2026-08-11 · **Maintained on the go** — updated after every coding iteration, not retroactively.

Single source of "what's left" across both repos. Detail lives in the linked docs; this file is the prioritised index.

- **Frontend:** `aashin10/Heavenly` — **`dev-agentic`** ← feature branches (was `dev-non-test`; changed at Slice 1 by user instruction, 2026-08-02)
- **Backend:** `aashin10/Heavenly-Job-Backend` — **`dev-agentic`** ← feature branches (was `develop`; same change). `main` remains the eventual target for both, untouched by this roadmap.

> The services-portal completion work is tracked as a slice-by-slice roadmap: [`docs/superpowers/plans/2026-08-02-services-portal-roadmap.md`](superpowers/plans/2026-08-02-services-portal-roadmap.md). This file stays the prioritised index; the roadmap has the sequencing, the file-level detail, and the decisions behind it.

**Status legend:** 🔴 blocker · 🟠 high · 🟡 medium · 🟢 low · 🔵 needs *your* decision/action

---

## Current state (verified, not assumed)

| | Status |
|---|---|
| Frontend UI | **Feature-complete on mocks.** All 4 UI sets shipped; 14 dead links fixed; 0 raw hex; 0 emoji; real 404 |
| Jobs-portal auth | **Live end-to-end.** Angular → .NET 10 → Postgres 16. Login/signup/`me`/`refresh`/`logout` all verified |
| Services portal | **Auth, profile editing, the request wizard, tender browsing, and vendor verification wired to the real API** (F2.1–F2.5, behind `useRealApi`, committed `false`). A vendor can be verified through the real admin UI for the first time. Bid submission, evaluation, and award screens still on `localStorage`. Backend: **B2 COMPLETE** — request → tender → bid → award runs end to end |
| Admin surface | **Unblocked (B11) and in use (F2.5).** A `ServiceAdmin`/`Admin` account can exist, be granted, and now actively verifies vendors through `/management` — every `/api/service-admin/vendors` route live-verified for **both** roles (F16 closed the gap where a granted `ServiceAdmin` specifically couldn't reach the screen at all, live-verified 2026-08-06) |
| Dependencies | **0 vulnerable packages** (verified 2026-07-26) |
| Tests | **215 backend integration tests**, Testcontainers-backed, self-contained. **55 frontend specs** (interceptor, token-refresh coordinator, `legalVendorActions`, `VendorAdminService` mock transitions and real-API sequencing, `request-state`'s per-instance sequencing, the vendor queue's conditional columns and load states, the review page's reason panel and in-flight guard, `AuthService.isAdmin` role-vs-userType, plus the app-shell specs) |

---

## What's next (reviewed 2026-08-11)

Full inventory last taken while planning Slice 3; updated now that it's shipped. The roadmap sequences the services-portal work; this is everything open, including what the roadmap does *not* cover.

**Done — Slice 3 (2026-08-11):** F5 (model divergences), F10 (requester address), F12 (in-flight guard, with a caveat — see its entry below), F17's loading/error/409 halves. → [`plan`](superpowers/plans/2026-08-06-slice-3-model-divergences.md)

**Scheduled — later roadmap slices:** F2.6 bids (Slice 4) · F2.7 admin request queue + D3 tender-draft generator (Slice 5) · F2.8 tenders (Slice 6) · D2 evaluation backend (Slice 7) · evaluation frontend (Slice 8) · awards (Slice 9) · flip `useRealApi` (Slice 10).

**Open, unscheduled, and worth a decision before Slice 10 flips the flag:**

| Item | Why it matters now |
|---|---|
| 🟠 **F3** collapse the two auth stores | F11 cannot be fixed without it, and F16's fix — while live-verified — is a *second* place admin identity is decided. The longer two stores exist, the more places learn to consult the wrong one. |
| 🟠 **F11** interceptor's session-clear is incomplete | Dormant only because `useRealApi` is `false`. On a failed refresh a jobs-portal user enters a redirect loop. **This becomes live the moment Slice 10 flips the flag** — it is the single most important thing to fix before then. |
| 🟠 **B3** password reset endpoints | No self-service recovery exists. Every forgotten password is a manual DB action today. |
| 🟡 **F18** queue truncates at 100 | Silent, and beside a total that contradicts it. Bites the first time a real deployment has >100 pending vendors. |
| 🟡 **F14** `getVendorAsync` can't tell 404 from 403/500 | **Checked, not closed:** Slice 3's 409 work touched only `decide()`, never `getVendorAsync` itself. Still open. |
| 🟡 **B7** email verification / 🟡 **B8** rate limiting | Both are launch-blockers rather than roadmap items: `EmailVerified` is never set true, and auth endpoints are unthrottled (brute-force + enumeration exposure). |
| 🟢 **B10** file upload (GCS signed URLs) | Blocks the vendor documents section, which currently explains itself rather than persisting. Also blocks B13's document count being meaningful. |
| 🟡 **B5** `/register` returns tokens · 🟡 **B6** Problem Details tail · 🟢 **B9** don't auto-migrate prod · 🟢 **B13** queue document count | Small, independent, no dependencies. |
| 🟡 **F4** simplify login · 🟡 **F6** design-system consolidation · 🟢 **F7** settings page · 🟢 **F8** skeleton loaders · 🟢 **F15**/🟢 **F19** | UI polish and small correctness items; none blocks anything. |

**Not a backlog item but the most urgent thing on this page:** the 🔴 credential rotation under **NEEDS YOU** — still outstanding.

---

## BACKEND

### ✅ B1. Account roles foundation — `UserRole` + extended `UserType` — **DONE 2026-07-26**
`UserType` extended with `ServiceRequester`/`Vendor`/`ServiceAdmin`; new `user_roles` table (unique on `user_id`+`role`, cascade delete) is the authoritative set, with `User.UserType` retained as the *primary* role so existing queries and JWT role claims keep working. Migration backfills a role row for every pre-existing user; registration seeds one for new users. `roles[]` now flows through login, `/me` and `/refresh`.
**Verified live:** migrated + new users return `roles`; a single account holding `['employer','service_requester']` proves multi-role works; duplicate role rejected by the constraint; no regressions across the auth suite or the AutoMapper endpoints.
→ branch `feature/account-roles`

### ✅ B2. Services-portal domain — **COMPLETE 2026-07-29**
The big greenfield, taken one aggregate at a time. Depends on B1.
→ [02](backend/02-API-VENDOR-DASHBOARD.md) · [04](backend/04-API-SERVICE-REQUESTS.md)

| | Aggregate | Status |
|---|---|---|
| B2.1 | **Vendor** (+documents, portfolio, bank, verification audit) | ✅ **DONE 2026-07-26** |
| B2.2 | Vendor **API slices** — register, profile read/update, admin verify queue | ✅ **DONE 2026-07-27** |
| B2.3 | `ServiceRequester` | ✅ **DONE 2026-07-27** |
| B2.4 | `ServiceRequest` (+drafts, events) | ✅ **DONE 2026-07-27** |
| B2.5 | `Tender` (+clarifications) | ✅ **DONE 2026-07-27** |
| B2.6 | `Bid` (+drafts, sealed bidding, evaluation) | ✅ **DONE 2026-07-29** |
| B2.7 | `Award` (+work tracking) | ✅ **DONE 2026-07-29** |

**B2.7 detail — 12 endpoints.** `/api/awards` (vendor), `/api/service-requests/{id}/award` (requester), `/api/service-admin/awards` (award a bid, list, start/complete/cancel).
- **Awarding is one transaction** touching four things: winner awarded, every other live bid rejected, tender marked awarded, award created. A partial application would leave two vendors both believing they won.
- Losing bids get a **deliberately generic** reason — why one bid beat another is commercially sensitive to the winner — but they *are* rejected, since that's the only thing telling those vendors the outcome.
- 🔒 **Sealed bidding survives the award**: a losing vendor gets 404 on it and never learns the winning amount. The requester sees it in full — they're paying for the job.
- **`activeProjects` finally has a real definition** (doc 02 §7's open question): awards in `accepted`/`in_progress`. Counted from the award, so a finished job stops counting at sign-off — verified live 1 → 0, with `wonBids` staying 1.
- **Completing/cancelling closes the underlying request** — the three describe one job, and a request left `published` after delivery sits in the requester's list forever.
**Verified:** 18 tests + full pipeline walked live (`SR-2026-00004 → TND-2026-00003 → 2 sealed bids → AWD-2026-00001 → completed`).

**B2.6 detail — 13 endpoints.** `/api/bids` (draft, submit, my bids, my stats, detail, withdraw) and `/api/service-admin/bids` (per-tender list, count, start-review/shortlist/reject).
- 🔒 **Sealed bidding is structural.** No DTO shows one vendor another's bid and no vendor-facing route could return one — every query is scoped by the caller's own vendor id *in the same WHERE clause as the bid id*, so a rival's bid is **404, never 403** (its existence isn't confirmed either). Verified live.
- 🔒 **Evaluators are held to it too**: reading or evaluating a tender's bids is **409 while the window is open**. Scoring bids as they arrive judges early bidders against a different field than late ones. The **count** stays available — it says how contested the work is without revealing a price.
- **Submission gated server-side** on window + eligibility + no-duplicate. `confirmEligibility` is the vendor's attestation, not the check — a vendor lacking required insurance is refused even when they tick it.
- **Withdrawal only while open** — afterwards a vendor could read the room and leave once evaluation began.
- **Rejection requires a reason**; `internalNotes` never reaches the vendor.
- Adds **`hasBid` + `bidCount`** to tender cards (2 queries per page, not per row) and the **vendor dashboard's four counters** as one call.
**Verified:** 29 tests + full live pass against Supabase.

**B2.5 detail — 14 endpoints.** `/api/tenders` (browse matched, detail with eligibility verdict, ask clarification) and `/api/service-admin/tenders` (list, create from approved request, edit draft, publish/close/cancel, clarifications Q&A).
- 🔒 **Budget visibility is an access rule, not a display hint.** The vendor-facing DTOs have **no field** for a withheld figure — they're separate types from the admin DTO, so the compiler guarantees it rather than a reviewer. `hide` → budget is `null`; `show_range` → the exact figure is withheld too. Verified live that the numbers appear nowhere in the vendor payload.
- **Publishing is gated** on a coherent bid window (exists, ends after it starts, not already past) and budget figures matching the visibility setting. It also moves the request to `published` — the two states describe one fact.
- **A published tender can't be edited** — vendors have priced against its scope.
- **Matching is capability AND area**, both translating to `= ANY(...)` over the GIN-indexed vendor arrays.
- **Eligibility returns every failure**, not the first — otherwise a vendor fixes one thing, rechecks, and is told the next.
- **Clarification answers are public to all bidders** (a private answer is an unfair advantage) but **the asker is never named**, and pending questions are hidden from vendors.
**Verified:** 28 tests + full live pass against Supabase.

**B2.4 detail — 14 endpoints.** `/api/service-requests` (drafts CRUD, submit, mine, detail, cancel) and `/api/service-admin/service-requests` (queue + counts, detail, start-review/approve/request-changes/close).
- **Drafts are their own table**, not a request with status `draft` — an unfinished form must not enter the admin queue, hold a request number, or live forever. One draft per service per requester (unique index); expiry runs from last save, so an actively edited draft never lapses.
- **The state machine lives in one table on the aggregate**; every transition consults it, so the pipeline can't drift from the code. Cancel only before a tender exists — after that vendors have bids in flight, so it closes instead.
- **The changes-required round trip works on the same request** — same id, same number, same history, review note cleared on resubmit. Verified live: `submitted → changes_required → submitted` on one row.
- Request numbers (`SR-2026-00001`) come from a **Postgres sequence**, not `max()+1`, which races under concurrent submissions.
- **`internalNotes` never reaches the requester** (asserted by test); requester contact details on the admin DTO are a **join**, not stored columns.
**Verified:** 24 tests + a full live pass against Supabase.

**B2.3 detail.** `/api/service-requesters` — register (all three types), `GET me`, `PUT me`.
- **One table, not table-per-hierarchy.** The frontend types this as a discriminated union, but a requester can **change type** (an individual who incorporates becomes an SME). Under TPH that is a delete-and-recreate, losing the id and all future request history. Type changes now go through `ApplyProfile()`, which clears fields the new type doesn't use before validating what it requires.
- GSTIN required for `large_organization`, optional for `sme` — a large org is always above the registration threshold; an SME may not be.
- Canonical wire value confirmed as `large_organization` (settles F5's divergence server-side).
**Verified:** 22 tests including both directions of type change, plus a live pass against Supabase.

**B2.2 detail — 12 endpoints.** `/api/vendors` (register, `me`, `me/profile-completion`, `me/basic`, `me/services`, `me/bank`, `me/documents`, `me/portfolio`) and `/api/service-admin/vendors` (queue with per-status counts, detail, approve/reject/suspend/reinstate).
- **Ownership is structural, not checked**: every self-service write addresses the profile by the caller's user id from their token. No route or body carries a vendor id, so there is nothing to tamper with.
- **The full bank account number is never returned by any endpoint** — not to its owner, not to reviewing admins. Only the masked tail. Changing it means re-entering it.
- Registration creates account + role + profile + session in **one** `SaveChanges`; a rejected registration leaves no orphaned login.
- The four review actions are **named endpoints**, not one set-status call, so the server owns which transitions exist.
**Verified:** 26 tests, plus a live end-to-end pass against Supabase (register → 40% completion → bank masked → suspend-pending rejected with 409 → approve → verified/canBid).

**B2.1 detail.** `Vendor` is a *profile on a `User` account*, not a second identity — credentials/sessions/roles stay in the auth tables and the `Vendor` entry in `user_roles` grants access, with a unique index enforcing one profile per account. This is what makes F3 (collapse the two auth stores) achievable rather than a rewrite.

Verification transitions are enforced in the domain: reject only from pending, suspend only from verified, reinstate only from suspended, approve from pending *or* rejected (resubmission). **This is stricter than the frontend**, whose `VendorAdminService.updateStatus()` allows any status from any other — see F9.

`service_capabilities`/`service_areas` are native `text[]` + GIN (tender matching is an overlap query); `experience_by_service` is `jsonb`; bank details are owned columns. `GetProfileCompletion()` mirrors `computeProfileSections()` exactly and derives percentage from the section list, so BG6 (ring 75% vs caption "2 of 5") cannot recur server-side.
**Verified:** 23 integration tests against real Postgres; migration applied to Supabase with both GIN indexes, both uniques, `jsonb` and `ARRAY` types confirmed in the live schema.

### 🟠 B3. Password reset endpoints
`PasswordResetToken` entity exists and is migrated, but **no endpoints use it** — a user who forgets their password has no recovery path. Needs request + confirm, single-use, expiring.

### ✅ B4. Integration test suite — **DONE 2026-07-26**
17 xUnit tests over the auth surface via `WebApplicationFactory` + Testcontainers (throwaway `postgres:16` per run, real migrations applied — so migrations are tested too). Covers register/login/me/refresh/logout, roles, wire-format casing, refresh-rotation replay, and every 401 path.
**Found a real bug:** JWT validation params were read *eagerly* off `builder.Configuration` while signing resolved `IOptions` *lazily* — they could diverge ("The signature key was not found"). Both now resolve from the same DI options.
Still to add: unit tests for handlers, and a frontend suite.

### 🟡 B5. `/register` should return tokens
Currently returns `{ userId }` only, so the frontend does register-then-login (two round trips). Returning an `AuthResponse` collapses it to one. Frontend already handles both.

### 🟡 B6. RFC 9457 Problem Details — **mostly done 2026-07-27**
`GlobalExceptionHandler` now maps `ValidationException` → 400 (field-keyed errors), `NotFoundException` → 404, `ForbiddenException` → 403, `AuthenticationException` → 401, `ConflictException`/`DomainException` → 409, as problem details. All new endpoints use it.
**Remaining:** `AuthController` still has its own try/catch returning bespoke `{message}` and `{errors:[]}` shapes, deliberately left alone because the Angular client parses them — migrating needs a coordinated frontend change. Its `409` is still triggered by string-matching an exception message.
→ [03 §2.4](backend/03-EXISTING-BACKEND-REVIEW.md)

### 🟡 B7. Email verification flow
`User.EmailVerified` exists but nothing ever sets it `true`.

### 🟡 B8. Rate limiting on auth endpoints
Login/register/reset are unthrottled — brute-force and enumeration exposure.

### 🟢 B9. Don't auto-migrate production
`Program.cs` auto-applies migrations in Development only (correct today). Keep it that way when Cloud Run deployment lands; apply prod migrations deliberately.

### 🟢 B10. File upload (GCS signed URLs)
Needed for vendor documents + tender attachments. `UploadedFile` entity exists. Sign → client PUTs → notify API. Never proxy bytes.

### ✅ B11. Admin bootstrap — **DONE 2026-08-02**
No `ServiceAdmin` could exist: registration refuses `UserType.Admin` (a past privilege-escalation bug, see B2.2's changelog entry) and nothing seeded one, so every `/api/service-admin/**` route was unreachable — the reason F2.4's vendor happy path could never be verified live. Now: `AdminSeeder` creates one platform `Admin` from `AdminSeed:*` configuration at startup — idempotent, **never** overwrites an existing account's password on re-run (rotating the seed secret alone does nothing once the row exists; rotation needs the row deleted or the email changed too, documented on the class). `POST/DELETE /api/admin/users/{id}/roles` (Admin-only, not ServiceAdmin — a services admin must not be able to mint more admins) lets that Admin find an account and grant/revoke `ServiceAdmin` or `Admin`. Only those two roles are grantable — `Vendor`/`ServiceRequester` are profile-backed and must come through their own registration endpoints, or the granted account would pass `[Authorize]` and 404 on every `me` call. Revoking a primary role or the last `Admin` is refused.
**Verified:** 15 integration tests (13 in the grant/revoke surface, including a test that genuinely drives the last-admin guard to zero rather than incidentally passing through a different guard) + a live pass registering a real vendor through the running API and reaching the verification-pending screen.
→ branch `feature/admin-bootstrap`

### ✅ B12. Reviewer names on the vendor verification timeline — **DONE 2026-08-02**
The admin verification timeline showed `by 0190f2c1-…` — a raw actor id — instead of who actually reviewed the vendor. `VendorVerificationEventDto` gains `ActorName`, resolved by a join against `Users` at read time (never a stored column, so a renamed admin account can't leave the history stale). Populated on admin reads (`GetVendorProfileQuery.IncludeReviewerNames`, `ReviewVendorCommand`'s own response) only — the vendor's own `GET /api/vendors/me` deliberately never gets it, matching every other admin-only field on this DTO.
**Verified:** 2 integration tests (admin sees the name; the vendor's own profile read asserts the field is JSON `null`, not merely unasserted) + confirmed live against the raw network response before the frontend fix below shipped.
→ branch `feature/vendor-admin-reviewer-names`

### 🟢 B13. Admin vendor queue can't show a document count
`GetVendorQueueQuery`/`VendorSummaryDto` don't carry one — loading every vendor's full `Documents` collection in a paged list query is the wrong performance trade for a list view. The frontend queue (F2.5) hides the "Docs" column in real-API mode rather than show a false "0/4". Needs either a lightweight count-only field added to the projection, or a join.

---

## FRONTEND

### ✅ F1. Silent token refresh — **DONE 2026-08-02**
The interceptor used to clear the session and redirect on any 401, hard-logging users out when the 60-minute access token expired mid-session. Now: a `TokenRefreshCoordinator` shares a single in-flight `/auth/refresh` call across every concurrent 401 (the refresh token rotates server-side, so two independent refreshes would consume it out from under each other and log the user out anyway) via `shareReplay`; the interceptor retries the original request once with the fresh token, and only clears + redirects if the refresh itself fails or the retry also 401s. A non-auth failure on the retry (a transient 500, say) propagates to the caller untouched rather than ending the session — the first cut of this code didn't distinguish that case from an auth failure, caught in review before it shipped.
**Verified live** against the running API with the access token shortened to 1 minute: a hard navigation firing two concurrent authenticated calls on an expired token produced exactly **one** `POST /auth/refresh` and both calls succeeded on retry; corrupting the refresh token produced exactly one failed refresh attempt, a clean session clear, and a single redirect to `/login` — no loop either way. 13 new frontend specs (5 coordinator + 8 interceptor), plus 3 pre-existing `app.component.spec.ts` specs fixed along the way (one had silently lacked an `HttpClient` provider for months; another asserted CLI-scaffold boilerplate — an `<h1>` — that the app shell hasn't rendered since a UI rework in December 2025).
→ branch `feature/silent-token-refresh` · [05 §After this works](backend/05-INTEGRATION-RUNBOOK.md)

### 🟠 F2. Services portal → real API
All of it still runs on `localStorage` (`ServiceAuthService`, `DraftService`, `ServiceRequestService`, `VendorAdminService`). Blocked on B1/B2 (both now done). Sequenced per-screen behind the same `useRealApi` flag.

**F2.1/F2.2 done 2026-08-01 — auth + profile editing.** New `VendorApiService`/`RequesterApiService` (+ wire DTOs) mirror the existing `AuthApiService` pattern. `ServiceAuthService` keeps every mock method unchanged for `!useRealApi` and adds `*Async` siblings (`signupVendorAsync`, `loginServiceUserAsync`, `updateVendorProfileAsync`, `addVendorPortfolioEntryAsync`, …) for the real path, plus session rehydration against `GET /me` on boot, mirroring the jobs portal's Stage 6 pattern. Login reuses `/api/auth/login` and checks `roles[]` before granting portal access.
- **Vendor editing wired**: basic info, services, bank details, portfolio add/remove — each verified against a live network request and the profile-completion percentage updating correctly. Documents section deliberately stops short of persisting (shows an explanatory toast) — blocked on B10, no file host exists yet.
- **Requester editing wired**: whole-profile `PUT /me`, type included.
- **Found and fixed a real bug in existing Stage 5/6 code, not new to this work**: `AuthService.rehydrateSession()` (jobs portal) wrote the cached user to `localStorage` but never the login timestamp. The *next* boot read that as a legacy/corrupt session and called `logout()` — which hits the real endpoint and clears the `TokenStore` **shared** with the services portal, silently ending both sessions. It only surfaced now because a vendor/requester is also a valid jobs `User`, the first scenario to exercise real-API rehydration repeatedly across portals. One line (`localStorage.setItem(LOGIN_TIMESTAMP_KEY, …)`) fixes it; verified with repeated clean reproductions before and after.
- **Two route-guard race conditions fixed** (`vendor-profile.page.ts`, `service-requester-profile.page.ts`): guards only check the cached session, not that the async `GET /me` rehydration following a hard navigation has finished. A snapshot taken in `ngOnInit()` could read null and never update — blanking the vendor page, or wrongly redirecting a logged-in requester to `/login`. Fixed by making the profile signals `computed()` against the service's own state instead of one-time reads. This class of guard/rehydration race is **not fully audited elsewhere** — only these two pages were touched.
- **Backend fix**: `ServiceRequesterDto` didn't carry `email`/`phone` (the frontend model requires both; a requester's contact *is* their account, unlike Vendor). Projected from `User` instead of duplicating. `UpdateServiceRequesterProfileCommand` gained an optional `Phone` field with "cannot be blanked out" validation. 2 new regression tests; 191/191 backend tests passing.
- Architectural tension surfaced, not resolved here: two independent auth stores (`AuthService`/`ServiceAuthService`) sharing one `TokenStore` is exactly what F3 exists to collapse — see F3.

**F2.3 done 2026-08-01 — the request wizard.** New `ServiceRequestApiService` (+ wire DTOs) mirrors the same pattern. `DraftService` and `ServiceRequestService` keep every mock method unchanged and add `*Async` siblings, wired into all three wizard forms (technical/mid-complexity/quick-service), the wizard shell page, the preview/submit page, both dashboards' draft & request widgets, and `/my-requests` (list, detail, cancel, edit-and-resubmit).
- **The backend has no "get draft by its own id" endpoint** — only by `serviceId` (which is also what enforces one-draft-per-service server-side). Rather than a routing refactor across three pages, the draft "handle" that flows through `?draftId=` query params is simply the `serviceId` itself in real-API mode — every call site already treats it as an opaque string, so the substitution needed zero page-level changes.
- Save-on-step-change stays fire-and-forget (`void this.saveDraft()`); only the final save before leaving the wizard (`onSubmit`) is awaited, so the preview page can't read a draft missing the last step's answers — the same race-condition class fixed twice already in F2.1/F2.2, caught this time before shipping rather than after.
- **Found and fixed a real backend bug during live verification, not a pre-existing one this time — introduced by this session's own wiring, then fixed in the same pass**: `DELETE /drafts/{serviceId}` threw `NotFoundException` on a missing draft, though it was documented as idempotent (204 either way). This didn't matter until the frontend started calling it right after a successful submit — and the submit endpoint already deletes the source draft server-side as part of that transaction. The follow-up delete always 404'd, and the frontend reported the *entire submission* as failed even though the request had already been created (`201`, visible in `my-requests`). Fixed the handler to be idempotent, matching its own doc; 2 new regression tests. Also removed the now-redundant explicit draft-clear call from the submit success path — both the mock and the real endpoint already guarantee it.
- **The backend's cancel/resubmit rules are broader than the mock's**: `approved` requests are still cancellable server-side, which the mock's status-only `canCancel` never allowed. `canCancel`/`canEditAndResubmit` now take an optional server-computed override (`ServiceRequestDto.isCancellableByRequester`/`isEditableByRequester`), authoritative when present, falling back to the old status check in mock mode.
- Verified end-to-end in the browser against the live backend: fill a 4-step quick-service wizard with real autosave PUTs, resume via a fresh page load, submit, land on the request detail with the correct request number and timeline, appear in `/my-requests`, cancel, and confirm the status/timeline update.

**F2.4 done 2026-08-01 — vendor tender browsing.** New `TenderApiService` (+ wire DTOs) for the vendor-facing surface only (`GET /tenders`, `GET /tenders/{id}`, `POST /tenders/{id}/clarifications`) — deliberately scoped apart from bidding, matching the backend's own B2.5/B2.6 split. `VendorTenderService` (`vendor.service.ts`) keeps every mock method unchanged and gains a real-API path.
- **Different shape from F2.1–F2.3**: `VendorTenderService` already centred on one signal (`tendersSignal`) that every other computed (`filteredTenders`, `stats`, filter options) derives from, rather than exposing synchronous CRUD directly. So real-API wiring for the *list* is a single `refreshTendersAsync()` fired from the constructor (mirrors the session-rehydration pattern) — zero page-level changes needed for `tender-browse.page.ts`'s list rendering, filtering, or sorting.
- **`getFilterOptions()` was a one-time method call in `ngOnInit`, not reactive** — read before the constructor's async refresh resolves, it would freeze on an empty list forever (the exact race class fixed twice already in F2.1/F2.2). Added a `filterOptions` computed signal deriving from `tendersSignal`; the page now reads that instead.
- **The vendor-facing detail endpoint bundles what the mock split into three calls**: eligibility and clarifications are embedded in `GET /tenders/{id}`, not separate lookups. `getTenderDetailBundleAsync()` fetches once and returns all three, replacing three round trips (and three chances to race) with one.
- **Only answered clarifications are ever in the vendor-facing payload** (confirmed by the backend's own test suite) — so after asking a question, the new (pending) clarification is appended to the displayed list from the POST response directly rather than re-fetched, which would silently drop it from view until an admin answers.
- **Saved tenders, "not interested", and per-tender bid status have no backend endpoints at all** — not a gap introduced here, the API was never built with them (bid status is the Bid API's job; saved/dismissed have no persistence story). These three stay mock/localStorage-only regardless of `useRealApi`, noted explicitly in code so a future reader doesn't go looking for a missing endpoint.
- **Verification note**: `GET /api/tenders` requires a *verified* vendor (`vendor.CanBid`), and no self-service path exists to verify one against the live dev database (verification is an admin-only action; creating a live admin account would mean either a raw DB write or a live-DB bypass, both correctly out of reach). Confirmed instead via the backend's own 30 `TenderApiTests` — which already assert the exact JSON field names this session's TypeScript models mirror (`budget.min/max/exact`, `eligibilityResult.eligible/reasons`, `clarifications[].answer` with no `vendorId`) — and via the browser against an *unverified* vendor: the 403 is caught and produces an empty list rather than a crash, and a missing tender correctly toasts "Tender not found" and redirects. The full happy path (a verified vendor seeing real published tenders) is unverified in the browser; low risk given the DTO-level test coverage, but worth a live pass once there's a way to verify a vendor outside the admin UI. **Partly resolved by F2.5, below** — a vendor can now be moved to `verified` through the real admin UI, so a verified vendor can exist without a raw DB write. The remaining half is still unproven: no recorded evidence shows a newly-verified vendor actually reaching `/vendor-dashboard` past `vendorVerifiedGuard` (the plan's own Task 8 Step 4 item 7, the step it calls *the gate*, was not performed — see the 2026-08-06 changelog entry). Verify that before treating this as the unblocker for Slices 4+.

**F2.5 done 2026-08-03 — admin vendor verification queue + review.** New `VendorAdminApiService` (+ wire DTOs) for the six admin endpoints (`GET /vendors` queue, `GET /vendors/{id}`, four decision actions). `VendorAdminService` keeps every mock method unchanged and gains `*Async` siblings; a new `mapVendorDto` (extracted from `ServiceAuthService`, used unchanged, so the admin and vendor-facing views of an account cannot drift) maps both. The queue and review pages are wired to it. **This is the first time in the project a vendor can be verified through the UI rather than a raw database write** — the exact gap F2.4 recorded honestly above, and the prerequisite every screen from here on depends on.
- **Server-authoritative counts.** The client holds one page of vendors; a client-computed count would misreport past 100 total. Counts come from the queue response and are kept in sync after every decision (`adjustServerStats`) without a full requery.
- **Backend gained reviewer names on the verification timeline** (B12: `VendorVerificationEventDto.actorName`) — a join at read time, not a stored column, so it can't go stale, and populated on admin reads only; the vendor's own profile deliberately never gets it.
- **Found and fixed a real integration gap during live verification** — the kind that falls between two tasks on two different branches rather than inside either one: the backend genuinely sent `actorName` in the wire response, but the frontend's copy of `VendorVerificationEventDto` was never updated to declare or read it, so the timeline rendered a raw GUID instead of "Platform Administrator" until this was caught live and fixed on the spot.
- **Found and fixed two real client/server divergences**, both caught in review before shipping: the mock's `reinstate()` set a vendor to `pending`, where the server's `Reinstate` sets `verified` — fixed, and verified live through a full approve → suspend → reinstate cycle ending at `verified`, not back in the queue. And the review screen offered a "Return to Queue" action on **rejected** vendors, which the server refuses with 409 every time (`reinstate` is legal from `suspended` only) — this one was briefly live in the shipped mock-mode app (`useRealApi` committed `false`) between the `reinstate` fix landing and the button's removal, since the mock has no transition validation of its own to catch it; pulled forward as a same-day fix once caught.
- **`legalVendorActions()`** (a pure function, own spec) now mirrors the server's transition rules exactly and drives every button — closes F9, below.
- **Document counts are honestly absent, not wrong.** The admin queue's summary endpoint doesn't carry a per-vendor document count (loading each vendor's full document collection in a paged list is the wrong performance trade), so the "Docs" column is hidden entirely in real-API mode rather than showing a false "0/4". Logged as B13.
- **One known gap not fixed, tracked as F12**: the four decision buttons have no in-flight guard, so a fast double-click can fire the request twice — the first succeeds, the second gets a genuine 409 on top of a decision that actually went through. No `busy`/`loading` pattern exists anywhere in this feature area, so the right fix is a shared convention, not a one-screen patch.
- Remaining under F2: bid submission, evaluation screens, award flows. None started yet.

### 🟠 F3. Collapse the two auth stores (C1)
`AuthService` (jobs) and `ServiceAuthService` (services) are separate, and a user can be signed into both at once. The API models one account with many roles, so these merge once B1 lands. **Upgraded from 🟡 (2026-08-02):** F11 depends on this — `authInterceptor`'s session-clear can't be made complete while there are two independent stores to clear.
→ [UI_ISSUES.md §5](UI_ISSUES.md) · [F11](#-f11-authinterceptors-session-clear-is-incomplete-for-the-jobs-portal)

### 🟡 F4. Simplify login (IA2)
Three decisions before credentials (portal → role → login/signup). With roles on the auth response this becomes one email+password form that routes afterwards. Unblocked by B1.

### ✅ F9. Vendor status transitions are unguarded on the client — **DONE 2026-08-03**
What was actually wrong turned out narrower and more specific than this entry originally assumed: not a general "any status from any other," but two concrete divergences — the mock's `reinstate()` set `pending` where the server sets `verified`, and the review screen offered a "Return to Queue" action on rejected vendors that the server refuses with 409 every time. Both fixed under F2.5, above. `legalVendorActions()` now mirrors `Domain/Entities/Vendor.cs`'s transition rules exactly, has its own spec, and every button on the review page is verified — in both directions, for all four statuses — to offer exactly what the server allows: no dead-end button, no hidden legal action. One narrower tail remains (a UI race, not a wrong rule) — see F12.

### ✅ F10. Requester address field has three names — **DONE 2026-08-11 (Slice 3)**
`ServiceRequesterBase.address` is now the one model field. The three UI-facing form-control names (`businessAddress`/`registeredAddress`/`address`) still exist on the profile page — a UI-naming decision, not a model one — but all three now read from and write to `address`, with a comment pointing between `buildForm()` and `save()` explaining the mapping.

Found and fixed a live bug outside the plan's original file list along the way: `service-requester-profile.page.ts`'s `save()` wrote into a `Record<string,unknown>`-cast variable using the two now-deleted key names, silently dropping the address update on every save instead of persisting it — not compiler-caught, since the cast erases property-name checking. The fix itself then introduced a mirror-image regression one layer up (`service-auth.service.ts`'s `updateServiceRequesterProfileAsync` reading the same deleted keys), caught in task review before it shipped, latent only because `useRealApi` is committed `false`.

**Verified live** against the real backend: a freshly-registered SME requester's address round-tripped correctly through the real API into the single `businessAddress`-labeled UI control.
→ [Slice 3 plan](superpowers/plans/2026-08-06-slice-3-model-divergences.md)

### 🟠 F11. `authInterceptor`'s session-clear is incomplete for the jobs portal
Found in F1's final review (2026-08-02). On a failed refresh, `authInterceptor`'s `endSession()` clears `TokenStore` and navigates to `/login` — but that's only half a logout. `AuthService`'s (jobs-portal) own state (`userSignal`, `CURRENT_USER_KEY`/`LOGIN_TIMESTAMP_KEY` in `localStorage`) and `ServiceAuthService`'s cached session are untouched. For a jobs-portal user this means: `endSession()` → `/login` → `guestGuard` sees `authService.isLoggedIn()` still `true` → bounces back to `/dashboard` → its data calls 401 with no refresh token left → `endSession()` again → back to `/login` → loop.

This is **pre-existing behavior** (the old interceptor had the same two lines) and is **dormant today** because `useRealApi` is committed `false`. It stops being dormant the moment any real-API session hits it — F1's own live verification didn't catch it because that pass ran as a vendor through `ServiceAuthService`, which `guestGuard` doesn't gate the same way. Don't band-aid this in isolation: the real fix is F3 (collapse the two auth stores into one), which removes the two independent pieces of state this bug lives in the gap between. Close F3 before or alongside flipping `useRealApi` on for real (roadmap Slice 10), not after.

### ✅ F12. Vendor review decision buttons have no in-flight guard — **DONE 2026-08-11 (Slice 3), with a caveat**
Found in F2.5/F9's review (2026-08-03). A `deciding` signal now guards all four decision methods plus Cancel — Cancel needed the same guard since it only hides the panel and cannot recall a request already sent, so an admin could otherwise dismiss the panel and act again on a vendor whose decision had already landed. **Verified live**, not just by unit test: firing two synchronous clicks on Approve produced exactly one `POST .../approve → 200 OK`, with the button already `disabled` before the second click even fired.

**Caveat this entry's original text should record rather than let close silently:** it asked for "a shared convention, not a one-screen patch." What shipped is a plain `signal(false)` local to this screen, not `core/utils/request-state.ts` — deliberately, not an oversight: `request-state`'s `begin()` *supersedes* an in-flight request rather than blocking a new one, which is correct for a superseded async fetch (F17, below) but wrong for a click-guard, which needs the second click ignored outright, not raced. The two problems share a root cause (no busy-state convention existed) but need different semantics, so F12's fix and `request-state.ts` are sibling patterns on the same two screens, not one shared implementation.
→ [Slice 3 plan](superpowers/plans/2026-08-06-slice-3-model-divergences.md)

### 🟡 F13. `VendorAdminService`'s real-API paths still have no test coverage — **partly closed 2026-08-06**
Found in Slice 2's final whole-branch review (2026-08-04). Originally: `legalVendorActions()`'s spec was the only new test code in the whole slice.

**Closed since:** the mock transition rules, the queue table's conditional columns, and the review page's reason panel now have specs (12 added 2026-08-06, each red-green verified against the pre-fix code — see the changelog). **Still open:** the real-API paths — `refreshAsync`'s request sequencing, `getVendorAsync`, `decide()`'s HTTP branch, and `adjustServerStats` — have no coverage, which is where F17's four findings live. Those want testing as part of whichever slice flips `useRealApi`, since the fixes and the tests are the same piece of work.

### 🟡 F14. `VendorAdminService.getVendorAsync` can't tell "not found" apart from "forbidden" or "server error"
Found in Slice 2's final whole-branch review (2026-08-04). In real-API mode, `getVendorAsync`'s catch block returns `null` on any failure — a genuine 404, a 403 (the signed-in admin lost `ServiceAdmin`/`Admin` mid-session), and a 500 all land on the review page's `notFound` state and the same "vendor not found" message. An admin who loses permission or hits a real server error sees the identical screen as one who followed a stale or bad link, with no way to tell which happened.

**Checked against Slice 3, still open (2026-08-11):** Slice 3's Task 8 touched `decide()`'s 409 branch only; its own implementer report confirms `getVendorAsync`'s catch is unchanged and still swallows every failure to `null`. Not closed incidentally.

### 🟢 F15. `VendorAdminService` seeds its queue from `localStorage` even in real-API mode
Found in Slice 2's final whole-branch review (2026-08-04). `vendorsSignal` initializes from `readVendors()` (the mock's `heavenly_vendors` localStorage store) unconditionally, regardless of `useRealApi` — real-API callers only see server data once `refreshAsync()` resolves. In practice this is a brief flash rather than a persistent wrong state, since every page that reads the queue calls `refreshAsync()` from `ngOnInit`, but a real-API session can render stale or mock vendor rows for one tick before the real fetch lands.

### ✅ F16. A `ServiceAdmin` could not open `/management` at all — **DONE 2026-08-06**
Found in Slice 2's post-merge review (2026-08-06). `/management` was gated by `adminGuard` → `AuthService.isAdmin()`, which checked only `userType === 'admin'` — correct for the seeded platform `Admin`, but every `ServiceAdmin` granted onto a differently-typed account (the exact shape B11's grant endpoint produces: primary `userType` untouched, `ServiceAdmin` added to `roles[]` only) was bounced with *"Access denied. Admin privileges required."* This made B11's grant/revoke endpoint decorative for its main purpose — you could grant `ServiceAdmin`, and the grantee still couldn't verify a vendor through the UI.

`isAdmin` now consults `roles[]` (already on the wire, now mapped into the session `User` on both login and `/me` rehydration) when present, mirroring the backend's own `[Authorize(Roles = "ServiceAdmin,Admin")]` exactly. Mock-mode users carry no `roles[]`, so `userType` remains the fallback there, unchanged. The navbar's Management link — which re-derived admin status independently of the guard, which is how this bug had two symptoms (unreachable *and* invisible) instead of one — now reads `authService.isAdmin()` directly, one source of truth.

**Verified red-green:** reverting `isAdmin` to the userType-only check fails the new "ServiceAdmin granted onto an employer account" spec.
**Verified live** against the running stack, not on reasoning alone: registered a fresh employer account, granted it `service_admin` through the real admin API, logged in as that account fresh (so the JWT carries the new role claim), and confirmed the Management link renders, `/management` loads ("Management Dashboard"), and `GET /api/service-admin/vendors` returns a genuine 200 with 7 real vendor rows and correct stats — proving the frontend guard *and* the backend authorization pass together for this role, not just routing.
→ branch `dev-agentic` (direct commit, post-merge fix) · related: [F3](#-f3-collapse-the-two-auth-stores-c1) · B11

### 🟡 F17. Real-API mode has no error, loading, or 409-reconciliation states — **loading/error/409 halves DONE 2026-08-11 (Slice 3); the fourth bullet stays open**
Found in Slice 2's post-merge review (2026-08-06); all dormant while `useRealApi` is `false`, all live the moment it flips. Four related gaps in `vendor-admin.service.ts` / the two management screens:
- ✅ **A failed queue load asserted an empty queue — fixed.** `refreshAsync` now runs through the new `core/utils/request-state.ts` primitive; a failed load calls `queueRequest.fail()` instead of fabricating `[]`/all-zero stats. **Verified live**, not just by unit test: killing the backend mid-session and switching filter tabs produced the intended "Couldn't load the queue" error state, with the four stat cards *retaining* their last-known-good values (7/1/0/0) instead of reverting to zero — a stronger result than the plan's own stated minimum bar. Restarting the backend and switching tabs again showed full recovery with real data.
- ✅ **No loading state — fixed.** The vendor queue component now exposes `loading`/`loadError` signals from the same primitive; the template gates on a 3-way chain (error → loading-and-empty → plain-empty → table) ahead of the table, so the in-flight window can no longer render "No vendors here" beside a stat card that disagrees with it.
- ✅ **Nothing reconciled after a 409 — fixed.** `decide()` now distinguishes a 409 (re-fetches the vendor via `getVendorAsync`, toasts "Reloading it.") from every other failure (unchanged generic toast + `null`); a failure of the reload itself gets its own fallback toast rather than leaving "Reloading it." as an unfulfilled promise. Task review caught a real regression the fix itself introduced: `vendor-review.page.ts`'s panel-close logic used to be reliably skipped on any failure (`decide()` always returned `null`), which is exactly what preserved the admin's typed reason on a stale request — once `decide()` could return a truthy vendor on a 409, the same `if (updated)` wrongly took the success branch and wiped it. Fixed before merge by gating the panel close on the reloaded vendor's status actually matching the attempted action's target, not just on a truthy result.
- ⛔ **`adjustServerStats`' `from` bucket is guessed** from a possibly-stale queue row (`:185`) rather than the freshly-fetched profile the admin actually acted on, so counts still drift permanently when another admin acted first, or when the vendor is outside the loaded page. **Confirmed still open** — out of Slice 3's scope, not touched by either task that landed in this area.

→ [Slice 3 plan](superpowers/plans/2026-08-06-slice-3-model-divergences.md)

### 🟡 F18. The queue silently stops at 100 vendors, next to a total that says otherwise
Found in Slice 2's post-merge review (2026-08-06). `refreshAsync` requests `pageSize: 100`, exactly the server's `MaxPageSize` clamp, and nothing reads the `totalCount`/`totalPages` the response already carries (declared in `vendor-admin-api.models.ts:44-45`, referenced nowhere). There is no pagination control and no search box, so with 137 pending vendors the stat card correctly reads **137** while the list beside it reads **Vendors (100)** and simply ends — and the 37 newest are unreachable by any route through the UI. The server's `search` parameter is implemented and never sent. Dormant behind `useRealApi`.

### 🟢 F19. The admin review screen renders mapper fallbacks as if they were data
Found in Slice 2's post-merge review (2026-08-06). The wire DTO is honestly nullable but the domain `Vendor` interface declares these fields required, so `vendor-dto.mapper.ts:36-46` invents values: `yearEstablished ?? 0` renders as **"Year Established: 0"**, and `registeredAddress/city/state/pinCode ?? ''` render the address line as **", ,"**, and `designation ?? ''` as **"Jane Doe ()"**. The verification queue is by definition full of incomplete profiles, so this is the common case on the one screen whose whole job is judging completeness — an admin cannot tell "not supplied" from "supplied as zero". `gstNumber` already does this correctly with `|| '—'`. Also: the rejection-reason textarea has no `maxlength` against a server limit of 1000 (`ReviewVendorCommand.cs:46`), and a 400 from exceeding it surfaces as the generic "The decision could not be saved."

### 🟢 F20. Three CSS custom properties are referenced but never defined
Found in Slice 3's Task 4 review (2026-08-11). `--yellow-50`, `--green-50`, and `--green-500` are referenced by badge/pill classes (`.status-review`/`.status-accepted` in `vendor-dashboard.page.scss`; at least 6 more sites in `service-requester-dashboard.page.scss`) but `styles.css` only defines the `-100` variants of those tokens — so those badges render with no pill background today. Already worked around locally in one place (`tender-detail.page.scss`, via `var(--yellow-50, var(--warning-bg))`) — someone hit this before and patched around it rather than fixing `styles.css`. One-line fix: add the two missing token values to `styles.css`.

### ✅ F5. Model divergences — **DONE 2026-08-11 (Slice 3)**
Re-verified against the code 2026-08-06 while planning Slice 3; two of the original entry's three bullets were imprecise and it missed one — both corrected below, then closed once Slice 3 shipped:
- ✅ **`RequesterType` — fixed.** `'large_organization'` (signup, core, and the API) vs `'organization'` (`management.model.ts:50`) genuinely disagreed; `management.model.ts` now re-exports the canonical core type instead of declaring its own, `'organization'` is gone.
- ✅ **`ServiceRequestStatus` — fixed, and this was the one the original entry missed entirely** (would have bitten Slice 5): `management.model.ts`'s copy carried a phantom **`rejected`** value no server state maps to (the admin actions are start-review / approve / request-changes / close) and was **missing `cancelled`**, which the server does send. `service-request-management.service.ts` no longer writes the phantom value — `rejectRequest()` is renamed `closeRequest()`, writing `'closed'`. `Record<ServiceRequestStatus, true>` exhaustiveness checks (not a plain array literal, which only validates listed elements) now pin both directions at compile time.
- ✅ **`ServiceRequest` — renamed, not merged, as intended.** The backend genuinely models three shapes (`ServiceRequestDto`, `ServiceRequestAdminDto`, `ServiceRequestSummaryDto`); the admin client type carries joined contact details and `internalNotes` that must never reach a requester, so two client types was correct — sharing the bare name was the defect, since an import from the wrong module type-checked silently. The admin one is now `AdminServiceRequest`.
- ✅ **`BidStatus` — the divergent copy fixed, in the file the original entry had wrong.** `vendor.model.ts`'s `BidStatus` was already canonical; the actual divergence was an inline hyphenated union with two phantom values (`pending`, `accepted`) in `vendor-dashboard.model.ts:23`. `VendorBid.status` now imports the canonical type; label/class maps rewritten as exhaustive `Record<BidStatus, string>` (7 keys, no fallback needed).
- ✅ **`BudgetVisibility`/`TenderType` — relocated to core** for Slice 6's benefit, a move rather than a dedupe as originally planned. **Found during Slice 3, not in the original entry:** a *third*, independent, value-identical `BudgetVisibility` declaration existed at `vendor.model.ts:3` — exactly the duplicate class this item exists to kill, missed by the plan's own pre-work claim that it "exists only in `management.model.ts`." Deleted; `vendor.model.ts` now imports it from core (and still re-exports it, since `vendor.service.ts` imports it from `vendor.model.ts` rather than core directly).
→ [Slice 3 plan](superpowers/plans/2026-08-06-slice-3-model-divergences.md) · [UI_ISSUES.md §3](UI_ISSUES.md)

### 🟡 F6. Design-system consolidation (A6 remainder)
Card, form-field, modal and table are still styled per-screen. Buttons, status-badge, empty-state and tokens are done.

### 🟢 F7. Management settings page
Deferred; the dead link was removed, so there's no dead end — purely additive whenever wanted.

### 🟢 F8. Skeleton loaders
Deferred deliberately — screens already show spinner + text, so this is refinement, not a defect.

---

## 🔵 NEEDS YOU

| # | Item | Why it's blocked |
|---|---|---|
| Y1 | **Cloud SQL production instance** | **Decided 2026-07-26: project `heavenly-corp`, prepare-only.** A ready-to-run `scripts/provision-cloudsql.sh` exists (dry-run by default, needs `--confirm`); only `gcloud` install + your go-ahead remain. Billable, so deliberately not executed |
| ~~Y2~~ | ~~AutoMapper licensing~~ | ✅ **Resolved 2026-07-26 — AutoMapper removed entirely.** Replaced with explicit static `Projection` expressions per DTO; output verified byte-identical. No licensing question remains |
| Y3 | **E5 imagery** | Supplied photos are watermarked Adobe Stock comps and can't ship. Needs licensed photography, or confirmation on `services-01.jpg` |
| Y4 | **Client/partner logos, team photos** | Content, not code |
| Y5 | **DLT sender registration** | Required by Indian carriers before SMS/phone OTP can go live; takes days to approve |

---

## Portal modularity (jobs ⟷ services split)

The two portals are being kept **separable** for a future split into independent deployables. Rules now enforced in code and documented in `Application/Features/ServicesPortal/README.md`:

1. **No cross-portal type references** in either direction. Nothing under `ServicesPortal/` touches `Job`, `JobApplication`, `JobDomain`, etc., and jobs code touches nothing in it. This is the most expensive thing to unpick later.
2. **Identity is the single shared concept** — `Vendor.UserId → users.id` is the only cross-module FK, and is the intended seam (extract identity into its own service, or give each service a projection of the user rows it needs).
3. **Route prefixes move as a unit** — `/api/vendors/**`, `/api/service-admin/**`. A gateway can route by path with no per-endpoint list.
4. **The Application layer stays provider-free** — the vendor queue search uses `ToLower().Contains()` rather than Npgsql's `ILike`, so the module lifts out without dragging Npgsql with it.

**Deliberately not done yet:** one `ApplicationDbContext` still holds both portals, and jobs features still sit directly under `Features/` rather than a matching `Features/JobsPortal/`. Both are mechanical moves; doing them now would touch working code for no behavioural gain. Migration path when the split starts: two `DbContext`s over two schemas, then two databases — the entity configurations are already per-entity files and move unchanged.

---

## Database — current

**Supabase (temporary), Seoul session pooler.** Cloud SQL / Firebase are on hold. Migrations applied and the full auth lifecycle verified against it. Connection is in user-secrets (`ConnectionStrings:DefaultConnection`), with the local Docker string retained as `ConnectionStrings:LocalDocker` to switch back offline. Session pooler port 5432 — **not** transaction pooler 6543, which lacks the session state EF migrations need.

🔴 **Rotate the Supabase DB password — now exposed twice, not just once.** Originally shared in a chat session archived to the private `heavenly-session-archive` repo; on 2026-08-02, printed a second time into a coding-assistant session transcript via an unfiltered `dotnet user-secrets list` (the command itself is now avoided — check presence with `grep -c`, never list values). Still not rotated as of this writing — deliberately not done autonomously since it's a shared resource other things depend on. Supabase dashboard → Settings → Database → Reset password, then re-run the `dotnet user-secrets set` command. The same session also generated the `AdminSeed:Password` local dev secret (B11) and printed *that* in plaintext too — lower stakes (local dev admin only) but rotate it in the same pass: `dotnet user-secrets set "AdminSeed:Password" "<new-value>"` (changing it alone has no effect on the already-seeded row — see B11's note on why).

**Added 2026-08-06 — a second local admin now exists.** F16's live verification needed an admin login, and the existing `AdminSeed` password was unknown to both parties (and unreadable — the sandbox blocks `dotnet user-secrets list`). Rather than disturb the existing row, `AdminSeed:*` was pointed at a **new** account, which the seeder created alongside it:
- `admin-f16-verify@heavenlycorporation.com` / `F16Verify-2026-Aug!` — **local dev database only**, deliberately shared in plaintext with the user, and to be treated as compromised from birth.
- A throwaway employer account `f16-employer-verify@example.com` was also created and granted `service_admin` to reproduce the F16 case.

Both are local-only and harmless where they sit, but delete them (or reset the local DB) before this database is ever used for anything real, and note that `AdminSeed:Email` now points at the new account rather than the original.

---

## Architecture notes

**Firebase vs GCP is not a choice** (verified 2026-07-26). Every Firebase project *is* a GCP project — `heavenly-corp` already has one. And **Firebase Data Connect is Cloud SQL for PostgreSQL**: listing Data Connect services enabled `sqladmin.googleapis.com`, the Cloud SQL Admin API. So the Cloud SQL decision and "use my Firebase project" are the same choice.

We use **Cloud SQL directly** rather than the Data Connect layer, because Data Connect manages schema from GraphQL SDL (which would fight EF Core migrations) and the .NET API would bypass its GraphQL layer anyway. Data Connect remains available if a direct client→DB use case ever appears.

Because the stack stayed relational, moving local→cloud is a **connection-string change only** — no application code changes.

---

## Changelog

- **2026-08-11** — **Slice 3 done: model divergences closed, async convention established.** All 8 implementation tasks reviewed (Sonnet implementer, Opus task reviewer) plus live verification against the real backend; see the [plan file](superpowers/plans/2026-08-06-slice-3-model-divergences.md) and its SDD ledger for full task-by-task detail. Closes **F5** (model divergences — plus a third `BudgetVisibility` duplicate the plan's own pre-work missed), **F10** (requester address collapsed to one field, plus a live save-path bug found and fixed along the way), and **F12** (in-flight guard on the vendor review decision buttons, shipped as a one-screen signal rather than the shared convention F12 originally asked for — noted, not silently closed as first worded). Closes F17's loading/error/409 halves via a new shared primitive, `core/utils/request-state.ts` — sequenced by a monotonic request id so a stale response can never overwrite a fresher one, and a failed request never fabricates data (no more confident empty-queue-and-zero-stats on a 403/500). F17's fourth bullet (`adjustServerStats`' stale `from`-bucket guess) and F14 (`getVendorAsync` can't distinguish 404/403/500) were explicitly re-checked against the final code, not assumed — both remain open. New backlog item **F20** logged for three undefined CSS custom properties found along the way (badges render with no pill background on two dashboard screens).
  - Every one of the 8 tasks' independent review caught something real: a third live duplicate the plan's own claim missed (Task 1); a genuine Critical regression — a fix at one layer breaking a byte-identical, previously-working read one layer up, latent only behind `useRealApi: false` (Task 5); a mutation-tested gap in the new primitive's own test suite, before it had a single consumer (Task 6); two genuine Important regressions found by diffing against pre-task code rather than reading the new code in isolation — a refactor silently widening when a toast fires (Task 7), and a return-value change with a caller-specific side effect a blanket brief claim didn't anticipate (Task 8).
  - **Verified live**, not on reasoning alone: a fresh SME signup's address round-tripped through the real API into the correct UI control (F10); killing the backend mid-session produced the intended error state with stat cards *retaining* their last-known-good values rather than reverting to zero (F17, exceeding the plan's own stated bar); two synchronous clicks on Approve produced exactly one `POST .../approve → 200 OK` with the button already disabled before the second click fired (F12).
  - 55/55 frontend specs, `ng build` clean.
- **2026-08-06** — **F16 fixed and live-verified.** `AuthService.isAdmin()` now consults the session's `roles[]` (already on the wire, newly mapped in) when present, matching the backend's `[Authorize(Roles = "ServiceAdmin,Admin")]` exactly — a granted `ServiceAdmin` on a differently-typed account is no longer refused `/management`. The navbar's Management link now reads the same `isAdmin()` instead of independently re-deriving it from `userType`, closing the gap where the bug had two symptoms. Verified red-green (the new spec fails against the reverted check) and live: registered a fresh employer, granted `service_admin` through the real running admin API, logged in fresh, and confirmed the link renders, the route loads, and `GET /api/service-admin/vendors` returns a genuine 200 with real data for that account. This is the fix the prior entry below deliberately deferred rather than ship unverified.
- **2026-08-06** — **Slice 2 post-merge review (four independent reviewers + a red-green pass over every claim).** Ran *after* the merge, against `dev-agentic`, specifically to test whether the slice does what it was planned to do. It mostly does — no defect was found in the shipped Slice 2 code that makes the admin verification flow wrong — but the review found one Critical hole the slice's own live verification had stepped around, and corrected a claim this file was making.
  - 🔴 **The Critical: a `ServiceAdmin` cannot open `/management`** (F16). The frontend guard tests `userType === 'admin'`; the backend authorizes `ServiceAdmin,Admin`. **Task 8 Step 2 of the plan explicitly said to grant and use a `ServiceAdmin`; execution substituted the seeded platform `Admin` as a shortcut, and that substitution is the only reason the hole survived the live walk.** It makes Slice 1's grant endpoint decorative for its main purpose. Not fixed here — an auth change that can't be verified without a running stack shouldn't ship on reasoning alone, and the durable fix belongs with F3.
  - ⚠️ **The plan's own "gate" step was never verified.** Step 4 item 7 — log in as the approved vendor and reach `/vendor-dashboard` — is the item the plan calls *"the gate… what unblocks Slices 4 onward"*, and nothing records it being done. This file's F2.4 entry nonetheless claims the gap is "resolved by F2.5." What was actually proven is narrower: a vendor can be moved to `verified` through the UI. Both documents now say so.
  - ✅ **Fixed: the mock accepted transitions the server refuses.** `VendorAdminService.transition()` had no rules of its own, so mock mode — the mode that actually ships — would perform any action the template offered. That is exactly how F9's "Return to Queue on a rejected vendor" bug stayed invisible. It now enforces `legalVendorActions`, making the mock a faithful stand-in and turning future drift into a local failure. Reinstate also now records a "Reinstated" note, so it is distinguishable from an approval in the timeline.
  - ✅ **Fixed (backend): the reviewer-name lookup was loading whole `User` rows** — `ToDictionaryAsync` takes `Func`, not `Expression`, so the selectors ran client-side and the SQL was `SELECT *`, pulling admins' bcrypt hashes and emails into memory on every admin vendor read to use one `Name`. Now projected server-side. Nothing ever reached the wire; this is exposure surface, not a disclosure. Also added `[JsonIgnore]` to `IncludeReviewerNames`, matching the convention every other server-populated property here already follows — it is not bindable today, but the day someone adds `[FromQuery]` a vendor could ask for the name of the admin who rejected them, and no test would fail.
  - ✅ **Fixed: test coverage where there was none.** 12 new frontend specs and 1 backend, each **red-green verified** — every one was run against the pre-fix code and confirmed to fail. That process corrected a wrong claim: the "Docs column" fix was written up in this file and in commit `075ce62` as a header/cell *count mismatch* that would "misalign every column"; rendering the pre-fix template proves both counts were 7 and matched, and the real defect was a cosmetic empty column. Diagnosis corrected, fix stands.
  - 📋 **Logged, not fixed:** F16 (above), F17 (no error/loading/409-reconciliation states in real-API mode — four related gaps that want one shared convention, together with F12), F18 (the queue silently stops at 100 with a contradicting total beside it), F19 (mapper fallbacks rendering as data: "Year Established: 0", ", ,"). All four are dormant behind `useRealApi: false` and belong to whichever slice flips it.
  - Independently re-verified clean: `legalVendorActions` matches `Vendor.cs` exactly in both directions across all four statuses; every DTO field-for-field against the real backend records; all 9 `VendorDto.From` call sites (no non-admin path passes a name map); the privacy guard test proven non-vacuous by mutation. 215/215 backend, 34/34 frontend.
- **2026-08-04** — **Slice 2 final whole-branch review, both repos.** Backend (`feature/vendor-admin-reviewer-names`): one Important finding — the reviewer-name privacy test only asserted the field was unpopulated on a vendor's own profile, not that it stayed `null` specifically after a *real* approval had populated it for the admin side, leaving a gap where a future regression could pass unnoticed. Hardened to approve-as-admin-then-read-as-vendor in one test; 214/214. Ready to merge. Frontend (`feature/vendor-verification-wiring`): two Important + eight Minor findings, ready to merge with fixes. Fixed before merge: a failed reject/suspend was silently discarding the admin's typed reason text instead of leaving it in the panel to retry (`vendor-review.page.ts`); the queue table rendered an empty "Docs" header above an empty cell in real-API mode (the column is now hidden outright); the shared `vendor-dto.mapper.ts` was missing the file-level rationale comment the plan specified. **Correction (2026-08-06):** the "Docs" finding was first written up here and in commit `075ce62` as a header/cell *count mismatch* that would "misalign every column after Services." That was wrong, and wrong in the direction of overstating severity — a rendering test run against the pre-fix template proves both counts were 7 and matched. The real defect was purely cosmetic: an empty column. The fix stands; the diagnosis did not, and was corrected once actually executed rather than reasoned about. Three cosmetic-only findings (duplicated success-message string literals between the async and sync decision paths, `VendorAdminService.stats` never used outside the class and should be `private`, one `inject()` call grouped away from the others) judged not worth their own backlog entries — zero behavioral difference either way — and recorded in the slice's SDD ledger instead. Three with real (if narrow) user-facing consequence logged as tracked debt: F13 (no unit test coverage anywhere in `VendorAdminService` or its two consuming components — only Task 3's `legalVendorActions` spec is new this slice), F14 (`getVendorAsync` can't tell a 403/500 apart from a genuine 404), F15 (the queue signal seeds from mock `localStorage` for one tick even in real-API mode before the real fetch lands).
- **2026-08-03** — **Slice 2 done (F2.5 + F9):** the vendor verification queue and review screens run on the real API, so a vendor can be verified through the UI for the first time — the prerequisite every later slice was blocked on, and the gap F2.4 recorded honestly. Backend gained reviewer names on the verification timeline (B12, a join not a stored column) so the audit trail reads as people rather than GUIDs; the vendor's own profile deliberately doesn't get them. Found and fixed three real divergences, one of them live in the shipped app at the time it was found: `reinstate` moved a vendor to `pending` on the client and `verified` on the server (fixed, then verified through a full approve→suspend→reinstate cycle); the review screen briefly offered a "Return to Queue" action on rejected vendors that the server refuses with 409 every time; and — caught only during live verification, not by any task's own review, because it fell in the gap between a backend task and a frontend task on two different branches — the backend correctly sent a reviewer's name on the wire but the frontend's copy of that DTO was never updated to read it, so the timeline showed a raw GUID until fixed on the spot. Every review-decision button is now proven, in both directions across all four vendor statuses, to offer exactly what the server's transition rules allow — closing F9. Two gaps tracked rather than fixed reactively: B13 (the admin queue can't show a document count — a backend contract gap) and F12 (no in-flight guard on the decision buttons, so a fast double-click can still surface a 409 after a real success). 214/214 backend, 22/22 frontend.
- **2026-08-02** — **B11 + F1 done (Slice 1 of the services-portal roadmap):** admin bootstrap (config-seeded `Admin`, role grant/revoke, `Admin`-only so a `ServiceAdmin` can't mint further admins) unblocks the entire `/api/service-admin/**` surface for the first time; silent token refresh (single-flight coordinator + retry-once interceptor) replaces the hard logout on 401, verified live with a real 1-minute token against the running API — one refresh call for two concurrent 401s, one clean redirect on a genuinely failed refresh, no loop either way. First frontend test suite (17 specs after the slice's final review added one more). 212/212 backend tests passing after the final whole-branch review's fix wave closed a real anonymous-privilege-escalation gap (registration blocked `Admin` self-assignment but not `ServiceAdmin`). Two pre-existing, unrelated bugs found and fixed along the way: `app.component.spec.ts` had silently lacked an `HttpClient` DI provider for months, and one of its assertions checked for CLI-scaffold `<h1>` text the app shell stopped rendering in December 2025. **Also: the Supabase DB password was accidentally printed into this session's transcript** (an unfiltered `dotnet user-secrets list`) — not yet rotated, flagged above under Database, deliberately left for a deliberate human action rather than done autonomously.
- **2026-08-01** — **F2.4 done:** vendor tender browsing (list, detail, ask clarification) wired to the real API. No backend changes needed — verified against the backend's own 30 `TenderApiTests` for wire-shape correctness, plus a live browser pass proving graceful handling of an unverified vendor (403 → empty state, not a crash). Full happy-path browser verification blocked on there being no way to verify a vendor short of the admin UI or a raw DB write — flagged as a follow-up, not skipped silently.
- **2026-08-01** — **F2.3 done:** service-request drafts wizard (all 3 forms), preview/submit, my-requests (list/detail/cancel/resubmit), and both dashboards' widgets wired to the real API. Found and fixed a same-session bug: `DELETE /drafts/{serviceId}` wasn't actually idempotent despite being documented as such, which surfaced as "submission failed" toasts on requests that had, in fact, been created. 193/193 backend tests passing.
- **2026-08-01** — **F2.1/F2.2 done:** services-portal auth (register/login/rehydrate) and vendor + requester profile editing wired to the real API behind `useRealApi` (committed `false`). Found and fixed a real cross-portal session bug in existing Stage 5/6 code (missing login-timestamp write caused a shared-`TokenStore` wipe) and two route-guard race conditions. Backend: `ServiceRequesterDto` now carries email/phone; `UpdateServiceRequesterProfileCommand` can update phone. 191/191 backend tests passing. Detail under F2.
- **2026-07-29** — **B2.7 done — B2 COMPLETE.** `Award` + post-award work tracking. The whole services-portal pipeline (request → tender → bid → award) now runs end to end and is verified live. `activeProjects` answered doc 02 §7.
- **2026-07-29** — **B2.6 done:** `Bid` + drafts + sealed bidding + evaluation. The request → tender → bid pipeline now runs end to end. Vendor dashboard's `openTenders`/`myBids`/`wonBids` are live; only `activeProjects` awaits B2.7.
- **2026-07-27** — **B2.5 done:** `Tender` + clarifications. Budget visibility enforced structurally (separate vendor DTO types); vendor matching on capability + area; eligibility verdicts.
- **2026-07-27** — **B2.4 done:** `ServiceRequest` + drafts + append-only events; the changes-required round trip verified end to end. Fixed `Database.SqlQuery` parameterising a sequence name (Postgres 42P01).
- **2026-07-27** — **B2.3 done:** `ServiceRequester` aggregate + API (single table, type changes supported). **Fixed validation 400s carrying no `errors` dictionary** — `GlobalExceptionHandler` serialised against the base `ProblemDetails` type, dropping the field-keyed errors the forms bind to; status-code-only tests never noticed. Logged F10.
- **2026-07-27** — **B2.2 done:** 12 vendor endpoints (self-service + admin verification), under an explicit `ServicesPortal` module boundary for the planned portal split. **Fixed a privilege-escalation hole** (see below) and completed B1's JWT role claims. B6 mostly done via `GlobalExceptionHandler`.
- **2026-07-27** — 🔴 **SECURITY: `POST /api/auth/register` accepted `userType: Admin`** and minted fully-privileged accounts. Root cause: validators were registered in DI but never resolved — no pipeline behaviour existed, so every FluentValidation rule in the codebase was dead code. Fixed with `ValidationBehaviour`. Confirmed unexploited (no Admin accounts existed).
- **2026-07-26** — **B2.1 done:** Vendor aggregate (domain + persistence + migration), 23 new tests, applied to Supabase. Resolved two open questions in doc 02 (portfolio now modelled; `basic` completion rule reconciled). Logged F9.
- **2026-07-26** — **B4 done:** 17 integration tests (Testcontainers); exposed + fixed a JWT key-divergence bug. **Supabase** wired as the temporary dev DB, migrations applied, auth lifecycle verified.
- **2026-07-26** — **AutoMapper removed** (explicit EF projections, byte-identical output). Firebase/Cloud SQL investigated: `heavenly-corp` chosen, provisioning script prepared but deliberately not run (billable).
- **2026-07-26** — **B1 done:** account roles foundation (`user_roles` + extended `UserType`, roles on all auth responses). Multi-role verified.
- **2026-07-26** — Cleared all package CVEs (AutoMapper 16, Swashbuckle 10.2.3, Cryptography.Xml 10.0.10), runtime-verified. Merged to `main`, created `develop`. Backlog created. Started B1.
- **2026-07-26** — Stage 6: session rehydration via `/me`.
- **2026-07-26** — Stage 5 verified end-to-end; .NET 10 + Docker Postgres running.
