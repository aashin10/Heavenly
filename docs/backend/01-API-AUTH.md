# API — Authentication

**Screens covered:** B1 `/login` · B2 `/vendor-signup` · B3 `/service-requester-signup` · B4 `/verification-pending`

**Frontend sources:** `core/services/auth.service.ts`, `core/services/service-auth.service.ts`, `core/models/user.model.ts`, `core/models/service.model.ts:500-596`, `core/guards/*.guard.ts`

Read [README.md](README.md) first for conventions (auth header, error shape, casing, dates, money).

---

## 1. Authentication approach — existing JWT

> **Retraction.** This section originally recommended Firebase Auth. That was written **before reviewing the existing backend** and is withdrawn. Full reasoning in [03-EXISTING-BACKEND-REVIEW.md §3](03-EXISTING-BACKEND-REVIEW.md).

**Decision: keep and extend the API's own JWT authentication.** It is already implemented and working:

| Piece | Where |
|---|---|
| Token issuance (access + refresh) | `Infrastructure/Services/JwtTokenService.cs` |
| Refresh-token persistence, IP + user-agent | `Domain/Entities/UserSession.cs` |
| Password reset flow | `Domain/Entities/PasswordResetToken.cs` |
| Credentials, verification, active flag | `User.PasswordHash`, `EmailVerified`, `IsActive` |
| Bearer validation | `Program.cs` — `ClockSkew = TimeSpan.Zero` |
| Config | `JwtSettings` — 60 min access, 7 day refresh |

Introducing Firebase now would put **two identity systems in one product** — the same defect being fixed on the frontend (IA1) — and would strand the working session and password-reset code.

**No Firebase setup is required.** Nothing is blocked on your console login.

### Phone OTP, when wanted

Phone login is a genuine expectation in this market, and it does not need Firebase. The pattern is already established here twice (`PasswordResetToken`, `UserSession`):

1. Add an SMS provider — **MSG91** is India-native and handles DLT registration; Twilio otherwise.
2. Add `PhoneVerificationToken` mirroring `PasswordResetToken`: code hash, expiry, attempt counter, consumed flag.
3. Rate-limit per phone **and** per IP; expire in ~5 min; cap attempts at 5.

**Start DLT sender registration early** if phone OTP is planned — Indian carriers require it and approval takes days.

### Existing endpoints

Already implemented, documented in the backend repo's own `API_DOCUMENTATION.md`:

| Endpoint | Notes |
|---|---|
| `POST /api/auth/register` | Returns `201` + `{ userId }`. Jobs roles only |
| `POST /api/auth/login` | Returns `AuthResponse` with both tokens |

### Gaps to close on the existing auth

| # | Gap | Why it matters |
|---|---|---|
| 1 | **No refresh endpoint** | `UserSession` persists refresh tokens but nothing exchanges one for a new access token. Users are hard-logged-out after 60 minutes |
| 2 | **No `GET /api/auth/me`** | The frontend cannot rehydrate a session on reload without re-login |
| 3 | **No logout** | `UserSession` rows are never invalidated — a stolen refresh token stays valid for 7 days |
| 4 | **Password reset not wired** | Entity exists; no request/confirm endpoints |
| 5 | **No email verification flow** | `EmailVerified` is never set to `true` by anything |
| 6 | **Secrets in `appsettings.json`** | JWT signing key in plaintext — see [03 §2.1](03-EXISTING-BACKEND-REVIEW.md). **Rotate before first commit** |
| 7 | **No CORS** | The Angular app cannot call the API at all — see [03 §2.2](03-EXISTING-BACKEND-REVIEW.md) |

Items 1–3 are needed before the frontend can hold a session properly. Items 6–7 block the two ever talking.

---

## 2. Account model

### The change from today

The frontend currently runs **two independent stores** — `AuthService` (jobs) and `ServiceAuthService` (services) — with separate `localStorage` keys. One person can be signed into both at once, which is the root of finding IA1.

**The API models one account with many roles.** One `uid`, one account row, a set of roles:

```jsonc
{
  "id": "0190f2c1-…",
  "email": "priya@sharmaelectricals.in",
  "roles": ["vendor"]
}
```

This is a deliberate departure from current frontend behaviour and requires collapsing the two services. It removes a whole class of bug (which session is "the" session?) and matches how people actually think — one login for Heavenly.

### Roles

Union of both portals, unchanged from the existing TypeScript:

| Role | Portal | Source |
|---|---|---|
| `applicant` | Jobs | `UserType` |
| `employer` | Jobs | `UserType` |
| `admin` | Jobs | `UserType` |
| `service_requester` | Services | `ServiceUserType` |
| `vendor` | Services | `ServiceUserType` |
| `service_admin` | Services | `ServiceUserType` |

