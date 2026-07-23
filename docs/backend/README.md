# Backend API Documentation

**Stack:** .NET 10 · Clean Architecture + CQRS (MediatR) · EF Core + PostgreSQL · custom JWT auth · Google Cloud

These documents specify the API the **existing Angular frontend** needs, targeting the **existing backend** at `/Users/admin/Heavenly/Heavenly-Job-Backend`. Every field traces to a component that renders it.

> ⚠️ **Read [03-EXISTING-BACKEND-REVIEW.md](03-EXISTING-BACKEND-REVIEW.md) first.** Docs 01 and 02 were originally drafted greenfield, before the existing backend was reviewed. They have been corrected, but 03 explains what is already built, what is missing, and why the earlier **Firebase recommendation was retracted**.

| Doc | Covers |
|---|---|
| [00-SCREEN-INVENTORY.md](00-SCREEN-INVENTORY.md) | All 27 routes, what each needs, documentation order |
| [01-API-AUTH.md](01-API-AUTH.md) | Login, both signup flows, verification status |
| [02-API-VENDOR-DASHBOARD.md](02-API-VENDOR-DASHBOARD.md) | Vendor dashboard: stats, opportunities, bids, profile completion |
| **[03-EXISTING-BACKEND-REVIEW.md](03-EXISTING-BACKEND-REVIEW.md)** | **What already exists, blocking issues, and corrections to 01/02** |
| [04-API-SERVICE-REQUESTS.md](04-API-SERVICE-REQUESTS.md) | Service request drafts, submission, formData schemas — canonical `ServiceRequest` |

---

## 1. Architecture

```
Angular 17 (SSR)  ──HTTPS──>  .NET 10 API (Cloud Run)  ──>  Cloud SQL (PostgreSQL)
   Cloud Run                        │
                                    └──> Cloud Storage (documents)
```

**Authentication is the API's own JWT**, already implemented (`JwtTokenService`, `UserSession`, `PasswordResetToken`). There is no external identity provider — see [03 §3](03-EXISTING-BACKEND-REVIEW.md) for why Firebase was considered and rejected.

| Concern | Owner |
|---|---|
| Credentials, tokens, refresh, password reset | **The API** — already built |
| Roles, vendor verification, suspension | **PostgreSQL** — business state, audited |
| All domain data | **PostgreSQL** |
| Files (vendor documents, tender attachments) | **Cloud Storage**, signed URLs |

---

## 2. Conventions

### Base URL

```
https://api.heavenlycorporation.com/api
```

**Existing convention**, set by `ApiControllerBase`: `[Route("api/[controller]")]`. Controller name gives the segment — `AuthController` → `/api/auth`.

> No version segment exists today. Adding `/v1` later means changing every route; worth deciding now. Given a single first-party consumer, **versioning can reasonably be deferred** — the frontend and API ship together.

### Authentication

Every authenticated request carries the API's own JWT:

```http
Authorization: Bearer <access-token>
```

Issued by `POST /api/auth/login` (see `AuthResponse`), validated by the JWT bearer middleware in `Program.cs`. Access token 60 min, refresh token 7 days, both configured in `JwtSettings`.

**Reject the request if the user is missing, `IsActive = false`, or suspended, regardless of a valid token** — a token outlives a suspension by up to an hour.

### Content type

`application/json; charset=utf-8` throughout, except file upload (`multipart/form-data`).

### Casing

**`camelCase` in JSON** — already the ASP.NET Core default and confirmed in the existing `AuthResponse` payloads.

**Enums are the open problem.** The API currently emits enum *names* (`"Applicant"`, PascalCase) while the frontend's unions are lowercase (`'applicant'`). Fix on the API side so no mapping layer is needed:

```csharp
builder.Services.ConfigureHttpJsonOptions(o =>
    o.SerializerOptions.Converters.Add(
        new JsonStringEnumConverter(JsonNamingPolicy.SnakeCaseLower)));
```

That yields `applicant`, `quick_service`, `under_review` — matching the TypeScript unions exactly.

### Dates

**ISO 8601, UTC, always.** `2026-07-19T14:30:00Z`

The frontend formats for display via `formatAppDate` / `formatAppDateTime` (`shared/utils/date-format.util.ts`) and never parses a pre-formatted string. Do not send display-formatted dates.

Business hours and deadlines are **Asia/Kolkata** in the user's mind — store UTC, and be careful that a "closes 19 Jul" deadline means end-of-day IST (`18:29:59Z`), not UTC midnight.

### Money

The domain already has a **`Money` value object** (`Domain/ValueObjects/Money.cs`) — use it rather than introducing a parallel representation. Serialised shape:

```jsonc
{ "amount": 4500000, "currency": "INR" }   // integer paise
```

**Integer minor units.** Never floating point. The frontend already renders Indian grouping and lakh/crore abbreviations (`tender-detail.page.ts:formatAmount`). Currency is `INR` app-wide — the field exists for forward-compatibility, not because other currencies are supported.

### IDs

Opaque strings. Use UUIDv7 (time-ordered, index-friendly). Never expose sequential integer PKs.

Human-facing reference numbers are **separate** from IDs and returned alongside — the frontend renders both (`{{ tender()!.tenderId }}` vs the routing `id`):

```jsonc
{ "id": "0190f2c1-…", "requestNumber": "SR-2026-00142" }
```

### Enums

Lowercase `snake_case` strings, matching the existing TypeScript unions exactly (`quick_service`, `under_review`, `service_requester`). **Do not send integers** — the frontend switches on these strings in `@switch` blocks and status maps.

