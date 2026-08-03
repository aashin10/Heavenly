# Slice 2 — Vendor Verification Queue + Review — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin verify a vendor through the real API, so a *verified vendor* can exist without a raw database write — the prerequisite every later slice depends on.

**Architecture:** The backend endpoints already exist (B2.2) and are unchanged except for one addition: the verification timeline currently returns actor **ids**, which the UI renders as raw GUIDs, so a small reviewer-name join is added first. The frontend then follows the pattern established in F2.1–F2.4 — a thin typed `VendorAdminApiService` over the wire DTOs, with the existing stateful `VendorAdminService` keeping every mock method unchanged and gaining `*Async` siblings behind `environment.useRealApi`.

**Tech Stack:** .NET 10 · EF Core 10 + Npgsql · MediatR · xUnit + Testcontainers · Angular 17 · RxJS · Karma/Jasmine

## Global Constraints

Every task's requirements implicitly include this section.

- **Branches:** backend `feature/vendor-admin-reviewer-names` off `dev-agentic`; frontend `feature/vendor-verification-wiring` off `dev-agentic`. `dev-agentic` is the integration branch for this roadmap (both repos), not `develop`/`dev-non-test`.
- **`useRealApi` stays committed as `false`.** Every wired method keeps its mock path working unchanged so a fresh clone runs with no backend.
- **Wire format:** `camelCase` JSON; enums as lowercase `snake_case` strings; dates ISO 8601 UTC; IDs opaque strings.
- **Errors:** RFC 9457 Problem Details via `GlobalExceptionHandler`. Backend throws `ValidationException` / `NotFoundException` / `ConflictException` / `DomainException` — never a bespoke shape.
- **Backend tests:** integration tests in `tests/Heavenly-Job.IntegrationTests/`, `[Collection(DatabaseCollection.Name)]`, each seeding uniquely-keyed rows (`UniqueEmail("prefix")`). Baseline is **212 tests** and must stay green. Docker must be running (Testcontainers `postgres:16`).
- **Frontend tests:** Karma + Jasmine (`npx ng test --watch=false --browsers=ChromeHeadless`). Baseline is **17 specs** and must stay green.
- **Race-condition rule (the class of bug found three times in F2.1–F2.4, and once more in this slice's own code — see Task 7):** never snapshot service state in `ngOnInit()` when an async refresh may still be in flight. Derive page state with `computed()` against the service's own signals.
- **Portal modularity:** nothing under `Application/Features/ServicesPortal/` may reference `Job`/`JobApplication`/`JobDomain` types.
- **Commits:** conventional prefixes (`feat:`, `fix:`, `test:`, `docs:`, `refactor:`), one concern per commit.
- **`docs/BACKLOG.md` is updated at the end of the slice**, not retroactively.

---

## Context: what already exists

Read this before Task 1 — it is the difference between wiring and rewriting.

**Backend endpoints (built in B2.2, unchanged by this slice):**

| Endpoint | Returns |
|---|---|
| `GET /api/service-admin/vendors?status=&search=&page=&pageSize=` | `VendorQueueDto` |
| `GET /api/service-admin/vendors/{vendorId}` | `VendorDto` |
| `POST /api/service-admin/vendors/{vendorId}/approve` | `VendorDto` |
| `POST /api/service-admin/vendors/{vendorId}/reject` | `VendorDto` |
| `POST /api/service-admin/vendors/{vendorId}/suspend` | `VendorDto` |
| `POST /api/service-admin/vendors/{vendorId}/reinstate` | `VendorDto` |

All six are `[Authorize(Roles = "ServiceAdmin,Admin")]`. Slice 1 made such an account obtainable; without it every call here is a 403.

**The `status` query parameter binds correctly as lowercase** (`?status=pending`). Query values bind via `TypeConverter`, which ignores the JSON snake_case policy — but `VendorStatus` members (`Pending`/`Verified`/`Rejected`/`Suspended`) are single words, so a case-insensitive parse matches. This is *not* the situation Slice 1 hit with `service_admin`; do not add a manual parser here.

**The server's transition rules** (`Domain/Entities/Vendor.cs`), which the client must mirror:

| Action | Legal from | Result |
|---|---|---|
| `approve` | `pending`, `rejected` | `verified` |
| `reject` (reason **required**) | `pending` | `rejected` |
| `suspend` (reason **required**) | `verified` | `suspended` |
| `reinstate` | `suspended` | **`verified`** |

An illegal transition throws `InvalidVendorStatusTransitionException` → **409**.

**Two concrete client/server divergences this slice must fix (this is the substance of F9):**

1. `VendorAdminService.reinstate()` sets the vendor to **`'pending'`**. The server's `Reinstate` sets **`Verified`**. The mock is simply wrong about what reinstating means.
2. `vendor-review.page.html`'s `@case ('rejected')` block offers a **"Return to Queue"** button wired to `reinstate()`. Against the real API that is `suspended`-only, so it returns **409** every time. A rejected vendor's only legal action is `approve`.

Additionally the `@case ('suspended')` button is labelled **"Reinstate to Queue"**, which misdescribes the result — reinstating returns the vendor to `verified`, not to the queue.

**An existing mapper you must reuse, not duplicate.** `service-auth.service.ts` already contains a complete, private `mapVendorDto(dto: VendorDto): Vendor` (plus `mapVendorDocuments` and `DOCUMENT_TYPE_KEYS`). Task 2 extracts it so the admin path shares one mapper. Writing a second one guarantees drift.

---

## File Structure

**Backend — modify**

| File | Change |
|---|---|
| `src/Application/.../Vendors/Common/VendorDtos.cs` | `VendorVerificationEventDto` gains `ActorName`; `VendorDto.From` accepts an optional reviewer-name map. |
| `src/Application/.../Vendors/Common/VendorReviewerNames.cs` *(create)* | One helper both admin call sites use to build the id→name map. |
| `src/Application/.../Vendors/Queries/GetVendorProfile/GetVendorProfileQuery.cs` | Gains `IncludeReviewerNames`; populates names when set. |
| `src/Application/.../Vendors/Commands/ReviewVendor/ReviewVendorCommand.cs` | Populates names, so the post-decision response needs no refetch. |
| `src/Api/.../Controllers/ServicesPortal/VendorAdminController.cs` | Sets `IncludeReviewerNames = true` on the admin detail read. |
| `tests/Heavenly-Job.IntegrationTests/VendorApiTests.cs` | Two tests: admin sees names, vendor's own `/me` does not. |

**Frontend — create**

| File | Responsibility |
|---|---|
| `src/app/core/api/services-portal/vendor-dto.mapper.ts` | The single `VendorDto → Vendor` mapper, extracted from `service-auth.service.ts`. |
| `src/app/core/api/services-portal/vendor-admin-api.models.ts` | Wire DTOs for the queue + review surface. |
| `src/app/core/api/services-portal/vendor-admin-api.service.ts` | Typed client for the six admin endpoints. |
| `src/app/core/services/vendor-transitions.ts` | Pure `legalVendorActions(status)` — the F9 rule, in one testable place. |
| `src/app/core/services/vendor-transitions.spec.ts` | Its spec. |

**Frontend — modify**

| File | Change |
|---|---|
| `src/app/core/services/service-auth.service.ts` | Import the extracted mapper instead of defining it. |
| `src/app/core/services/vendor-admin.service.ts` | `*Async` siblings + real-API state. |
| `src/app/features/management/vendors/vendor-queue.component.ts` | Load from the API; derive filter options reactively. |
| `src/app/features/management/vendors/vendor-review.page.ts` | Async load + async decisions. |
| `src/app/features/management/vendors/vendor-review.page.html` | Drive buttons off `legalVendorActions`; fix the two wrong buttons. |

---

## Task 1: Reviewer names on the verification timeline (backend)

Without this, the admin timeline renders `by 0190f2c1-4a3b-…` — the audit trail becomes unreadable exactly where it matters most. The vendor's own `/api/vendors/me` deliberately does **not** get names: who reviewed you is internal, and this slice should not quietly widen what a vendor sees.

**Files:**
- Modify: `src/Application/Heavenly-Job.Application/Features/ServicesPortal/Vendors/Common/VendorDtos.cs`
- Create: `src/Application/Heavenly-Job.Application/Features/ServicesPortal/Vendors/Common/VendorReviewerNames.cs`
- Modify: `src/Application/Heavenly-Job.Application/Features/ServicesPortal/Vendors/Queries/GetVendorProfile/GetVendorProfileQuery.cs`
- Modify: `src/Application/Heavenly-Job.Application/Features/ServicesPortal/Vendors/Commands/ReviewVendor/ReviewVendorCommand.cs`
- Modify: `src/Api/Heavenly-Job.Api/Controllers/ServicesPortal/VendorAdminController.cs`
- Test: `tests/Heavenly-Job.IntegrationTests/VendorApiTests.cs`

**Interfaces:**
- Consumes: `Vendor`, `VendorVerificationEvent`, `IApplicationDbContext` (all existing)
- Produces:
  - `VendorVerificationEventDto(string Status, DateTime OccurredAt, string? ActorId, string? ActorName, string? Note)`
  - `VendorDto.From(Vendor v, IReadOnlyDictionary<string, string>? reviewerNames = null)`
  - `static Task<IReadOnlyDictionary<string, string>> VendorReviewerNames.LoadAsync(IApplicationDbContext, Vendor, CancellationToken)`
  - `GetVendorProfileQuery.IncludeReviewerNames` (bool, default `false`)

- [ ] **Step 1: Create the backend branch**

```bash
cd /Users/admin/Heavenly-agentic/Heavenly-Job-Backend && git checkout dev-agentic && git pull --ff-only && git checkout -b feature/vendor-admin-reviewer-names
```

- [ ] **Step 2: Write the failing tests**

Append to the `VendorApiTests` class in `tests/Heavenly-Job.IntegrationTests/VendorApiTests.cs`:

```csharp
    [Fact]
    public async Task AdminVendorDetail_NamesTheReviewer_NotJustTheirId()
    {
        var (_, vendorId, _) = await RegisterVendorAsync();
        var adminToken = await CreateServiceAdminTokenAsync();

        Authorize(adminToken);
        await _client.PostAsJsonAsync($"/api/service-admin/vendors/{vendorId}/approve", new { });

        var res = await _client.GetAsync($"/api/service-admin/vendors/{vendorId}");

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var body = await res.Content.ReadFromJsonAsync<JsonElement>();
        var approval = body.GetProperty("verificationEvents")
            .EnumerateArray()
            .Last();

        // The id is still present — it is the durable reference. The name is
        // additive, and is what the admin timeline actually renders.
        Assert.False(string.IsNullOrWhiteSpace(approval.GetProperty("actorId").GetString()));
        Assert.Equal("Service Admin", approval.GetProperty("actorName").GetString());
    }

    [Fact]
    public async Task VendorsOwnProfile_DoesNotNameTheReviewer()
    {
        var (vendorToken, vendorId, _) = await RegisterVendorAsync();

        Authorize(await CreateServiceAdminTokenAsync());
        await _client.PostAsJsonAsync($"/api/service-admin/vendors/{vendorId}/approve", new { });

        // Who reviewed a vendor is internal. The vendor sees that it happened
        // and when, but not which member of staff decided it.
        Authorize(vendorToken);
        var res = await _client.GetAsync("/api/vendors/me");

        var body = await res.Content.ReadFromJsonAsync<JsonElement>();
        var approval = body.GetProperty("verificationEvents").EnumerateArray().Last();

        Assert.True(
            approval.GetProperty("actorName").ValueKind == JsonValueKind.Null,
            "The vendor-facing profile must not carry the reviewing admin's name.");
    }
```

`CreateServiceAdminTokenAsync()` already exists in this file and creates its admin with `Name = "Service Admin"` — that is the string the first test asserts.

- [ ] **Step 3: Run the tests to verify they fail**

```bash
cd /Users/admin/Heavenly-agentic/Heavenly-Job-Backend && dotnet test --filter "FullyQualifiedName~VendorApiTests"
```

Expected: FAIL — `actorName` is not a property of the returned object (`KeyNotFoundException` from `GetProperty`).

- [ ] **Step 4: Add `ActorName` to the event DTO**

In `src/Application/Heavenly-Job.Application/Features/ServicesPortal/Vendors/Common/VendorDtos.cs`, replace the `VendorVerificationEventDto` record with:

```csharp
public record VendorVerificationEventDto(
    string Status,
    DateTime OccurredAt,
    string? ActorId,
    string? ActorName,
    string? Note)
{
    /// <summary>
    /// <paramref name="reviewerNames"/> is null on vendor-facing reads: who
    /// reviewed an application is internal, and the vendor sees only that it
    /// happened. Admin reads pass the map so the timeline renders a person
    /// rather than a GUID.
    /// </summary>
    public static VendorVerificationEventDto From(
        VendorVerificationEvent e, IReadOnlyDictionary<string, string>? reviewerNames = null)
    {
        var name = e.ActorId is not null && reviewerNames is not null
                   && reviewerNames.TryGetValue(e.ActorId, out var found)
            ? found
            : null;

        return new(e.Status.ToWireFormat(), e.OccurredAt, e.ActorId, name, e.Note);
    }
}
```

- [ ] **Step 5: Thread the map through `VendorDto.From`**

In the same file, change the `From` signature and the `VerificationEvents` line only. The signature becomes:

```csharp
    public static VendorDto From(
        Vendor v, IReadOnlyDictionary<string, string>? reviewerNames = null) => new(
```

and the verification-events argument becomes:

```csharp
        v.VerificationEvents.OrderBy(e => e.OccurredAt)
            .Select(e => VendorVerificationEventDto.From(e, reviewerNames)).ToList(),
```

The parameter is optional so the seven non-admin call sites (`UpdateVendorBasicInfoCommand`, `UpdateVendorServicesCommand`, `UpdateVendorBankDetailsCommand`, `UpsertVendorDocumentCommand`, `VendorPortfolioCommands` ×2, and the vendor's own profile read) keep compiling and keep returning `actorName: null`.

- [ ] **Step 6: Add the lookup helper**

Create `src/Application/Heavenly-Job.Application/Features/ServicesPortal/Vendors/Common/VendorReviewerNames.cs`:

```csharp
using HeavenlyJob.Application.Common.Interfaces;
using HeavenlyJob.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace HeavenlyJob.Application.Features.ServicesPortal.Vendors.Common;

/// <summary>
/// Resolves the reviewing admins named on a vendor's verification timeline.
///
/// <para>A join rather than a stored column, for the same reason the
/// service-request admin DTO joins requester contact details: a name is not a
/// fact about the decision, it is a fact about the account that made it, and
/// copying it onto the event would let the two drift the moment someone
/// changes their name.</para>
/// </summary>
public static class VendorReviewerNames
{
    public static async Task<IReadOnlyDictionary<string, string>> LoadAsync(
        IApplicationDbContext context, Vendor vendor, CancellationToken cancellationToken)
    {
        var actorIds = vendor.VerificationEvents
            .Select(e => e.ActorId)
            .Where(id => id is not null)
            .Select(id => id!)
            .Distinct()
            .ToList();

        if (actorIds.Count == 0) return new Dictionary<string, string>();

        return await context.Users
            .AsNoTracking()
            .Where(u => actorIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.Name, cancellationToken);
    }
}
```

- [ ] **Step 7: Populate names on the admin detail read**

In `src/Application/Heavenly-Job.Application/Features/ServicesPortal/Vendors/Queries/GetVendorProfile/GetVendorProfileQuery.cs`, add this property to the query record:

```csharp
    /// <summary>
    /// Admin reads set this so the timeline can name reviewers. The vendor's
    /// own profile read leaves it false — see VendorVerificationEventDto.From.
    /// </summary>
    public bool IncludeReviewerNames { get; init; }
```

and replace the handler's `return VendorDto.From(vendor);` (line 38) with:

```csharp
        if (!request.IncludeReviewerNames) return VendorDto.From(vendor);

        var reviewerNames = await VendorReviewerNames.LoadAsync(_context, vendor, cancellationToken);
        return VendorDto.From(vendor, reviewerNames);
```

Add `using HeavenlyJob.Application.Features.ServicesPortal.Vendors.Common;` if the file does not already have it.

- [ ] **Step 8: Populate names on the review response**

In `src/Application/Heavenly-Job.Application/Features/ServicesPortal/Vendors/Commands/ReviewVendor/ReviewVendorCommand.cs`, replace `return VendorDto.From(vendor);` (line 92) with:

```csharp
        // The caller is an admin by construction (the endpoint is role-gated),
        // and the client renders this response straight into the timeline — so
        // populating names here saves a refetch after every decision.
        var reviewerNames = await VendorReviewerNames.LoadAsync(_context, vendor, cancellationToken);
        return VendorDto.From(vendor, reviewerNames);
```

Add `using HeavenlyJob.Application.Features.ServicesPortal.Vendors.Common;` if absent.

- [ ] **Step 9: Set the flag on the admin controller**

In `src/Api/Heavenly-Job.Api/Controllers/ServicesPortal/VendorAdminController.cs`, change the `GetById` action body to:

```csharp
    public async Task<ActionResult<VendorDto>> GetById(string vendorId) =>
        Ok(await Mediator.Send(new GetVendorProfileQuery
        {
            VendorId = vendorId,
            IncludeReviewerNames = true
        }));
```

- [ ] **Step 10: Run the tests to verify they pass**

```bash
cd /Users/admin/Heavenly-agentic/Heavenly-Job-Backend && dotnet test --filter "FullyQualifiedName~VendorApiTests"
```

Expected: PASS, including the two new tests.

- [ ] **Step 11: Run the full suite for regressions**

```bash
cd /Users/admin/Heavenly-agentic/Heavenly-Job-Backend && dotnet test
```

Expected: `Failed: 0, Passed: 214` (212 baseline + 2).

- [ ] **Step 12: Commit and merge**

```bash
cd /Users/admin/Heavenly-agentic/Heavenly-Job-Backend && git add -A && git commit -m "feat: name the reviewing admin on the vendor verification timeline"
```

```bash
cd /Users/admin/Heavenly-agentic/Heavenly-Job-Backend && git checkout dev-agentic && git merge --no-ff feature/vendor-admin-reviewer-names -m "Merge branch 'feature/vendor-admin-reviewer-names' into dev-agentic" && dotnet test
```

Expected: `Failed: 0, Passed: 214` on the merged result. Do not push — the controller handles pushing.

---

## Task 2: Extract the shared `VendorDto → Vendor` mapper (frontend)

A pure refactor with no behaviour change. It exists so Task 4 has one mapper to call instead of a second copy.

**Files:**
- Create: `src/app/core/api/services-portal/vendor-dto.mapper.ts`
- Modify: `src/app/core/services/service-auth.service.ts`

**Interfaces:**
- Consumes: `VendorDto` (`vendor-api.models.ts`), `Vendor`/`VendorDocuments` (`core/models/service.model.ts`)
- Produces: `export function mapVendorDto(dto: VendorDto): Vendor`

- [ ] **Step 1: Create the frontend branch**

```bash
cd /Users/admin/Heavenly-agentic/Heavenly-Frontend && git checkout dev-agentic && git pull --ff-only && git checkout -b feature/vendor-verification-wiring
```

- [ ] **Step 2: Move the mapper into its own file**

Create `src/app/core/api/services-portal/vendor-dto.mapper.ts`. Cut **lines 832–901** of `service-auth.service.ts` verbatim — that is exactly the three declarations `DOCUMENT_TYPE_KEYS` (832), `mapVendorDocuments` (839–848) and `mapVendorDto` (850–901), with no other code in the range — and paste them into the new file, adding `export` to `mapVendorDto` and the imports they need:

```ts
import { Vendor, VendorDocuments } from '../../models/service.model';
import { VendorDto } from './vendor-api.models';

/**
 * The single VendorDto → Vendor mapping.
 *
 * Extracted from ServiceAuthService so the admin verification surface maps
 * identically to the vendor's own profile. Two copies of this would drift the
 * first time a field is added, and the admin queue would quietly disagree with
 * the vendor's own view of their account.
 */
const DOCUMENT_TYPE_KEYS: Record<string, keyof VendorDocuments> = {
  // …the exact contents cut from service-auth.service.ts…
};

function mapVendorDocuments(dto: VendorDto): VendorDocuments {
  // …exact body cut from service-auth.service.ts…
}

export function mapVendorDto(dto: VendorDto): Vendor {
  // …exact body cut from service-auth.service.ts…
}
```

Copy the three bodies character-for-character — this step must not change behaviour. Keep their existing doc comments (including the one explaining that `maskAccountNumber` is idempotent on an already-masked value).

- [ ] **Step 3: Import it back into `service-auth.service.ts`**

Delete the three moved declarations from `service-auth.service.ts` and add to its imports:

```ts
import { mapVendorDto } from '../api/services-portal/vendor-dto.mapper';
```

Leave every call site (`applyVendorDto`, etc.) untouched — they already call `mapVendorDto(dto)`.

- [ ] **Step 4: Verify nothing changed**

```bash
cd /Users/admin/Heavenly-agentic/Heavenly-Frontend && npx ng test --watch=false --browsers=ChromeHeadless && npx ng build
```

Expected: 17/17 specs pass and the build succeeds. A refactor that compiles and leaves the suite green is the evidence here; there is no new behaviour to test.

- [ ] **Step 5: Commit**

```bash
cd /Users/admin/Heavenly-agentic/Heavenly-Frontend && git add src/app/core/api/services-portal/vendor-dto.mapper.ts src/app/core/services/service-auth.service.ts && git commit -m "refactor: extract the shared VendorDto mapper out of ServiceAuthService"
```

---

## Task 3: `legalVendorActions` — the F9 rule in one testable place

**Files:**
- Create: `src/app/core/services/vendor-transitions.ts`
- Test: `src/app/core/services/vendor-transitions.spec.ts`

**Interfaces:**
- Consumes: `VendorStatus` (`core/models/service.model.ts`)
- Produces:
  - `export type VendorAction = 'approve' | 'reject' | 'suspend' | 'reinstate'`
  - `export function legalVendorActions(status: VendorStatus): readonly VendorAction[]`

- [ ] **Step 1: Write the failing spec**

Create `src/app/core/services/vendor-transitions.spec.ts`:

```ts
import { legalVendorActions } from './vendor-transitions';

describe('legalVendorActions', () => {
  it('offers approve and reject on a pending vendor', () => {
    expect(legalVendorActions('pending')).toEqual(['approve', 'reject']);
  });

  it('offers only suspend on a verified vendor', () => {
    expect(legalVendorActions('verified')).toEqual(['suspend']);
  });

  it('offers only approve on a rejected vendor', () => {
    // Not reinstate: the server allows reinstate from `suspended` alone, so
    // offering it here produced a guaranteed 409. A rejected vendor who fixes
    // their documents is approved, not reinstated.
    expect(legalVendorActions('rejected')).toEqual(['approve']);
  });

  it('offers only reinstate on a suspended vendor', () => {
    expect(legalVendorActions('suspended')).toEqual(['reinstate']);
  });

  it('never offers an action the server would reject', () => {
    // Mirrors Domain/Entities/Vendor.cs exactly. If this table and the domain
    // ever disagree, the UI offers a button that always 409s — which is the
    // whole defect F9 exists to close.
    const serverRules: Record<string, string[]> = {
      approve: ['pending', 'rejected'],
      reject: ['pending'],
      suspend: ['verified'],
      reinstate: ['suspended'],
    };

    for (const status of ['pending', 'verified', 'rejected', 'suspended'] as const) {
      for (const action of legalVendorActions(status)) {
        expect(serverRules[action]).toContain(status);
      }
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd /Users/admin/Heavenly-agentic/Heavenly-Frontend && npx ng test --watch=false --browsers=ChromeHeadless --include='**/vendor-transitions.spec.ts'
```

Expected: compile failure — `Cannot find module './vendor-transitions'`.

- [ ] **Step 3: Write the implementation**

Create `src/app/core/services/vendor-transitions.ts`:

```ts
import { VendorStatus } from '../models/service.model';

export type VendorAction = 'approve' | 'reject' | 'suspend' | 'reinstate';

/**
 * Which review actions the server will accept for a vendor in this status.
 *
 * Mirrors the transition guards in `Domain/Entities/Vendor.cs`. It lives here,
 * as a pure function with its own spec, rather than as conditions in a
 * template: the template version silently offered "Return to Queue" on a
 * rejected vendor, which the server refuses with a 409 every time (F9).
 *
 * Order matters — it is the order the buttons render in, primary action first.
 */
const LEGAL_ACTIONS: Record<VendorStatus, readonly VendorAction[]> = {
  pending: ['approve', 'reject'],
  verified: ['suspend'],
  rejected: ['approve'],
  suspended: ['reinstate'],
};

export function legalVendorActions(status: VendorStatus): readonly VendorAction[] {
  return LEGAL_ACTIONS[status] ?? [];
}
```

Deliberately just the one function. Reject and suspend also require a *reason*, but the review page already models that with its existing `pendingAction`/`reasonText` prompt — adding a second exported helper for it here would be an unused export on day one.

- [ ] **Step 4: Run it to verify it passes**

```bash
cd /Users/admin/Heavenly-agentic/Heavenly-Frontend && npx ng test --watch=false --browsers=ChromeHeadless --include='**/vendor-transitions.spec.ts'
```

Expected: PASS, 5 specs.

- [ ] **Step 5: Commit**

```bash
cd /Users/admin/Heavenly-agentic/Heavenly-Frontend && git add src/app/core/services/vendor-transitions.ts src/app/core/services/vendor-transitions.spec.ts && git commit -m "feat: legalVendorActions mirrors the server's vendor transition rules"
```

---

## Task 4: `VendorAdminApiService` + wire models

**Files:**
- Create: `src/app/core/api/services-portal/vendor-admin-api.models.ts`
- Create: `src/app/core/api/services-portal/vendor-admin-api.service.ts`

**Interfaces:**
- Consumes: `VendorDto` (`vendor-api.models.ts`), `environment`
- Produces:
  - `VendorSummaryDto`, `VendorQueueStatsDto`, `VendorQueueDto`, `VendorQueueParams`
  - `VendorAdminApiService` with `queue(params)`, `getById(id)`, `approve(id, reason?)`, `reject(id, reason)`, `suspend(id, reason)`, `reinstate(id, reason?)` — all returning `Observable<…>`

- [ ] **Step 1: Write the wire models**

Create `src/app/core/api/services-portal/vendor-admin-api.models.ts`:

```ts
/**
 * Wire shapes for the admin vendor surface
 * (`/api/service-admin/vendors`, backend B2.2).
 *
 * Dates arrive as ISO 8601 strings and stay strings here — converting to Date
 * is the mapper's job, not the transport's.
 */

/** One row of the verification queue. Deliberately smaller than VendorDto. */
export interface VendorSummaryDto {
  id: string;
  businessName: string;
  businessType: string;
  city: string | null;
  state: string | null;
  primaryContactPerson: string | null;
  email: string | null;
  phone: string | null;
  serviceCapabilities: string[];
  verificationStatus: string;
  createdAt: string;
  verifiedAt: string | null;
}

/**
 * Counts across the *whole* queue, not the current filter — they drive the
 * tabs that change the filter, so filtering them would make every tab show the
 * count of the tab already selected.
 */
export interface VendorQueueStatsDto {
  pending: number;
  verified: number;
  rejected: number;
  suspended: number;
  total: number;
}

export interface VendorQueueDto {
  items: VendorSummaryDto[];
  stats: VendorQueueStatsDto;
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface VendorQueueParams {
  /** Lowercase status, e.g. 'pending'. Omit for every vendor. */
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}
```

- [ ] **Step 2: Write the client**

Create `src/app/core/api/services-portal/vendor-admin-api.service.ts`:

```ts
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { VendorDto } from './vendor-api.models';
import { VendorQueueDto, VendorQueueParams } from './vendor-admin-api.models';

/**
 * Typed client for the admin vendor endpoints (docs/backend/02).
 *
 * Every route here is role-gated to ServiceAdmin/Admin — a caller without one
 * gets 403, which is why Slice 1 (admin bootstrap) had to land first.
 */
@Injectable({ providedIn: 'root' })
export class VendorAdminApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/service-admin/vendors`;

  /** GET /api/service-admin/vendors — filtered, paged, with per-status counts. */
  queue(params: VendorQueueParams = {}): Observable<VendorQueueDto> {
    let httpParams = new HttpParams();
    // `status` binds via TypeConverter, not the JSON snake_case policy — but
    // every VendorStatus member is a single word, so the lowercase wire value
    // parses case-insensitively. No manual conversion needed.
    if (params.status) httpParams = httpParams.set('status', params.status);
    if (params.search) httpParams = httpParams.set('search', params.search);
    if (params.page) httpParams = httpParams.set('page', params.page);
    if (params.pageSize) httpParams = httpParams.set('pageSize', params.pageSize);

    return this.http.get<VendorQueueDto>(this.base, { params: httpParams });
  }

  /** GET /api/service-admin/vendors/{id} — full profile + named timeline. */
  getById(vendorId: string): Observable<VendorDto> {
    return this.http.get<VendorDto>(`${this.base}/${vendorId}`);
  }

  /** Legal from pending or rejected. */
  approve(vendorId: string, reason?: string): Observable<VendorDto> {
    return this.http.post<VendorDto>(`${this.base}/${vendorId}/approve`, { reason: reason ?? null });
  }

  /** Legal from pending only. The reason is shown to the vendor. */
  reject(vendorId: string, reason: string): Observable<VendorDto> {
    return this.http.post<VendorDto>(`${this.base}/${vendorId}/reject`, { reason });
  }

  /** Legal from verified only. */
  suspend(vendorId: string, reason: string): Observable<VendorDto> {
    return this.http.post<VendorDto>(`${this.base}/${vendorId}/suspend`, { reason });
  }

  /** Legal from suspended only — and returns the vendor to *verified*. */
  reinstate(vendorId: string, reason?: string): Observable<VendorDto> {
    return this.http.post<VendorDto>(`${this.base}/${vendorId}/reinstate`, { reason: reason ?? null });
  }
}
```

- [ ] **Step 3: Verify it compiles**

```bash
cd /Users/admin/Heavenly-agentic/Heavenly-Frontend && npx ng build
```

Expected: build succeeds. (No spec here — this class is a thin transport wrapper with no logic of its own; it is exercised end-to-end in Task 8.)

- [ ] **Step 4: Commit**

```bash
cd /Users/admin/Heavenly-agentic/Heavenly-Frontend && git add src/app/core/api/services-portal/vendor-admin-api.models.ts src/app/core/api/services-portal/vendor-admin-api.service.ts && git commit -m "feat: typed client for the admin vendor verification endpoints"
```

---

## Task 5: `VendorAdminService` async siblings — ✅ done (commits 6830d0c, 396757b)

**Files:**
- Modified: `src/app/core/services/vendor-admin.service.ts`

**As-built interfaces** (this section originally planned a narrower design; a
task review caught three real gaps — see "What changed from the original
plan" below — and the fix round redesigned this file. What's recorded here is
what actually shipped, not the original draft):

- `refreshAsync(status?: VendorStatus | 'all'): Promise<void>` — request-sequenced (a `refreshRequestId` counter discards a stale response that resolves after a newer one)
- `getVendorAsync(id: string): Promise<Vendor | null>`
- `approveAsync(id: string, actor: string): Promise<Vendor | null>`
- `rejectAsync(id: string, reason: string, actor: string): Promise<Vendor | null>`
- `suspendAsync(id: string, reason: string, actor: string): Promise<Vendor | null>`
- `reinstateAsync(id: string, actor: string): Promise<Vendor | null>`
- `readonly useRealApi: boolean`
- `readonly queueStats: Signal<VendorQueueStats>` — server counts when present, else the mock-computed `stats`; kept in sync after every decision by a private `adjustServerStats(from, to)`, not just after a refresh

**`actor` is real, not vestigial.** All four decision methods are safe to call in *either* mode: `decide()` branches internally on `useRealApi`, exactly like `refreshAsync`/`getVendorAsync` already did — mock mode calls the corresponding pre-existing synchronous method (`approve`/`reject`/`suspend`/`reinstate`, unchanged) and re-reads via `getVendor(id)`; real-API mode calls `VendorAdminApiService` and ignores `actor` (the server derives the actor from the caller's token). Task 7 must pass `this.actor()` (already a private method on `VendorReviewPageComponent`) into all four — see Task 7's Step 3 below, already updated for this.

**The mock's `reinstate()` now targets `verified`, not `pending`** — matching the server's `Vendor.Reinstate`, which no transition ever produces `pending` from. It also does **not** stamp `verifiedAt` (`transition()` takes an explicit `stampVerifiedAt: boolean`; only `approve()` passes `true`), matching the server's `Reinstate()`, which leaves `VerifiedAt` alone — only `Approve()` sets it.

**What changed from the original plan, and why** (recorded so later slices don't repeat the gap):

1. **A live regression, fixed immediately outside this task.** Fixing `reinstate()`'s target status was correct, but until Task 7 lands, `vendor-review.page.html` still had a "Return to Queue" button on **rejected** vendors wired to `reinstate()` — which the server refuses (`reinstate` is `suspended`-only), but the *mock* doesn't validate transitions at all, so it silently succeeded and, post-fix, silently approved a rejected vendor. `useRealApi` is committed `false`, so this was live in the shipped app the moment `6830d0c` landed. Fixed directly, same day, by removing that one button (commit `90167b8`, in `vendor-review.page.html` — not this file).
2. **No in-flight request sequencing on `refreshAsync`.** Task 6 wires this method to rapid filter-tab clicks; without sequencing, a slow older response can overwrite a fast newer one. Fixed with the `refreshRequestId` counter described above.
3. **`decide()` didn't keep `queueStats` in sync.** After a decision, the server-side counts sat stale until the next full refresh — approve three pending vendors and the Pending badge doesn't move. Fixed with `adjustServerStats`.
4. **The decision methods weren't gated by `useRealApi` at all**, unlike `refreshAsync`/`getVendorAsync`. In mock mode they'd have issued a live HTTP call to a backend that might not be running. This is the reason `actor` exists on the public signature — the mock fallback path needs it, the real path doesn't.

Full detail, including the independent re-verification of each fix (traced by hand, not just read), is in the SDD ledger for this slice if you need it; it isn't reproduced here.

- [ ] **Step: Verify it compiles and nothing regressed** *(already done — recorded for completeness)*

```bash
cd /Users/admin/Heavenly-agentic/Heavenly-Frontend && npx ng build && npx ng test --watch=false --browsers=ChromeHeadless
```

Result: build succeeded; 22/22 specs pass (unchanged — this task added no new spec file, by design; the async paths are exercised end-to-end by Task 8's live verification).

---

## Task 6: Wire the queue component and the tab badge

**Files:**
- Modify: `src/app/features/management/vendors/vendor-queue.component.ts`
- Modify: `src/app/features/management/vendors/vendor-queue.component.html:104-105`
- Modify: `src/app/features/management/management.page.ts`
- Modify: `src/app/features/management/management.page.html:45`

**Interfaces:**
- Consumes: `VendorAdminService.refreshAsync`, `.queueStats`, `.useRealApi` (Task 5)
- Produces: no new exports

The management page renders a pending-count badge on the Vendors tab and is a
second consumer of the same service — easy to miss, and wrong in two distinct
ways once the data is remote: it reads the mock-computed `stats()` (which
counts only the rows currently loaded, i.e. one page) and nothing triggers a
load until the user opens the tab, so the badge that exists to *draw* them to
the tab reads zero until they go there anyway.

**A second, separate misleading-data problem, caught in Task 5's review.**
`VendorSummaryDto` (Task 4) does not carry a document count — the backend's
queue query deliberately doesn't load each vendor's full `Documents`
collection for a paged list, which is the right performance call. So Task 5's
`summaryToVendor` sets `documentsUploaded: {}` for every real-API row, and
`documentCount(vendor)` — unchanged, still reading that field — returns `0`
for all of them. The badge doesn't go blank or say "unknown"; it renders
**"0/4"**, which reads as "checked, and none are uploaded" on a screen whose
whole purpose is judging document completeness. Step 3 below stops that
specific lie without inventing a new backend field under this fix's time
pressure — a real `documentCount` on the queue DTO is deferred to the backlog
(recorded in Task 8).

- [ ] **Step 1: Switch the component to the async load and server counts**

In `src/app/features/management/vendors/vendor-queue.component.ts`, make three changes.

Replace the `stats` line:

```ts
  readonly stats = this.vendorAdmin.queueStats;
```

Replace `ngOnInit` with:

```ts
  ngOnInit(): void {
    // Fire-and-forget: `filteredVendors` is a computed over the service's own
    // signal, so it re-renders when the load lands. Awaiting here would need
    // the component to be async and would gain nothing.
    void this.vendorAdmin.refreshAsync();
  }
```

Replace `setFilter` with:

```ts
  setFilter(value: VendorFilter): void {
    this.filter.set(value);

    // Against the real API the client holds one page, so filtering locally
    // would hide vendors that are simply on another page. Re-query instead;
    // in mock mode the whole set is already in memory and the computed filter
    // below is the whole story.
    if (this.vendorAdmin.useRealApi) {
      void this.vendorAdmin.refreshAsync(value);
    }
  }
```

`filteredVendors` stays exactly as it is: in mock mode it does the filtering, and in real-API mode the server has already filtered, so the predicate is a harmless no-op that keeps one code path.

- [ ] **Step 2: Stop the document-count badge from lying in real-API mode**

`vendor-queue.component.ts`'s `documentCount()` reads `vendor.documentsUploaded`, which Task 5's `summaryToVendor` sets to `{}` for every row fetched from the real API (the queue endpoint doesn't load each vendor's documents — a deliberate, separate backend concern, not a bug in this task). Left alone, every real-API row would render **"0/4"**, which reads as "checked, none uploaded" rather than "not loaded at this level" — actively wrong on a screen whose job is judging document completeness.

In `src/app/features/management/vendors/vendor-queue.component.html`, lines 104–105, wrap the count in a mode check:

```html
                @if (!vendorAdmin.useRealApi) {
                  <span class="doc-count" [class.doc-count--incomplete]="documentCount(vendor) < 2">
                    {{ documentCount(vendor) }}/4
                  </span>
                }
```

`vendorAdmin` is already a private field on the component (`private readonly vendorAdmin = inject(VendorAdminService)`) — change it to `protected readonly` so the template can read `useRealApi` off it, matching how `management.page.ts` already exposes its injected services as `protected readonly`.

- [ ] **Step 3: Point the tab badge at the authoritative counts**

In `src/app/features/management/management.page.html`, line 45, replace `stats()` with `queueStats()`:

```html
          <span class="tab-badge">{{ vendorAdminService.queueStats().pending }}</span>
```

- [ ] **Step 4: Populate the badge without opening the tab**

`ManagementPageComponent` currently has no lifecycle hook. In `src/app/features/management/management.page.ts`, add `OnInit` to the class and load the queue once:

```ts
export class ManagementPageComponent implements OnInit {
```

```ts
  ngOnInit(): void {
    // The Vendors tab badge exists to pull an admin toward pending vendors, so
    // it has to be right before they open the tab. In mock mode this is a
    // localStorage read; against the API it is one request.
    void this.vendorAdminService.refreshAsync();
  }
```

Add `OnInit` to the existing `@angular/core` import on that file.

- [ ] **Step 5: Verify**

```bash
cd /Users/admin/Heavenly-agentic/Heavenly-Frontend && npx ng build && npx ng test --watch=false --browsers=ChromeHeadless
```

Expected: build succeeds, 22/22 specs pass.

- [ ] **Step 6: Commit**

```bash
cd /Users/admin/Heavenly-agentic/Heavenly-Frontend && git add src/app/features/management/vendors/vendor-queue.component.ts src/app/features/management/vendors/vendor-queue.component.html src/app/features/management/management.page.ts src/app/features/management/management.page.html && git commit -m "feat: vendor queue and tab badge load from the API with server-side counts"
```

---

## Task 7: Wire the review page and fix the illegal actions (F9)

**Files:**
- Modify: `src/app/features/management/vendors/vendor-review.page.ts`
- Modify: `src/app/features/management/vendors/vendor-review.page.html`

**Interfaces:**
- Consumes: `VendorAdminService.*Async` (Task 5), `legalVendorActions` (Task 3)
- Produces: on the component — `can(action: VendorAction): boolean`, and `approve()` / `startReject()` / `startSuspend()` / `reinstate()` / `confirmReason()` all become `async`

- [ ] **Step 1: Load the vendor asynchronously**

In `src/app/features/management/vendors/vendor-review.page.ts`, replace `ngOnInit` and `reload` with:

```ts
  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.notFound.set(true);
      return;
    }
    await this.reload(id);
  }

  private async reload(id: string): Promise<void> {
    const vendor = await this.vendorAdmin.getVendorAsync(id);
    if (!vendor) {
      this.notFound.set(true);
      return;
    }
    this.vendor.set(vendor);
    this.pendingAction.set(null);
    this.reasonText.set('');
  }