Roles are a **set** — a user may legitimately be both `employer` and `service_requester`. The frontend's navbar already derives a single `SessionView` and can render role-specific links from an array.

> **Open question for you:** should `admin` and `service_admin` merge? They gate different screens (`/management` vs `/management/evaluation`) but are likely the same people. Merging simplifies; keeping them separate allows delegating tender evaluation without granting job moderation. **Recommend keeping separate** — least privilege, and the split already exists.


### Login flow

Credentials go to the API; the API issues the tokens. No third party involved.

```
1. Angular ──> POST /api/auth/login  { email, password }
2. API     : verify hash, create UserSession, issue access + refresh
3. API     ──> AuthResponse (both tokens + expiries + user summary)
4. Angular : store tokens, route by role
5. Angular ──> POST /api/auth/refresh when access token nears expiry
```

`AuthResponse` already carries enough to render the navbar without a second call — `userId`, `email`, `name`, `userType`, `company`. Extending it with a `roles` array (§2) removes the need for a separate profile fetch on login.

This also fixes **IA2** (three decisions before credentials): with roles on the response, login is one email+password form and the app routes afterwards — no portal toggle, no role tab.

---

## 3. Endpoints

### `POST /api/auth/login` — exists

Request and `AuthResponse` are documented in the backend repo's `API_DOCUMENTATION.md`. **Two changes needed:**

```jsonc
{
  "userId": "550e8400-…",
  "email": "priya@sharmaelectricals.in",
  "name": "Priya Sharma",
  "userType": "vendor",              // CHANGE: lowercase, was "Applicant"
  "roles": ["vendor"],               // ADD: the authoritative set
  "company": null,
  "accessToken": "eyJ…",
  "refreshToken": "dGhp…",
  "accessTokenExpiresAt": "2026-07-19T15:30:00Z",
  "refreshTokenExpiresAt": "2026-07-26T14:30:00Z",

  // ADD: present only when roles includes "vendor"
  "vendor": {
    "id": "0190f2c1-…",
    "businessName": "Sharma Electricals",
    "verificationStatus": "pending",
    "canAccessPortal": false
  }
}
```

`userType` stays for backward compatibility with whatever already consumes it; `roles` becomes authoritative.

`canAccessPortal` is computed server-side (`verificationStatus == Verified`). The frontend's `vendorVerifiedGuard` should read the boolean rather than re-deriving the rule.

---

### `GET /api/auth/me` — **new, needed**

Session rehydration on page reload. Without it the frontend must either re-login or trust a cached payload.

**Auth:** required. **200:** same body as `AuthResponse` minus the token fields.

**401** if the token is invalid/expired. **403** if `IsActive == false`.

---

### `POST /api/auth/refresh` — **new, needed**

`UserSession` already persists refresh tokens; nothing exchanges them. Without this, every user is hard-logged-out after 60 minutes.

```jsonc
{ "refreshToken": "dGhp…" }
```

**200** → a fresh `AuthResponse`.

**Rotate on use:** issue a new refresh token and invalidate the old `UserSession` row. If an already-consumed refresh token is presented, treat it as theft — revoke **all** sessions for that user and return `401`.

---

### `POST /api/auth/logout` — **new, needed**

Invalidates the current `UserSession`. Without it, a stolen refresh token stays valid for 7 days. Accept an optional `allSessions: true` for "sign out everywhere". **204.**

---

### `POST /api/auth/register` — exists, needs extension

Currently takes `UserType` (`Employer | Applicant | Admin`) and creates a `User`. The services portal needs two more registration paths that create a `User` **plus** a profile entity.

---

### `POST /api/auth/register/requester` — **new**

Maps `RequesterSignupFormData` (`service.model.ts:543`). The frontend's three-step wizard flattens to one call — steps are UI, not transactions.

```jsonc
{
  "fullName": "Priya Sharma",
  "email": "priya@brightinteriors.in",
  "phone": "+919876543210",
  "password": "…",
  "requesterType": "sme",              // individual | sme | large_organization

  // exactly one block, matching requesterType
  "individual":  { "city": "New Delhi", "address": "64B, DDA Flats, Shivaji Enclave Extension" },
  "sme":         { "organizationName": "Bright Interiors", "gstNumber": "07AABCU9603R1ZM",
                   "businessAddress": "…", "city": "New Delhi",
                   "authorizedPersonName": "Priya Sharma", "designation": "Director" },
  "largeOrganization": { "organizationName": "…", "gstNumber": "07AABCU9603R1ZM",
                   "registeredAddress": "…", "city": "New Delhi",
                   "authorizedPersonName": "…", "designation": "…", "department": "Facilities" },

  "termsAccepted": true,
  "marketingConsent": false
}
```

