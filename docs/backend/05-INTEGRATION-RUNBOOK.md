# Integration Runbook — connecting the Angular app to the .NET API

**Scope:** the first real vertical slice — **jobs-portal auth** (login / register / session). This is deliberately small: prove the two halves talk before wiring the rest.

> **✅ VERIFIED END-TO-END (2026-07-26).** The full stack now round-trips: Angular → HTTP → .NET 10 → Postgres 16 (Docker) → JWT → session. Proven in-browser with localStorage cleared beforehand, so nothing could be faked by mocks:
> - **Login** through the real form → CORS preflight `204`, `POST /api/auth/login` `200`, tokens stored, routed to `/dashboard`
> - **Signup** → user created via API, auto-logged in, **BCrypt hash** (`$2a$11$…`) persisted in Postgres
> - **Wrong password** → stays on login, generic error, no token stored
> - `GET /me` `200` (and `401` without a token) · `POST /refresh` rotates (old token then `401`) · `POST /logout` `204` and clears sessions (2 → 0 in the DB)
> - Enum casing fixed: `userType` is now `"employer"`, matching the Angular union
>
> `useRealApi` is committed as **`false`** so a fresh clone works with no backend. Flip it to `true` (API on `http://localhost:5212`) to use the real stack.

---

## What was built this stage

### Frontend (`aashin10/Heavenly`, branch `Feature/UI-Rework-Backend-Docs`) — verified

| File | Purpose |
|---|---|
| `src/environments/environment.ts` | `apiBaseUrl` + `useRealApi` flag (default **false** → mocks) |
| `src/app/core/api/token-store.service.ts` | access/refresh token persistence (SSR-safe) |
| `src/app/core/api/auth.interceptor.ts` | attaches `Bearer` to API calls; on 401 clears + redirects to `/login` |
| `src/app/core/api/auth-api.models.ts` | wire types (`AuthResponse`, requests) |
| `src/app/core/api/auth-api.service.ts` | typed client: `login/register/me/refresh/logout` |
| `auth.service.ts` → `loginAsync` / `signupAsync` | branch on `useRealApi`: real HTTP or the existing mock |
| `app.config.ts` | `provideHttpClient(withFetch(), withInterceptors([authInterceptor]))` |
| login page | the two jobs handlers are now `async` and await the above |

With `useRealApi: false` the app behaves exactly as before (verified in-browser: mock login still lands on `/dashboard`).

### Backend (`aashin10/Heavenly-Job-Backend`, branch `feature/frontend-integration-prep`) — built & verified

| Change | File |
|---|---|
| **CORS** policy for the Angular origins (the hard blocker) | `Program.cs` |
| **snake_case enum** serialization (so `userType` is `"applicant"`, not `"Applicant"`) | `Program.cs` |
| Removed the `WeatherForecast` template scaffold | `Program.cs` |
| `GET /api/auth/me` | `Features/Auth/Queries/GetCurrentUser/*`, `AuthController` |
| `POST /api/auth/refresh` (rotating) | `Features/Auth/Commands/RefreshToken/*`, `AuthController` |
| `POST /api/auth/logout` | `Features/Auth/Commands/Logout/*`, `AuthController` |

MediatR auto-registers the new handlers (assembly scan). No manual DI wiring needed.

---

## Running it (everything below is already set up on this machine)

```bash
# 1. database
cd Heavenly-Job-Backend && docker compose up -d      # Postgres 16, healthy on :5432

# 2. api  (migrations auto-apply in Development)
cd src/Api/Heavenly-Job.Api && dotnet run            # → http://localhost:5212

# 3. frontend
cd HeavenlyFrontEnd && npx ng serve --port 4300
```

Then set `useRealApi: true` in `src/environments/environment.ts` (already points at `http://localhost:5212/api`).

**Toolchain/secrets** — .NET 10 SDK is installed (`~/.dotnet`, on PATH via `~/.zshrc`); secrets are in user-secrets with a rotated JWT key. Full detail, plus the **Cloud SQL production path**, lives in the backend repo's `SETUP.md`.

### Smoke test (all verified passing)
```bash
API=http://localhost:5212/api
curl -X POST $API/auth/register -H 'Content-Type: application/json' \
  -d '{"fullName":"T","email":"t@x.test","phone":"+910000000000","password":"StrongP@ss1","userType":0}'
curl -X POST $API/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"t@x.test","password":"StrongP@ss1"}'          # → tokens
curl $API/auth/me -H "Authorization: Bearer <accessToken>"     # → profile
```

---

## Known gaps to expect (and why)

- **`/register` returns `{ userId }` only**, so `signupAsync` does register-then-login (two calls). Fine for now; collapse to one once register returns tokens. The frontend already handles both.
- **Enum casing — FIXED & verified.** `JsonStringEnumConverter` only applies to enum-typed properties; `AuthResponse.UserType` is a `string` built with `.ToString()`, so it still emitted PascalCase. Added `EnumExtensions.ToWireFormat()` and used it in all three handlers → `userType` is now `"employer"`. The JWT *role claim* deliberately stays PascalCase so `[Authorize(Roles=...)]` keeps matching.
- **No silent token refresh yet.** The interceptor clears + redirects on 401; wiring `refresh()` into a retry is the next increment, once this slice is confirmed working end-to-end.
- **Password**: the mock never checked it; the real `LoginUserCommandHandler` verifies a BCrypt hash. Seed users via the real `/register` (which hashes), not by hand.

---

## After this works — recommended order

1. **Session rehydration**: call `/me` on app start to restore the session after reload (replaces the localStorage-timestamp check). ⬅️ **next**
2. **Silent refresh**: interceptor catches 401 → `refresh()` → retry once.
3. **Services-portal backend** (the big greenfield): `UserRole` + extend `UserType`, then `Vendor` + verification, then `ServiceRequester`/`ServiceRequest`, per docs 01–04. Only start this once auth round-trips cleanly.
4. Standardise errors on RFC 9457 Problem Details ([03 §2.4](03-EXISTING-BACKEND-REVIEW.md)) so `422`s carry field-keyed messages the forms can bind.
