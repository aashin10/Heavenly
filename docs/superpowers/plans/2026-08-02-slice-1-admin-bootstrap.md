# Slice 1 — Admin Bootstrap + Silent Token Refresh — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make it possible for a `ServiceAdmin` account to exist, and stop 60-minute token expiry from logging people out mid-session — the two things blocking every remaining slice of the services-portal roadmap.

**Architecture:** Backend gains a configuration-driven startup seeder that creates one platform `Admin` if absent, plus a small `/api/admin/users` surface where that Admin can grant and revoke the `ServiceAdmin` role. Frontend gains a single-flight refresh coordinator so the HTTP interceptor retries a 401'd request once with a fresh token instead of clearing the session.

**Tech Stack:** .NET 10 · EF Core 10 + Npgsql · MediatR · FluentValidation · BCrypt.Net-Next · xUnit + Testcontainers · Angular 17 · RxJS · Karma/Jasmine

## Global Constraints

- Backend work happens on branch `feature/admin-bootstrap` off `develop`. Frontend work happens on branch `feature/silent-token-refresh` off `dev-non-test`.
- `useRealApi` stays committed as `false`.
- Wire format: `camelCase` JSON, enums as lowercase `snake_case` strings, dates ISO 8601 UTC, IDs opaque strings.
- New endpoints throw `ValidationException` / `NotFoundException` / `ConflictException` and let `GlobalExceptionHandler` render RFC 9457 Problem Details. Never return a bespoke error shape.
- Every new endpoint gets integration tests in `tests/Heavenly-Job.IntegrationTests/`, decorated `[Collection(DatabaseCollection.Name)]`, seeding uniquely-keyed rows. The suite is **193 tests** before this slice and must stay green.
- No secret is ever committed. The seed password lives in `dotnet user-secrets` locally and in the platform secret store in deployed environments.
- Conventional-commit prefixes: `feat:`, `fix:`, `test:`, `docs:`, `chore:`.

---

## File Structure

**Backend — create**

| File | Responsibility |
|---|---|
| `src/Api/Heavenly-Job.Api/Configuration/AdminSeedSettings.cs` | Options object bound from the `AdminSeed` configuration section. |
| `src/Api/Heavenly-Job.Api/Configuration/AdminSeeder.cs` | Idempotent startup seed of one platform `Admin` user + `user_roles` row. |
| `src/Api/Heavenly-Job.Api/Controllers/AdminUsersController.cs` | `/api/admin/users` — find a user, grant a role, revoke a role. |
| `src/Application/Heavenly-Job.Application/Features/Admin/Common/UserAdminDto.cs` | Wire shape for an account as an admin sees it, including its role set. |
| `src/Application/Heavenly-Job.Application/Features/Admin/Queries/FindUsers/FindUsersQuery.cs` | Query + handler: look a user up by email fragment. |
| `src/Application/Heavenly-Job.Application/Features/Admin/Commands/GrantRole/GrantRoleCommand.cs` | Command + validator + handler: add a role to a user. |
| `src/Application/Heavenly-Job.Application/Features/Admin/Commands/RevokeRole/RevokeRoleCommand.cs` | Command + validator + handler: remove a role from a user. |
| `tests/Heavenly-Job.IntegrationTests/AdminBootstrapTests.cs` | Seeding + role grant/revoke, including every refusal. |

**Backend — modify**

| File | Change |
|---|---|
| `src/Api/Heavenly-Job.Api/Program.cs` | Bind `AdminSeedSettings`; run `AdminSeeder` after the migration block. |
| `tests/Heavenly-Job.IntegrationTests/HeavenlyApiFactory.cs` | Supply `AdminSeed:*` config so the seeded admin exists for this and later slices. |

**Frontend — create**

| File | Responsibility |
|---|---|
| `src/app/core/api/token-refresh.coordinator.ts` | Owns the single in-flight refresh; hands back a fresh access token. |
| `src/app/core/api/token-refresh.coordinator.spec.ts` | Proves concurrent callers share one HTTP refresh. |
| `src/app/core/api/auth.interceptor.spec.ts` | Proves attach / refresh-and-retry / give-up behaviour. |

**Frontend — modify**

| File | Change |
|---|---|
| `src/app/core/api/auth.interceptor.ts` | Refresh once and retry on 401 instead of clearing the session. |

The coordinator is a separate file from the interceptor on purpose: the interceptor is a pure function with no place to hold state, and single-flight *is* state. Splitting them also means the deduplication rule can be tested without an HTTP interceptor harness.

---

## Task 1: Put the backend repo on the right branch

The local backend checkout is on `main`, which contains no ServicesPortal code at all. Running or building from it would look like half the product had been deleted.

**Files:**
- Modify: none (working-tree branch change only)

**Interfaces:**
- Consumes: nothing
- Produces: a `develop`-based checkout at `/Users/admin/Heavenly-agentic/Heavenly-Job-Backend` with all ServicesPortal controllers present, and a green 193-test baseline

- [ ] **Step 1: Confirm the working tree is clean**

```bash
cd /Users/admin/Heavenly-agentic/Heavenly-Job-Backend && git status --short
```

Expected: no output. If there is output, stop and resolve it before switching branches.

- [ ] **Step 2: Switch to develop**

```bash
cd /Users/admin/Heavenly-agentic/Heavenly-Job-Backend && git checkout develop && git pull --ff-only
```

Expected: `Switched to branch 'develop'` and an up-to-date working tree.

- [ ] **Step 3: Verify the ServicesPortal code is actually present**

```bash
ls /Users/admin/Heavenly-agentic/Heavenly-Job-Backend/src/Api/Heavenly-Job.Api/Controllers/ServicesPortal/
```

Expected: ten files — `AwardAdminController.cs`, `AwardsController.cs`, `BidAdminController.cs`, `BidsController.cs`, `ServiceRequestAdminController.cs`, `ServiceRequestersController.cs`, `ServiceRequestsController.cs`, `TenderAdminController.cs`, `VendorAdminController.cs`, `VendorsController.cs`. If you see zero, you are still on `main`.

- [ ] **Step 4: Establish the green baseline**

```bash
cd /Users/admin/Heavenly-agentic/Heavenly-Job-Backend && dotnet test
```

Expected: `Passed! - Failed: 0, Passed: 193`. Docker must be running — the suite starts a `postgres:16` Testcontainer. If the count differs from 193, record the real number; that is the baseline every later step compares against.

- [ ] **Step 5: Create the feature branch**

```bash
cd /Users/admin/Heavenly-agentic/Heavenly-Job-Backend && git checkout -b feature/admin-bootstrap
```

---

## Task 2: Seed a platform Admin from configuration

**Files:**
- Create: `src/Api/Heavenly-Job.Api/Configuration/AdminSeedSettings.cs`
- Create: `src/Api/Heavenly-Job.Api/Configuration/AdminSeeder.cs`
- Modify: `src/Api/Heavenly-Job.Api/Program.cs`
- Modify: `tests/Heavenly-Job.IntegrationTests/HeavenlyApiFactory.cs`
- Test: `tests/Heavenly-Job.IntegrationTests/AdminBootstrapTests.cs`

**Interfaces:**
- Consumes: `ApplicationDbContext`, `User`, `UserRole`, `UserType` (all existing)
- Produces:
  - `HeavenlyJob.Api.Configuration.AdminSeedSettings` with `const string SectionName = "AdminSeed"` and properties `string? Email`, `string? Password`, `string Name`
  - `static Task HeavenlyJob.Api.Configuration.AdminSeeder.SeedAsync(IServiceProvider services, CancellationToken cancellationToken = default)`
  - A seeded account reachable via `POST /api/auth/login` whose `roles` array contains `"admin"`

- [ ] **Step 1: Write the failing test**

Create `tests/Heavenly-Job.IntegrationTests/AdminBootstrapTests.cs`:

```csharp
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using HeavenlyJob.Domain.Entities;
using HeavenlyJob.Domain.Enums;
using HeavenlyJob.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace HeavenlyJob.IntegrationTests;

/// <summary>
/// The admin bootstrap: a configured platform Admin is seeded at startup, and
/// that Admin is the only account that can grant the ServiceAdmin role.
///
/// <para>Without this, no account satisfying
/// <c>[Authorize(Roles = "ServiceAdmin,Admin")]</c> can be created at all —
/// registration explicitly refuses <see cref="UserType.Admin"/> — so the entire
/// <c>/api/service-admin/**</c> surface is unreachable.</para>
/// </summary>
[Collection(DatabaseCollection.Name)]
public class AdminBootstrapTests : IAsyncLifetime
{
    private readonly HeavenlyApiFactory _factory;
    private HttpClient _client = null!;

    public AdminBootstrapTests(HeavenlyApiFactory factory) => _factory = factory;

    public async Task InitializeAsync()
    {
        await _factory.MigrateAsync();
        _client = _factory.CreateClient();
    }

    public Task DisposeAsync() => Task.CompletedTask;

    [Fact]
    public async Task SeededAdmin_CanLogIn_AndHoldsTheAdminRole()
    {
        var res = await _client.PostAsJsonAsync("/api/auth/login", new
        {
            email = HeavenlyApiFactory.SeededAdminEmail,
            password = HeavenlyApiFactory.SeededAdminPassword
        });

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var body = await res.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Contains("admin", body.GetProperty("roles").EnumerateArray().Select(r => r.GetString()));
    }

    [Fact]
    public async Task Seeding_IsIdempotent_AndNeverDuplicatesTheAccount()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var count = await db.Users.CountAsync(u => u.Email == HeavenlyApiFactory.SeededAdminEmail);

        Assert.Equal(1, count);
    }
}
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd /Users/admin/Heavenly-agentic/Heavenly-Job-Backend && dotnet test --filter "FullyQualifiedName~AdminBootstrapTests"
```

Expected: compile error — `HeavenlyApiFactory` has no `SeededAdminEmail`. That is the failure we are fixing.

- [ ] **Step 3: Add the settings object**

Create `src/Api/Heavenly-Job.Api/Configuration/AdminSeedSettings.cs`:

```csharp
namespace HeavenlyJob.Api.Configuration;

/// <summary>
/// The one platform administrator seeded at startup.
///
/// <para>Registration deliberately refuses <see cref="Domain.Enums.UserType.Admin"/>
/// — that hole was a real privilege-escalation bug once — so an administrator
/// cannot come into existence through the API. It has to come from trusted
/// configuration instead: user-secrets locally, the platform secret store in
/// deployed environments. Never appsettings.json.</para>
///
/// <para>Leave <see cref="Email"/> empty and seeding is skipped entirely.</para>
/// </summary>
public class AdminSeedSettings
{
    public const string SectionName = "AdminSeed";

    public string? Email { get; set; }
    public string? Password { get; set; }
    public string Name { get; set; } = "Platform Administrator";
}
```

- [ ] **Step 4: Add the seeder**

Create `src/Api/Heavenly-Job.Api/Configuration/AdminSeeder.cs`:

```csharp
using HeavenlyJob.Domain.Entities;
using HeavenlyJob.Domain.Enums;
using HeavenlyJob.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace HeavenlyJob.Api.Configuration;

/// <summary>
/// Creates the configured platform administrator if it does not already exist.
///
/// <para>Idempotent by email, and deliberately <em>never</em> updates an
/// existing account: re-running startup must not silently reset a live
/// administrator's password back to whatever is in configuration, which would
/// turn a stale secret into a working credential.</para>
///
/// <para>Requires the schema to exist. In Development migrations auto-apply
/// immediately before this runs; in deployed environments they are applied
/// deliberately before the app starts, and a missing schema here should fail
/// loudly rather than leave an unreachable admin surface.</para>
/// </summary>
public static class AdminSeeder
{
    public static async Task SeedAsync(
        IServiceProvider services, CancellationToken cancellationToken = default)
    {
        using var scope = services.CreateScope();

        var settings = scope.ServiceProvider.GetRequiredService<IOptions<AdminSeedSettings>>().Value;
        var logger = scope.ServiceProvider
            .GetRequiredService<ILoggerFactory>()
            .CreateLogger(typeof(AdminSeeder));

        if (string.IsNullOrWhiteSpace(settings.Email))
        {
            logger.LogInformation("AdminSeed:Email is not configured; skipping admin seeding.");
            return;
        }

        if (string.IsNullOrWhiteSpace(settings.Password))
        {
            throw new InvalidOperationException(
                "AdminSeed:Email is configured but AdminSeed:Password is not. " +
                "Set it with: dotnet user-secrets set \"AdminSeed:Password\" \"<password>\"");
        }

        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var email = settings.Email.Trim().ToLowerInvariant();
        if (await db.Users.AnyAsync(u => u.Email == email, cancellationToken))
        {
            logger.LogInformation("Admin {Email} already exists; leaving it untouched.", email);
            return;
        }

        var admin = new User
        {
            Email = email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(settings.Password),
            Name = settings.Name,
            UserType = UserType.Admin,
            EmailVerified = true,
            AcceptedTerms = true
        };

        db.Users.Add(admin);
        db.UserRoles.Add(new UserRole { UserId = admin.Id, Role = UserType.Admin });
        await db.SaveChangesAsync(cancellationToken);

        logger.LogWarning("Seeded platform administrator {Email}.", email);
    }
}
```

- [ ] **Step 5: Wire it into Program.cs**

In `src/Api/Heavenly-Job.Api/Program.cs`, add the options binding next to the other `builder.Services` registrations, immediately after `builder.Services.AddAuthorization();`:

```csharp
builder.Services.Configure<AdminSeedSettings>(
    builder.Configuration.GetSection(AdminSeedSettings.SectionName));
```

Then replace the existing migration block:

```csharp
// Apply pending migrations automatically in development
if (app.Environment.IsDevelopment())
{
    using var scope = app.Services.CreateScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    await dbContext.Database.MigrateAsync();
}
```

with:

```csharp
// Apply pending migrations automatically in development
if (app.Environment.IsDevelopment())
{
    using var scope = app.Services.CreateScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    await dbContext.Database.MigrateAsync();
}

// Seed the configured platform administrator. Runs in every environment —
// registration refuses UserType.Admin, so this is the only way one can exist —
// and is a no-op when AdminSeed:Email is unset. Must run after migrations.
await AdminSeeder.SeedAsync(app.Services);
```

- [ ] **Step 6: Give the test factory a seeded admin**

In `tests/Heavenly-Job.IntegrationTests/HeavenlyApiFactory.cs`, add these constants directly below the `_jwtKey` field:

```csharp
    /// <summary>
    /// The administrator seeded by AdminSeeder in every test run. Tests that
    /// need to reach an <c>/api/service-admin/**</c> route log in as this
    /// account rather than hand-inserting a privileged user.
    /// </summary>
    public const string SeededAdminEmail = "seeded-admin@heavenly.test";
    public const string SeededAdminPassword = "SeedAdm1n@Pass";
```

and add these two entries to the `AddInMemoryCollection` dictionary inside `ConfigureAppConfiguration`:

```csharp
                ["AdminSeed:Email"] = SeededAdminEmail,
                ["AdminSeed:Password"] = SeededAdminPassword,
```

- [ ] **Step 7: Run the tests to verify they pass**

```bash
cd /Users/admin/Heavenly-agentic/Heavenly-Job-Backend && dotnet test --filter "FullyQualifiedName~AdminBootstrapTests"
```

Expected: PASS, 2 tests.

- [ ] **Step 8: Run the whole suite for regressions**

```bash
cd /Users/admin/Heavenly-agentic/Heavenly-Job-Backend && dotnet test
```