> ⚠️ Two enums are currently declared inconsistently in the frontend — see [UI_ISSUES.md §3](../UI_ISSUES.md). The API defines the canonical form and the frontend must be corrected to match, not the reverse.

### Pagination

Cursor-based for anything that grows unbounded (tenders, bids, requests):

```http
GET /api/tenders?limit=20&cursor=eyJpZCI6…
```

```jsonc
{
  "items": [ … ],
  "nextCursor": "eyJpZCI6…",   // null when exhausted
  "totalCount": 143            // omit if expensive
}
```

Offset pagination is acceptable for admin tables where deep paging is rare and jumping to page N is useful.

### Errors

> **Current state:** `AuthController` returns three different error shapes, and the `409` is triggered by string-matching an exception message. See [03 §2.4](03-EXISTING-BACKEND-REVIEW.md). Standardising is cheap now, with four controllers.

One shape everywhere — [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457) Problem Details, which ASP.NET Core produces natively:

```jsonc
{
  "type": "https://api.heavenlycorporation.com/errors/validation-failed",
  "title": "Validation failed",
  "status": 422,
  "detail": "One or more fields are invalid.",
  "instance": "/api/auth/register/vendor",
  "traceId": "00-4bf92f…-01",
  "errors": {
    "gstNumber": ["Must be a valid 15-character GSTIN."],
    "phone": ["Must be a valid Indian mobile number."]
  }
}
```

| Status | Use |
|---|---|
| `400` | Malformed request (bad JSON, wrong type) |
| `401` | Missing/invalid/expired token → frontend redirects to `/login` |
| `403` | Valid identity, insufficient permission → **include `detail` explaining why**; the vendor-verification case depends on it |
| `404` | Not found, **or** found but not visible to this caller (do not leak existence) |
| `409` | State conflict — e.g. bidding on a closed tender, double-submitting |
| `422` | Validation failed — always populate `errors` keyed by **frontend field name** |
| `429` | Rate limited — include `Retry-After` |
| `5xx` | Server error — never leak exception detail |

`errors` keys must match the frontend's form control names so messages can be bound to fields without translation.

### Idempotency

Mutating endpoints that a user could double-submit (bid submission, request submission, registration) accept:

```http
Idempotency-Key: <client-generated-uuid>
```

Replaying a key returns the original response. The frontend's multi-step forms with autosave make double-submission genuinely likely — the bid submission screen in particular.

### Rate limiting

At minimum on: login, registration, OTP send, contact form. Return `429` + `Retry-After`. OTP endpoints need per-phone **and** per-IP limits.

---

## 3. Cross-cutting requirements

### Soft delete + audit

Never hard-delete tenders, bids, requests, or accounts. Every state transition on those aggregates must record `actorId`, `at`, `from`, `to`, `reason`. The evaluation flow (award decisions) and vendor verification are the ones most likely to be disputed later, so their history has to survive.

### Draft expiry

`ServiceRequest` drafts carry `autoDeleteAt = createdAt + 7 days` (`core/models/service.model.ts:324`) and bid drafts behave similarly. Implement as a scheduled job (Cloud Scheduler → an authenticated endpoint), not a client-side check — the current frontend computes it locally, so a draft only expires if someone opens the app.

### Sealed commercial bids

`bid-evaluation` and `commercial-bid-detail` assume commercial proposals stay **sealed** until the technical phase completes. This must be enforced **server-side** — the API must not return commercial figures for a tender still in technical evaluation, regardless of the caller's role. A frontend-only guard is not a seal.

### File uploads

Vendor documents and tender attachments go to a **private** GCS bucket. Never proxy file bytes through the API:

1. Client requests an upload URL → API returns a short-lived (≈15 min) signed PUT URL scoped to one object path.
2. Client PUTs directly to GCS.
3. Client notifies the API, which records the object and validates it (size, content type, virus scan if in scope).

Downloads use short-lived signed GET URLs. Vendor documents contain PAN/GST/bank details — they must never be publicly readable, and signed URLs must not be logged.

### CORS

> 🔴 **Not configured at all today.** The Angular app cannot call this API — every request fails at preflight. This is the first thing to fix when wiring the two together. See [03 §2.2](03-EXISTING-BACKEND-REVIEW.md).

Allow the frontend origins only (`https://heavenlycorporation.com`, plus `http://localhost:4200`/`:4300` for development). Credentials are carried in the `Authorization` header, so `AllowCredentials` is not required.

### SSR consideration

The frontend prerenders 21 routes and uses `provideClientHydration`. Server-side rendering runs in Node **without** a browser `localStorage`. Any endpoint called during SSR must work with no auth token and return only public data — the public marketing pages must never depend on an authenticated call.

---

## 4. Data model divergences to resolve before implementation

Carried over from [UI_ISSUES.md §3](../UI_ISSUES.md) because it directly shapes the schema:

1. **`ServiceRequest` is declared twice** with different shapes (`core/models` vs `management.model`). The API defines one canonical entity; the frontend must be refactored onto it.
2. **`RequesterType` genuinely disagrees:** `'large_organization'` (signup) vs `'organization'` (management). **Canonical: `large_organization`.**
3. **`ServiceCategory` and `BudgetVisibility`** are duplicated but currently agree. Deduplicate in the frontend to stop them drifting.
4. **Two auth stores** (`AuthService`, `ServiceAuthService`) let one person be logged into both portals at once. The API models **one account with many roles** — see [01-API-AUTH.md §2](01-API-AUTH.md). This is a deliberate change to current frontend behaviour.
5. **`User.UserType` is a single enum** on the backend (`Employer | Applicant | Admin`) and must become a role *set* to accommodate the three service roles — see [03 §2.5](03-EXISTING-BACKEND-REVIEW.md).
