# Existing Backend — Review

**Reviewed:** 2026-07-19 · `/Users/admin/Heavenly/Heavenly-Job-Backend`

> **Correction notice.** `README.md` and `01-API-AUTH.md` were originally written as a **greenfield design**, without checking this repository. That was wrong, and one recommendation in particular — **use Firebase Auth** — is now **retracted**. See §3. This document is the source of truth for what exists; the other docs have been amended to match.

---

## 1. What is already built

A genuinely well-structured **.NET 10 Clean Architecture** solution. This is not scaffolding — it is a working jobs-portal API.

```
Heavenly-Job-Backend.slnx
└── src/
    ├── Domain/          entities, enums, value objects — no dependencies
    ├── Application/     CQRS handlers, DTOs, validators, interfaces
    ├── Infrastructure/  EF Core, Postgres, JWT service, migrations
    └── Api/             controllers, Swagger, JWT bearer setup
```

### Stack

| Concern | Choice |
|---|---|
| Runtime | **.NET 10** (`net10.0`) |
| Pattern | Clean Architecture + **CQRS via MediatR** |
| Validation | **FluentValidation** (per-command validators) |
| ORM | **EF Core 10** + **Npgsql** |
| Database | **PostgreSQL** — `heavenlyjob` |
| Auth | **Custom JWT** — access + refresh tokens |
| Logging | **Serilog** (console + file) |
| Docs | **Swashbuckle** with JWT auth in Swagger UI |
| Strictness | `TreatWarningsAsErrors`, `WarningLevel 9999`, `Nullable enable` |

`TreatWarningsAsErrors` with `WarningLevel 9999` is an unusually high bar and a good sign — the codebase is held to it.

### Domain entities (13)

`User` · `UserSession` · `PasswordResetToken` · `Job` · `JobApplication` · `JobDomain` · `JobSkill` · `SavedJob` · `JobNotification` · `JobAdminAction` · `ApplicationStatusHistory` · `ContactInquiry` · `UploadedFile`

Value objects: `Address`, `Email`, `Money` — so the money-as-value-object convention already exists and my `{ amount, currency }` proposal should defer to `Money`'s actual shape.

### Implemented endpoints

Base route is `api/[controller]` (`ApiControllerBase`). Documented in the repo's own `API_DOCUMENTATION.md`.

| Endpoint | Feature slice |
|---|---|
| `POST /api/auth/register` | `RegisterUser` command + validator |
| `POST /api/auth/login` | `LoginUser` command + validator |
| `GET /api/jobdomains` | `GetJobDomains` query |
| `GET /api/jobs` | `GetJobsWithPagination` |
| `GET /api/jobs/{id}` | `GetJobById` |
| `POST /api/jobs` | `CreateJob` |
| `GET /api/jobs/by-user` | `GetJobsByUser` |
| `GET /api/jobs/stats` | `GetJobStats` |
| `GET /api/jobs/by-status` | `GetJobsByStatus` (admin, paginated) |
| `/api/users/*` | `UsersController` |

### Coverage against the frontend

| Frontend area | Backend status |
|---|---|
| Jobs portal (C1–C4) | **Substantially built** |
| Auth — jobs roles | **Built** (`Employer`/`Applicant`/`Admin`) |
| Contact form (A4) | Entity exists (`ContactInquiry`); endpoint not found |
| **Services portal** — requests, tenders, bids, vendors, evaluation (D, E, F) | **Nothing.** No `ServiceRequest`, `Tender`, `Bid`, or `Vendor` entity exists |

**The entire services marketplace is unbuilt on the backend.** That is the bulk of the frontend — 18 of 27 screens.

---

## 2. Blocking issues

### 2.1 🔴 Secrets are committed in plaintext

`src/Api/Heavenly-Job.Api/appsettings.json`:

```jsonc
"ConnectionStrings": {
  "DefaultConnection": "Host=localhost;…;Username=postgres;Password=<REDACTED>"
},
"JwtSettings": {
  "SecretKey": "<REDACTED — 64-hex-char HMAC key>",
  …
}
```

> Real values redacted here. This repo is public — the actual password and
> signing key live only in the backend's `appsettings.json` (a private repo),
> and both should be rotated since they were committed to that file.

A database password and the **JWT signing key** are in the tracked config file. Anyone with the signing key can mint valid tokens for any user, including `Admin`.

The directory is **not currently a git repo** (`git rev-parse` fails), so this has not been pushed anywhere yet. That is lucky and worth acting on **before** the first `git init`:

1. Move both to **user-secrets** for local dev (`dotnet user-secrets set`).
2. Use **Secret Manager** + Workload Identity in Cloud Run for production.
3. **Rotate the JWT key** — treat the current one as compromised; it has been sitting in a plaintext file.
4. Add a `.gitignore` covering `appsettings.*.json`, `bin/`, `obj/` before initialising the repo.

### 2.2 🔴 No CORS — the frontend cannot call this API

`grep -rn "AddCors|UseCors" src/` returns nothing. The Angular app on `localhost:4200` will fail every request at the browser preflight. This is the first thing to fix when wiring the two together.

```csharp
builder.Services.AddCors(o => o.AddPolicy("frontend", p => p
    .WithOrigins("https://heavenlycorporation.com", "http://localhost:4200", "http://localhost:4300")
    .AllowAnyHeader()
    .AllowAnyMethod()));
// after UseHttpsRedirection, before UseAuthentication:
app.UseCors("frontend");
```

### 2.3 🟡 Template scaffolding still present

`Program.cs` still carries the `WeatherForecast` record and its `/weatherforecast` endpoint from the project template. Harmless but it ships in production and appears in Swagger. Delete.