Expected: `Failed: 0, Passed: 195` (the 193 baseline plus these 2).

- [ ] **Step 9: Set the local development secret**

```bash
cd /Users/admin/Heavenly-agentic/Heavenly-Job-Backend/src/Api/Heavenly-Job.Api && dotnet user-secrets set "AdminSeed:Email" "admin@heavenlycorporation.com"
```

```bash
cd /Users/admin/Heavenly-agentic/Heavenly-Job-Backend/src/Api/Heavenly-Job.Api && dotnet user-secrets set "AdminSeed:Password" "$(openssl rand -base64 24)"
```

Then read the generated password back and record it in your password manager — it is not recoverable from the database:

```bash
cd /Users/admin/Heavenly-agentic/Heavenly-Job-Backend/src/Api/Heavenly-Job.Api && dotnet user-secrets list | grep AdminSeed
```

- [ ] **Step 10: Commit**

```bash
cd /Users/admin/Heavenly-agentic/Heavenly-Job-Backend && git add src/Api/Heavenly-Job.Api/Configuration/AdminSeedSettings.cs src/Api/Heavenly-Job.Api/Configuration/AdminSeeder.cs src/Api/Heavenly-Job.Api/Program.cs tests/Heavenly-Job.IntegrationTests/HeavenlyApiFactory.cs tests/Heavenly-Job.IntegrationTests/AdminBootstrapTests.cs && git commit -m "feat: seed the platform administrator from configuration"
```

---

## Task 3: Grant and revoke roles as an Admin

**Files:**
- Create: `src/Application/Heavenly-Job.Application/Features/Admin/Common/UserAdminDto.cs`
- Create: `src/Application/Heavenly-Job.Application/Features/Admin/Queries/FindUsers/FindUsersQuery.cs`
- Create: `src/Application/Heavenly-Job.Application/Features/Admin/Commands/GrantRole/GrantRoleCommand.cs`
- Create: `src/Application/Heavenly-Job.Application/Features/Admin/Commands/RevokeRole/RevokeRoleCommand.cs`
- Create: `src/Api/Heavenly-Job.Api/Controllers/AdminUsersController.cs`
- Test: `tests/Heavenly-Job.IntegrationTests/AdminBootstrapTests.cs` (extend)

**Interfaces:**
- Consumes: `AdminSeeder`'s seeded account (Task 2), `IApplicationDbContext`, `NotFoundException`, `ConflictException`, `UserType`
- Produces:
  - `GET /api/admin/users?email=<fragment>` → `IReadOnlyList<UserAdminDto>`
  - `POST /api/admin/users/{userId}/roles` body `{ "role": "service_admin" }` → `UserAdminDto`
  - `DELETE /api/admin/users/{userId}/roles/{role}` → `UserAdminDto`
  - `UserAdminDto { string Id, string Email, string Name, UserType PrimaryRole, IReadOnlyList<UserType> Roles, bool IsActive }`

**Design rule this task encodes:** only `ServiceAdmin` and `Admin` are grantable. `Vendor` and `ServiceRequester` are *profile-backed* roles — their registration endpoints create account, role and profile in one `SaveChanges`. Granting the bare role would produce an account that passes `[Authorize]` and then 404s on every `me` endpoint, because no profile row exists.

- [ ] **Step 1: Write the failing tests**

Append these to `tests/Heavenly-Job.IntegrationTests/AdminBootstrapTests.cs`, inside the class:

```csharp
    // ---------- helpers ----------

    private static string UniqueEmail(string prefix) => $"{prefix}-{Guid.NewGuid():N}@heavenly.test";
    private const string ValidPassword = "StrongP@ss1";

    private void Authorize(string token) =>
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

    private void Deauthorize() => _client.DefaultRequestHeaders.Authorization = null;

    private async Task<string> LoginAsync(string email, string password)
    {
        Deauthorize();
        var res = await _client.PostAsJsonAsync("/api/auth/login", new { email, password });
        var body = await res.Content.ReadFromJsonAsync<JsonElement>();
        return body.GetProperty("accessToken").GetString()!;
    }

    private Task<string> SeededAdminTokenAsync() =>
        LoginAsync(HeavenlyApiFactory.SeededAdminEmail, HeavenlyApiFactory.SeededAdminPassword);

    /// <summary>Registers an ordinary applicant and returns (userId, email, token).</summary>
    private async Task<(string userId, string email, string token)> RegisterApplicantAsync()
    {
        var email = UniqueEmail("user");
        Deauthorize();
        await _client.PostAsJsonAsync("/api/auth/register", new
        {
            fullName = "Ordinary Person",
            email,
            phone = "+919876500000",
            password = ValidPassword,
            userType = (int)UserType.Applicant
        });

        var token = await LoginAsync(email, ValidPassword);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var userId = (await db.Users.SingleAsync(u => u.Email == email)).Id;

        return (userId, email, token);
    }

    // ---------- find ----------

    [Fact]
    public async Task FindUsers_ByEmail_ReturnsTheAccountAndItsRoles()
    {
        var (userId, email, _) = await RegisterApplicantAsync();
        Authorize(await SeededAdminTokenAsync());

        var res = await _client.GetAsync($"/api/admin/users?email={Uri.EscapeDataString(email)}");

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var body = await res.Content.ReadFromJsonAsync<JsonElement>();
        var match = body.EnumerateArray().Single();
        Assert.Equal(userId, match.GetProperty("id").GetString());
        Assert.Contains("applicant", match.GetProperty("roles").EnumerateArray().Select(r => r.GetString()));
    }

    // ---------- grant ----------

    [Fact]
    public async Task GrantRole_AddsServiceAdmin_AndTheUserCanReachTheAdminSurface()
    {
        var (userId, email, _) = await RegisterApplicantAsync();
        Authorize(await SeededAdminTokenAsync());

        var grant = await _client.PostAsJsonAsync(
            $"/api/admin/users/{userId}/roles", new { role = "service_admin" });

        Assert.Equal(HttpStatusCode.OK, grant.StatusCode);
        var body = await grant.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Contains("service_admin", body.GetProperty("roles").EnumerateArray().Select(r => r.GetString()));

        // The whole point: a freshly-issued token for that account now opens
        // the service-admin surface.
        Authorize(await LoginAsync(email, ValidPassword));
        var queue = await _client.GetAsync("/api/service-admin/vendors");
        Assert.Equal(HttpStatusCode.OK, queue.StatusCode);
    }

    [Fact]
    public async Task GrantRole_Twice_IsRejectedAsAConflict()
    {
        var (userId, _, _) = await RegisterApplicantAsync();
        Authorize(await SeededAdminTokenAsync());

        await _client.PostAsJsonAsync($"/api/admin/users/{userId}/roles", new { role = "service_admin" });
        var second = await _client.PostAsJsonAsync($"/api/admin/users/{userId}/roles", new { role = "service_admin" });

        Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
    }

    [Fact]
    public async Task GrantRole_RefusesProfileBackedRoles()
    {
        var (userId, _, _) = await RegisterApplicantAsync();
        Authorize(await SeededAdminTokenAsync());

        var res = await _client.PostAsJsonAsync($"/api/admin/users/{userId}/roles", new { role = "vendor" });

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task GrantRole_RecordsWhoGrantedIt()
    {
        var (userId, _, _) = await RegisterApplicantAsync();
        Authorize(await SeededAdminTokenAsync());

        await _client.PostAsJsonAsync($"/api/admin/users/{userId}/roles", new { role = "service_admin" });

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var granted = await db.UserRoles
            .SingleAsync(r => r.UserId == userId && r.Role == UserType.ServiceAdmin);
        var seededAdminId = (await db.Users
            .SingleAsync(u => u.Email == HeavenlyApiFactory.SeededAdminEmail)).Id;

        Assert.Equal(seededAdminId, granted.GrantedBy);
    }

    [Fact]
    public async Task GrantRole_IsRefusedToANonAdmin()
    {
        var (userId, _, ownToken) = await RegisterApplicantAsync();
        Authorize(ownToken);

        var res = await _client.PostAsJsonAsync($"/api/admin/users/{userId}/roles", new { role = "service_admin" });

        Assert.Equal(HttpStatusCode.Forbidden, res.StatusCode);
    }

    [Fact]
    public async Task GrantRole_OnAMissingUser_Is404()
    {
        Authorize(await SeededAdminTokenAsync());

        var res = await _client.PostAsJsonAsync(
            $"/api/admin/users/{Guid.NewGuid()}/roles", new { role = "service_admin" });

        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
    }

    // ---------- revoke ----------

    [Fact]
    public async Task RevokeRole_RemovesTheRole_AndClosesTheAdminSurface()
    {
        var (userId, email, _) = await RegisterApplicantAsync();
        Authorize(await SeededAdminTokenAsync());
        await _client.PostAsJsonAsync($"/api/admin/users/{userId}/roles", new { role = "service_admin" });

        Authorize(await SeededAdminTokenAsync());
        var res = await _client.DeleteAsync($"/api/admin/users/{userId}/roles/service_admin");

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var body = await res.Content.ReadFromJsonAsync<JsonElement>();
        Assert.DoesNotContain("service_admin", body.GetProperty("roles").EnumerateArray().Select(r => r.GetString()));

        Authorize(await LoginAsync(email, ValidPassword));
        var queue = await _client.GetAsync("/api/service-admin/vendors");
        Assert.Equal(HttpStatusCode.Forbidden, queue.StatusCode);
    }

    [Fact]
    public async Task RevokeRole_RefusesToRemoveTheUsersPrimaryRole()
    {
        var (userId, _, _) = await RegisterApplicantAsync();
        Authorize(await SeededAdminTokenAsync());

        var res = await _client.DeleteAsync($"/api/admin/users/{userId}/roles/applicant");

        Assert.Equal(HttpStatusCode.Conflict, res.StatusCode);
    }

    /// <summary>
    /// The seeded administrator cannot revoke its own Admin role. Note this is
    /// caught by the <em>primary-role</em> rule, not the last-admin rule — its
    /// <c>UserType</c> is Admin. The last-admin guard is defence in depth for
    /// an account that holds Admin as a secondary role, which the shared test
    /// fixture cannot produce in isolation because the seeded admin always
    /// exists.
    /// </summary>
    [Fact]
    public async Task RevokeRole_RefusesToRemoveTheSeededAdminsOwnRole()
    {
        Authorize(await SeededAdminTokenAsync());

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var seededAdminId = (await db.Users
            .SingleAsync(u => u.Email == HeavenlyApiFactory.SeededAdminEmail)).Id;

        var res = await _client.DeleteAsync($"/api/admin/users/{seededAdminId}/roles/admin");

        Assert.Equal(HttpStatusCode.Conflict, res.StatusCode);
    }

    /// <summary>
    /// The complement of the above: the last-admin guard must not over-fire.
    /// Revoking Admin from a second administrator is legal precisely because
    /// another one remains.
    /// </summary>
    [Fact]
    public async Task RevokeRole_FromASecondAdmin_IsAllowed()
    {
        var (userId, _, _) = await RegisterApplicantAsync();
        Authorize(await SeededAdminTokenAsync());
        await _client.PostAsJsonAsync($"/api/admin/users/{userId}/roles", new { role = "admin" });

        var res = await _client.DeleteAsync($"/api/admin/users/{userId}/roles/admin");

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var body = await res.Content.ReadFromJsonAsync<JsonElement>();
        Assert.DoesNotContain("admin", body.GetProperty("roles").EnumerateArray().Select(r => r.GetString()));
    }

    [Fact]
    public async Task RevokeRole_ThatTheUserDoesNotHold_Is404()
    {
        var (userId, _, _) = await RegisterApplicantAsync();
        Authorize(await SeededAdminTokenAsync());

        var res = await _client.DeleteAsync($"/api/admin/users/{userId}/roles/service_admin");

        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
    }
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd /Users/admin/Heavenly-agentic/Heavenly-Job-Backend && dotnet test --filter "FullyQualifiedName~AdminBootstrapTests"
```

