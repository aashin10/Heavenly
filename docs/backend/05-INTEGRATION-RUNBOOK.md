# Integration Runbook — connecting the Angular app to the .NET API

**Scope:** the first real vertical slice — **jobs-portal auth** (login / register / session). This is deliberately small: prove the two halves talk before wiring the rest.

> **Status of this stage.** The frontend integration layer is built and verified (compiles; mock path unchanged). The backend changes are written to the existing code's patterns but **were not compiled here — this machine has no .NET SDK.** You need to build and run them. Everything you must do is below.

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

### Backend (`aashin10/Heavenly-Job-Backend`, branch `feature/frontend-integration-prep`) — **needs your build**

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

## Your steps (in order)

### 1. Install the toolchain
- **.NET 10 SDK** (the project targets `net10.0`): https://dotnet.microsoft.com/download
- **PostgreSQL** — local install, or Docker:
  ```bash
  docker run --name heavenly-pg -e POSTGRES_PASSWORD=<new-password> \
    -e POSTGRES_DB=heavenlyjob -p 5432:5432 -d postgres:16
  ```

### 2. Rotate the secrets, move them out of `appsettings.json`
The committed `appsettings.json` still holds the old DB password and JWT key — **rotate both**, then use user-secrets so they never sit in source again:
```bash
cd src/Api/Heavenly-Job.Api
dotnet user-secrets init
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Host=localhost;Port=5432;Database=heavenlyjob;Username=postgres;Password=<new-password>"
dotnet user-secrets set "JwtSettings:SecretKey" "<new-64+ char random key>"
```
Then blank those two values in `appsettings.json` (leave the keys, empty the secrets). User-secrets override at runtime in Development.

### 3. Build & run the API
```bash
cd src/Api/Heavenly-Job.Api
dotnet build          # <-- fix any compile errors the new files surface, then:
dotnet run
```
Migrations auto-apply in Development (`Program.cs`). Note the HTTPS port it binds (commonly `https://localhost:5001` or a `:7xxx` port from `launchSettings.json`).

### 4. Point the frontend at it & flip the flag
In `src/environments/environment.ts`:
```ts
apiBaseUrl: 'https://localhost:5001/api',   // match the port from step 3
useRealApi: true,
```
If the API's dev cert isn't trusted: `dotnet dev-certs https --trust`.

### 5. Test the slice
1. Register a user through the jobs signup form → should `201` then auto-login.
2. Log out, log back in → lands on `/dashboard`, `Authorization: Bearer …` on the `/me`-style calls (check devtools Network).
3. Confirm no CORS error in the console (that's the #1 thing this stage fixes).

---

## Known gaps to expect (and why)

- **`/register` returns `{ userId }` only**, so `signupAsync` does register-then-login (two calls). Fine for now; collapse to one once register returns tokens. The frontend already handles both.
- **Enum casing**: the fix makes responses lowercase. `applyAuthResponse` also lowercases defensively, so it works either way — but do apply the backend fix so *all* endpoints are consistent.
- **No silent token refresh yet.** The interceptor clears + redirects on 401; wiring `refresh()` into a retry is the next increment, once this slice is confirmed working end-to-end.
- **Password**: the mock never checked it; the real `LoginUserCommandHandler` verifies a BCrypt hash. Seed users via the real `/register` (which hashes), not by hand.

---

## After this works — recommended order

1. **Session rehydration**: call `/me` on app start to restore the session after reload (replaces the localStorage-timestamp check).
2. **Silent refresh**: interceptor catches 401 → `refresh()` → retry once.
3. **Services-portal backend** (the big greenfield): `UserRole` + extend `UserType`, then `Vendor` + verification, then `ServiceRequester`/`ServiceRequest`, per docs 01–04. Only start this once auth round-trips cleanly.
4. Standardise errors on RFC 9457 Problem Details ([03 §2.4](03-EXISTING-BACKEND-REVIEW.md)) so `422`s carry field-keyed messages the forms can bind.