```

The old `ngOnInit` read `this.vendorAdmin.getVendor(id)` synchronously — against a real API that returns `null` before the fetch resolves and the page would render its not-found state permanently. This is the same class of bug fixed three times in F2.1–F2.4.

- [ ] **Step 2: Expose the legal-action rule to the template**

Add the import:

```ts
import { VendorAction, legalVendorActions } from '../../../core/services/vendor-transitions';
```

and add this member to the component:

```ts
  /**
   * Whether the server would accept this action for the vendor's current
   * status. The template previously hard-coded a @switch that offered
   * "Return to Queue" (reinstate) on a rejected vendor — a guaranteed 409,
   * since the server allows reinstate from `suspended` alone.
   */
  can(action: VendorAction): boolean {
    const status = this.vendor()?.verificationStatus;
    return status ? legalVendorActions(status).includes(action) : false;
  }
```

- [ ] **Step 3: Make the four decisions async**

Task 5's fix round (applied after its initial review) redesigned the four `*Async` decision methods to take an `actor` parameter and branch internally on `useRealApi` — mirroring `refreshAsync`/`getVendorAsync`, which already do this. That means every `*Async` method is now safe to call unconditionally, in either mode; this page does not need its own mode check. Pass `this.actor()` (the existing private method already in this file) as the actor argument.

Replace the `approve`, `reinstate` and `confirmReason` methods with:

```ts
  async approve(): Promise<void> {
    const v = this.vendor();
    if (!v) return;
    const updated = await this.vendorAdmin.approveAsync(v.id, this.actor());
    if (updated) this.vendor.set(updated);
  }

  async reinstate(): Promise<void> {
    const v = this.vendor();
    if (!v) return;
    const updated = await this.vendorAdmin.reinstateAsync(v.id, this.actor());
    if (updated) this.vendor.set(updated);
  }

  async confirmReason(): Promise<void> {
    const v = this.vendor();
    const action = this.pendingAction();
    const reason = this.reasonText().trim();
    if (!v || !action || !reason) return;

    const updated =
      action === 'reject'
        ? await this.vendorAdmin.rejectAsync(v.id, reason, this.actor())
        : await this.vendorAdmin.suspendAsync(v.id, reason, this.actor());

    if (updated) this.vendor.set(updated);
    this.pendingAction.set(null);
    this.reasonText.set('');
  }