Expected: the two Task 2 tests pass; the twelve new ones fail with `404 Not Found` — no `/api/admin/users` route exists yet.

- [ ] **Step 3: Add the DTO**

Create `src/Application/Heavenly-Job.Application/Features/Admin/Common/UserAdminDto.cs`:

```csharp
using HeavenlyJob.Domain.Entities;
using HeavenlyJob.Domain.Enums;
using System.Linq.Expressions;

namespace HeavenlyJob.Application.Features.Admin.Common;

/// <summary>
/// An account as an administrator sees it. Deliberately carries no password
/// hash, no session data and no profile detail — this surface exists to answer
/// "who is this and what may they do", nothing more.
/// </summary>
public class UserAdminDto
{
    public string Id { get; init; } = null!;
    public string Email { get; init; } = null!;
    public string Name { get; init; } = null!;

    /// <summary>The legacy single-column role, retained as the primary one.</summary>
    public UserType PrimaryRole { get; init; }

    /// <summary>The authoritative role set from <c>user_roles</c>.</summary>
    public IReadOnlyList<UserType> Roles { get; init; } = [];

    public bool IsActive { get; init; }

    /// <summary>
    /// Projected in the database rather than materialised and mapped, matching
    /// the explicit-projection approach adopted when AutoMapper was removed.
    /// </summary>
    public static Expression<Func<User, UserAdminDto>> Projection => user => new UserAdminDto
    {
        Id = user.Id,
        Email = user.Email,
        Name = user.Name,
        PrimaryRole = user.UserType,
        Roles = user.Roles.Select(r => r.Role).ToList(),
        IsActive = user.IsActive
    };
}
```

- [ ] **Step 4: Add the find query**

Create `src/Application/Heavenly-Job.Application/Features/Admin/Queries/FindUsers/FindUsersQuery.cs`:

```csharp
using HeavenlyJob.Application.Common.Interfaces;
using HeavenlyJob.Application.Features.Admin.Common;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HeavenlyJob.Application.Features.Admin.Queries.FindUsers;

/// <summary>
/// Finds accounts by email fragment so an administrator can pick the one to
/// promote. Capped rather than paged: this is a lookup box, and an
/// administrator who cannot find the account in twenty results should type more
/// of the address.
/// </summary>
public record FindUsersQuery : IRequest<IReadOnlyList<UserAdminDto>>
{
    public string? Email { get; init; }
}

public class FindUsersQueryHandler
    : IRequestHandler<FindUsersQuery, IReadOnlyList<UserAdminDto>>
{
    private const int MaxResults = 20;

    private readonly IApplicationDbContext _context;

    public FindUsersQueryHandler(IApplicationDbContext context) => _context = context;

    public async Task<IReadOnlyList<UserAdminDto>> Handle(
        FindUsersQuery request, CancellationToken cancellationToken)
    {
        var query = _context.Users.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(request.Email))
        {
            // ToLower().Contains() rather than Npgsql's ILike: the Application
            // layer stays provider-free so the module can be lifted out without
            // dragging Npgsql with it.
            var fragment = request.Email.Trim().ToLower();
            query = query.Where(u => u.Email.ToLower().Contains(fragment));
        }

        return await query
            .OrderBy(u => u.Email)
            .Take(MaxResults)
            .Select(UserAdminDto.Projection)
            .ToListAsync(cancellationToken);
    }
}
```

- [ ] **Step 5: Add the grant command**

Create `src/Application/Heavenly-Job.Application/Features/Admin/Commands/GrantRole/GrantRoleCommand.cs`:

```csharp
using FluentValidation;
using HeavenlyJob.Application.Common.Exceptions;
using HeavenlyJob.Application.Common.Interfaces;
using HeavenlyJob.Application.Features.Admin.Common;
using HeavenlyJob.Domain.Entities;
using HeavenlyJob.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HeavenlyJob.Application.Features.Admin.Commands.GrantRole;

public record GrantRoleCommand : IRequest<UserAdminDto>
{
    public string UserId { get; init; } = null!;
    public UserType Role { get; init; }

    /// <summary>The administrator performing the grant, from their token.</summary>
    public string ActorId { get; init; } = null!;
}

public class GrantRoleCommandValidator : AbstractValidator<GrantRoleCommand>
{
    /// <summary>
    /// Vendor and ServiceRequester are profile-backed: their registration
    /// endpoints create account, role and profile in one SaveChanges. Granting
    /// the bare role would produce an account that passes [Authorize] and then
    /// 404s on every "me" endpoint, because no profile row exists.
    /// </summary>
    public static readonly IReadOnlySet<UserType> Grantable =
        new HashSet<UserType> { UserType.ServiceAdmin, UserType.Admin };

    public GrantRoleCommandValidator()
    {
        RuleFor(x => x.UserId).NotEmpty();

        RuleFor(x => x.Role)
            .Must(Grantable.Contains)
            .WithMessage("Only 'service_admin' and 'admin' can be granted directly. " +
                         "Vendor and requester roles are created by their registration endpoints, " +
                         "which also create the profile the role depends on.");
    }
}

public class GrantRoleCommandHandler : IRequestHandler<GrantRoleCommand, UserAdminDto>
{
    private readonly IApplicationDbContext _context;

    public GrantRoleCommandHandler(IApplicationDbContext context) => _context = context;

    public async Task<UserAdminDto> Handle(
        GrantRoleCommand request, CancellationToken cancellationToken)
    {
        var user = await _context.Users
            .Include(u => u.Roles)
            .SingleOrDefaultAsync(u => u.Id == request.UserId, cancellationToken)
            ?? throw NotFoundException.For("User", request.UserId);

        if (user.Roles.Any(r => r.Role == request.Role))
        {
            throw new ConflictException($"This account already holds the '{request.Role}' role.");
        }

        _context.UserRoles.Add(new UserRole
        {
            UserId = user.Id,
            Role = request.Role,
            GrantedBy = request.ActorId
        });

        await _context.SaveChangesAsync(cancellationToken);

        return await _context.Users
            .AsNoTracking()
            .Where(u => u.Id == user.Id)
            .Select(UserAdminDto.Projection)
            .SingleAsync(cancellationToken);
    }
}
```

- [ ] **Step 6: Add the revoke command**

Create `src/Application/Heavenly-Job.Application/Features/Admin/Commands/RevokeRole/RevokeRoleCommand.cs`:

```csharp
using FluentValidation;
using HeavenlyJob.Application.Common.Exceptions;
using HeavenlyJob.Application.Common.Interfaces;
using HeavenlyJob.Application.Features.Admin.Common;
using HeavenlyJob.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HeavenlyJob.Application.Features.Admin.Commands.RevokeRole;

public record RevokeRoleCommand : IRequest<UserAdminDto>
{
    public string UserId { get; init; } = null!;
    public UserType Role { get; init; }
}

public class RevokeRoleCommandValidator : AbstractValidator<RevokeRoleCommand>
{
    public RevokeRoleCommandValidator() => RuleFor(x => x.UserId).NotEmpty();
}

public class RevokeRoleCommandHandler : IRequestHandler<RevokeRoleCommand, UserAdminDto>
{
    private readonly IApplicationDbContext _context;

    public RevokeRoleCommandHandler(IApplicationDbContext context) => _context = context;

    public async Task<UserAdminDto> Handle(
        RevokeRoleCommand request, CancellationToken cancellationToken)
    {
        var user = await _context.Users
            .Include(u => u.Roles)
            .SingleOrDefaultAsync(u => u.Id == request.UserId, cancellationToken)
            ?? throw NotFoundException.For("User", request.UserId);

        var role = user.Roles.SingleOrDefault(r => r.Role == request.Role)
            ?? throw new NotFoundException(
                $"This account does not hold the '{request.Role}' role.");

        // UserType is still the primary role and still drives the JWT's own
        // claim. Removing the matching row would leave the two disagreeing —
        // the user would keep the privilege via the primary column while the
        // role set said otherwise.
        if (user.UserType == request.Role)
        {
            throw new ConflictException(
                $"'{request.Role}' is this account's primary role and cannot be revoked.");
        }

        // Locking every administrator out is unrecoverable without database
        // access, so the last one is refused regardless of who asks.
        if (request.Role == UserType.Admin)
        {
            var remaining = await _context.UserRoles
                .CountAsync(r => r.Role == UserType.Admin && r.UserId != user.Id, cancellationToken);

            if (remaining == 0)
            {
                throw new ConflictException(
                    "This is the last administrator; revoking it would lock everyone out.");
            }
        }

        _context.UserRoles.Remove(role);
        await _context.SaveChangesAsync(cancellationToken);

        return await _context.Users
            .AsNoTracking()
            .Where(u => u.Id == user.Id)
            .Select(UserAdminDto.Projection)
            .SingleAsync(cancellationToken);
    }
}
```

- [ ] **Step 7: Add the controller**

Create `src/Api/Heavenly-Job.Api/Controllers/AdminUsersController.cs`:

```csharp
using HeavenlyJob.Application.Features.Admin.Commands.GrantRole;
using HeavenlyJob.Application.Features.Admin.Commands.RevokeRole;
using HeavenlyJob.Application.Features.Admin.Common;
using HeavenlyJob.Application.Features.Admin.Queries.FindUsers;
using HeavenlyJob.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HeavenlyJob.Api.Controllers;

/// <summary>
/// Account role administration.
///
/// <para>Guarded by <c>Admin</c> alone — deliberately <em>not</em>
/// <c>ServiceAdmin</c>. A services administrator manages vendors and tenders; if
/// they could also grant roles, any one of them could mint further
/// administrators, and the platform's privilege boundary would be decided by
/// whoever was appointed first.</para>
///
/// <para>The seeded platform administrator (see <c>AdminSeeder</c>) is the root
/// of this: it is the only account that exists without being granted.</para>
/// </summary>
[Route("api/admin/users")]
[Authorize(Roles = nameof(UserType.Admin))]
public class AdminUsersController : ApiControllerBase
{
    /// <summary>Finds accounts by email fragment, capped at 20 results.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<UserAdminDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<UserAdminDto>>> Find([FromQuery] string? email) =>
        Ok(await Mediator.Send(new FindUsersQuery { Email = email }));

    /// <summary>Grants a role. Only 'service_admin' and 'admin' are grantable.</summary>
    [HttpPost("{userId}/roles")]
    [ProducesResponseType(typeof(UserAdminDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<UserAdminDto>> GrantRole(
        string userId, [FromBody] GrantRoleRequest request) =>
        Ok(await Mediator.Send(new GrantRoleCommand
        {
            UserId = userId,
            Role = request.Role,
            ActorId = RequireUserId()
        }));

    /// <summary>Revokes a role the account currently holds.</summary>
    [HttpDelete("{userId}/roles/{role}")]
    [ProducesResponseType(typeof(UserAdminDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<UserAdminDto>> RevokeRole(string userId, UserType role) =>
        Ok(await Mediator.Send(new RevokeRoleCommand { UserId = userId, Role = role }));
}

public record GrantRoleRequest
{
    public UserType Role { get; init; }
}
```

- [ ] **Step 8: Run the tests to verify they pass**

```bash
cd /Users/admin/Heavenly-agentic/Heavenly-Job-Backend && dotnet test --filter "FullyQualifiedName~AdminBootstrapTests"
```

Expected: PASS, 14 tests.

If `RevokeRole_RemovesTheRole...` sends `service_admin` in the route and binding fails, confirm the `JsonStringEnumConverter(JsonNamingPolicy.SnakeCaseLower)` registered in `Program.cs` applies to route binding as well as body binding. It does not — route values bind through `TypeConverter`, not `System.Text.Json`. Fix by taking the role as a string and parsing it explicitly:

```csharp
    [HttpDelete("{userId}/roles/{role}")]
    public async Task<ActionResult<UserAdminDto>> RevokeRole(string userId, string role) =>
        Ok(await Mediator.Send(new RevokeRoleCommand
        {
            UserId = userId,
            Role = ParseRole(role)
        }));

    /// <summary>
    /// Route values bind via TypeConverter, which knows nothing about the
    /// snake_case JSON policy, so "service_admin" is parsed here rather than
    /// leaking a PascalCase route segment into the wire format.
    /// </summary>
    private static UserType ParseRole(string role) =>
        Enum.TryParse<UserType>(role.Replace("_", string.Empty), ignoreCase: true, out var parsed)
            ? parsed
            : throw new NotFoundException($"'{role}' is not a role.");
```

Add `using HeavenlyJob.Application.Common.Exceptions;` to the controller when you apply this.

- [ ] **Step 9: Run the whole suite for regressions**

```bash
cd /Users/admin/Heavenly-agentic/Heavenly-Job-Backend && dotnet test
```

Expected: `Failed: 0, Passed: 207` (193 baseline + 2 from Task 2 + 12 here).

- [ ] **Step 10: Verify it live**

Start Postgres and the API:

```bash
cd /Users/admin/Heavenly-agentic/Heavenly-Job-Backend && docker compose up -d
```

```bash
cd /Users/admin/Heavenly-agentic/Heavenly-Job-Backend/src/Api/Heavenly-Job.Api && dotnet run
```

In a second terminal, log in as the seeded admin and promote an account. Replace the email and password with the ones you set in Task 2 Step 9:

```bash
curl -s -X POST http://localhost:5212/api/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@heavenlycorporation.com","password":"<your-seed-password>"}'
```

Expected: `200` with an `accessToken` and `"roles":["admin"]`.

```bash
curl -s "http://localhost:5212/api/admin/users?email=vendor" -H "Authorization: Bearer <accessToken>"
```

Expected: `200` with a JSON array of matching accounts.

```bash
curl -s -X POST http://localhost:5212/api/admin/users/<userId>/roles -H 'Content-Type: application/json' -H "Authorization: Bearer <accessToken>" -d '{"role":"service_admin"}'
```

Expected: `200` and `roles` now containing `"service_admin"`.

- [ ] **Step 11: Commit**

```bash
cd /Users/admin/Heavenly-agentic/Heavenly-Job-Backend && git add src/Application/Heavenly-Job.Application/Features/Admin src/Api/Heavenly-Job.Api/Controllers/AdminUsersController.cs tests/Heavenly-Job.IntegrationTests/AdminBootstrapTests.cs && git commit -m "feat: an admin can grant and revoke the service-admin role"
```

- [ ] **Step 12: Merge into develop**

```bash
cd /Users/admin/Heavenly-agentic/Heavenly-Job-Backend && git checkout develop && git merge --no-ff feature/admin-bootstrap -m "Merge branch 'feature/admin-bootstrap' into develop" && git push origin develop
```

---

## Task 4: Single-flight token refresh coordinator

**Files:**
- Create: `src/app/core/api/token-refresh.coordinator.ts`
- Test: `src/app/core/api/token-refresh.coordinator.spec.ts`

**Interfaces:**
- Consumes: `AuthApiService.refresh(body: RefreshRequest): Observable<AuthResponse>`, `TokenStore.refreshToken` / `.set(access, refresh)` / `.clear()` — all existing
- Produces: `TokenRefreshCoordinator.refresh(): Observable<string>` — emits the new access token, and shares one in-flight HTTP call across all concurrent callers

Switch to the frontend repo for the rest of this plan.

- [ ] **Step 1: Create the frontend branch**

```bash
cd /Users/admin/Heavenly-agentic/Heavenly-Frontend && git checkout -b feature/silent-token-refresh
```

- [ ] **Step 2: Write the failing test**

