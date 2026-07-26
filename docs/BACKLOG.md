# Heavenly — Consolidated Backlog

**Last updated:** 2026-07-26 · **Maintained on the go** — updated after every coding iteration, not retroactively.

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
| Services portal | **Frontend only.** Every screen runs on `localStorage`; no backend entities exist at all |
| Dependencies | **0 vulnerable packages** (verified 2026-07-26) |
| Tests | **17 backend integration tests**, Testcontainers-backed, self-contained. Frontend still has none |

---

## BACKEND

### ✅ B1. Account roles foundation — `UserRole` + extended `UserType` — **DONE 2026-07-26**
`UserType` extended with `ServiceRequester`/`Vendor`/`ServiceAdmin`; new `user_roles` table (unique on `user_id`+`role`, cascade delete) is the authoritative set, with `User.UserType` retained as the *primary* role so existing queries and JWT role claims keep working. Migration backfills a role row for every pre-existing user; registration seeds one for new users. `roles[]` now flows through login, `/me` and `/refresh`.
**Verified live:** migrated + new users return `roles`; a single account holding `['employer','service_requester']` proves multi-role works; duplicate role rejected by the constraint; no regressions across the auth suite or the AutoMapper endpoints.
→ branch `feature/account-roles`

### 🟠 B2. Services-portal domain ⬅️ **next** (now on a test safety net)
Now unblocked by B1. The big greenfield: `Vendor` (+verification, documents, bank), `ServiceRequester`, `ServiceRequest` (+drafts, events), `Tender`, `Bid`, `Award`. Depends on B1.
→ [02](backend/02-API-VENDOR-DASHBOARD.md) · [04](backend/04-API-SERVICE-REQUESTS.md)

### 🟠 B3. Password reset endpoints
`PasswordResetToken` entity exists and is migrated, but **no endpoints use it** — a user who forgets their password has no recovery path. Needs request + confirm, single-use, expiring.

### ✅ B4. Integration test suite — **DONE 2026-07-26**
17 xUnit tests over the auth surface via `WebApplicationFactory` + Testcontainers (throwaway `postgres:16` per run, real migrations applied — so migrations are tested too). Covers register/login/me/refresh/logout, roles, wire-format casing, refresh-rotation replay, and every 401 path.
**Found a real bug:** JWT validation params were read *eagerly* off `builder.Configuration` while signing resolved `IOptions` *lazily* — they could diverge ("The signature key was not found"). Both now resolve from the same DI options.
Still to add: unit tests for handlers, and a frontend suite.

### 🟡 B5. `/register` should return tokens
Currently returns `{ userId }` only, so the frontend does register-then-login (two round trips). Returning an `AuthResponse` collapses it to one. Frontend already handles both.

### 🟡 B6. RFC 9457 Problem Details
`AuthController` returns three different error shapes, and the `409` is triggered by **string-matching an exception message** (`ex.Message.Contains("already exists")`) — that breaks the moment someone rewords it. Standardise via middleware; `422`s should carry field-keyed errors the Angular forms can bind.
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
All of it still runs on `localStorage` (`ServiceAuthService`, `DraftService`, `ServiceRequestService`, `VendorAdminService`). Blocked on B1/B2. Sequenced per-screen behind the same `useRealApi` flag.

### 🟡 F3. Collapse the two auth stores (C1)
`AuthService` (jobs) and `ServiceAuthService` (services) are separate, and a user can be signed into both at once. The API models one account with many roles, so these merge once B1 lands.
→ [UI_ISSUES.md §5](UI_ISSUES.md)

### 🟡 F4. Simplify login (IA2)
Three decisions before credentials (portal → role → login/signup). With roles on the auth response this becomes one email+password form that routes afterwards. Unblocked by B1.

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

- **2026-07-26** — **B4 done:** 17 integration tests (Testcontainers); exposed + fixed a JWT key-divergence bug. **Supabase** wired as the temporary dev DB, migrations applied, auth lifecycle verified.
- **2026-07-26** — **AutoMapper removed** (explicit EF projections, byte-identical output). Firebase/Cloud SQL investigated: `heavenly-corp` chosen, provisioning script prepared but deliberately not run (billable).
- **2026-07-26** — **B1 done:** account roles foundation (`user_roles` + extended `UserType`, roles on all auth responses). Multi-role verified.
- **2026-07-26** — Cleared all package CVEs (AutoMapper 16, Swashbuckle 10.2.3, Cryptography.Xml 10.0.10), runtime-verified. Merged to `main`, created `develop`. Backlog created. Started B1.
- **2026-07-26** — Stage 6: session rehydration via `/me`.
- **2026-07-26** — Stage 5 verified end-to-end; .NET 10 + Docker Postgres running.