```

`startReject()`, `startSuspend()` and `cancelReason()` stay as they are — they only set local signals.

- [ ] **Step 4: Drive the buttons off the rule**

In `src/app/features/management/vendors/vendor-review.page.html`, replace the whole `@switch (v.verificationStatus) { … }` block (the four `@case` blocks inside `<div class="decision-actions">`) with:

```html
                  @if (can('approve')) {
                    <button type="button" class="btn-primary" (click)="approve()">
                      <app-icon name="circle-check" [size]="16" /> Approve Vendor
                    </button>
                  }
                  @if (can('reject')) {
                    <button type="button" class="btn-outline" (click)="startReject()">Reject</button>
                  }
                  @if (can('suspend')) {
                    <button type="button" class="btn-danger" (click)="startSuspend()">
                      <app-icon name="ban" [size]="16" /> Suspend Vendor
                    </button>
                  }
                  @if (can('reinstate')) {
                    <button type="button" class="btn-primary" (click)="reinstate()">
                      Reinstate Vendor
                    </button>
                  }
```

Two behaviour changes fall out of this, both deliberate: the **"Return to Queue"** button disappears from rejected vendors (it always 409'd), and the suspended vendor's button is relabelled from "Reinstate to Queue" to **"Reinstate Vendor"** — reinstating returns them to *verified*, not to the queue.

- [ ] **Step 5: Verify**

```bash
cd /Users/admin/Heavenly-agentic/Heavenly-Frontend && npx ng build && npx ng test --watch=false --browsers=ChromeHeadless
```

Expected: build succeeds, 22/22 specs pass.

- [ ] **Step 6: Commit**

```bash
cd /Users/admin/Heavenly-agentic/Heavenly-Frontend && git add src/app/features/management/vendors/vendor-review.page.ts src/app/features/management/vendors/vendor-review.page.html && git commit -m "feat: vendor review wired to the API; only legal actions are offered (F9)"
```

---

## Task 8: Live verification and backlog

The verification gate the roadmap set for this slice. This is the first time in the project that a vendor can be verified without a raw database write, so walk it end to end rather than trusting the unit tests.

**Files:**
- Modify: `src/environments/environment.ts` (temporarily; reverted in Step 6)
- Modify: `docs/BACKLOG.md`

- [ ] **Step 1: Start the stack**

```bash
cd /Users/admin/Heavenly-agentic/Heavenly-Job-Backend && docker compose up -d
```

```bash
cd /Users/admin/Heavenly-agentic/Heavenly-Job-Backend/src/Api/Heavenly-Job.Api && dotnet run
```

```bash
cd /Users/admin/Heavenly-agentic/Heavenly-Frontend && npx ng serve --port 4300
```

Kill any process already listening on `:5212` or `:4300` first — a server started before this slice's code will silently serve the old build and invalidate the whole verification.

- [ ] **Step 2: Give yourself a ServiceAdmin**

Log in as the seeded admin (Slice 1) and grant `ServiceAdmin` to the account you will review vendors with, using `GET /api/admin/users?email=…` to find its id and `POST /api/admin/users/{id}/roles` with `{"role":"service_admin"}`. Log out and back in afterwards — role claims are baked into the access token at login, so the grant does not affect a token already issued.

- [ ] **Step 3: Turn the real API on locally**

Set `useRealApi: true` in `src/environments/environment.ts`. Reverted in Step 6; must not be committed.

- [ ] **Step 4: Walk the gate**

1. Register a fresh vendor through `/vendor-signup`. Expect `POST /api/vendors/register` → **201**.
2. As the ServiceAdmin, open `/management` → **Vendors** tab. The new vendor appears, and the tab counts match the queue.
3. Confirm the counts are server-side: the Pending count should reflect *every* pending vendor, not just the rows on screen.
4. Open the vendor. Confirm the timeline reads **"by Service Admin"** (or your admin's name) — **not** a GUID. That is Task 1's deliverable.
5. Confirm the buttons match the status: a `pending` vendor offers **Approve** and **Reject** only — no Suspend, no Reinstate.
6. Approve. Expect **200** and the status flipping to verified.
7. Confirm the vendor now passes `vendorVerifiedGuard`: log in as that vendor and reach `/vendor-dashboard` instead of `/verification-pending`. **This is the gate — it is what unblocks Slices 4 onward.**
8. Back as admin, open the now-verified vendor: only **Suspend** is offered. Suspend it with a reason, then confirm only **Reinstate Vendor** is offered.
9. Reinstate, and confirm the vendor returns to **verified** (not pending).

- [ ] **Step 5: Confirm no illegal action is reachable**

For each of the four statuses, confirm the buttons on screen exactly match this table — a button outside it is an F9 regression:

| Status | Buttons shown |
|---|---|
| `pending` | Approve Vendor, Reject |
| `verified` | Suspend Vendor |
| `rejected` | Approve Vendor |
| `suspended` | Reinstate Vendor |

- [ ] **Step 6: Revert the flag**

```bash
cd /Users/admin/Heavenly-agentic/Heavenly-Frontend && git checkout -- src/environments/environment.ts && git diff --stat
```

Expected: no output — `useRealApi` stays committed as `false`.

- [ ] **Step 7: Update the backlog**

In `docs/BACKLOG.md`:

1. Under **F2**, add an `F2.5 done 2026-08-02` paragraph recording: the queue and review screens wired to `/api/service-admin/vendors`; server-side counts (the client holds one page, so local counts would misreport); the shared `mapVendorDto` extracted so the admin and vendor views cannot drift; and the backend addition of reviewer names on the timeline.
2. Change **F9**'s heading to `### ✅ F9. Vendor status transitions are unguarded on the client — **DONE 2026-08-02**` and record what was actually wrong, which was narrower and more specific than the original entry: the mock's `reinstate()` set `pending` where the server sets `verified`, and the review template offered "Return to Queue" on a rejected vendor — an action the server refuses with 409 every time. Both fixed; `legalVendorActions()` now mirrors `Domain/Entities/Vendor.cs` and has its own spec.
3. Update the **Current state** table: services portal now includes the admin vendor-verification surface; frontend specs 17 → 22; backend tests 212 → 214.
4. Add a new backend item, `🟢 B12`, recording the gap Task 6 worked around: `GetVendorQueueQuery`/`VendorSummaryDto` don't carry a document count, so the admin queue can't show one without either loading every vendor's full `Documents` collection in a paged list query (wrong performance trade for a list view) or adding a lightweight count-only field to the projection. The queue currently hides the count entirely in real-API mode rather than showing a wrong one.
5. Add to the changelog:

```markdown
- **2026-08-02** — **Slice 2 done (F2.5 + F9):** the vendor verification queue and review screens run on the real API, so a vendor can be verified through the UI for the first time — the prerequisite Slices 4+ were blocked on, and the gap F2.4 recorded honestly. Backend gained reviewer names on the verification timeline (a join, not a stored column) so the audit trail reads as people rather than GUIDs; the vendor's own profile deliberately does not get them. Found and fixed three real client/server divergences: `reinstate` moved a vendor to `pending` on the client and `verified` on the server; the review screen offered a "Return to Queue" action on rejected vendors that the server refuses with 409 every time (this half was live in the shipped mock-mode app for several commits before Task 7 removed it — pulled forward as a direct fix once caught); and the queue's document-count badge would have read "0/4" on every real-API row (the summary DTO doesn't carry one) rather than showing nothing — logged as B12. 214/214 backend, 22/22 frontend.
```

- [ ] **Step 8: Commit and merge both repos**

```bash
cd /Users/admin/Heavenly-agentic/Heavenly-Frontend && git add docs/BACKLOG.md && git commit -m "docs: Slice 2 complete — vendor verification wired, F9 closed"
```

```bash
cd /Users/admin/Heavenly-agentic/Heavenly-Frontend && git checkout dev-agentic && git merge --no-ff feature/vendor-verification-wiring -m "Merge branch 'feature/vendor-verification-wiring' into dev-agentic" && npx ng test --watch=false --browsers=ChromeHeadless && npx ng build
```