Create `src/app/core/api/token-refresh.coordinator.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../../environments/environment';
import { TokenRefreshCoordinator } from './token-refresh.coordinator';
import { TokenStore } from './token-store.service';

describe('TokenRefreshCoordinator', () => {
  let coordinator: TokenRefreshCoordinator;
  let httpMock: HttpTestingController;
  let tokenStore: TokenStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    coordinator = TestBed.inject(TokenRefreshCoordinator);
    httpMock = TestBed.inject(HttpTestingController);
    tokenStore = TestBed.inject(TokenStore);
    tokenStore.set('stale-access', 'valid-refresh');
  });

  afterEach(() => {
    httpMock.verify();
    tokenStore.clear();
  });

  it('exchanges the refresh token and stores the new pair', () => {
    let emitted: string | undefined;
    coordinator.refresh().subscribe((token) => (emitted = token));

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/auth/refresh`);
    expect(req.request.body).toEqual({ refreshToken: 'valid-refresh' });
    req.flush({ accessToken: 'fresh-access', refreshToken: 'fresh-refresh' });

    expect(emitted).toBe('fresh-access');
    expect(tokenStore.accessToken).toBe('fresh-access');
    expect(tokenStore.refreshToken).toBe('fresh-refresh');
  });

  it('shares one HTTP call across concurrent callers', () => {
    const emitted: string[] = [];
    coordinator.refresh().subscribe((t) => emitted.push(t));
    coordinator.refresh().subscribe((t) => emitted.push(t));
    coordinator.refresh().subscribe((t) => emitted.push(t));

    // expectOne fails the test if more than one matching request was made,
    // which is exactly the regression this guards: three parallel 401s must
    // not fire three refreshes and rotate the token out from under each other.
    const req = httpMock.expectOne(`${environment.apiBaseUrl}/auth/refresh`);
    req.flush({ accessToken: 'fresh-access', refreshToken: 'fresh-refresh' });

    expect(emitted).toEqual(['fresh-access', 'fresh-access', 'fresh-access']);
  });

  it('starts a new call once the previous one has settled', () => {
    coordinator.refresh().subscribe();
    httpMock
      .expectOne(`${environment.apiBaseUrl}/auth/refresh`)
      .flush({ accessToken: 'first', refreshToken: 'first-refresh' });

    coordinator.refresh().subscribe();
    httpMock
      .expectOne(`${environment.apiBaseUrl}/auth/refresh`)
      .flush({ accessToken: 'second', refreshToken: 'second-refresh' });

    expect(tokenStore.accessToken).toBe('second');
  });

  it('errors without calling the API when there is no refresh token', () => {
    tokenStore.clear();
    let errored = false;
    coordinator.refresh().subscribe({ error: () => (errored = true) });

    httpMock.expectNone(`${environment.apiBaseUrl}/auth/refresh`);
    expect(errored).toBeTrue();
  });

  it('clears the session when the refresh itself is rejected', () => {
    let errored = false;
    coordinator.refresh().subscribe({ error: () => (errored = true) });

    httpMock
      .expectOne(`${environment.apiBaseUrl}/auth/refresh`)
      .flush({ title: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    expect(errored).toBeTrue();
    expect(tokenStore.accessToken).toBeNull();
    expect(tokenStore.refreshToken).toBeNull();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
cd /Users/admin/Heavenly-agentic/Heavenly-Frontend && npx ng test --watch=false --browsers=ChromeHeadless
```

Expected: compile failure — `Cannot find module './token-refresh.coordinator'`.

- [ ] **Step 4: Write the coordinator**

Create `src/app/core/api/token-refresh.coordinator.ts`:

```ts
import { Injectable, inject } from '@angular/core';
import { Observable, finalize, map, shareReplay, tap, throwError } from 'rxjs';
import { AuthApiService } from './auth-api.service';
import { TokenStore } from './token-store.service';

/**
 * Owns the single in-flight access-token refresh.
 *
 * The interceptor is a pure function and has nowhere to keep state, but
 * single-flight *is* state: without it, a dashboard that fires six parallel
 * requests against an expired token fires six refreshes. Because /auth/refresh
 * rotates the refresh token, the second through sixth would present a token the
 * first had already consumed — and the user would be logged out by the very
 * mechanism meant to keep them signed in.
 *
 * `shareReplay({ refCount: false })` keeps the result available to subscribers
 * that arrive after the response lands, and `finalize` clears the slot so the
 * next genuine expiry starts a fresh exchange.
 */
@Injectable({ providedIn: 'root' })
export class TokenRefreshCoordinator {
  private readonly authApi = inject(AuthApiService);
  private readonly tokenStore = inject(TokenStore);

  private inFlight: Observable<string> | null = null;

  /** Emits the new access token, or errors if the session cannot be renewed. */
  refresh(): Observable<string> {
    if (this.inFlight) return this.inFlight;

    const refreshToken = this.tokenStore.refreshToken;
    if (!refreshToken) {
      return throwError(() => new Error('No refresh token is stored.'));
    }

    this.inFlight = this.authApi.refresh({ refreshToken }).pipe(
      tap((response) => this.tokenStore.set(response.accessToken, response.refreshToken)),
      map((response) => response.accessToken),
      tap({
        // A rejected refresh means the session is genuinely over — the token
        // was revoked, expired past its 7 days, or already rotated. Clearing
        // here keeps the interceptor's job to navigation alone.
        error: () => this.tokenStore.clear(),
      }),
      finalize(() => (this.inFlight = null)),
      shareReplay({ bufferSize: 1, refCount: false })
    );

    return this.inFlight;
  }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
cd /Users/admin/Heavenly-agentic/Heavenly-Frontend && npx ng test --watch=false --browsers=ChromeHeadless
```

Expected: PASS — 5 coordinator specs plus the pre-existing `app.component.spec.ts`.

- [ ] **Step 6: Commit**

```bash
cd /Users/admin/Heavenly-agentic/Heavenly-Frontend && git add src/app/core/api/token-refresh.coordinator.ts src/app/core/api/token-refresh.coordinator.spec.ts && git commit -m "feat: single-flight token refresh coordinator"
```

---

## Task 5: Refresh and retry in the interceptor

**Files:**
- Modify: `src/app/core/api/auth.interceptor.ts`
- Test: `src/app/core/api/auth.interceptor.spec.ts`

**Interfaces:**
- Consumes: `TokenRefreshCoordinator.refresh(): Observable<string>` (Task 4), `TokenStore`, `Router`
- Produces: an `authInterceptor` that retries a 401'd request exactly once with a refreshed token, and clears + redirects only when the refresh fails

- [ ] **Step 1: Write the failing test**

Create `src/app/core/api/auth.interceptor.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { authInterceptor } from './auth.interceptor';
import { TokenStore } from './token-store.service';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let tokenStore: TokenStore;
  let router: jasmine.SpyObj<Router>;

  const url = `${environment.apiBaseUrl}/vendors/me`;

  beforeEach(() => {
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: Router, useValue: router },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    tokenStore = TestBed.inject(TokenStore);
    tokenStore.set('stale-access', 'valid-refresh');
  });

  afterEach(() => {
    httpMock.verify();
    tokenStore.clear();
  });

  it('attaches the bearer token to API requests', () => {
    http.get(url).subscribe();

    const req = httpMock.expectOne(url);
    expect(req.request.headers.get('Authorization')).toBe('Bearer stale-access');
    req.flush({});
  });

  it('leaves non-API requests untouched', () => {
    http.get('/assets/config.json').subscribe();

    const req = httpMock.expectOne('/assets/config.json');
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({});
  });

  it('refreshes once and retries the original request with the new token', () => {
    let body: Record<string, unknown> | undefined;
    http.get<Record<string, unknown>>(url).subscribe((res) => (body = res));

    httpMock.expectOne(url).flush({}, { status: 401, statusText: 'Unauthorized' });

    httpMock
      .expectOne(`${environment.apiBaseUrl}/auth/refresh`)
      .flush({ accessToken: 'fresh-access', refreshToken: 'fresh-refresh' });

    const retried = httpMock.expectOne(url);
    expect(retried.request.headers.get('Authorization')).toBe('Bearer fresh-access');
    retried.flush({ businessName: 'Sharma Electricals' });

    expect(body).toEqual({ businessName: 'Sharma Electricals' });
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('gives up after one retry when the retried request also 401s', () => {
    let errored = false;
    http.get(url).subscribe({ error: () => (errored = true) });

    httpMock.expectOne(url).flush({}, { status: 401, statusText: 'Unauthorized' });
    httpMock
      .expectOne(`${environment.apiBaseUrl}/auth/refresh`)
      .flush({ accessToken: 'fresh-access', refreshToken: 'fresh-refresh' });
    httpMock.expectOne(url).flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(errored).toBeTrue();
    expect(tokenStore.accessToken).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('clears the session and redirects when the refresh itself fails', () => {
    let errored = false;
    http.get(url).subscribe({ error: () => (errored = true) });

    httpMock.expectOne(url).flush({}, { status: 401, statusText: 'Unauthorized' });
    httpMock
      .expectOne(`${environment.apiBaseUrl}/auth/refresh`)
      .flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(errored).toBeTrue();
    expect(tokenStore.accessToken).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('does not intercept a 401 from the login endpoint', () => {
    let errored = false;
    http.post(`${environment.apiBaseUrl}/auth/login`, {}).subscribe({ error: () => (errored = true) });

    httpMock
      .expectOne(`${environment.apiBaseUrl}/auth/login`)
      .flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(errored).toBeTrue();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(tokenStore.accessToken).toBe('stale-access');
  });

  it('redirects without calling refresh when no refresh token is stored', () => {
    tokenStore.clear();
    http.get(url).subscribe({ error: () => undefined });

    httpMock.expectOne(url).flush({}, { status: 401, statusText: 'Unauthorized' });

    httpMock.expectNone(`${environment.apiBaseUrl}/auth/refresh`);
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd /Users/admin/Heavenly-agentic/Heavenly-Frontend && npx ng test --watch=false --browsers=ChromeHeadless
```

Expected: the three attach/passthrough specs pass; `refreshes once and retries…` fails because the current interceptor clears and redirects instead of refreshing.

- [ ] **Step 3: Rewrite the interceptor**

Replace the whole of `src/app/core/api/auth.interceptor.ts` with:

```ts
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TokenRefreshCoordinator } from './token-refresh.coordinator';
import { TokenStore } from './token-store.service';

/**
 * Attaches the bearer token to API requests and keeps the session alive.
 *
 * On a 401 the request is not abandoned: the token is refreshed once and the
 * original request replayed with the new one. Only if that refresh fails — a
 * revoked, rotated or genuinely expired refresh token — is the session cleared
 * and the user sent to /login.
 *
 * Retry is deliberately once, not a loop. The replay runs inside switchMap, so
 * its own failures land in the inner catchError rather than re-entering this
 * one; a second 401 ends the session instead of refreshing forever.
 *
 * Concurrency is handled by TokenRefreshCoordinator, not here — six parallel
 * requests hitting an expired token share one refresh.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.apiBaseUrl)) {
    return next(req);
  }

  const tokenStore = inject(TokenStore);
  const coordinator = inject(TokenRefreshCoordinator);
  const router = inject(Router);

  const withAuth = (token: string | null) =>
    token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  const endSession = (error: unknown) => {
    tokenStore.clear();
    router.navigate(['/login']);
    return throwError(() => error);
  };

  return next(withAuth(tokenStore.accessToken)).pipe(
    catchError((error: unknown) => {
      const status = (error as HttpErrorResponse)?.status;

      // A 401 on login or refresh is a normal "bad credentials" / "session
      // over" answer that the caller handles; hijacking it would turn a failed
      // login into a redirect loop.
      const isAuthEndpoint =
        req.url.includes('/auth/login') || req.url.includes('/auth/refresh');

      if (status !== 401 || isAuthEndpoint) {
        return throwError(() => error);
      }

      if (!tokenStore.refreshToken) {
        return endSession(error);
      }

      return coordinator.refresh().pipe(
        switchMap((accessToken) => next(withAuth(accessToken))),
        catchError((retryError: unknown) => endSession(retryError))
      );
    })
  );
};
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd /Users/admin/Heavenly-agentic/Heavenly-Frontend && npx ng test --watch=false --browsers=ChromeHeadless
```

Expected: PASS — 7 interceptor specs, 5 coordinator specs, 1 pre-existing app spec.

- [ ] **Step 5: Verify the production build still compiles**

```bash
cd /Users/admin/Heavenly-agentic/Heavenly-Frontend && npx ng build
```

Expected: build succeeds, 21 routes prerendered, 0 errors.

- [ ] **Step 6: Commit**

```bash
cd /Users/admin/Heavenly-agentic/Heavenly-Frontend && git add src/app/core/api/auth.interceptor.ts src/app/core/api/auth.interceptor.spec.ts && git commit -m "feat: refresh the access token and retry once instead of ending the session"
```

---

## Task 6: Verify silent refresh in a real browser

Unit tests prove the interceptor's logic. They cannot prove it works against the real API, where the refresh token rotates server-side and a replayed one is rejected.

**Files:**
- Modify: `src/environments/environment.ts` (temporarily, reverted in Step 6)

**Interfaces:**
- Consumes: everything from Tasks 2–5
- Produces: a verified end-to-end refresh, recorded in `docs/BACKLOG.md`

- [ ] **Step 1: Shorten the access token so expiry is reachable**

In `src/Api/Heavenly-Job.Api/appsettings.Development.json`, set `JwtSettings:AccessTokenExpirationMinutes` to `1`. If the key is absent, add it under the existing `JwtSettings` section. Leave `RefreshTokenExpirationDays` alone.

- [ ] **Step 2: Start the stack**

```bash
cd /Users/admin/Heavenly-agentic/Heavenly-Job-Backend && docker compose up -d
```

```bash
cd /Users/admin/Heavenly-agentic/Heavenly-Job-Backend/src/Api/Heavenly-Job.Api && dotnet run
```

```bash
cd /Users/admin/Heavenly-agentic/Heavenly-Frontend && npx ng serve --port 4300
```

- [ ] **Step 3: Turn the real API on locally**

Set `useRealApi: true` in `src/environments/environment.ts`. This edit is reverted in Step 6 and must not be committed.

- [ ] **Step 4: Walk it**

1. Open `http://localhost:4300`, clear `localStorage`, and log in as a vendor through the real form.
2. Open devtools → Network, and wait 70 seconds so the access token expires.
3. Navigate to the vendor profile, which issues `GET /api/vendors/me`.
4. Expected sequence in Network: `GET /api/vendors/me` → **401**, then `POST /api/auth/refresh` → **200**, then `GET /api/vendors/me` → **200**. The page renders. You are **not** redirected to `/login`.
5. Reload the page with several widgets loading at once and confirm only **one** `POST /auth/refresh` appears, not one per request.
6. Now corrupt the refresh token: in devtools → Application → Local Storage, change `heavenly_refresh_token` to `garbage`. Trigger a request. Expected: `401`, one failed `POST /auth/refresh` → `401`, tokens cleared, redirect to `/login`.

- [ ] **Step 5: Restore the token lifetime**

Set `JwtSettings:AccessTokenExpirationMinutes` back to `60` in `appsettings.Development.json`.

- [ ] **Step 6: Revert the flag**

```bash
cd /Users/admin/Heavenly-agentic/Heavenly-Frontend && git checkout -- src/environments/environment.ts && git diff --stat
```

Expected: no changes to `environment.ts`. `useRealApi` must remain committed as `false`.

- [ ] **Step 7: Rotate the Supabase database password**

The current password was shared in a chat session archived to the private `heavenly-session-archive` repo, and is flagged 🔴 in the backlog. Do it now, while you are already in the secrets:

1. Supabase dashboard → Settings → Database → Reset password.
2. Re-point the local secret:

```bash
cd /Users/admin/Heavenly-agentic/Heavenly-Job-Backend/src/Api/Heavenly-Job.Api && dotnet user-secrets set "ConnectionStrings:DefaultConnection" "<new-session-pooler-connection-string>"
```

Use the **session pooler on port 5432**, not the transaction pooler on 6543 — the latter lacks the session state EF migrations need.

- [ ] **Step 8: Update the backlog**

In `docs/BACKLOG.md`:

1. Change the `### 🟠 F1. Silent token refresh` heading to `### ✅ F1. Silent token refresh — **DONE 2026-08-02**` and replace its body with what was built: single-flight coordinator, retry-once interceptor, 16 frontend specs (13 new + 3 pre-existing fixed) — the first real frontend tests in the repo.
2. Add a new backend entry above B3:

```markdown
### ✅ B11. Admin bootstrap — **DONE 2026-08-02**
No `ServiceAdmin` could exist: registration refuses `UserType.Admin` and nothing seeded one, so every `/api/service-admin/**` route was unreachable — which is why F2.4's vendor happy path could never be verified live. Now: `AdminSeeder` creates one platform `Admin` from `AdminSeed:*` configuration at startup (idempotent, never overwrites an existing account's password, no-op when unset), and `/api/admin/users` lets that Admin find an account and grant/revoke `ServiceAdmin`. Only `service_admin` and `admin` are grantable — `Vendor`/`ServiceRequester` are profile-backed and must come through their own registration endpoints. Revoking a primary role or the last `Admin` is refused.
**Verified:** 14 integration tests + a live pass promoting an account and reaching `GET /api/service-admin/vendors` with its token.
→ branch `feature/admin-bootstrap`
```

3. In the `Database — current` section, replace the ⚠️ rotation warning with a note that the password was rotated on 2026-08-02.
4. Add to the changelog, at the top:

```markdown
- **2026-08-02** — **B11 + F1 done:** admin bootstrap (config-seeded `Admin`, role grant/revoke) unblocks the entire `/api/service-admin/**` surface; silent token refresh replaces the hard logout on 401. First frontend test suite (12 specs). Supabase password rotated. 207/207 backend tests passing.
```

- [ ] **Step 9: Commit and merge**

```bash
cd /Users/admin/Heavenly-agentic/Heavenly-Frontend && git add docs/BACKLOG.md && git commit -m "docs: B11 + F1 complete; Supabase password rotated"
```

```bash
cd /Users/admin/Heavenly-agentic/Heavenly-Frontend && git checkout dev-non-test && git merge --no-ff feature/silent-token-refresh -m "Merge branch 'feature/silent-token-refresh' into dev-non-test" && git push origin dev-non-test
```

---

## Done when

- [ ] `dotnet test` passes with 208 tests.
- [ ] `npx ng test --watch=false --browsers=ChromeHeadless` passes with 16 specs.
- [ ] `npx ng build` succeeds with 0 errors.
- [ ] A seeded `Admin` logs in against the running API and promotes another account to `ServiceAdmin`, and that account reaches `GET /api/service-admin/vendors`.
- [ ] An expired access token is refreshed and the request retried in a real browser, with exactly one `POST /auth/refresh` for a burst of parallel requests.
- [ ] A corrupted refresh token clears the session and redirects to `/login`.
- [ ] `useRealApi` is still committed as `false`.
- [ ] The Supabase password has been rotated and the local secret updated.
- [ ] `docs/BACKLOG.md` records B11 and F1 as done.

**Next:** Slice 2 — vendor verification queue and review. Its plan gets written at the start of that slice, so it can incorporate anything this one turned up.