### 2.4 🟡 Error shape is inconsistent with itself

`AuthController` returns three different error shapes:

```jsonc
{ "errors": ["Email is required."] }        // 400 — array of strings
{ "message": "Invalid email or password." } // 401 — single message
{ "message": "…already exists" }            // 409
```

The 409 is caught by **string-matching an exception message** (`ex.Message.Contains("already exists")`), which will break the moment that message is reworded.

Recommend a global exception-handling middleware emitting **RFC 9457 Problem Details** (built into ASP.NET Core), with `errors` keyed by field name so the Angular forms can bind messages to controls. Worth doing now, while there are only four controllers.

### 2.5 🟡 `UserType` is a single enum, not a role set

`User.UserType` is one of `Employer | Applicant | Admin`. The services portal adds `service_requester`, `vendor`, `service_admin` — and a person can legitimately be an employer *and* a service requester.

This is the same modelling question the frontend has (two auth stores, [UI_ISSUES.md §5](../UI_ISSUES.md)). Decide before building the services domain: **extend `UserType`**, or **move to a `UserRoles` join table**. Recommend the join table — see §4.

### 2.6 🟢 Enum serialisation

`AuthResponse.UserType` is a `string` set to the enum name — `"Applicant"`, PascalCase. The frontend's `UserType` union is lowercase (`'applicant'`). Something must normalise. Recommend serialising enums as lowercase strings via a `JsonStringEnumConverter` with a naming policy, so the API matches the TypeScript unions directly and no mapping layer is needed.

---

## 3. Firebase — recommendation retracted

**Previous recommendation: adopt Firebase Auth. That was made without knowledge of this codebase and is withdrawn.**

Already implemented here:

- `JwtTokenService` issuing access + refresh tokens
- `UserSession` entity — refresh-token persistence, IP and user-agent capture
- `PasswordResetToken` entity — reset flow modelled
- `User.PasswordHash`, `EmailVerified`, `IsActive`, `LastLoginAt`
- JWT bearer validation wired in `Program.cs` with `ClockSkew = TimeSpan.Zero`

Adopting Firebase now would mean **two authentication systems in one product** — precisely the defect being fixed on the frontend (IA1: two parallel auth stores). It would also strand the working session and password-reset code.

**Revised recommendation: keep the existing JWT auth. Extend it.**

The original argument for Firebase was **phone OTP**, and that argument still holds on its own terms — phone login is expected in this market. But it does not require Firebase. When phone OTP is wanted:

- Add an SMS provider (MSG91 or Twilio; MSG91 is India-native and handles DLT registration).
- Add `PhoneVerificationToken` alongside the existing `PasswordResetToken` — same pattern, already established here.
- OTP is a short-lived code with attempt limits and expiry. Non-trivial, but this codebase already demonstrates the token-lifecycle pattern twice.

That keeps one identity system, one user table, one set of claims.

**You do not need to set up Firebase.** Nothing is blocked on your console login — I should not have asked. Apologies for the detour.

### What Google Cloud still gives you

| Need | Service |
|---|---|
| API hosting | **Cloud Run** (containerised .NET) |
| Frontend hosting (SSR) | **Cloud Run** — Angular SSR needs a Node runtime |
| Database | **Cloud SQL for PostgreSQL** — matches Npgsql exactly |
| Secrets | **Secret Manager** — fixes §2.1 |
| File storage | **Cloud Storage** — for `UploadedFile` and vendor documents |
| Images | **Artifact Registry** |

No Firebase anywhere in that list.

---

## 4. Extending to the services portal

The services marketplace is greenfield, but it must follow this codebase's existing conventions rather than invent new ones:

- One vertical slice per feature: `Features/<Aggregate>/Commands|Queries/<Name>/` with `Command`, `Handler`, `Validator`, `Dto`.
- Entities in `Domain/Entities`, enums in `Domain/Enums`, EF config in `Infrastructure/Persistence/Configurations`.
- Reuse the `Money`, `Address`, `Email` value objects — do not introduce a parallel money representation.
- Controllers stay thin: build command → `Mediator.Send` → map result.

### Suggested account model

Rather than growing `UserType` into six values:

```csharp
// Domain/Entities/UserRole.cs
public class UserRole
{
    public string UserId { get; set; } = null!;
    public UserType Role { get; set; }      // enum extended with the three service roles
    public DateTime GrantedAt { get; set; }
    public string? GrantedBy { get; set; }
}
```

`User` keeps `UserType` as the *primary* role for backward compatibility with existing queries, with `UserRoles` as the authoritative set. Migrate reads to the collection incrementally.

`Vendor` and `ServiceRequester` become **profile entities hanging off `User`** (one-to-one, nullable), not user subtypes — a person may be both.

### Ordering

1. `UserRole` + extend `UserType` — unblocks every service role.
2. `Vendor` + verification workflow — vendors gate the whole portal ([UI_ISSUES.md §2](../UI_ISSUES.md)).
3. `ServiceRequester` + `ServiceRequest`.
4. `Tender` (from an approved request).
5. `Bid` + sealed commercial handling.
6. Evaluation + `Award`.

---

## 5. Corrections applied to the other docs

| Doc | Change |
|---|---|
| `README.md` | Base path `/v1/…` → `/api/…`; Firebase removed from architecture; conventions aligned to existing code |
| `01-API-AUTH.md` | Firebase section retracted; rewritten around the existing JWT auth, `AuthResponse`, and `UserSession` |
| `02-API-VENDOR-DASHBOARD.md` | Auth header note updated; endpoint path corrected to `/api/…` |

`00-SCREEN-INVENTORY.md` needs no change — it describes the frontend, which is unaffected.