Expected: 22/22 specs and a clean build on the merged result. The backend was already merged in Task 1 Step 12. Do not push — the controller handles pushing.

---

## Done when

- [ ] `dotnet test` passes with 214 tests.
- [ ] `npx ng test --watch=false --browsers=ChromeHeadless` passes with 22 specs.
- [ ] `npx ng build` succeeds with 0 errors.
- [ ] A vendor registered through the real signup appears in the admin queue with correct server-side counts.
- [ ] The verification timeline names the reviewing admin; the vendor's own `/api/vendors/me` does not.
- [ ] Approving through the UI lets that vendor pass `vendorVerifiedGuard` into `/vendor-dashboard`.
- [ ] Each of the four statuses offers exactly the buttons in Task 8 Step 5's table.
- [ ] Reinstating a suspended vendor returns them to **verified**, in both mock and real-API mode.
- [ ] `useRealApi` is still committed as `false`.
- [ ] `docs/BACKLOG.md` records F2.5 and closes F9.

**Next:** Slice 3 — model divergence fixes (F5, F10). Its plan gets written at the start of that slice, so it can incorporate anything this one turned up.

---

## Notes carried forward (not this slice's work)

- **Documents are still non-persisting.** The review page lists document *names* from `documentsUploaded`, but there is no file host (B10), so an admin cannot open a vendor's document to check it. Verification is therefore currently a judgement on metadata alone. This is the largest remaining hole in the verification flow and should be stated plainly rather than discovered later.
- **`legalVendorActions` duplicates a rule the server owns.** It is the right trade-off for a responsive UI, but the two can drift. If a future slice adds a transition, the spec's last case (`never offers an action the server would reject`) is where that drift surfaces — keep it.
- **Queue paging is capped at 100** (`pageSize: 100` in `refreshAsync`) rather than paged. Fine while the vendor pool is small; a real pager belongs with the other admin lists in Slice 5.
