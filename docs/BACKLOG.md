# Heavenly — Consolidated Backlog

**Last updated:** 2026-08-01 · **Maintained on the go** — updated after every coding iteration, not retroactively.

Single source of "what's left" across both repos. Detail lives in the linked docs; this file is the prioritised index.

- **Frontend:** `aashin10/Heavenly` — branch `Feature/UI-Rework-Backend-Docs`
- **Backend:** `aashin10/Heavenly-Job-Backend` — `main` ← `develop` ← feature branches

**Status legend:** 🔴 blocker · 🟠 high · 🟡 medium · 🟢 low · 🔵 needs *your* decision/action

---

## Current state (verified, not assumed)

| | Status |
|---|---|
| Frontend UI | **Feature-complete on mocks.** All 4 UI sets shipped; 14 dead links fixed; 0 raw hex; 0 emoji; real 404 |
| Jobs-portal auth | **Live end-to-end.** Angular → .NET 10 → Postgres 16. Login/signup/`me`/`refresh`/`logout` all verified |
| Services portal | **Auth, profile editing, the request wizard, and tender browsing wired to the real API** (F2.1–F2.4, behind `useRealApi`, committed `false`). Bid/award screens still on `localStorage`. Backend: **B2 COMPLETE** — request → tender → bid → award runs end to end |
| Dependencies | **0 vulnerable packages** (verified 2026-07-26) |
| Tests | **193 backend integration tests**, Testcontainers-backed, self-contained. Frontend still has none |

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

---

## FRONTEND

### 🟠 F1. Silent token refresh
The interceptor currently clears the session and redirects on 401. It should try `refresh()` once and retry the request. Without it, users are hard-logged-out when the 60-minute access token expires mid-session.
→ [05 §After this works](backend/05-INTEGRATION-RUNBOOK.md)

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
- **Verification note**: `GET /api/tenders` requires a *verified* vendor (`vendor.CanBid`), and no self-service path exists to verify one against the live dev database (verification is an admin-only action; creating a live admin account would mean either a raw DB write or a live-DB bypass, both correctly out of reach). Confirmed instead via the backend's own 30 `TenderApiTests` — which already assert the exact JSON field names this session's TypeScript models mirror (`budget.min/max/exact`, `eligibilityResult.eligible/reasons`, `clarifications[].answer` with no `vendorId`) — and via the browser against an *unverified* vendor: the 403 is caught and produces an empty list rather than a crash, and a missing tender correctly toasts "Tender not found" and redirects. The full happy path (a verified vendor seeing real published tenders) is unverified in the browser; low risk given the DTO-level test coverage, but worth a live pass once there's a way to verify a vendor outside the admin UI.
- Remaining under F2: bid submission, admin verification/evaluation screens, award flows. None started yet.

### 🟡 F3. Collapse the two auth stores (C1)
`AuthService` (jobs) and `ServiceAuthService` (services) are separate, and a user can be signed into both at once. The API models one account with many roles, so these merge once B1 lands.
→ [UI_ISSUES.md §5](UI_ISSUES.md)

### 🟡 F4. Simplify login (IA2)
Three decisions before credentials (portal → role → login/signup). With roles on the auth response this becomes one email+password form that routes afterwards. Unblocked by B1.

### 🟠 F9. Vendor status transitions are unguarded on the client
`VendorAdminService.updateStatus()` sets any status from any other — an admin can "suspend" a vendor who was never verified (quietly removing them from the review queue), or "reject" a verified one. The server now refuses all of these (B2.1), so once F2 lands these actions will start failing with 409 rather than silently succeeding. Fix the client to only offer legal actions for the current status.

### 🟡 F10. Requester address field has three names
The `ServiceRequester` union calls one field `address` (individual), `businessAddress` (SME) and `registeredAddress` (large org). It is one concept — where the requester is — and the API returns it as `address` (B2.3). Collapse the three on the client.

### 🟡 F5. Model divergences
- `RequesterType`: `'large_organization'` (signup) vs `'organization'` (management) — **genuinely disagree**; canonical is `large_organization`
- `VendorBid.status` redeclares `BidStatus` with hyphens + two statuses that don't exist
- `ServiceRequest` declared twice with different shapes
→ [UI_ISSUES.md §3](UI_ISSUES.md)

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

⚠️ **Rotate the Supabase DB password** — it was shared in a chat session that is archived to the private `heavenly-session-archive` repo. Supabase dashboard → Settings → Database → Reset password, then re-run the `dotnet user-secrets set` command.

---

## Architecture notes

**Firebase vs GCP is not a choice** (verified 2026-07-26). Every Firebase project *is* a GCP project — `heavenly-corp` already has one. And **Firebase Data Connect is Cloud SQL for PostgreSQL**: listing Data Connect services enabled `sqladmin.googleapis.com`, the Cloud SQL Admin API. So the Cloud SQL decision and "use my Firebase project" are the same choice.

We use **Cloud SQL directly** rather than the Data Connect layer, because Data Connect manages schema from GraphQL SDL (which would fight EF Core migrations) and the .NET API would bypass its GraphQL layer anyway. Data Connect remains available if a direct client→DB use case ever appears.

Because the stack stayed relational, moving local→cloud is a **connection-string change only** — no application code changes.

---

## Changelog

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