**Validation** (a `RegisterRequesterCommandValidator`, following the existing FluentValidation pattern):

| Field | Rule |
|---|---|
| `requesterType` | Must match exactly one populated block → else `422` |
| `gstNumber` | 15-char GSTIN, checksum-validated. Required for `large_organization`, optional for `sme`, rejected for `individual` |
| `phone` | E.164, Indian mobile |
| `password` | Same policy as the existing `RegisterUserCommandValidator` |
| `termsAccepted` | Must be `true` |

> **Canonical value: `large_organization`.** `management.model.ts` declares `'organization'` — a frontend bug ([UI_ISSUES.md §3](../UI_ISSUES.md)).

**201** → `AuthResponse` (log them straight in). **409** if the email exists.

---

### `POST /api/auth/register/vendor` — **new**

Maps `VendorSignupFormData` (`service.model.ts:594`) — a four-step wizard.

```jsonc
{
  // account
  "email": "priya@sharmaelectricals.in",
  "password": "…",

  // step 1 — business identity
  "businessName": "Sharma Electricals",
  "businessType": "private_limited",   // individual_contractor | partnership | private_limited | llp | others
  "gstNumber": "07AABCU9603R1ZM",
  "panNumber": "AABCU9603R",
  "yearEstablished": 2014,

  // step 2 — contact
  "primaryContactPerson": "Priya Sharma",
  "designation": "Director",
  "phone": "+919876543210",
  "alternatePhone": "+919812345678",
  "registeredAddress": "…", "city": "New Delhi", "state": "Delhi", "pinCode": "110027",

  // step 3 — capabilities
  "serviceCapabilities": ["ac-servicing", "electrical-materials"],
  "serviceAreas": ["New Delhi", "Gurugram", "Noida"],

  // step 4 — documents (uploaded first, referenced by id) + bank
  "documentIds": ["0190f2c1-…", "0190f2c2-…"],
  "bankDetails": {
    "accountHolderName": "Sharma Electricals Pvt Ltd",
    "accountNumber": "50100123456789",
    "ifscCode": "HDFC0001234",
    "bankName": "HDFC Bank"
  },
  "termsAccepted": true
}
```

**Validation**

| Field | Rule |
|---|---|
| `gstNumber` | 15-char GSTIN, checksum-validated, **required** |
| `panNumber` | `[A-Z]{5}[0-9]{4}[A-Z]`. 5th char encodes entity type — cross-check against `businessType` |
| `yearEstablished` | 1900 ≤ y ≤ current year |
| `ifscCode` | `[A-Z]{4}0[A-Z0-9]{6}` |
| `accountNumber` | 9–18 digits |
| `serviceCapabilities` | Non-empty; every ID must exist in the catalogue |
| `pinCode` | 6 digits |

**201** → `AuthResponse` with `vendor.verificationStatus: "pending"`, `canAccessPortal: false`.

**Side effects:** creates `User` + `Vendor` + `VendorBankDetails` in one transaction; enqueues an admin verification task (screen F8 — **does not exist**, see [UI_ISSUES.md §2](../UI_ISSUES.md)).

**Sensitive data.** `panNumber` and `accountNumber` are PII with real consequences. Encrypt at rest, never log, and return only a masked `••••6789`. The existing `UploadedFile` entity is the precedent for handling documents.

---

### `GET /api/vendors/me/verification` — **new**

Powers `/verification-pending` (B4).

```jsonc
{
  "status": "pending",                    // pending | verified | rejected | suspended
  "submittedAt": "2026-07-18T11:20:00Z",
  "reviewedAt": null,
  "message": "Your documents are being reviewed. This usually takes 24–48 hours.",
  "canAccessPortal": false,
  "missingDocuments": ["tradeLicense"],
  "rejectionReason": null
}
```

`missingDocuments` and `rejectionReason` are what turn this from a dead-end screen into something actionable — `/verification-pending` is currently terminal with no path forward.

Poll at ~60s while the tab is visible, or refresh on focus. Verification is a human process measured in hours.

---

## 4. Authorisation matrix

Enforced server-side. Frontend guards are UX, not security.

| Endpoint | applicant | employer | admin | service_requester | vendor (verified) | vendor (pending) | service_admin |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `GET /api/auth/me` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `POST /api/auth/register/*` | — anonymous — |||||||
| `GET /api/vendors/me/verification` | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |
| Vendor portal (`/api/tenders`, `/api/bids`) | ❌ | ❌ | ❌ | ❌ | ✅ | **❌ 403** | ❌ |
| Management | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ |

**The `pending` vendor 403 must carry a useful `detail`** so the frontend can route to `/verification-pending` rather than showing a generic error:

```jsonc
{
  "type": "https://api.heavenlycorporation.com/errors/vendor-not-verified",
  "title": "Vendor not verified",
  "status": 403,
  "detail": "Your vendor account is pending verification. You'll get portal access once an administrator approves your documents."
}
```

---

## 5. Schema changes

Additive to the existing EF Core model. Entities go in `Domain/Entities`, configs in `Infrastructure/Persistence/Configurations`, following the established pattern.

### Extend `UserType`

```csharp
public enum UserType
{
    Employer, Applicant, Admin,            // existing
    ServiceRequester, Vendor, ServiceAdmin // new
}
```

### New: `UserRole` — roles become a set

```csharp
public class UserRole
{
    public string UserId { get; set; } = null!;
    public UserType Role { get; set; }
    public DateTime GrantedAt { get; set; } = DateTime.UtcNow;
    public string? GrantedBy { get; set; }
    public virtual User User { get; set; } = null!;
}
```

`User.UserType` stays as the *primary* role so existing queries keep working; `UserRoles` becomes authoritative. Backfill one row per existing user in the migration.

### New: `Vendor`, `VendorBankDetails`, `VendorDocument`, `ServiceRequester`, `VendorVerificationEvent`

```csharp
public class Vendor
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string UserId { get; set; } = null!;            // 1:1 with User
    public string BusinessName { get; set; } = null!;
    public VendorBusinessType BusinessType { get; set; }
    public string GstNumber { get; set; } = null!;
    public string PanNumberEncrypted { get; set; } = null!;
    public int YearEstablished { get; set; }
    public string PrimaryContactPerson { get; set; } = null!;
    public string Designation { get; set; } = null!;
    public string? AlternatePhone { get; set; }
    public Address RegisteredAddress { get; set; } = null!;  // reuse existing value object
    public List<string> ServiceCapabilities { get; set; } = [];
    public List<string> ServiceAreas { get; set; } = [];
    public VendorStatus VerificationStatus { get; set; } = VendorStatus.Pending;
    public DateTime? VerifiedAt { get; set; }
    public string? VerifiedBy { get; set; }
    public string? RejectionReason { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public virtual User User { get; set; } = null!;
    public virtual VendorBankDetails? BankDetails { get; set; }
    public virtual ICollection<VendorDocument> Documents { get; set; } = [];
}
```

**Notes**
- Reuse the existing `Address` value object rather than adding loose city/state/pin columns.
- `ServiceCapabilities` maps to a Postgres `text[]` with a **GIN index** — tender→vendor matching queries it on every publish.
- `VendorVerificationEvent` records every transition (`from`, `to`, `actor`, `reason`, `at`). Award and verification decisions get disputed; the history must survive.
- Vendor documents reuse the existing `UploadedFile` entity where possible rather than a parallel table.

---

## 6. Frontend changes required

| # | Change | Why |
|---|---|---|
| 1 | Collapse `AuthService` + `ServiceAuthService` | One account, many roles. Resolves C1/IA1 at the data layer |
| 2 | Replace `localStorage` mock auth with real HTTP + token storage | `loginServiceRequester(email, _password)` currently **ignores the password** |
| 3 | Add token refresh before expiry | Access token is 60 min |
| 4 | Simplify login to one email+password form | Roles come from the response. Resolves IA2 |
| 5 | `vendorVerifiedGuard` reads `canAccessPortal` | Stop duplicating the rule client-side |
| 6 | Fix `RequesterType` in `management.model.ts` | `'organization'` → `'large_organization'` |
| 7 | Signup submits once at the end | Steps are UI; registration is one transaction |
| 8 | Wire file upload in vendor signup step 4 | Currently holds `File` objects that go nowhere |
| 9 | Delete `heavenly_*` localStorage seeding | Contains **plaintext passwords** ([UI_ISSUES.md §4](../UI_ISSUES.md)) |

---

## 7. Open questions

1. **Should `Admin` and `ServiceAdmin` merge?** Recommend separate — least privilege, and the split already exists in the frontend routes.
2. **Can one person be both vendor and requester?** The schema allows it. Add a constraint if not — though a contractor also requesting services seems plausible.
3. **Vendor re-verification on profile change?** If GST/PAN/bank change post-approval, revert to `pending`? **Recommend yes** for those three; no for address or service areas.
4. **Where does `ContactInquiry` get its endpoint?** The entity exists with no controller — the contact form (A4) has nowhere to post.
5. **API versioning** — add `/v1` now or defer? Deferring is defensible with one first-party consumer.
