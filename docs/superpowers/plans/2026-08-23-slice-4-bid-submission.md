# Slice 4 — Bid Submission + My Bids — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the three vendor bid screens — bid submission, my bids, bid detail — off `localStorage` and onto the real `/api/bids` endpoints, so a verified vendor can draft a bid across reloads, submit it, watch its status, and withdraw it while the window is open.

**Architecture:** Two halves on two branches. The backend half is small and lands first: three vendor-facing DTO corrections so the client can offer exactly the actions the server will accept (the same principle `legalVendorActions` established in Slice 2, applied to bids). The frontend half follows the pattern F2.1–F2.5 established — a thin typed `BidApiService` plus wire DTOs, a pure DTO mapper, and `*Async` siblings on `VendorTenderService` that branch on `environment.useRealApi` while every mock method keeps working unchanged. All three screens use `core/utils/request-state.ts` from Slice 3; none hand-rolls a `loading` boolean.

**Tech Stack:** Angular 17 (standalone, signals) · TypeScript strict · Karma/Jasmine · .NET 10 · EF Core 10 + Npgsql · MediatR · FluentValidation · xUnit + Testcontainers

## Global Constraints

Every task's requirements implicitly include this section.

- **Branches (already cut, do not create new ones):**
  - Frontend `feature/bid-submission` off `dev-agentic` (frontend repo, `Heavenly-Frontend/`).
  - Backend `feature/vendor-bid-dtos` off `dev-agentic` (backend repo, `Heavenly-Job-Backend/`).
  - `dev-agentic` is the integration branch for both repos. Nothing merges to `develop`/`main`.
- **`useRealApi` stays committed `false`.** Every mock path must keep working unchanged so a fresh clone runs with no backend. Flip it locally to verify; **never commit the flip**.
- **The backend is the canon.** Where this plan and a `.cs` file disagree, read the `.cs` file and follow it — then correct this plan in the same commit.
- **Wire format:** `camelCase` JSON; enums lowercase `snake_case` strings; dates ISO 8601 UTC; IDs opaque strings. Nulls **are** serialized (no `DefaultIgnoreCondition` is configured), so an absent object arrives as `"myBid": null`, not as a missing key.
- **Errors:** RFC 9457 Problem Details from `GlobalExceptionHandler`. The mapping, read from the handler on 2026-08-23:
  | Exception | Status | Body |
  |---|---|---|
  | `ValidationException` (FluentValidation) | **400** | `ValidationProblemDetails` — `errors: { "PropertyName": ["msg"] }`, PascalCase keys |
  | `NotFoundException` | **404** | `detail` |
  | `ForbiddenException` | **403** | `detail` |
  | `ConflictException` | **409** | `detail` |
  | `DomainException` (incl. `TenderNotOpenForBiddingException`) | **409** | `detail` |
- **Frontend tests:** `npx ng test --watch=false --browsers=ChromeHeadless`. **Verified baseline: 62 specs, all green (run 2026-08-23).** Note the roadmap and `docs/BACKLOG.md` both still say 55 — that number predates Slice 3's fix round; 62 is the real one, and Task 10 corrects the docs. New specs go beside the file they cover.
- **Backend tests:** `dotnet test` from `Heavenly-Job-Backend/`. **Baseline 215 tests.** ⚠️ **Docker must be running** — the suite is Testcontainers-backed, and with Docker down every one of the 215 fails instantly with a `Docker.DotNet` connection stack trace (confirmed 2026-08-23). That is an environment failure, not a code failure. Start Docker before reporting a red suite.
- **Build:** `npx ng build` must stay clean.
- **Race-condition rule:** never snapshot service state in `ngOnInit()` when an async refresh may still be in flight. Derive page state with `computed()` against the service's own signals.
- **Failure never fabricates data.** A failed load records an error; it does not write `[]` or zeros. This is `request-state.ts`'s rule 2 and it is a review finding, not a preference.
- **Commits:** conventional prefixes (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`), one concern per commit.
- **`docs/BACKLOG.md` is updated at the end of the slice** (Task 10), not retroactively.

---

## Context: what is actually true, verified against the code on 2026-08-23

Read this before Task 1. The roadmap's Slice 4 section was written before Slices 1–3 shipped. Four things it says need correcting, and it misses three defects that block its own verification gate.

### Corrections to the roadmap

| Roadmap said | Actually |
|---|---|
| "Files: create `bid-api.{service,models}.ts`; modify `vendor.service.ts` and the three pages." | Also `tender-detail.page.ts` (per-tender bid status, the D6 exception the same section calls for) and `vendor-dashboard.page.ts` (the `/mine/stats` bullet in the same section). The file list and the notes contradict each other; the notes are right. |
| "`GET /api/bids/mine/stats` replaces the vendor dashboard's four separately-computed counters with one call." | The dashboard does not compute four counters — `vendor-dashboard.page.ts:109` **hard-codes** `{openTenders: 24, myBids: 8, wonBids: 3, activeProjects: 2}`. There is nothing to replace; there is a fabrication to delete. |
| "Withdrawal is only legal while the bid window is open… Hide the control rather than letting it fail." | **There is no withdraw control.** `VendorTenderService.withdrawBid()` exists at `vendor.service.ts:422` and is called from nowhere — verified by grep across `*.ts` and `*.html`. This slice builds the control, it does not gate an existing one. |
| "Per-tender bid status (`getMyBidStatus`) moves from mock to the real Bid API here." | It cannot, as written: **`GET /api/bids` has no by-tender route**, and `VendorTenderDto` (the tender-detail payload) carries no bid field — only the *browse list* row (`TenderOpportunityDto`) has `hasBid`. Task 1 adds `myBid` to the detail DTO, which is both exact and free (the handler already loads the vendor). Scanning a page of `/api/bids/mine` was the alternative and is not sound past 100 bids. |

### Three defects that block the slice's own verification gate

1. **The Submit Bid button is a dead link.** `tender-detail.page.ts:85` navigates to `/vendor/bid/submit/:tenderId`. The route table (`vendor.routes.ts`) declares `tenders/:id/bid`. There is no `bid/submit` path anywhere in `app.routes.ts`, and the `**` catch-all renders the real 404 page. **The bid form is unreachable from the tender today.** Fixed in Task 6.

2. **A restored draft loses all but the first row of every repeatable section.** `bid-submission.page.ts:97` calls `this.bidForm.patchValue(draft.formData)`. `similarWorkReferences` and `priceBreakdown` are `FormArray`s holding exactly one control each (`initializeForm` calls `addReference()`/`addPriceItem()` once). `FormArray.patchValue` silently ignores values past the last existing control — so a draft with three price lines restores one. This is pre-existing and mock-mode-only so far; the verification gate ("draft a bid across page reloads") walks straight into it. Fixed in Task 6.

3. **A withdrawn bid still occupies the vendor's one slot, but `hasBid` says it doesn't.** The unique index `IX_bids_tender_id_vendor_id` and `SubmitBidCommandHandler`'s duplicate check (`AnyAsync(b => b.TenderId == … && b.VendorId == …)`, no status filter) both count a withdrawn bid. But `BrowseTendersQueryHandler` computes `myBidTenderIds` with `&& b.Status != BidStatus.Withdrawn`, so after a withdrawal the browse row reports `hasBid: false` and offers a Submit button that can only ever 409. Fixed in Task 1.
   > **Not fixed here, and deliberately so:** *whether* withdrawing should free the slot is a product decision, not a bug. The current answer is "no". Task 10 logs it as **B14** for a decision rather than changing behaviour under cover of a wiring slice.

4. **`isEditableByVendor` claims more than the server allows.** `Bid.cs:172` — `IsEditableByVendor => Status == BidStatus.Submitted`, doc-commented "Whether the vendor may still change or pull this bid." But `WithdrawBidCommandHandler` refuses on `!bid.Tender.IsAcceptingBids`, which is a *different and stricter* condition: an admin can `close` a tender early, leaving a `submitted` bid whose window is shut. A UI trusting `isEditableByVendor` would show Withdraw and take a 409. Task 1 adds `canWithdraw` rather than redefining `isEditableByVendor` (which honestly means "the status permits revision" and has one other conceptual user coming in Slice 7).

### What the backend already gives us, read from the source

`BidsController.cs` — every route `[Authorize(Roles = Vendor)]`, every query scoped to the caller's own vendor id:

| Route | Returns | Refuses with |
|---|---|---|
| `GET /api/bids/drafts/{tenderId}` | `BidDraftDto` | **404 when no draft exists** — the normal first-visit case, not an error |
| `PUT /api/bids/drafts/{tenderId}` | `BidDraftDto` | 400 (step/shape), 409 (`TenderNotOpenForBiddingException`) |
| `POST /api/bids/tenders/{tenderId}` | **201** `BidDto` | 400 validation · 403 eligibility · 409 duplicate **or** window closed |
| `GET /api/bids/mine?status=&page=&pageSize=` | `BidListDto<BidSummaryDto>` | pageSize clamped 1..**100**, default 20 |
| `GET /api/bids/mine/stats` | `VendorBidStatsDto` | — |
| `GET /api/bids/{bidId}` | `BidDto` | 404 (another vendor's bid is *not found*, never *forbidden*) |
| `POST /api/bids/{bidId}/withdraw` | `BidDto` | 409 once the window is shut |

Submission is gated server-side on three things — window, eligibility, no duplicate. `confirmEligibility` is an **attestation**, not the check: `SubmitBidCommandValidator` requires it to be `true`, and *then* `SubmitBidCommandHandler` runs `tender.FindEligibilityFailures(vendor)` and 403s with every reason listed. The UI must surface that refusal, not assume success.

Submitting **deletes the draft server-side** in the same transaction. Do not follow a successful submit with a draft-delete call — that is the exact shape of the F2.3 bug where a redundant cleanup call 404'd and reported a successful submission as a failure.

---

## File Structure

### Backend — `Heavenly-Job-Backend/`, branch `feature/vendor-bid-dtos`

| File | Change |
|---|---|
| `src/Application/…/Tenders/Common/TenderDtos.cs` | New `MyBidSummaryDto`; `VendorTenderDto` gains `MyBid` |
| `src/Application/…/Tenders/Queries/TenderQueries.cs` | Browse: `hasBid` counts a withdrawn bid. Detail: project the caller's own bid |
| `src/Application/…/Bids/Common/BidDtos.cs` | `BidDto` gains `CanWithdraw` |
| `tests/Heavenly-Job.IntegrationTests/BidApiTests.cs` | Three new tests |

### Frontend — `Heavenly-Frontend/`, branch `feature/bid-submission`

**Create**

| File | Responsibility |
|---|---|
| `src/app/core/api/services-portal/bid-api.models.ts` | Wire DTOs for `/api/bids`. Mirrors the wire exactly — no domain shapes, no optional-vs-null guessing |
| `src/app/core/api/services-portal/bid-api.service.ts` | Thin typed client, seven methods, one per route |
| `src/app/features/vendor/bid-dto.mapper.ts` | The single place wire DTOs become `Bid`/`BidSummary`/`BidDraft`, and `BidFormData` becomes a submit payload. Beside the types it produces, not in `core/` — `vendor-dto.mapper.ts` sits in `core/api/` because `Vendor` lives in `core/models/`; these types live in `features/vendor/`, and `core/` must not import upward from `features/` |
| `src/app/features/vendor/bid-dto.mapper.spec.ts` | Its spec |
| `src/app/core/utils/problem-details.ts` | Reads RFC 9457 bodies: status, `detail`, and `errors` with keys camelCased to match form controls. Slices 5–9 reuse it |
| `src/app/core/utils/problem-details.spec.ts` | Its spec |
| `src/app/features/vendor/vendor.service.spec.ts` | The bid `*Async` paths: sequencing, failure-never-fabricates, submit-result discrimination |
| `src/app/features/vendor/bid-submission/bid-submission.page.spec.ts` | Draft restore rebuilds form arrays; a 403 renders the refusal |
| `src/app/features/vendor/my-bids/my-bids.page.spec.ts` | Loading / error / empty are three distinct states |
| `src/app/features/vendor/bid-detail/bid-detail.page.spec.ts` | The withdraw control follows `canWithdraw`, not status |

**Modify**

| File | Change |
|---|---|
| `src/app/core/models/service.model.ts` | Hosts `BidStatus` (moved from `vendor.model.ts`), so `core/` never imports from `features/` |
| `src/app/features/vendor/vendor.model.ts` | Re-exports `BidStatus`; new `BidSummary`; `Bid extends BidSummary` and gains `bidNumber`/`canWithdraw`/`isLive`/`events`; `BidDraft` gains `totalSteps`; `BidStatusResult` gains `bidNumber` |
| `src/app/features/vendor/vendor.service.ts` | Bid `*Async` siblings, request-state, `bids` becomes a computed over two private sources |
| `src/app/features/vendor/bid-submission/bid-submission.page.{ts,html}` | Async draft + submit, refusal surfacing, form-array restore, and the route fix's landing side |
| `src/app/features/vendor/my-bids/my-bids.page.{ts,html}` | Async load, three states, truncation notice, `bidNumber` for display |
| `src/app/features/vendor/bid-detail/bid-detail.page.{ts,html}` | Async load, three states, the withdraw control |
| `src/app/features/vendor/tender-detail/tender-detail.page.ts` | Route fix; real bid status from the bundle |
| `src/app/core/api/services-portal/tender-api.models.ts` | `VendorTenderDto` gains `myBid` |
| `src/app/features/dashboard/vendor-dashboard/vendor-dashboard.page.ts` | Stats from `/api/bids/mine/stats`; delete the hard-coded four |

---

## Task 1: Backend — vendor-facing DTOs tell the truth about the caller's own bid

**Repo:** `Heavenly-Job-Backend/`, branch `feature/vendor-bid-dtos` (already checked out).

**Why one task and not three:** all three changes assert one property — *a vendor-facing payload must carry enough for the client to offer exactly the actions the server will accept*. They share a build, a `dotnet test` cycle and a branch, and together they total about thirty lines. Splitting them would interleave two backend branches through the frontend tasks for no review value.

**Files:**
- Modify: `src/Application/Heavenly-Job.Application/Features/ServicesPortal/Tenders/Common/TenderDtos.cs` (new record above line 87; `VendorTenderDto` record + its `From` at line 122)
- Modify: `src/Application/Heavenly-Job.Application/Features/ServicesPortal/Tenders/Queries/TenderQueries.cs` (browse `myBidTenderIds` ~line 118; detail handler ~lines 186-192)
- Modify: `src/Application/Heavenly-Job.Application/Features/ServicesPortal/Bids/Common/BidDtos.cs` (`BidDto` record ~line 84 and its `From` ~line 104)
- Test: `tests/Heavenly-Job.IntegrationTests/BidApiTests.cs` (append before the closing brace)

**Interfaces:**
- Consumes: nothing.
- Produces, on the wire:
  - `GET /api/tenders/{id}` → `myBid: { id: string, bidNumber: string, status: string } | null`
  - `GET /api/tenders` → `hasBid: boolean` now **true** for a withdrawn bid
  - `GET /api/bids/{id}` and every other `BidDto` → `canWithdraw: boolean`
  - Task 2 declares the TypeScript for all three; the names above are the contract.

- [ ] **Step 1: Start Docker, then confirm the baseline is green**

Run: `dotnet test`
Expected: `Passed: 215, Failed: 0`. If instead every test fails with a `Docker.DotNet` / `Testcontainers` connection stack trace, Docker is not running — start it and re-run. Do not proceed on a red baseline.

- [ ] **Step 2: Write the three failing tests**

Append to `tests/Heavenly-Job.IntegrationTests/BidApiTests.cs`, inside the class, before its final `}`:

```csharp
    // ================= what the vendor-facing DTOs must reveal =================

    [Fact]
    public async Task TenderDetail_NamesTheCallersOwnBid()
    {
        var admin = await AdminTokenAsync();
        var tenderId = await PublishedTenderAsync(admin);

        var token = await VendorTokenAsync();
        Authorize(token);

        var before = await _client.GetFromJsonAsync<JsonElement>($"/api/tenders/{tenderId}");
        Assert.Equal(JsonValueKind.Null, before.GetProperty("myBid").ValueKind);

        var submitted = await _client.PostAsJsonAsync($"/api/bids/tenders/{tenderId}", BidPayload());
        var bidId = (await submitted.Content.ReadFromJsonAsync<JsonElement>())
            .GetProperty("id").GetString();

        var after = await _client.GetFromJsonAsync<JsonElement>($"/api/tenders/{tenderId}");
        Deauthorize();

        var mine = after.GetProperty("myBid");
        Assert.Equal(bidId, mine.GetProperty("id").GetString());
        Assert.Equal("submitted", mine.GetProperty("status").GetString());
        Assert.StartsWith("BID-", mine.GetProperty("bidNumber").GetString());
    }

    /// <summary>
    /// A withdrawn bid still occupies the vendor's one slot — the unique index
    /// on (tender, vendor) and the submit handler's duplicate check both count
    /// it. A browse row reporting hasBid:false therefore offered a Submit
    /// button that could only ever 409.
    /// </summary>
    [Fact]
    public async Task AWithdrawnBidStillCountsAsHavingBid()
    {
        var admin = await AdminTokenAsync();
        var tenderId = await PublishedTenderAsync(admin);
        var (token, bidId) = await SubmitBidAsync(tenderId);

        Authorize(admin);
        var tenderNumber = (await _client.GetFromJsonAsync<JsonElement>(
            $"/api/service-admin/tenders/{tenderId}")).GetProperty("tenderNumber").GetString();

        Authorize(token);
        await _client.PostAsJsonAsync($"/api/bids/{bidId}/withdraw", new { });

        var detail = await _client.GetFromJsonAsync<JsonElement>($"/api/tenders/{tenderId}");
        Assert.Equal("withdrawn", detail.GetProperty("myBid").GetProperty("status").GetString());

        // Searched by tender number, not read off page 1: this collection shares
        // one database and one city, so the browse is paged.
        var browse = await _client.GetFromJsonAsync<JsonElement>($"/api/tenders?search={tenderNumber}");
        var row = browse.GetProperty("items").EnumerateArray()
            .Single(t => t.GetProperty("id").GetString() == tenderId);
        Assert.True(row.GetProperty("hasBid").GetBoolean());

        // The withdrawn bid is out of contention even though it blocks a re-bid.
        Assert.Equal(0, row.GetProperty("bidCount").GetInt32());

        // And this is what makes the flag matter: the slot really is spent.
        var again = await _client.PostAsJsonAsync($"/api/bids/tenders/{tenderId}", BidPayload());
        Deauthorize();
        Assert.Equal(HttpStatusCode.Conflict, again.StatusCode);
    }

    /// <summary>
    /// `isEditableByVendor` is a status test; withdrawal is gated on the
    /// tender's window, which an admin can shut early. A client trusting the
    /// former would render a control the server refuses.
    /// </summary>
    [Fact]
    public async Task CanWithdraw_TracksTheWindowNotJustTheStatus()
    {
        var admin = await AdminTokenAsync();
        var tenderId = await PublishedTenderAsync(admin);
        var (token, bidId) = await SubmitBidAsync(tenderId);

        Authorize(token);
        var open = await _client.GetFromJsonAsync<JsonElement>($"/api/bids/{bidId}");
        Assert.True(open.GetProperty("canWithdraw").GetBoolean());
        Deauthorize();

        await CloseTenderAsync(admin, tenderId);

        Authorize(token);
        var closed = await _client.GetFromJsonAsync<JsonElement>($"/api/bids/{bidId}");
        Deauthorize();

        Assert.Equal("submitted", closed.GetProperty("status").GetString());
        Assert.True(closed.GetProperty("isEditableByVendor").GetBoolean());
        Assert.False(closed.GetProperty("canWithdraw").GetBoolean());
    }
```

- [ ] **Step 3: Run the three tests to verify they fail**

Run: `dotnet test --filter "TenderDetail_NamesTheCallersOwnBid|AWithdrawnBidStillCountsAsHavingBid|CanWithdraw_TracksTheWindowNotJustTheStatus"`
Expected: all three FAIL. The first two on `KeyNotFoundException` for `myBid`, the third on `canWithdraw`. If one *passes*, the field already exists — stop and read the file before writing anything.

- [ ] **Step 4: Add `MyBidSummaryDto` and hang it off `VendorTenderDto`**

In `TenderDtos.cs`, immediately above `public record VendorTenderDto(`:

```csharp
/// <summary>
/// The caller's own bid on a tender — as much of it as a tender view needs.
///
/// <para>Present whatever its status, <b>withdrawn included</b>. The unique
/// index on (tender, vendor) and <c>SubmitBidCommandHandler</c>'s duplicate
/// check both count a withdrawn bid, so a vendor who withdrew cannot bid
/// again. A view that hid it would offer a Submit button that can only ever
/// 409 — see <c>BrowseTendersQueryHandler</c>'s matching comment.</para>
/// </summary>
public record MyBidSummaryDto(string Id, string BidNumber, string Status);
```

Add a final parameter to the `VendorTenderDto` record — last, so no existing positional argument moves:

```csharp
    DateTime? PublishedAt,
    MyBidSummaryDto? MyBid)
```

and to its factory:

```csharp
    /// <param name="myBid">
    /// Null on list views and for a vendor who has not bid. See
    /// <see cref="MyBidSummaryDto"/> for why a withdrawn bid is not null.
    /// </param>
    public static VendorTenderDto From(
        Tender t,
        TenderEligibilityResultDto? eligibility = null,
        MyBidSummaryDto? myBid = null) => new(
```

…with `myBid` as the final argument of the `new(…)` call, after the clarifications projection.

- [ ] **Step 5: Project the caller's own bid in the detail handler**

In `TenderQueries.cs`, in `GetTenderForVendorQueryHandler.Handle`, replace the final two statements:

```csharp
        var failures = tender.FindEligibilityFailures(vendor);
        var eligibility = new TenderEligibilityResultDto(failures.Count == 0, failures);

        // Whatever its status, withdrawn included — see MyBidSummaryDto.
        // Projected to an anonymous type first: ToWireFormat() is a C#
        // extension method and cannot be translated to SQL, the same reason
        // GetMyBidsQueryHandler maps its rows after materialising them.
        var mine = await _context.Bids
            .AsNoTracking()
            .Where(b => b.TenderId == tender.Id && b.VendorId == vendor.Id)
            .Select(b => new { b.Id, b.BidNumber, b.Status })
            .FirstOrDefaultAsync(cancellationToken);

        var myBid = mine is null
            ? null
            : new MyBidSummaryDto(mine.Id, mine.BidNumber, mine.Status.ToWireFormat());

        return VendorTenderDto.From(tender, eligibility, myBid);
```

- [ ] **Step 6: Make `hasBid` count a withdrawn bid**

Same file, in `BrowseTendersQueryHandler.Handle`, the `myBidTenderIds` query. Drop the status filter and say why:

```csharp
        // No status filter, deliberately — unlike bidCounts above. `bidCount`
        // answers "how contested is this?", where a withdrawn bid is gone;
        // `hasBid` answers "have I spent my one slot?", where it is not. The
        // unique index and the submit handler's duplicate check both count it,
        // so reporting false here offers a Submit button guaranteed to 409.
        var myBidTenderIds = await _context.Bids
            .Where(b => tenderIds.Contains(b.TenderId) && b.VendorId == vendor.Id)
            .Select(b => b.TenderId)
            .ToListAsync(cancellationToken);
```

- [ ] **Step 7: Add `CanWithdraw` to `BidDto`**

In `BidDtos.cs`, add a parameter to the `BidDto` record immediately after `bool IsLive,`:

```csharp
    bool IsLive,
    /// <summary>
    /// Whether a withdraw request would be accepted right now. Stricter than
    /// <see cref="IsEditableByVendor"/>, which tests the status alone:
    /// withdrawal is gated on the tender's bid window, and an admin can close
    /// a tender early, leaving a `submitted` bid whose window is shut.
    /// </summary>
    bool CanWithdraw,
```

and in `BidDto.From`, after `b.IsLive,`:

```csharp
        b.IsLive,
        b.IsEditableByVendor && b.Tender.IsAcceptingBids,
```

`From` already documents `Tender` as a required include, and all three call sites (`GetMyBidQueryHandler`, `WithdrawBidCommandHandler`, `SubmitBidCommandHandler`) load or assign it — verified 2026-08-23.

- [ ] **Step 8: Run the three tests to verify they pass**

Run: `dotnet test --filter "TenderDetail_NamesTheCallersOwnBid|AWithdrawnBidStillCountsAsHavingBid|CanWithdraw_TracksTheWindowNotJustTheStatus"`
Expected: `Passed: 3, Failed: 0`

- [ ] **Step 9: Run the whole suite**

Run: `dotnet test`
Expected: `Passed: 218, Failed: 0` (215 + 3). If the total differs, the count in this plan is stale — record the real number here and in Task 10's backlog update rather than assuming a failure.

- [ ] **Step 10: Commit**

```bash
git add -A && git commit -m "feat: vendor-facing tender and bid DTOs report the caller's own bid honestly"
```

---

## Task 2: Frontend — wire DTOs and the typed bid client

**Repo:** `Heavenly-Frontend/`, branch `feature/bid-submission` (already checked out). Every remaining task is in this repo.

**Files:**
- Create: `src/app/core/api/services-portal/bid-api.models.ts`
- Create: `src/app/core/api/services-portal/bid-api.service.ts`
- Modify: `src/app/core/models/service.model.ts` (host `BidStatus`)
- Modify: `src/app/features/vendor/vendor.model.ts:81-88` (re-export `BidStatus` instead of declaring it)
- Modify: `src/app/core/api/services-portal/tender-api.models.ts` (`VendorTenderDto` gains `myBid`)

**Why the enum move is in this task:** `bid-api.models.ts` lives in `core/` and needs `BidStatus`, which today is declared in `features/vendor/vendor.model.ts` — a `core/ → features/` import, backwards. Slice 3 already moved `BudgetVisibility` and `TenderType` to `core/models/service.model.ts` for exactly this reason and left the import-plus-re-export shim at `vendor.model.ts:1-8`. Follow that shim exactly; it is there because `export type {...} from '...'` alone re-exports a name without binding it into the file's own scope.

**Interfaces:**
- Consumes: Task 1's wire contract (`myBid`, `canWithdraw`, `hasBid`).
- Produces:
  - `BidStatus` exported from `core/models/service.model.ts`, re-exported unchanged from `features/vendor/vendor.model.ts` (every existing importer keeps working).
  - `bid-api.models.ts`: `BidDto`, `BidSummaryDto`, `BidDraftDto`, `BidListDto<T>`, `VendorBidStatsDto`, `BidEventDto`, `BidWorkReferenceDto`, `BidPriceItemDto`, `TechnicalProposalDto`, `CommercialProposalDto`, `SaveBidDraftRequest`, `SubmitBidRequest`, `BidWorkReferenceInput`, `BidPriceItemInput`.
  - `BidApiService` with `getDraft`, `saveDraft`, `submit`, `mine`, `myStats`, `getById`, `withdraw`.
  - `MyBidSummaryDto` and `VendorTenderDto.myBid` in `tender-api.models.ts`.

- [ ] **Step 1: Move `BidStatus` to core**

In `src/app/core/models/service.model.ts`, beside the other canonical unions (near `BudgetVisibility`/`TenderType`, around line 38-41), add:

```ts
/**
 * Where a bid sits in the evaluation pipeline. Mirrors `BidStatus.cs` exactly.
 *
 * `draft` is only ever a `BidDraft`'s state — a persisted bid row never carries
 * it, which is why `COUNT(*)` over bids is always the number of real bids.
 * Lives here rather than in `features/vendor/` so `core/api/` can name it
 * without importing upward, the same move Slice 3 made for `BudgetVisibility`.
 */
export type BidStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'shortlisted'
  | 'awarded'
  | 'rejected'
  | 'withdrawn';
```

In `src/app/features/vendor/vendor.model.ts`, delete the `export type BidStatus = …` block at lines 81-88 and extend the existing shim at the top of the file:

```ts
import type { BidStatus, BudgetVisibility } from '../../core/models/service.model';
export type { BidStatus, BudgetVisibility } from '../../core/models/service.model';
```

- [ ] **Step 2: Verify nothing broke**

Run: `npx ng build`
Expected: clean. `vendor-dashboard.model.ts:2` and `vendor-dashboard.page.ts:16` both import `BidStatus` from `../../vendor/vendor.model` and must keep compiling unchanged — that is what the re-export is for.

- [ ] **Step 3: Write the wire DTOs**

Create `src/app/core/api/services-portal/bid-api.models.ts`:

```ts
/**
 * Wire types for the .NET vendor-facing bid API (backend B2.6,
 * `BidsController` + `BidDtos.cs`).
 *
 * These mirror the wire, not the domain. Every field the server declares
 * nullable is `| null` here rather than optional, because the API serializes
 * nulls explicitly (no `DefaultIgnoreCondition` is configured) — an absent
 * value arrives as `null`, and `?` would let a missing key pass unnoticed.
 * Turning these into the app's own shapes is `bid-dto.mapper.ts`'s job and
 * nowhere else's.
 */
import { BidStatus, ServiceCategory } from '../../models/service.model';

export interface BidWorkReferenceDto {
  id: string;
  clientName: string;
  projectType: string;
  contactPerson: string | null;
  phone: string | null;
}

export interface BidPriceItemDto {
  id: string;
  description: string;
  amount: number;
  sortOrder: number;
}

/** One status change on a bid — append-only; award disputes are decided on this. */
export interface BidEventDto {
  fromStatus: BidStatus | null;
  toStatus: BidStatus;
  note: string | null;
  occurredAt: string;
}

export interface TechnicalProposalDto {
  companyProfile: string | null;
  relevantExperience: string | null;
  technicalApproach: string | null;
  manpowerPlan: string | null;
  equipmentPlan: string | null;
  deliveryTimeline: string | null;
  deviations: string | null;
  similarWorkReferences: BidWorkReferenceDto[];
}

export interface CommercialProposalDto {
  totalPrice: number;
  taxesAndDuties: string | null;
  paymentTerms: string | null;
  validityPeriod: string | null;
  warrantyPricing: string | null;
  amcPricing: string | null;
  priceBreakdown: BidPriceItemDto[];
}

/** `GET|PUT /api/bids/drafts/{tenderId}`. `formData` is the wizard's own answers, opaque to the server. */
export interface BidDraftDto {
  id: string;
  tenderId: string;
  currentStep: number;
  totalSteps: number;
  formData: Record<string, unknown>;
  lastSaved: string;
  createdAt: string;
}

/**
 * A bid as its own author sees it. There is deliberately no DTO anywhere that
 * shows one vendor another's bid, and no `internalNotes` field here at all —
 * that is on the admin-only `BidEvaluationDto`, which this file does not model.
 */
export interface BidDto {
  id: string;
  bidNumber: string;
  tenderId: string;
  tenderNumber: string;
  tenderTitle: string;
  tenderClosingDate: string | null;
  vendorId: string;
  status: BidStatus;
  bidAmount: number;
  technicalProposal: TechnicalProposalDto;
  commercialProposal: CommercialProposalDto;
  rejectionReason: string | null;
  /** Status permits revision. NOT the withdraw test — see `canWithdraw`. */
  isEditableByVendor: boolean;
  /** Still in contention: submitted, under_review or shortlisted. */
  isLive: boolean;
  /** Whether a withdraw would be accepted right now — status AND an open window. */
  canWithdraw: boolean;
  submittedAt: string;
  updatedAt: string;
  events: BidEventDto[];
}

/** One row of `GET /api/bids/mine`. Carries no proposal — the detail route does. */
export interface BidSummaryDto {
  id: string;
  bidNumber: string;
  tenderId: string;
  tenderNumber: string;
  tenderTitle: string;
  category: ServiceCategory;
  status: BidStatus;
  bidAmount: number;
  tenderClosingDate: string | null;
  submittedAt: string;
}

/** `GET /api/bids/mine/stats` — the vendor dashboard's four counters in one call. */
export interface VendorBidStatsDto {
  /** Matched to this vendor's capabilities and areas, not a global count. */
  openTenders: number;
  myBids: number;
  wonBids: number;
  activeProjects: number;
}

export interface BidListDto<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface SaveBidDraftRequest {
  currentStep: number;
  totalSteps: number;
  formData: Record<string, unknown>;
}

export interface BidWorkReferenceInput {
  clientName: string;
  projectType: string;
  contactPerson?: string;
  phone?: string;
}

export interface BidPriceItemInput {
  description: string;
  amount: number;
}

/** `POST /api/bids/tenders/{tenderId}`. `confirmEligibility` is an attestation the server re-checks. */
export interface SubmitBidRequest {
  companyProfile?: string;
  relevantExperience?: string;
  technicalApproach?: string;
  manpowerPlan?: string;
  equipmentPlan?: string;
  deliveryTimeline?: string;
  deviations?: string;
  similarWorkReferences: BidWorkReferenceInput[];
  totalPrice: number;
  taxesAndDuties?: string;
  paymentTerms?: string;
  validityPeriod?: string;
  warrantyPricing?: string;
  amcPricing?: string;
  priceBreakdown: BidPriceItemInput[];
  confirmEligibility: boolean;
}

export interface MyBidsParams {
  status?: BidStatus;
  page?: number;
  pageSize?: number;
}
```

- [ ] **Step 4: Declare `myBid` on the tender detail DTO**

In `src/app/core/api/services-portal/tender-api.models.ts`, add above `VendorTenderDto` and reference it from the interface:

```ts
/**
 * The caller's own bid on this tender, from `GET /api/tenders/{id}`.
 *
 * Present whatever its status, **withdrawn included** — a withdrawn bid still
 * spends the vendor's one slot (unique index on tender+vendor), so treating it
 * as "no bid" would offer a Submit button the server refuses with 409.
 */
export interface MyBidSummaryDto {
  id: string;
  bidNumber: string;
  status: BidStatus;
}
```

Add `import { BidStatus, ServiceCategory } from '../../models/service.model';` (the file already imports `ServiceCategory`), and add to `VendorTenderDto`, after `publishedAt`:

```ts
  myBid: MyBidSummaryDto | null;
```

- [ ] **Step 5: Write the typed client**

Create `src/app/core/api/services-portal/bid-api.service.ts`:

```ts
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  BidDraftDto,
  BidDto,
  BidListDto,
  BidSummaryDto,
  MyBidsParams,
  SaveBidDraftRequest,
  SubmitBidRequest,
  VendorBidStatsDto,
} from './bid-api.models';

/**
 * Typed client for the .NET vendor-facing bid endpoints (backend B2.6).
 *
 * Every route is scoped server-side to the caller's own vendor profile — no
 * method here takes a vendor id, because none of the routes accept one. That
 * is what makes the bidding sealed, and it is a property of the route table
 * rather than of this client remembering to filter.
 *
 * Only exercised when `environment.useRealApi` is true; the interceptor adds
 * the bearer token and handles 401s.
 */
@Injectable({ providedIn: 'root' })
export class BidApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/bids`;

  /** GET /api/bids/drafts/{tenderId} — **404 when no draft exists**, which is the normal first visit. */
  getDraft(tenderId: string): Observable<BidDraftDto> {
    return this.http.get<BidDraftDto>(`${this.base}/drafts/${tenderId}`);
  }

  /** PUT /api/bids/drafts/{tenderId} — creates or overwrites. 409 once the tender stops accepting bids. */
  saveDraft(tenderId: string, body: SaveBidDraftRequest): Observable<BidDraftDto> {
    return this.http.put<BidDraftDto>(`${this.base}/drafts/${tenderId}`, body);
  }

  /**
   * POST /api/bids/tenders/{tenderId} — 201 on success.
   * 400 validation · 403 eligibility · 409 duplicate or closed window.
   * Submitting deletes the draft server-side; do not follow this with a delete.
   */
  submit(tenderId: string, body: SubmitBidRequest): Observable<BidDto> {
    return this.http.post<BidDto>(`${this.base}/tenders/${tenderId}`, body);
  }

  /** GET /api/bids/mine — paged; the server clamps pageSize to 1..100. */
  mine(params: MyBidsParams = {}): Observable<BidListDto<BidSummaryDto>> {
    let httpParams = new HttpParams();
    if (params.status) httpParams = httpParams.set('status', params.status);
    if (params.page) httpParams = httpParams.set('page', params.page);
    if (params.pageSize) httpParams = httpParams.set('pageSize', params.pageSize);
    return this.http.get<BidListDto<BidSummaryDto>>(`${this.base}/mine`, { params: httpParams });
  }

  /** GET /api/bids/mine/stats */
  myStats(): Observable<VendorBidStatsDto> {
    return this.http.get<VendorBidStatsDto>(`${this.base}/mine/stats`);
  }

  /** GET /api/bids/{bidId} — another vendor's bid is 404, never 403. */
  getById(bidId: string): Observable<BidDto> {
    return this.http.get<BidDto>(`${this.base}/${bidId}`);
  }

  /** POST /api/bids/{bidId}/withdraw — 409 once the bid window is shut. */
  withdraw(bidId: string, reason?: string): Observable<BidDto> {
    return this.http.post<BidDto>(`${this.base}/${bidId}/withdraw`, { reason: reason ?? null });
  }
}
```

- [ ] **Step 6: Build**

Run: `npx ng build`
Expected: clean.

- [ ] **Step 7: Run the suite**

Run: `npx ng test --watch=false --browsers=ChromeHeadless`
Expected: `TOTAL: 62 SUCCESS` — unchanged. This task adds types and a client, no behaviour.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat: typed client and wire DTOs for the vendor bid API"
```

---

## Task 3: `core/utils/problem-details.ts` — reading a refusal instead of guessing

**Files:**
- Create: `src/app/core/utils/problem-details.ts`
- Create: `src/app/core/utils/problem-details.spec.ts`

**Why a shared primitive and not a helper inside `vendor.service.ts`:** every screen from here to Slice 9 has to tell a 403 eligibility refusal from a 409 duplicate from a 400 field error, and bind that last one to a control. `vendor-admin.service.ts:223` currently does this by hand with `(error as { status?: number })?.status` and a hardcoded string — fine for one call site, wrong to copy five more times. This is the same argument that produced `request-state.ts` in Slice 3, and it lands as its own task for the same reason: it is a primitive with its own spec, and a reviewer can accept or reject it on its own terms.

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `problemStatus(error: unknown): number | undefined`
  - `problemDetail(error: unknown, fallback: string): string`
  - `problemFieldErrors(error: unknown): Record<string, string[]>` — keys are **form-control names**, already camelCased and stripped of index paths
  - `problemMessages(error: unknown): string[]` — every validation message, flattened, for a summary panel

- [ ] **Step 1: Write the failing spec**

Create `src/app/core/utils/problem-details.spec.ts`:

```ts
import { HttpErrorResponse } from '@angular/common/http';
import {
  problemDetail,
  problemFieldErrors,
  problemMessages,
  problemStatus,
} from './problem-details';

function httpError(status: number, body: unknown): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: body });
}

describe('problem-details', () => {
  it('reads the server’s own words off a 409', () => {
    const error = httpError(409, {
      title: 'Conflict.',
      status: 409,
      detail: 'You have already bid on tender TND-2026-00087.',
    });

    expect(problemStatus(error)).toBe(409);
    expect(problemDetail(error, 'fallback')).toBe(
      'You have already bid on tender TND-2026-00087.'
    );
  });

  it('camelCases validation keys so they match form control names', () => {
    // FluentValidation names properties as declared: PascalCase on the wire,
    // camelCase in the Angular form. Without this the error binds to nothing.
    const error = httpError(400, {
      title: 'One or more validation errors occurred.',
      status: 400,
      errors: {
        TotalPrice: ['A bid must have a price.'],
        TechnicalApproach: ['A technical approach is required.'],
      },
    });

    expect(problemFieldErrors(error)).toEqual({
      totalPrice: ['A bid must have a price.'],
      technicalApproach: ['A technical approach is required.'],
    });
  });

  it('collapses an indexed path onto its top-level control', () => {
    // RuleForEach produces "PriceBreakdown[0].Description". No control has
    // that name; the array itself does.
    const error = httpError(400, {
      status: 400,
      errors: {
        'PriceBreakdown[0].Description': ['must not be empty'],
        'PriceBreakdown[1].Amount': ['must be >= 0'],
      },
    });

    expect(problemFieldErrors(error)).toEqual({
      priceBreakdown: ['must not be empty', 'must be >= 0'],
    });
  });

  it('lists every validation message for a summary panel', () => {
    const error = httpError(400, {
      status: 400,
      errors: { TotalPrice: ['A bid must have a price.'], Deviations: ['too long'] },
    });

    expect(problemMessages(error)).toEqual(['A bid must have a price.', 'too long']);
  });

  it('falls back when the body is not problem details at all', () => {
    // A dropped connection has status 0 and a ProgressEvent for a body. The
    // fallback must win rather than "[object ProgressEvent]" reaching a toast.
    const offline = new HttpErrorResponse({ status: 0, error: new ProgressEvent('error') });

    expect(problemStatus(offline)).toBe(0);
    expect(problemDetail(offline, 'Could not reach the server.')).toBe(
      'Could not reach the server.'
    );
    expect(problemFieldErrors(offline)).toEqual({});
    expect(problemMessages(offline)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx ng test --watch=false --browsers=ChromeHeadless`
Expected: FAIL — the module does not exist, so the build of the spec bundle errors.

- [ ] **Step 3: Write the implementation**

Create `src/app/core/utils/problem-details.ts`:

```ts
/**
 * Reads RFC 9457 problem details — the shape `GlobalExceptionHandler` returns
 * for every services-portal endpoint.
 *
 * The server is the only thing that knows *why* it refused. A client that
 * throws that away and toasts "Something went wrong" turns a fixable answer
 * ("An insurance certificate is required on your profile") into a dead end, so
 * every refusal a user can act on goes through here.
 *
 * `AuthController` is deliberately not covered: its own try/catch blocks return
 * bespoke `{ message }` / `{ errors: [] }` shapes that predate this handler.
 * That is backlog item B6, not this file's problem.
 */

/** The subset of RFC 9457 the API actually sends. */
interface ProblemBody {
  title?: string;
  detail?: string;
  status?: number;
  /** Present on 400s only, from `ValidationProblemDetails`. Keys are PascalCase property paths. */
  errors?: Record<string, string[]>;
}

function body(error: unknown): ProblemBody | null {
  const payload = (error as { error?: unknown })?.error;
  // A network failure puts a ProgressEvent here, and a non-JSON 500 puts a
  // string. Neither is problem details, and neither should be read as one.
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  return payload as ProblemBody;
}

/** The HTTP status, or undefined if this isn't an `HttpErrorResponse` at all. */
export function problemStatus(error: unknown): number | undefined {
  const status = (error as { status?: unknown })?.status;
  return typeof status === 'number' ? status : undefined;
}

/**
 * The control name an Angular form would use for a server property path.
 * `TotalPrice` → `totalPrice`; `PriceBreakdown[0].Description` → `priceBreakdown`,
 * because that is the name the `FormArray` is registered under — nothing is
 * bound to the indexed path.
 */
function controlName(propertyPath: string): string {
  const head = propertyPath.split(/[[.]/)[0];
  return head.charAt(0).toLowerCase() + head.slice(1);
}

/** Validation messages keyed by form-control name. Empty for anything that isn't a 400 with `errors`. */
export function problemFieldErrors(error: unknown): Record<string, string[]> {
  const errors = body(error)?.errors;
  if (!errors) return {};

  const byControl: Record<string, string[]> = {};
  for (const [path, messages] of Object.entries(errors)) {
    const name = controlName(path);
    byControl[name] = [...(byControl[name] ?? []), ...messages];
  }
  return byControl;
}

/** Every validation message, flattened, in the order the server listed them. */
export function problemMessages(error: unknown): string[] {
  const errors = body(error)?.errors;
  return errors ? Object.values(errors).flat() : [];
}

/**
 * The most specific human-readable sentence available.
 *
 * `detail` first (403/404/409 carry the real reason there), then the first
 * validation message (a 400's `title` is the generic "One or more validation
 * errors occurred." and says nothing), then `title`, then the caller's fallback.
 */
export function problemDetail(error: unknown, fallback: string): string {
  const problem = body(error);
  if (problem?.detail) return problem.detail;

  const [firstMessage] = problemMessages(error);
  if (firstMessage) return firstMessage;

  return problem?.title || fallback;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx ng test --watch=false --browsers=ChromeHeadless`
Expected: `TOTAL: 67 SUCCESS` (62 + 5). If the total differs by anything other than the 5 specs you just added, the baseline in this plan is stale — record the real number and carry it forward rather than assuming a regression.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: one place that reads why the server refused"
```

---

## Task 4: The bid model split and the DTO mapper

**Files:**
- Modify: `src/app/features/vendor/vendor.model.ts`
- Create: `src/app/features/vendor/bid-dto.mapper.ts`
- Create: `src/app/features/vendor/bid-dto.mapper.spec.ts`

**Where the mapper lives, and why not beside `vendor-dto.mapper.ts`:** that one sits in `core/api/services-portal/` because the type it produces (`Vendor`) lives in `core/models/`. `Bid`, `BidSummary` and `BidDraft` live in `features/vendor/`, so a mapper in `core/` would import upward from `features/` — the exact layering problem Task 2 avoided by moving `BidStatus` down to `core/`. The mapper goes beside the types it produces.

**Why `BidSummary` is a separate type and not a `Bid` with blank proposals:** `vendor-admin.service.ts`'s `summaryToVendor` does fill blanks into a full `Vendor`, and that was accepted in Slice 2 — but it is safe there only because the review page *always* refetches by id. Here `bid-detail.page.ts:33` reads the detail straight out of the same list the summaries populate, so a blank-filled `Bid` would render an empty Technical Proposal section as though the vendor had submitted one. That is the "confident lie" failure class this project keeps closing. A separate type makes it a compile error instead. It is the same reasoning Slice 3 used to rename `ServiceRequest` → `AdminServiceRequest`: two shapes is correct, sharing the name is the defect.

**Interfaces:**
- Consumes: Task 2's `bid-api.models.ts`; `BidStatus` from `core/models/service.model.ts`.
- Produces, from `vendor.model.ts`:
  - `BidEvent { fromStatus?: BidStatus; toStatus: BidStatus; note?: string; occurredAt: string }`
  - `BidSummary { bidId; bidNumber; tenderId; tenderNumber; tenderTitle; category?: ServiceCategory; status: BidStatus; bidAmount: number; tenderClosingDate: string; submittedAt: string }`
  - `Bid extends BidSummary { vendorId; technicalProposal; commercialProposal; updatedAt?; rejectionReason?; canWithdraw: boolean; isLive: boolean; events: BidEvent[] }`
  - `BidDraft { tenderId; formData; currentStep; totalSteps; lastSaved }`
  - `BidStatusResult { submitted: boolean; status?: BidStatus; bidId?: string; bidNumber?: string }`
  - `TenderCategory` is **deleted**; `PublishedTender.category` is `ServiceCategory`
- Produces, from `bid-dto.mapper.ts`:
  - `mapBidDto(dto: BidDto): Bid`
  - `mapBidSummaryDto(dto: BidSummaryDto): BidSummary`
  - `mapBidDraftDto(dto: BidDraftDto): BidDraft`
  - `toBidSummary(bid: Bid): BidSummary`
  - `toSubmitBidRequest(form: BidFormData): SubmitBidRequest`

- [ ] **Step 1: Write the failing spec**

Create `src/app/features/vendor/bid-dto.mapper.spec.ts`:

```ts
import { BidDto, BidSummaryDto } from '../../core/api/services-portal/bid-api.models';
import { mapBidDto, mapBidSummaryDto, toSubmitBidRequest } from './bid-dto.mapper';
import { BidFormData } from './vendor.model';

function bidDto(overrides: Partial<BidDto> = {}): BidDto {
  return {
    id: 'b-1',
    bidNumber: 'BID-2026-00231',
    tenderId: 't-1',
    tenderNumber: 'TND-2026-00087',
    tenderTitle: 'Quarterly AC servicing',
    tenderClosingDate: '2026-09-01T00:00:00Z',
    vendorId: 'v-1',
    status: 'submitted',
    bidAmount: 52000,
    technicalProposal: {
      companyProfile: '20 years in HVAC.',
      relevantExperience: null,
      technicalApproach: 'Two technicians per floor.',
      manpowerPlan: null,
      equipmentPlan: null,
      deliveryTimeline: '3 days',
      deviations: null,
      similarWorkReferences: [
        { id: 'r-1', clientName: 'Acme', projectType: 'AC servicing', contactPerson: null, phone: null },
      ],
    },
    commercialProposal: {
      totalPrice: 52000,
      taxesAndDuties: 'GST 18% extra',
      paymentTerms: null,
      validityPeriod: null,
      warrantyPricing: null,
      amcPricing: null,
      priceBreakdown: [{ id: 'p-1', description: 'Labour', amount: 30000, sortOrder: 0 }],
    },
    rejectionReason: null,
    isEditableByVendor: true,
    isLive: true,
    canWithdraw: true,
    submittedAt: '2026-08-20T10:00:00Z',
    updatedAt: '2026-08-20T10:00:00Z',
    events: [{ fromStatus: null, toStatus: 'submitted', note: 'Submitted', occurredAt: '2026-08-20T10:00:00Z' }],
    ...overrides,
  };
}

describe('bid-dto.mapper', () => {
  it('keeps the opaque id and the human reference apart', () => {
    // `bidId` is the route key; `bidNumber` is what a vendor reads out loud.
    // Conflating them worked while the mock generated both from Date.now().
    const bid = mapBidDto(bidDto());

    expect(bid.bidId).toBe('b-1');
    expect(bid.bidNumber).toBe('BID-2026-00231');
  });

  it('takes canWithdraw from the server, not from the status', () => {
    // An admin can close a tender early: status stays `submitted` while the
    // window is shut, so deriving this locally would offer a control that 409s.
    const bid = mapBidDto(bidDto({ status: 'submitted', canWithdraw: false }));

    expect(bid.canWithdraw).toBe(false);
  });

  it('turns nullable wire fields into the empty strings the templates render', () => {
    const bid = mapBidDto(bidDto());

    expect(bid.technicalProposal.relevantExperience).toBe('');
    expect(bid.commercialProposal.paymentTerms).toBe('');
    expect(bid.technicalProposal.similarWorkReferences[0].phone).toBe('');
  });

  it('maps a list row without inventing a proposal', () => {
    const summary: BidSummaryDto = {
      id: 'b-2',
      bidNumber: 'BID-2026-00232',
      tenderId: 't-2',
      tenderNumber: 'TND-2026-00088',
      tenderTitle: 'Office rewiring',
      category: 'technical',
      status: 'under_review',
      bidAmount: 90000,
      tenderClosingDate: null,
      submittedAt: '2026-08-21T10:00:00Z',
    };

    const row = mapBidSummaryDto(summary);

    expect(row.bidId).toBe('b-2');
    expect(row.category).toBe('technical');
    // A null closing date becomes '' — the template's date pipe renders nothing
    // rather than "Invalid Date".
    expect(row.tenderClosingDate).toBe('');
    // And there is no proposal on the type at all: `BidSummary` has no such
    // field, so nothing downstream can read a blank one as real.
    expect('technicalProposal' in row).toBe(false);
  });

  it('drops empty repeatable rows on the way out', () => {
    // The wizard seeds one blank reference and one blank price line. Sending
    // them makes the server reject the whole bid on NotEmpty rules.
    const form: BidFormData = {
      confirmEligibility: true,
      companyProfile: 'x',
      relevantExperience: 'y',
      similarWorkReferences: [
        { clientName: 'Acme', projectType: 'AC', contactPerson: '', phone: '' },
        { clientName: '', projectType: '', contactPerson: '', phone: '' },
      ],
      technicalApproach: 'z',
      manpowerPlan: '',
      equipmentPlan: '',
      deliveryTimeline: '3 days',
      deviations: '',
      totalPrice: 52000,
      priceBreakdown: [
        { description: 'Labour', amount: 30000 },
        { description: '', amount: 0 },
      ],
      taxesAndDuties: 'GST',
      paymentTerms: '50/50',
      validityPeriod: '60 days',
      warrantyPricing: '',
      amcPricing: '',
    };

    const request = toSubmitBidRequest(form);

    expect(request.similarWorkReferences.length).toBe(1);
    expect(request.priceBreakdown.length).toBe(1);
    expect(request.confirmEligibility).toBe(true);
    // Optional blanks go as undefined, not '': the server's MaximumLength rules
    // pass either way, but '' would persist an empty string as though answered.
    expect(request.manpowerPlan).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx ng test --watch=false --browsers=ChromeHeadless`
Expected: FAIL — `bid-dto.mapper` does not exist.

- [ ] **Step 3: Update `vendor.model.ts`**

Delete `export type TenderCategory = …` (line 10) and extend the top-of-file shim, which already exists for `BudgetVisibility`:

```ts
import type { BidStatus, BudgetVisibility, ServiceCategory } from '../../core/models/service.model';
export type { BidStatus, BudgetVisibility, ServiceCategory } from '../../core/models/service.model';
```

Change `PublishedTender.category` to `ServiceCategory` — `TenderCategory` was a third declaration of the identical union (`'quick_service' | 'mid_complexity' | 'technical'`), with exactly two references in the whole app, both in this file. It is the same duplicate class Slice 3 removed for `ServiceCategory`/`RequesterType` and simply missed here.

Replace the bid model block (from `export interface Bid {` through `BidStatusResult`) with:

```ts
/** One status change on a bid — append-only. This is the real history; nothing derives it from the current status. */
export interface BidEvent {
  fromStatus?: BidStatus;
  toStatus: BidStatus;
  note?: string;
  occurredAt: string;
}

/**
 * One row of `/vendor/bids`.
 *
 * Deliberately **not** a `Bid` with blank proposals. `GET /api/bids/mine`
 * carries no proposal — the detail route does — and a blank-filled `Bid` would
 * let the detail page render an empty Technical Proposal as though the vendor
 * had submitted one. Two shapes is correct; sharing the name would be the
 * defect (the same call Slice 3 made for `AdminServiceRequest`).
 */
export interface BidSummary {
  /** Opaque server id. This is the route key for `/vendor/bids/:id`. */
  bidId: string;
  /** Human reference, e.g. `BID-2026-00231`. This is what the UI shows. */
  bidNumber: string;
  tenderId: string;
  tenderNumber: string;
  tenderTitle: string;
  /**
   * Only `GET /api/bids/mine` carries a category — `GET /api/bids/{id}` does
   * not. Optional rather than defaulted, because a made-up 'quick_service' on
   * a detail-sourced bid is exactly the fabricated data this codebase keeps
   * removing. Nothing in Slice 4 renders it; it is here because the list
   * endpoint sends it and Slice 8 will want it.
   */
  category?: ServiceCategory;
  status: BidStatus;
  bidAmount: number;
  /** '' when the tender has no closing date, so the date pipe renders nothing rather than "Invalid Date". */
  tenderClosingDate: string;
  submittedAt: string;
}

/** A bid in full — `GET /api/bids/{id}`. */
export interface Bid extends BidSummary {
  vendorId: string;
  technicalProposal: TechnicalProposal;
  commercialProposal: CommercialProposal;
  updatedAt?: string;
  /** The only feedback an unsuccessful vendor receives. */
  rejectionReason?: string;
  /**
   * Whether a withdraw would be accepted right now. Server-computed: it is
   * status **and** an open bid window, and an admin can close a tender early.
   * Never derive this from `status` — that is what makes the control honest.
   */
  canWithdraw: boolean;
  /** Still in contention. */
  isLive: boolean;
  events: BidEvent[];
}
```

Extend `BidDraft` and `BidStatusResult`:

```ts
export interface BidDraft {
  tenderId: string;
  formData: Partial<BidFormData>;
  currentStep: number;
  /** Required by `PUT /api/bids/drafts/{tenderId}`, which validates 1..20 and `currentStep <= totalSteps`. */
  totalSteps: number;
  lastSaved: string;
}

export interface BidStatusResult {
  submitted: boolean;
  status?: BidStatus;
  /** Opaque id — used to route to `/vendor/bids/:id`. */
  bidId?: string;
  /** Human reference, for display. */
  bidNumber?: string;
}
```

- [ ] **Step 4: Write the mapper**

Create `src/app/features/vendor/bid-dto.mapper.ts`:

```ts
/**
 * The one place bid wire DTOs become the app's own shapes, and the one place
 * a bid form becomes a submit payload.
 *
 * Extracted rather than inlined into `vendor.service.ts` for the reason
 * `vendor-dto.mapper.ts` was: two views of the same record must not be able to
 * drift, and a pure function is testable without a TestBed.
 */
import {
  Bid,
  BidDraft,
  BidEvent,
  BidFormData,
  BidSummary,
  CommercialProposal,
  PriceItem,
  TechnicalProposal,
  WorkReference,
} from './vendor.model';
import {
  BidDraftDto,
  BidDto,
  BidSummaryDto,
  CommercialProposalDto,
  SubmitBidRequest,
  TechnicalProposalDto,
} from '../../core/api/services-portal/bid-api.models';

/** Wire null → '' — every template here renders these directly. */
const text = (value: string | null | undefined): string => value ?? '';

/** Wire null/'' → undefined — an optional the vendor left blank must not persist as an empty answer. */
const optional = (value: string | null | undefined): string | undefined =>
  value && value.trim() ? value : undefined;

function mapTechnical(dto: TechnicalProposalDto): TechnicalProposal {
  return {
    companyProfile: text(dto.companyProfile),
    relevantExperience: text(dto.relevantExperience),
    technicalApproach: text(dto.technicalApproach),
    manpowerPlan: text(dto.manpowerPlan),
    equipmentPlan: text(dto.equipmentPlan),
    deliveryTimeline: text(dto.deliveryTimeline),
    deviations: text(dto.deviations),
    similarWorkReferences: dto.similarWorkReferences.map<WorkReference>(r => ({
      clientName: r.clientName,
      projectType: r.projectType,
      contactPerson: text(r.contactPerson),
      phone: text(r.phone),
    })),
  };
}

function mapCommercial(dto: CommercialProposalDto): CommercialProposal {
  return {
    totalPrice: dto.totalPrice,
    taxesAndDuties: text(dto.taxesAndDuties),
    paymentTerms: text(dto.paymentTerms),
    validityPeriod: text(dto.validityPeriod),
    warrantyPricing: text(dto.warrantyPricing),
    amcPricing: text(dto.amcPricing),
    // Already ordered by sortOrder server-side; kept as sent so the vendor sees
    // the lines in the order they entered them.
    priceBreakdown: dto.priceBreakdown.map<PriceItem>(p => ({
      description: p.description,
      amount: p.amount,
    })),
  };
}

export function mapBidDto(dto: BidDto): Bid {
  return {
    bidId: dto.id,
    bidNumber: dto.bidNumber,
    tenderId: dto.tenderId,
    tenderNumber: dto.tenderNumber,
    tenderTitle: dto.tenderTitle,
    // No `category`: `BidDto` does not carry one, and `BidSummary.category` is
    // optional precisely so this mapper does not have to invent a value.
    status: dto.status,
    bidAmount: dto.bidAmount,
    tenderClosingDate: text(dto.tenderClosingDate),
    submittedAt: dto.submittedAt,
    vendorId: dto.vendorId,
    technicalProposal: mapTechnical(dto.technicalProposal),
    commercialProposal: mapCommercial(dto.commercialProposal),
    updatedAt: dto.updatedAt,
    rejectionReason: dto.rejectionReason ?? undefined,
    canWithdraw: dto.canWithdraw,
    isLive: dto.isLive,
    events: dto.events.map<BidEvent>(e => ({
      fromStatus: e.fromStatus ?? undefined,
      toStatus: e.toStatus,
      note: e.note ?? undefined,
      occurredAt: e.occurredAt,
    })),
  };
}

export function mapBidSummaryDto(dto: BidSummaryDto): BidSummary {
  return {
    bidId: dto.id,
    bidNumber: dto.bidNumber,
    tenderId: dto.tenderId,
    tenderNumber: dto.tenderNumber,
    tenderTitle: dto.tenderTitle,
    category: dto.category,
    status: dto.status,
    bidAmount: dto.bidAmount,
    tenderClosingDate: text(dto.tenderClosingDate),
    submittedAt: dto.submittedAt,
  };
}

/** Narrows a full bid to the list shape — used by the mock path, which holds full bids. */
export function toBidSummary(bid: Bid): BidSummary {
  return {
    bidId: bid.bidId,
    bidNumber: bid.bidNumber,
    tenderId: bid.tenderId,
    tenderNumber: bid.tenderNumber,
    tenderTitle: bid.tenderTitle,
    category: bid.category,
    status: bid.status,
    bidAmount: bid.bidAmount,
    tenderClosingDate: bid.tenderClosingDate,
    submittedAt: bid.submittedAt,
  };
}

export function mapBidDraftDto(dto: BidDraftDto): BidDraft {
  return {
    tenderId: dto.tenderId,
    formData: dto.formData as Partial<BidFormData>,
    currentStep: dto.currentStep,
    totalSteps: dto.totalSteps,
    lastSaved: dto.lastSaved,
  };
}

/**
 * Form → submit payload.
 *
 * Blank repeatable rows are dropped: the wizard seeds one empty reference and
 * one empty price line on load, and `SubmitBidCommandValidator`'s `NotEmpty`
 * child rules would reject the whole bid over rows the vendor never filled in.
 */
export function toSubmitBidRequest(form: BidFormData): SubmitBidRequest {
  return {
    companyProfile: optional(form.companyProfile),
    relevantExperience: optional(form.relevantExperience),
    technicalApproach: optional(form.technicalApproach),
    manpowerPlan: optional(form.manpowerPlan),
    equipmentPlan: optional(form.equipmentPlan),
    deliveryTimeline: optional(form.deliveryTimeline),
    deviations: optional(form.deviations),
    similarWorkReferences: (form.similarWorkReferences ?? [])
      .filter(r => r.clientName?.trim() && r.projectType?.trim())
      .map(r => ({
        clientName: r.clientName.trim(),
        projectType: r.projectType.trim(),
        contactPerson: optional(r.contactPerson),
        phone: optional(r.phone),
      })),
    totalPrice: Number(form.totalPrice),
    taxesAndDuties: optional(form.taxesAndDuties),
    paymentTerms: optional(form.paymentTerms),
    validityPeriod: optional(form.validityPeriod),
    warrantyPricing: optional(form.warrantyPricing),
    amcPricing: optional(form.amcPricing),
    priceBreakdown: (form.priceBreakdown ?? [])
      .filter(p => p.description?.trim() && Number(p.amount) > 0)
      .map(p => ({ description: p.description.trim(), amount: Number(p.amount) })),
    confirmEligibility: form.confirmEligibility === true,
  };
}
```

- [ ] **Step 5: Fix every compile error the model change surfaces**

Run: `npx ng build`

`Bid` now requires `bidNumber`, `tenderNumber`, `category`, `canWithdraw`, `isLive` and `events`, so the compiler will point at `vendor.service.ts`'s mock `submitBid` (around line 359). Fill them from the mock's own data — no new mock behaviour, just the fields the type now demands:

```ts
    const bidId = `BID-${Date.now()}`;

    const newBid: Bid = {
      bidId,
      // The mock has no number generator; the id doubles as the reference, which
      // is what it already displayed everywhere before the two were separated.
      bidNumber: bidId,
      tenderId,
      tenderNumber: tender?.tenderId ?? '',
      tenderTitle: tender?.title || 'Unknown Tender',
      category: tender?.category ?? 'quick_service',
      tenderClosingDate: tender?.bidWindowEnd || new Date().toISOString(),
      vendorId: 'current-vendor',
      // …technicalProposal / commercialProposal unchanged…
      bidAmount: bidData.totalPrice,
      status: 'submitted',
      submittedAt: new Date().toISOString(),
      canWithdraw: true,
      isLive: true,
      events: [{ toStatus: 'submitted', note: 'Submitted', occurredAt: new Date().toISOString() }],
    };
```

and the mock `withdrawBid` must keep `canWithdraw`/`isLive` truthful when it flips the status:

```ts
      b.bidId === bidId
        ? { ...b, status: 'withdrawn' as BidStatus, canWithdraw: false, isLive: false,
            updatedAt: new Date().toISOString() }
        : b
```

Keep fixing until the build is clean. Do not widen a type to silence an error — every one of these is the compiler pointing at a field that genuinely has to be filled.

- [ ] **Step 6: Run the tests**

Run: `npx ng test --watch=false --browsers=ChromeHeadless`
Expected: `TOTAL: 72 SUCCESS` (67 + 5).

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "refactor: a bid list row is a BidSummary, not a Bid with blank proposals"
```

---

## Task 5: `vendor.service.ts` — the bid `*Async` siblings

**Files:**
- Modify: `src/app/features/vendor/vendor.model.ts` (add `BidSubmitResult`, `BidDraftSaveResult`, `VendorBidStats`)
- Modify: `src/app/features/vendor/vendor.service.ts`
- Create: `src/app/features/vendor/vendor.service.spec.ts`

**Shape of the change.** Same contract as F2.1–F2.5: every existing mock method stays exactly as it is, and each gains an `*Async` sibling that branches on `environment.useRealApi`, so no call site needs to know which mode is running. Two differences from the tender half of this file:

- **`bids` becomes a computed over two private sources**, not a signal. Mock mode holds full `Bid`s (it has to — it is also the detail store); real mode holds `BidSummary` rows from `GET /api/bids/mine`. One public `bids` computed over both means no synchronisation code and one thing for screens to read.
- **No constructor refresh.** `refreshTendersAsync()` fires from the constructor because every vendor screen renders tenders. Bids are read by one screen, so `my-bids.page.ts` calls `refreshBidsAsync()` from `ngOnInit` instead — the pattern `vendor-queue.component.ts` uses. Firing it from the constructor would put a `/api/bids/mine` request on the tender-browse page, which never shows a bid.

**Pagination is capped and says so.** `GET /api/bids/mine` clamps `pageSize` to 100. Fetch 100 unfiltered and filter client-side rather than refetching per status tab, because the stat cards count *across* statuses and no per-status count endpoint exists. When `totalCount` exceeds what came back, record it in `bidsTruncated` so Task 7 can say so on screen — F18 is on the backlog precisely because the vendor queue truncates at 100 **silently**, beside a total that contradicts it. Do not repeat that here.

**Interfaces:**
- Consumes: `BidApiService` (Task 2), `./bid-dto.mapper` (Task 4, same directory), `core/utils/problem-details` (Task 3), `core/utils/request-state`'s `createRequestState` (Slice 3).
- Produces, on `VendorTenderService`:
  - `readonly useRealApi: boolean`
  - `readonly bids: Signal<BidSummary[]>` (replaces the old `bids` signal of `Bid[]`)
  - `readonly bidsLoading: Signal<boolean>` · `readonly bidsError: Signal<string | null>`
  - `readonly bidsTruncated: Signal<{ shown: number; total: number } | null>`
  - `readonly noConfirmedBids: Signal<boolean>`
  - `refreshBidsAsync(): Promise<void>`
  - `getBidDetailAsync(bidId: string): Promise<Bid | null>`
  - `withdrawBidAsync(bidId: string, reason?: string): Promise<Bid | null>`
  - `getBidDraftAsync(tenderId: string): Promise<BidDraft | null>`
  - `saveBidDraftAsync(draft: BidDraft): Promise<BidDraftSaveResult>`
  - `submitBidAsync(form: BidFormData, tenderId: string): Promise<BidSubmitResult>`
  - `getVendorBidStatsAsync(): Promise<VendorBidStats | null>`
- Produces, in `vendor.model.ts`:
  - `type BidDraftSaveResult = 'saved' | 'closed' | 'failed'`
  - `interface VendorBidStats { openTenders: number; myBids: number; wonBids: number; activeProjects: number }`
  - `type BidSubmitResult` (the discriminated union below)

- [ ] **Step 1: Add the result types to `vendor.model.ts`**

```ts
/**
 * What a submit attempt actually did.
 *
 * A discriminated union rather than `{ bidId } | null`, because the four ways
 * a submit is refused need four different screens: a 403 lists requirements
 * the vendor can go and fix, a 400 binds to fields, a 409 means the tender or
 * the slot is gone and the page must stop offering Submit. `confirmEligibility`
 * is an attestation the server re-checks, so "the box was ticked" is never
 * evidence the bid was accepted.
 */
export type BidSubmitResult =
  | { ok: true; bidId: string; bidNumber: string }
  /** 403 — `FindEligibilityFailures` returned every reason, not just the first. */
  | { ok: false; kind: 'ineligible'; reasons: string[] }
  /** 400 — `fieldErrors` keys are form-control names, ready to bind. */
  | { ok: false; kind: 'validation'; fieldErrors: Record<string, string[]>; messages: string[] }
  /** 409 — already bid on this tender, or the window shut. Either way, Submit must go away. */
  | { ok: false; kind: 'conflict'; message: string }
  | { ok: false; kind: 'failed'; message: string };

/** Why a draft save didn't land. `closed` means the tender stopped accepting bids — stop autosaving. */
export type BidDraftSaveResult = 'saved' | 'closed' | 'failed';

/** `GET /api/bids/mine/stats`. `openTenders` is matched to this vendor, not a global count. */
export interface VendorBidStats {
  openTenders: number;
  myBids: number;
  wonBids: number;
  activeProjects: number;
}
```

- [ ] **Step 2: Write the failing spec**

Create `src/app/features/vendor/vendor.service.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, of, throwError } from 'rxjs';
import { VendorTenderService } from './vendor.service';
import { ToastService } from '../../core/services/toast.service';
import { BidApiService } from '../../core/api/services-portal/bid-api.service';
import { TenderApiService } from '../../core/api/services-portal/tender-api.service';
import { BidDto, BidListDto, BidSummaryDto } from '../../core/api/services-portal/bid-api.models';
import { environment } from '../../../environments/environment';
import { BidFormData } from './vendor.model';

function summary(id: string, overrides: Partial<BidSummaryDto> = {}): BidSummaryDto {
  return {
    id,
    bidNumber: `BID-${id}`,
    tenderId: `t-${id}`,
    tenderNumber: `TND-${id}`,
    tenderTitle: 'Quarterly AC servicing',
    category: 'quick_service',
    status: 'submitted',
    bidAmount: 52000,
    tenderClosingDate: '2026-09-01T00:00:00Z',
    submittedAt: '2026-08-20T10:00:00Z',
    ...overrides,
  };
}

function page(items: BidSummaryDto[], totalCount = items.length): BidListDto<BidSummaryDto> {
  return { items, page: 1, pageSize: 100, totalCount };
}

function detailDto(overrides: Partial<BidDto> = {}): BidDto {
  return {
    id: 'b-1', bidNumber: 'BID-1', tenderId: 't-1', tenderNumber: 'TND-1',
    tenderTitle: 'Quarterly AC servicing', tenderClosingDate: null, vendorId: 'v-1',
    status: 'submitted', bidAmount: 52000,
    technicalProposal: {
      companyProfile: null, relevantExperience: null, technicalApproach: null,
      manpowerPlan: null, equipmentPlan: null, deliveryTimeline: null,
      deviations: null, similarWorkReferences: [],
    },
    commercialProposal: {
      totalPrice: 52000, taxesAndDuties: null, paymentTerms: null,
      validityPeriod: null, warrantyPricing: null, amcPricing: null, priceBreakdown: [],
    },
    rejectionReason: null, isEditableByVendor: true, isLive: true, canWithdraw: true,
    submittedAt: '2026-08-20T10:00:00Z', updatedAt: '2026-08-20T10:00:00Z', events: [],
    ...overrides,
  };
}

function httpError(status: number, body: unknown) {
  return new HttpErrorResponse({ status, error: body });
}

const EMPTY_FORM: BidFormData = {
  confirmEligibility: true,
  companyProfile: 'p', relevantExperience: 'e', similarWorkReferences: [],
  technicalApproach: 'a', manpowerPlan: '', equipmentPlan: '', deliveryTimeline: '3 days',
  deviations: '', totalPrice: 52000, priceBreakdown: [], taxesAndDuties: 'GST',
  paymentTerms: '50/50', validityPeriod: '60 days', warrantyPricing: '', amcPricing: '',
};

/** Real-API mode with a stubbed bid client; each call gets its own Subject so tests settle them out of order. */
function makeRealApiService(bidApiOverrides: Record<string, unknown> = {}) {
  const errors: string[] = [];
  const minePages: Subject<BidListDto<BidSummaryDto>>[] = [];
  const mineSpy = jasmine.createSpy('mine').and.callFake(() => {
    const subject = new Subject<BidListDto<BidSummaryDto>>();
    minePages.push(subject);
    return subject;
  });

  environment.useRealApi = true;
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: TenderApiService, useValue: { browse: () => new Subject() } },
      { provide: BidApiService, useValue: { mine: mineSpy, ...bidApiOverrides } },
      {
        provide: ToastService,
        useValue: { error: (m: string) => errors.push(m), success: () => undefined, info: () => undefined },
      },
    ],
  });

  return { service: TestBed.inject(VendorTenderService), errors, minePages };
}

describe('VendorTenderService bids — real API', () => {
  afterEach(() => {
    environment.useRealApi = false;
    localStorage.removeItem('heavenly_vendor_bids');
  });

  it('discards a stale response that resolves after a newer one', async () => {
    const { service, minePages } = makeRealApiService();

    const stale = service.refreshBidsAsync();
    const fresh = service.refreshBidsAsync();

    minePages[1].next(page([summary('new')]));
    minePages[1].complete();
    await fresh;

    minePages[0].next(page([summary('old')]));
    minePages[0].complete();
    await stale;

    expect(service.bids().map(b => b.bidId)).toEqual(['new']);
  });

  it('records a failure instead of rendering an empty bid list as fact', async () => {
    const { service, minePages } = makeRealApiService();

    const first = service.refreshBidsAsync();
    minePages[0].next(page([summary('a')]));
    minePages[0].complete();
    await first;

    const second = service.refreshBidsAsync();
    minePages[1].error(httpError(500, null));
    await second;

    // The rows are untouched; the error is what changed. Writing [] here would
    // render "You haven't submitted any bids" over a server that never said so.
    expect(service.bids().length).toBe(1);
    expect(service.bidsError()).toBeTruthy();
    expect(service.bidsLoading()).toBe(false);
  });

  it('reports truncation rather than truncating silently', async () => {
    const { service, minePages } = makeRealApiService();

    const load = service.refreshBidsAsync();
    minePages[0].next(page([summary('a'), summary('b')], 137));
    minePages[0].complete();
    await load;

    expect(service.bidsTruncated()).toEqual({ shown: 2, total: 137 });
  });

  it('treats a 404 from the draft endpoint as "no draft", not as an error', async () => {
    // The first visit to a bid form always 404s here. Surfacing that as a
    // failure would put an error banner on a blank form every single time.
    const { service } = makeRealApiService({
      getDraft: () => throwError(() => httpError(404, { detail: 'Bid draft not found.' })),
    });

    await expectAsync(service.getBidDraftAsync('t-1')).toBeResolvedTo(null);
  });

  it('turns a 403 into the list of things the vendor has to fix', async () => {
    const { service } = makeRealApiService({
      submit: () => throwError(() => httpError(403, {
        detail: 'You do not meet this tender\'s requirements: An insurance certificate is required on your profile.',
      })),
    });

    const result = await service.submitBidAsync(EMPTY_FORM, 't-1');

    expect(result.ok).toBe(false);
    if (!result.ok && result.kind === 'ineligible') {
      expect(result.reasons.join(' ')).toContain('insurance certificate');
    } else {
      fail(`expected an ineligible result, got ${JSON.stringify(result)}`);
    }
  });

  it('keeps the server’s own sentence on a 409 rather than a generic failure', async () => {
    const { service } = makeRealApiService({
      submit: () => throwError(() => httpError(409, {
        detail: 'You have already bid on tender TND-2026-00087. Revise the existing bid instead.',
      })),
    });

    const result = await service.submitBidAsync(EMPTY_FORM, 't-1');

    expect(result.ok).toBe(false);
    if (!result.ok && result.kind === 'conflict') {
      expect(result.message).toContain('TND-2026-00087');
    } else {
      fail(`expected a conflict result, got ${JSON.stringify(result)}`);
    }
  });

  it('re-reads the bid when a withdraw 409s, so the screen stops lying', async () => {
    // A 409 *is* the server saying our copy is stale. Slice 3 established that
    // the only honest response is a fresh read — see vendor-admin's decide().
    // Returning null instead would leave a Withdraw button that can never work.
    const getById = jasmine.createSpy('getById').and.returnValue(
      of(detailDto({ canWithdraw: false }))
    );
    const { service } = makeRealApiService({
      withdraw: () => throwError(() => httpError(409, { detail: 'Bidding has closed.' })),
      getById,
    });

    const bid = await service.withdrawBidAsync('b-1');

    expect(getById).toHaveBeenCalledWith('b-1');
    expect(bid?.canWithdraw).toBe(false);
  });
});

describe('VendorTenderService bids — mock mode is untouched', () => {
  afterEach(() => localStorage.removeItem('heavenly_vendor_bids'));

  it('still submits and withdraws entirely in localStorage', () => {
    environment.useRealApi = false;
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ToastService, useValue: { error: () => undefined, success: () => undefined, info: () => undefined } },
      ],
    });
    const service = TestBed.inject(VendorTenderService);

    const { bidId } = service.submitBid(EMPTY_FORM, 'TND-001');
    expect(service.bids().some(b => b.bidId === bidId)).toBe(true);

    expect(service.withdrawBid(bidId)).toBe(true);
    expect(service.bids().find(b => b.bidId === bidId)?.status).toBe('withdrawn');
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx ng test --watch=false --browsers=ChromeHeadless`
Expected: FAIL — `refreshBidsAsync` and friends do not exist yet.

- [ ] **Step 4: Restructure the bid state**

In `vendor.service.ts`, rename the existing `bidsSignal` to `mockBidsSignal` (it is, and always was, the mock's full-bid store — `loadBids`/`saveBids` read and write `BIDS_KEY` and stay exactly as they are, pointed at the new name). Then add beside it:

```ts
  private readonly bidApi = inject(BidApiService);

  readonly useRealApi = environment.useRealApi;

  /** Real-API list rows. Empty in mock mode, where `mockBidsSignal` is the data. */
  private readonly remoteBidsSignal = signal<BidSummary[]>([]);

  /**
   * The bid list, whichever mode is running.
   *
   * A computed over two private sources rather than one signal both write to:
   * the mock has to keep full `Bid`s (it is also the detail store), the API
   * sends `BidSummary` rows, and a single signal would need synchronising code
   * that could get out of step. Screens read this and never learn which mode
   * they are in.
   */
  readonly bids = computed<BidSummary[]>(() =>
    this.useRealApi ? this.remoteBidsSignal() : this.mockBidsSignal().map(toBidSummary)
  );

  private readonly bidsRequest = createRequestState();
  readonly bidsLoading = this.bidsRequest.loading;
  readonly bidsError = this.bidsRequest.error;

  /** Set when the server holds more bids than the single page we fetched. Null when it doesn't. */
  private readonly bidsTruncatedSignal = signal<{ shown: number; total: number } | null>(null);
  readonly bidsTruncated = this.bidsTruncatedSignal.asReadonly();

  /**
   * True in real-API mode until a bid fetch has succeeded at least once. A
   * screen reading this shows a placeholder rather than "0 bids", which is a
   * claim it has no evidence for — the same rule `noConfirmedStats` enforces
   * on the vendor queue.
   */
  private readonly bidsLoadedSignal = signal(false);
  readonly noConfirmedBids = computed(() => this.useRealApi && !this.bidsLoadedSignal());
```

Point `activeBids` and `stats` at `this.bids()` instead of `this.bidsSignal()`. Their filters are unchanged — `BidSummary` carries `status`, which is all they read.

`toBidSummary` already exists in `bid-dto.mapper.ts` from Task 4; import it, do not redefine it.

**The rename touches six mock methods**, all of which read `this.bidsSignal()` today and must read `this.mockBidsSignal()` instead: `getMyBidStatus` (line ~326), `submitBid` (~359), `getMyBids` (~409), `getMyBidsFiltered` (~413), `getBidDetail` (~418) and `withdrawBid` (~422). Their bodies are otherwise unchanged — they are the mock, and the mock keeps working exactly as it does now. `loadBids`/`saveBids` follow the same rename.

- [ ] **Step 5: Write the `*Async` siblings**

Append to the `real API (behind environment.useRealApi)` section of `vendor.service.ts`. Replace that section's opening comment about bid status having no endpoint — Task 9 closes it — but keep the saved-tenders / not-interested half, which is still true.

```ts
  /**
   * Replaces the bid list from `GET /api/bids/mine`.
   *
   * Fetched unfiltered at the server's maximum page size and filtered on the
   * client, because the status tabs sit beside stat cards that count *across*
   * statuses and there is no per-status count endpoint. That caps us at 100 —
   * so when there are more, `bidsTruncated` records it and the screen says so.
   * F18 is on the backlog because the vendor queue truncates *silently*.
   */
  async refreshBidsAsync(): Promise<void> {
    if (!this.useRealApi) return;

    const requestId = this.bidsRequest.begin();

    try {
      const page = await firstValueFrom(this.bidApi.mine({ pageSize: 100 }));
      if (!this.bidsRequest.isCurrent(requestId)) return;

      this.remoteBidsSignal.set(page.items.map(mapBidSummaryDto));
      this.bidsTruncatedSignal.set(
        page.totalCount > page.items.length
          ? { shown: page.items.length, total: page.totalCount }
          : null
      );
      this.bidsLoadedSignal.set(true);
      this.bidsRequest.succeed(requestId);
    } catch (error) {
      if (!this.bidsRequest.isCurrent(requestId)) return;
      // Deliberately writes neither an empty list nor a zeroed count: both are
      // assertions about the vendor's bids, and a failed request is no
      // evidence for either. `request-state.ts`'s rule 2.
      const message = problemDetail(error, 'Could not load your bids.');
      this.bidsRequest.fail(requestId, message);
      this.toastService.error(message);
    }
  }

  /** One bid in full. Mock mode reads the local store; real mode always fetches — a list row has no proposal. */
  async getBidDetailAsync(bidId: string): Promise<Bid | null> {
    if (!this.useRealApi) return this.getBidDetail(bidId) ?? null;

    try {
      return mapBidDto(await firstValueFrom(this.bidApi.getById(bidId)));
    } catch {
      // Another vendor's bid is a 404 here, never a 403 — the API refuses to
      // confirm it exists, and this must not either.
      return null;
    }
  }

  /**
   * Withdraws a bid.
   *
   * A 409 means the window shut between the page rendering and the click. Like
   * Slice 3's `decide()`, the only honest response is a fresh read: returning
   * null would leave a Withdraw button on screen that can never work.
   */
  async withdrawBidAsync(bidId: string, reason?: string): Promise<Bid | null> {
    if (!this.useRealApi) return this.withdrawBid(bidId) ? this.getBidDetail(bidId) ?? null : null;

    try {
      const bid = mapBidDto(await firstValueFrom(this.bidApi.withdraw(bidId, reason)));
      this.toastService.success('Bid withdrawn.');
      this.remoteBidsSignal.update(list =>
        list.map(row => (row.bidId === bid.bidId ? { ...row, status: bid.status } : row))
      );
      return bid;
    } catch (error) {
      if (problemStatus(error) === 409) {
        this.toastService.error(problemDetail(error, 'Bidding has closed.'));
        const fresh = await this.getBidDetailAsync(bidId);
        if (!fresh) {
          this.toastService.error('That bid could not be reloaded. Refresh the page.');
        }
        return fresh;
      }
      this.toastService.error(problemDetail(error, 'The bid could not be withdrawn.'));
      return null;
    }
  }

  /**
   * The caller's draft for a tender, or null when there isn't one.
   *
   * **A 404 is the normal first visit**, not a failure — the endpoint has no
   * "empty draft" response. Treating it as an error would put a banner on a
   * blank form every time a vendor opens one for the first time.
   */
  async getBidDraftAsync(tenderId: string): Promise<BidDraft | null> {
    if (!this.useRealApi) return this.getBidDraft(tenderId);

    try {
      return mapBidDraftDto(await firstValueFrom(this.bidApi.getDraft(tenderId)));
    } catch (error) {
      if (problemStatus(error) === 404) return null;
      this.toastService.error(problemDetail(error, 'Could not load your saved draft.'));
      return null;
    }
  }

  /**
   * Saves a draft. Returns `closed` on the 409 the server sends once a tender
   * stops accepting bids, so an autosave loop can stop rather than toast every
   * thirty seconds about a tender that is not coming back.
   */
  async saveBidDraftAsync(draft: BidDraft): Promise<BidDraftSaveResult> {
    if (!this.useRealApi) {
      this.saveBidDraft(draft);
      return 'saved';
    }

    try {
      await firstValueFrom(
        this.bidApi.saveDraft(draft.tenderId, {
          currentStep: draft.currentStep,
          totalSteps: draft.totalSteps,
          formData: draft.formData as Record<string, unknown>,
        })
      );
      return 'saved';
    } catch (error) {
      return problemStatus(error) === 409 ? 'closed' : 'failed';
    }
  }

  /**
   * Submits a bid.
   *
   * Every refusal is classified rather than collapsed: the server is the only
   * thing that knows whether the vendor is ineligible, has already bid, or
   * mistyped a price, and each of those needs a different screen. The draft is
   * deleted server-side in the same transaction — do **not** follow a success
   * with a draft-delete call, which is the exact shape of the F2.3 bug where a
   * redundant cleanup 404'd and reported a successful submit as a failure.
   */
  async submitBidAsync(bidData: BidFormData, tenderId: string): Promise<BidSubmitResult> {
    if (!this.useRealApi) {
      const { bidId } = this.submitBid(bidData, tenderId);
      return { ok: true, bidId, bidNumber: bidId };
    }

    try {
      const dto = await firstValueFrom(
        this.bidApi.submit(tenderId, toSubmitBidRequest(bidData))
      );
      this.toastService.success('Bid submitted successfully!');
      // Drop the local draft copy too: the server already deleted its own, and
      // leaving ours offers "resume your draft" for a bid already submitted.
      this.clearBidDraft(tenderId);
      return { ok: true, bidId: dto.id, bidNumber: dto.bidNumber };
    } catch (error) {
      switch (problemStatus(error)) {
        case 403:
          return {
            ok: false,
            kind: 'ineligible',
            // The server lists every failure in one sentence, on purpose — a
            // vendor told only about insurance fixes that, retries, and is then
            // told about experience. Split it back into lines to show them.
            reasons: splitEligibilityReasons(
              problemDetail(error, 'You do not meet this tender’s requirements.')
            ),
          };
        case 400:
          return {
            ok: false,
            kind: 'validation',
            fieldErrors: problemFieldErrors(error),
            messages: problemMessages(error),
          };
        case 409:
          return {
            ok: false,
            kind: 'conflict',
            message: problemDetail(error, 'This tender is no longer accepting bids.'),
          };
        default:
          return {
            ok: false,
            kind: 'failed',
            message: problemDetail(error, 'The bid could not be submitted.'),
          };
      }
    }
  }

  /** `GET /api/bids/mine/stats`. Null on failure — the caller shows a placeholder, never a zero. */
  async getVendorBidStatsAsync(): Promise<VendorBidStats | null> {
    if (!this.useRealApi) return null;

    try {
      const dto = await firstValueFrom(this.bidApi.myStats());
      return {
        openTenders: dto.openTenders,
        myBids: dto.myBids,
        wonBids: dto.wonBids,
        activeProjects: dto.activeProjects,
      };
    } catch {
      return null;
    }
  }
```

and, as a file-level function beside the other mappers at the bottom:

```ts
/**
 * `ForbiddenException` joins every eligibility failure into one sentence after
 * a "requirements:" prefix. Each failure is itself a full sentence ending in a
 * period, so splitting on that boundary recovers the list the server built.
 * Falls back to the whole string, which is never worse than what a toast
 * would have shown.
 */
function splitEligibilityReasons(detail: string): string[] {
  const [, listed] = detail.split(/requirements:\s*/);
  const source = listed ?? detail;
  const parts = source.split(/(?<=\.)\s+/).map(s => s.trim()).filter(Boolean);
  return parts.length ? parts : [detail];
}
```

- [ ] **Step 6: Run the tests**

Run: `npx ng test --watch=false --browsers=ChromeHeadless`
Expected: `TOTAL: 79 SUCCESS` (72 + 7).

- [ ] **Step 7: Build**

Run: `npx ng build`
Expected: clean. `my-bids.page.ts:77`'s `getMyBids()` still compiles — the mock method is untouched — but its *return type* is still `Bid[]`, which Task 7 changes.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat: bid drafts, submission, withdrawal and stats against the real API"
```

---

## Task 6: The bid submission wizard

**Files:**
- Modify: `src/app/features/vendor/tender-detail/tender-detail.page.ts:85` (the dead link)
- Modify: `src/app/features/vendor/bid-submission/bid-submission.page.ts`
- Modify: `src/app/features/vendor/bid-submission/bid-submission.page.html` (around the step-4 submit block, line ~500)
- Create: `src/app/features/vendor/bid-submission/bid-submission.page.spec.ts`

**Three defects this task closes, all of them pre-existing:**

1. **The page is unreachable.** `tender-detail.page.ts:85` routes to `/vendor/bid/submit/:id`; the route table declares `tenders/:id/bid`; the `**` catch-all serves the 404 page. One line.
2. **A restored draft loses every repeatable row but the first.** `patchValue` cannot grow a `FormArray` — it silently ignores values past the last existing control, and `initializeForm` seeds exactly one of each. Restore has to rebuild the arrays before patching.
3. **The tender is looked up synchronously.** `loadTenderDetails` calls `getTenderDetail()`, a `tendersSignal` lookup. On a deep link in real-API mode the constructor's `refreshTendersAsync()` may not have resolved, so it reads `undefined` and bounces the vendor to `/vendor/tenders` with "Tender not found". That is the ngOnInit-snapshot race this roadmap has a Global Constraint about. `getTenderDetailBundleAsync()` already exists and returns the tender, its clarifications and this vendor's eligibility in one call.

**Interfaces:**
- Consumes: `getBidDraftAsync`, `saveBidDraftAsync`, `submitBidAsync`, `BidSubmitResult`, `BidDraftSaveResult` (Task 5).
- Produces: `getTenderDetailBundleAsync` resolves `{ tender, clarifications, eligibility, bidStatus: BidStatusResult }` — the `bidStatus` member is added here, by Step 3 below, because this page is its first consumer. Task 9 reads the same member on the tender detail page.

- [ ] **Step 1: Write the failing spec**

Create `src/app/features/vendor/bid-submission/bid-submission.page.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { BidSubmissionPageComponent } from './bid-submission.page';
import { VendorTenderService } from '../vendor.service';
import { ToastService } from '../../../core/services/toast.service';
import { BidDraft, BidSubmitResult, PublishedTender } from '../vendor.model';

function makeComponent(overrides: Partial<Record<string, unknown>> = {}) {
  const toasts: string[] = [];

  const vendorService = {
    getTenderDetailBundleAsync: () =>
      Promise.resolve({
        tender: { id: 't-1', title: 'Quarterly AC servicing', bidWindowEnd: '2099-01-01T00:00:00Z' } as PublishedTender,
        clarifications: [],
        eligibility: { eligible: true, reasons: [], missingRequirements: [] },
        bidStatus: { submitted: false },
      }),
    getBidDraftAsync: () => Promise.resolve(null as BidDraft | null),
    saveBidDraftAsync: () => Promise.resolve('saved' as const),
    submitBidAsync: () => Promise.resolve({ ok: true, bidId: 'b-1', bidNumber: 'BID-1' } as BidSubmitResult),
    ...overrides,
  };

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [BidSubmissionPageComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: VendorTenderService, useValue: vendorService },
      { provide: ActivatedRoute, useValue: { snapshot: { params: { id: 't-1' } } } },
      {
        provide: ToastService,
        useValue: {
          error: (m: string) => toasts.push(m),
          success: (m: string) => toasts.push(m),
          info: (m: string) => toasts.push(m),
        },
      },
    ],
  });

  const fixture = TestBed.createComponent(BidSubmissionPageComponent);
  return { fixture, component: fixture.componentInstance, toasts };
}

describe('BidSubmissionPageComponent', () => {
  it('rebuilds the repeatable rows a restored draft actually contains', async () => {
    // patchValue cannot grow a FormArray. The form seeds one blank price line,
    // so before this fix a three-line draft came back with one line and the
    // vendor silently resubmitted a different bid from the one they saved.
    const draft: BidDraft = {
      tenderId: 't-1',
      currentStep: 3,
      totalSteps: 4,
      lastSaved: '2026-08-22T10:00:00Z',
      formData: {
        priceBreakdown: [
          { description: 'Labour', amount: 30000 },
          { description: 'Consumables', amount: 15000 },
          { description: 'Transport', amount: 7000 },
        ],
        similarWorkReferences: [
          { clientName: 'Acme', projectType: 'AC servicing', contactPerson: '', phone: '' },
          { clientName: 'Globex', projectType: 'AC servicing', contactPerson: '', phone: '' },
        ],
      },
    };

    const { fixture, component } = makeComponent({ getBidDraftAsync: () => Promise.resolve(draft) });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.priceBreakdownArray.length).toBe(3);
    expect(component.priceBreakdownArray.at(2).value.description).toBe('Transport');
    expect(component.similarWorkReferencesArray.length).toBe(2);
    expect(component.currentStep()).toBe(3);
  });

  it('shows every eligibility reason instead of a generic failure', async () => {
    const { fixture, component } = makeComponent({
      submitBidAsync: () =>
        Promise.resolve({
          ok: false,
          kind: 'ineligible',
          reasons: [
            'An insurance certificate is required on your profile.',
            'At least 5 years’ experience in this service is required.',
          ],
        } as BidSubmitResult),
    });
    fixture.detectChanges();
    await fixture.whenStable();

    component.finalConfirmation.set(true);
    component.bidForm.patchValue({
      confirmEligibility: true, companyProfile: 'p', relevantExperience: 'e',
      technicalApproach: 'a', deliveryTimeline: '3 days', totalPrice: 52000,
      taxesAndDuties: 'GST', paymentTerms: '50/50', validityPeriod: '60 days',
    });

    await component.submitBid();

    expect(component.submitRefusal()?.kind).toBe('ineligible');
    expect(component.submitRefusal()?.reasons.length).toBe(2);
    expect(component.showSuccessModal()).toBe(false);
  });

  it('stops autosaving once the tender stops accepting bids', async () => {
    // The server 409s a draft save on a closed tender. Left running, the timer
    // would fire that every thirty seconds for as long as the tab is open.
    const { fixture, component } = makeComponent({
      saveBidDraftAsync: () => Promise.resolve('closed' as const),
    });
    fixture.detectChanges();
    await fixture.whenStable();

    await component.saveDraft(true);

    expect(component.autoSaveInterval).toBeNull();
    expect(component.biddingClosed()).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx ng test --watch=false --browsers=ChromeHeadless`
Expected: FAIL — `submitRefusal`, `biddingClosed` and an async `saveDraft` do not exist.

- [ ] **Step 3: Widen the tender bundle to carry the caller's bid status**

`getTenderDetailBundleAsync` is the only awaited load this page has, and it must tell the wizard whether the vendor has already bid — the server refuses a second bid with a 409, withdrawn bids included, so opening the form at all would waste their time. Add the member now, in both branches:

```ts
  async getTenderDetailBundleAsync(
    tenderId: string
  ): Promise<{
    tender: PublishedTender;
    clarifications: TenderClarification[];
    eligibility: EligibilityResult;
    bidStatus: BidStatusResult;
  } | null> {
```

Mock branch: `bidStatus: this.getMyBidStatus(tenderId)`.

Real branch — from Task 1's new field, present whatever the bid's status, **withdrawn included**:

```ts
        bidStatus: dto.myBid
          ? {
              submitted: true,
              status: dto.myBid.status,
              bidId: dto.myBid.id,
              bidNumber: dto.myBid.bidNumber,
            }
          : { submitted: false },
```

Delete the sentence in the section comment above `refreshTendersAsync` claiming per-tender bid status has no backend counterpart — as of Task 1 it does. Keep the saved-tenders and "not interested" half, which is still true (D6).

`tender-detail.page.ts:72` still calls the mock `getMyBidStatus()` and keeps compiling; Task 9 switches it to the bundle.

- [ ] **Step 4: Fix the dead link**

`tender-detail.page.ts:85`:

```ts
  startBidSubmission(): void {
    if (!this.eligibility().eligible) {
      this.showEligibilityModal.set(true);
      return;
    }
    // Was '/vendor/bid/submit', which no route declares — it hit the `**`
    // catch-all and served the 404 page. The route is `vendor/tenders/:id/bid`
    // (vendor.routes.ts), and `bid-submission.page.ts` reads the tender id
    // from `params['id']` accordingly.
    this.router.navigate(['/vendor/tenders', this.tenderId, 'bid']);
  }
```

- [ ] **Step 5: Make the page load asynchronously and restore drafts properly**

In `bid-submission.page.ts`:

```ts
  tenderId = '';
  tender = signal<PublishedTender | null>(null);
  eligibility = signal<EligibilityResult>({ eligible: false, reasons: [], missingRequirements: [] });

  /** Why the last submit was refused, if it was. Null while nothing has been refused. */
  submitRefusal = signal<
    | { kind: 'ineligible'; reasons: string[] }
    | { kind: 'validation'; messages: string[] }
    | { kind: 'conflict'; message: string }
    | { kind: 'failed'; message: string }
    | null
  >(null);

  /** Set once the server says the tender no longer accepts bids. Hides Submit and stops autosave. */
  biddingClosed = signal(false);

  submitting = signal(false);

  ngOnInit(): void {
    this.tenderId = this.route.snapshot.params['id'];
    this.initializeForm();
    void this.load();
  }

  /**
   * One awaited load, not three synchronous reads.
   *
   * `getTenderDetail()` was a `tendersSignal` lookup: on a deep link in
   * real-API mode the constructor's tender refresh may not have resolved yet,
   * so it read `undefined` and bounced the vendor out with "Tender not found".
   * The bundle also carries this vendor's eligibility, so the wizard can say
   * up front what a submit would be refused for.
   */
  private async load(): Promise<void> {
    const bundle = await this.vendorService.getTenderDetailBundleAsync(this.tenderId);
    if (!bundle) {
      this.toastService.error('Tender not found');
      this.router.navigate(['/vendor/tenders']);
      return;
    }

    this.tender.set(bundle.tender);
    this.eligibility.set(bundle.eligibility);

    // Already bid — the server refuses a second one (409), withdrawn bids
    // included, so offering the form would waste the vendor's time.
    if (bundle.bidStatus.submitted && bundle.bidStatus.bidId) {
      this.toastService.info('You have already bid on this tender.');
      this.router.navigate(['/vendor/bids', bundle.bidStatus.bidId]);
      return;
    }

    await this.restoreDraft();
    this.setupAutoSave();
  }

  private async restoreDraft(): Promise<void> {
    const draft = await this.vendorService.getBidDraftAsync(this.tenderId);
    if (!draft) return;

    const data = draft.formData ?? {};

    // Rebuild both FormArrays to the length the draft actually holds *before*
    // patching. `FormArray.patchValue` ignores values past the last existing
    // control, and the form seeds exactly one of each — so a three-line price
    // breakdown came back as one line, silently.
    this.resizeArray(this.similarWorkReferencesArray, data.similarWorkReferences?.length ?? 1,
      () => this.addReference());
    this.resizeArray(this.priceBreakdownArray, data.priceBreakdown?.length ?? 1,
      () => this.addPriceItem());

    this.bidForm.patchValue(data);
    this.currentStep.set(draft.currentStep);
    this.lastSavedTime.set(new Date(draft.lastSaved));
    this.toastService.info('Draft restored');
  }

  /** Grows or shrinks a FormArray to `length` (minimum one row, which is what the form starts with). */
  private resizeArray(array: FormArray, length: number, addOne: () => void): void {
    const target = Math.max(1, length);
    while (array.length > target) array.removeAt(array.length - 1);
    while (array.length < target) addOne();
  }
```

- [ ] **Step 6: Make draft saving async and stop it when bidding closes**

```ts
  private setupAutoSave(): void {
    this.autoSaveInterval = setInterval(() => {
      void this.saveDraft(true);
    }, 30000); // Auto-save every 30 seconds
  }

  private stopAutoSave(): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
  }

  async saveDraft(silent = false): Promise<void> {
    const draft: BidDraft = {
      tenderId: this.tenderId,
      formData: this.bidForm.value,
      currentStep: this.currentStep(),
      // The server validates 1..20 and `currentStep <= totalSteps`; sending the
      // wizard's own step count keeps a resumed draft on the step it left.
      totalSteps: this.totalSteps,
      lastSaved: new Date().toISOString(),
    };

    const result = await this.vendorService.saveBidDraftAsync(draft);

    if (result === 'closed') {
      // 409: the tender stopped accepting bids. Nothing about that resolves by
      // retrying, and the timer would fire it every thirty seconds.
      this.stopAutoSave();
      this.biddingClosed.set(true);
      this.toastService.error('This tender is no longer accepting bids.');
      return;
    }

    if (result === 'failed') {
      // Silent autosaves stay silent — a transient failure is retried in
      // thirty seconds and does not need a toast each time.
      if (!silent) this.toastService.error('Could not save your draft.');
      return;
    }

    this.lastSavedTime.set(new Date());
    if (!silent) this.toastService.success('Draft saved');
  }

  async saveDraftAndExit(): Promise<void> {
    await this.saveDraft();
    this.router.navigate(['/vendor/tenders', this.tenderId]);
  }
```

`ngOnDestroy` calls `this.stopAutoSave()`. `nextStep()` becomes `void this.saveDraft(true)` before advancing — deliberately not awaited: the step change must not wait on the network, and the final save before submit is what has to land.

- [ ] **Step 7: Handle every way a submit is refused**

```ts
  async submitBid(): Promise<void> {
    if (!this.finalConfirmation()) {
      this.toastService.error('Please confirm the terms and conditions');
      return;
    }

    if (this.bidForm.invalid) {
      this.toastService.error('Please complete all required fields');
      return;
    }

    if (this.submitting()) return; // one click, one bid
    this.submitting.set(true);
    this.submitRefusal.set(null);

    const formData: BidFormData = { /* unchanged — the existing mapping from bidForm.value */ };

    const result = await this.vendorService.submitBidAsync(formData, this.tenderId);
    this.submitting.set(false);

    if (result.ok) {
      this.stopAutoSave(); // the draft is gone server-side; nothing left to save
      this.submittedBidId.set(result.bidId);
      this.submittedBidNumber.set(result.bidNumber);
      this.showSuccessModal.set(true);
      return;
    }

    switch (result.kind) {
      case 'ineligible':
        // `confirmEligibility` is an attestation, not the check. The server
        // re-ran it and listed everything this vendor falls short on.
        this.submitRefusal.set({ kind: 'ineligible', reasons: result.reasons });
        break;
      case 'validation':
        this.submitRefusal.set({ kind: 'validation', messages: result.messages });
        this.applyServerFieldErrors(result.fieldErrors);
        break;
      case 'conflict':
        // Already bid, or the window shut. Neither resolves by clicking again.
        this.biddingClosed.set(true);
        this.stopAutoSave();
        this.submitRefusal.set({ kind: 'conflict', message: result.message });
        break;
      default:
        this.submitRefusal.set({ kind: 'failed', message: result.message });
    }
  }

  /**
   * Binds the server's validation messages to the controls they name, so the
   * error appears beside the field rather than only in a summary. Keys arrive
   * already camelCased by `problemFieldErrors`.
   */
  private applyServerFieldErrors(fieldErrors: Record<string, string[]>): void {
    for (const [control, messages] of Object.entries(fieldErrors)) {
      const target = this.bidForm.get(control);
      if (!target) continue;
      target.setErrors({ ...(target.errors ?? {}), server: messages.join(' ') });
      target.markAsTouched();
    }
  }

  serverError(fieldName: string): string | null {
    return (this.bidForm.get(fieldName)?.errors?.['server'] as string) ?? null;
  }
```

Add `submittedBidNumber = signal('')` beside `submittedBidId`.

- [ ] **Step 8: Render the refusal**

In `bid-submission.page.html`, above the step-4 submit button (~line 500):

```html
@if (submitRefusal(); as refusal) {
  <div class="submit-refusal" role="alert">
    @switch (refusal.kind) {
      @case ('ineligible') {
        <h3>This bid was not accepted</h3>
        <p>The tender's requirements are checked when you submit, not when you tick the box:</p>
        <ul>
          @for (reason of refusal.reasons; track reason) {
            <li>{{ reason }}</li>
          }
        </ul>
      }
      @case ('validation') {
        <h3>Some answers need fixing</h3>
        <ul>
          @for (message of refusal.messages; track message) {
            <li>{{ message }}</li>
          }
        </ul>
      }
      @default {
        <h3>This bid was not accepted</h3>
        <p>{{ refusal.message }}</p>
      }
    }
  </div>
}
```

and gate the submit button so a refusal that cannot be retried does not offer a retry:

```html
<button
  class="btn btn-primary"
  type="button"
  [disabled]="submitting() || biddingClosed()"
  (click)="submitBid()">
  {{ submitting() ? 'Submitting…' : 'Submit Bid' }}
</button>
```

Add matching styles to `bid-submission.page.scss` using the existing design tokens — no raw hex (`docs/UI_ISSUES.md` records that the app is at zero raw hex and should stay there).

- [ ] **Step 9: Run the tests and build**

Run: `npx ng test --watch=false --browsers=ChromeHeadless`
Expected: `TOTAL: 82 SUCCESS` (79 + 3).

Run: `npx ng build`
Expected: clean.

- [ ] **Step 10: Commit**

```bash
git add -A && git commit -m "feat: the bid wizard is reachable, restores drafts whole, and reports refusals"
```

---

## Task 7: `/vendor/bids` — three states, and an honest count

**Files:**
- Modify: `src/app/features/vendor/my-bids/my-bids.page.ts`
- Modify: `src/app/features/vendor/my-bids/my-bids.page.html`
- Create: `src/app/features/vendor/my-bids/my-bids.page.spec.ts`

**What is wrong today:** `loadBids()` takes a one-time snapshot in `ngOnInit` (`this.bids.set(this.vendorService.getMyBids())`) into a page-local signal. Against the real API that reads an empty list before the fetch lands and never updates — the exact `ngOnInit` snapshot race the Global Constraints forbid. The template has one branch for "no bids", so a failed load renders "You haven't submitted any bids", which is a claim about the vendor's bids that a failed request is no evidence for.

**Interfaces:**
- Consumes: `bids`, `bidsLoading`, `bidsError`, `bidsTruncated`, `noConfirmedBids`, `refreshBidsAsync` (Task 5).
- Produces: nothing other tasks read.

- [ ] **Step 1: Write the failing spec**

Create `src/app/features/vendor/my-bids/my-bids.page.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { MyBidsPageComponent } from './my-bids.page';
import { VendorTenderService } from '../vendor.service';
import { BidSummary } from '../vendor.model';

function row(id: string, status: BidSummary['status'] = 'submitted'): BidSummary {
  return {
    bidId: id,
    bidNumber: `BID-${id}`,
    tenderId: `t-${id}`,
    tenderNumber: `TND-${id}`,
    tenderTitle: 'Quarterly AC servicing',
    status,
    bidAmount: 52000,
    tenderClosingDate: '2026-09-01T00:00:00Z',
    submittedAt: '2026-08-20T10:00:00Z',
  };
}

function makeComponent(state: {
  bids?: BidSummary[];
  loading?: boolean;
  error?: string | null;
  truncated?: { shown: number; total: number } | null;
}) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [MyBidsPageComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      {
        provide: VendorTenderService,
        useValue: {
          bids: signal(state.bids ?? []),
          bidsLoading: signal(state.loading ?? false),
          bidsError: signal(state.error ?? null),
          bidsTruncated: signal(state.truncated ?? null),
          noConfirmedBids: signal(false),
          refreshBidsAsync: () => Promise.resolve(),
        },
      },
    ],
  });

  const fixture = TestBed.createComponent(MyBidsPageComponent);
  fixture.detectChanges();
  return fixture;
}

describe('MyBidsPageComponent', () => {
  it('does not claim there are no bids when the load failed', () => {
    // "You haven't submitted any bids" is an assertion about the vendor's
    // bids. A 500 is no evidence for it.
    const html = makeComponent({ error: 'Could not load your bids.' }).nativeElement.textContent;

    expect(html).toContain('Could not load your bids.');
    expect(html).not.toContain("haven't submitted any bids");
  });

  it('says it is loading rather than showing an empty state first', () => {
    const html = makeComponent({ loading: true }).nativeElement.textContent;

    expect(html).toContain('Loading');
    expect(html).not.toContain("haven't submitted any bids");
  });

  it('says so when it is only showing part of the list', () => {
    // F18 exists because the vendor queue truncates at 100 silently, beside a
    // total that contradicts it. Not repeating that here.
    const html = makeComponent({
      bids: [row('a'), row('b')],
      truncated: { shown: 2, total: 137 },
    }).nativeElement.textContent;

    expect(html).toContain('137');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx ng test --watch=false --browsers=ChromeHeadless`
Expected: FAIL — the component still reads `getMyBids()` and the stub has no such method.

- [ ] **Step 3: Derive the page from the service**

Replace the page-local `bids` signal and `loadBids()` in `my-bids.page.ts`:

```ts
export class MyBidsPageComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly vendorService = inject(VendorTenderService);

  /**
   * Read from the service's own signal, not snapshotted in ngOnInit. A
   * one-time read landed before the fetch resolved and never updated — the
   * same race fixed three times in F2.1–F2.4.
   */
  readonly bids = this.vendorService.bids;
  readonly loading = this.vendorService.bidsLoading;
  readonly loadError = this.vendorService.bidsError;
  readonly truncated = this.vendorService.bidsTruncated;
  readonly noConfirmedBids = this.vendorService.noConfirmedBids;

  ngOnInit(): void {
    // Fire-and-forget: `filteredBids` is a computed over the service's signal,
    // so it re-renders when the load lands. Same pattern as the vendor queue.
    void this.vendorService.refreshBidsAsync();
  }
```

`filteredBids` and `stats` keep their bodies but read `this.bids()`. The search predicate moves from `bid.bidId` to `bid.bidNumber` — the id is an opaque GUID against the real API and a vendor cannot type it:

```ts
      result = result.filter(bid =>
        bid.tenderTitle.toLowerCase().includes(query) ||
        bid.bidNumber.toLowerCase().includes(query)
      );
```

- [ ] **Step 4: Render three states, not one**

In `my-bids.page.html`, replace the `@if (filteredBids().length === 0)` opening with an ordered chain — the error branch first and unconditional, exactly as `vendor-queue.component.html` does it:

```html
  <div class="bids-list">
    @if (loadError()) {
      <!-- Before the empty state, deliberately. "No bids yet" is a claim about
           this vendor's bids; a failed request is no evidence for it. -->
      <app-empty-state icon="circle-x" title="Couldn't load your bids" [message]="loadError()!" />
    } @else if (loading() && bids().length === 0) {
      <app-empty-state icon="clock" title="Loading your bids…" message="" />
    } @else if (filteredBids().length === 0) {
      <!-- …the two existing empty states, unchanged… -->
    } @else {
      @if (truncated(); as t) {
        <p class="list-note">
          Showing your {{ t.shown }} most recent bids of {{ t.total }}.
        </p>
      }
      <!-- …the existing @for over filteredBids(), unchanged apart from the id… -->
    }
  </div>
```

Swap the two `bid.bidId` display sites for `bid.bidNumber` (the card's `.bid-id` span and the overlay's `aria-label`); the `(click)="viewBidDetail(bid.bidId)"` handlers and the `track` keep using `bidId`, which is the route key.

Make the stat cards honest about what they can and cannot count:

```html
    <button class="stat-card" …>
      <span class="stat-value">{{ statValue(stats().total) }}</span>
      <span class="stat-label">Total Bids</span>
    </button>
```

with, in the component:

```ts
  /**
   * A count over the rows we hold. That is the whole truth in mock mode and
   * whenever the list fits one page; when it doesn't, or before any load has
   * succeeded, there is no number we can honestly print here — no per-status
   * count endpoint exists — so print a placeholder instead of a wrong number.
   */
  statValue(count: number): string {
    return this.noConfirmedBids() || this.truncated() ? '—' : String(count);
  }
```

- [ ] **Step 5: Run the tests and build**

Run: `npx ng test --watch=false --browsers=ChromeHeadless`
Expected: `TOTAL: 85 SUCCESS` (82 + 3).

Run: `npx ng build`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: my-bids loads from the API and never renders a failure as an empty list"
```

---

## Task 8: `/vendor/bids/:id` — real history, and the withdraw control

**Files:**
- Modify: `src/app/features/vendor/bid-detail/bid-detail.page.ts`
- Modify: `src/app/features/vendor/bid-detail/bid-detail.page.html`
- Modify: `src/app/features/vendor/bid-detail/bid-detail.page.scss`
- Create: `src/app/features/vendor/bid-detail/bid-detail.page.spec.ts`

**Three things this task closes:**

1. **There is no withdraw control anywhere in the app.** `withdrawBid()` has existed at `vendor.service.ts:422` since the mock was written and is called from nowhere — verified by grep across every `.ts` and `.html`. The roadmap's "hide the control rather than letting it fail" describes gating a control that does not exist. This task builds it.
2. **The page renders nothing at all when the load fails.** The whole template is `@if (bid(); as bid) { … }` with no `@else`. A 404, a 500 or a slow network all produce a blank white page.
3. **The status timeline invents its dates.** `getStatusTimeline()` derives four fixed steps from the current status and stamps `bid.updatedAt` on every intermediate one — so a bid that went straight from `submitted` to `awarded` displays a "Under Technical Review" step dated as though it happened. `BidDto.events` is the real append-only history (the backend's own comment: "Award disputes are decided on this"). Render that.

**Interfaces:**
- Consumes: `getBidDetailAsync`, `withdrawBidAsync` (Task 5); `Bid.canWithdraw`, `Bid.events` (Task 4).
- Produces: nothing other tasks read.

- [ ] **Step 1: Write the failing spec**

Create `src/app/features/vendor/bid-detail/bid-detail.page.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { BidDetailPageComponent } from './bid-detail.page';
import { VendorTenderService } from '../vendor.service';
import { ToastService } from '../../../core/services/toast.service';
import { Bid } from '../vendor.model';

function bid(overrides: Partial<Bid> = {}): Bid {
  return {
    bidId: 'b-1',
    bidNumber: 'BID-2026-00231',
    tenderId: 't-1',
    tenderNumber: 'TND-2026-00087',
    tenderTitle: 'Quarterly AC servicing',
    status: 'submitted',
    bidAmount: 52000,
    tenderClosingDate: '2099-01-01T00:00:00Z',
    submittedAt: '2026-08-20T10:00:00Z',
    vendorId: 'v-1',
    technicalProposal: {
      companyProfile: '', relevantExperience: '', similarWorkReferences: [],
      technicalApproach: '', manpowerPlan: '', equipmentPlan: '',
      deliveryTimeline: '', deviations: '',
    },
    commercialProposal: {
      totalPrice: 52000, priceBreakdown: [], taxesAndDuties: '',
      paymentTerms: '', validityPeriod: '', warrantyPricing: '', amcPricing: '',
    },
    canWithdraw: true,
    isLive: true,
    events: [{ toStatus: 'submitted', note: 'Submitted', occurredAt: '2026-08-20T10:00:00Z' }],
    ...overrides,
  };
}

async function makeComponent(detail: Bid | null, withdraw = () => Promise.resolve(bid())) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [BidDetailPageComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { snapshot: { params: { id: 'b-1' } } } },
      {
        provide: VendorTenderService,
        useValue: {
          getBidDetailAsync: () => Promise.resolve(detail),
          withdrawBidAsync: withdraw,
          getTenderDetailBundleAsync: () => Promise.resolve(null),
        },
      },
      { provide: ToastService, useValue: { error: () => undefined, success: () => undefined, info: () => undefined } },
    ],
  });

  const fixture = TestBed.createComponent(BidDetailPageComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

describe('BidDetailPageComponent', () => {
  it('offers Withdraw only when the server says the bid can be withdrawn', async () => {
    const open = await makeComponent(bid({ canWithdraw: true }));
    expect(open.nativeElement.textContent).toContain('Withdraw');
  });

  it('hides Withdraw on a submitted bid whose window has shut', async () => {
    // Status is still `submitted` — an admin closed the tender early. Deriving
    // the control from the status would show a button the server 409s.
    const closed = await makeComponent(bid({ status: 'submitted', canWithdraw: false }));
    expect(closed.nativeElement.textContent).not.toContain('Withdraw');
  });

  it('says the bid could not be loaded instead of rendering a blank page', async () => {
    const failed = await makeComponent(null);
    expect(failed.nativeElement.textContent).toContain("Couldn't load this bid");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx ng test --watch=false --browsers=ChromeHeadless`
Expected: FAIL — there is no withdraw control and no error branch.

- [ ] **Step 3: Load asynchronously, with an error state**

In `bid-detail.page.ts`:

```ts
export class BidDetailPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly vendorService = inject(VendorTenderService);
  private readonly toastService = inject(ToastService);

  bid = signal<Bid | null>(null);
  loading = signal(true);
  loadFailed = signal(false);

  /** Guards the withdraw control while a request is in flight — one click, one withdrawal. */
  withdrawing = signal(false);
  showWithdrawPanel = signal(false);
  withdrawReason = signal('');

  ngOnInit(): void {
    void this.load(this.route.snapshot.params['id']);
  }

  private async load(bidId: string): Promise<void> {
    this.loading.set(true);
    const bid = await this.vendorService.getBidDetailAsync(bidId);
    this.loading.set(false);

    if (!bid) {
      // Deliberately not a redirect. The old code bounced to /vendor/bids on
      // any failure, so a transient 500 looked identical to a bid that does
      // not exist, and the vendor was never told which.
      this.loadFailed.set(true);
      return;
    }

    this.bid.set(bid);
  }
```

- [ ] **Step 4: Build the withdraw control**

```ts
  openWithdrawPanel(): void {
    this.withdrawReason.set('');
    this.showWithdrawPanel.set(true);
  }

  cancelWithdraw(): void {
    // Guarded like the panel's own action: cancelling only hides the panel, it
    // cannot recall a request already sent. Slice 2's F12 lesson.
    if (this.withdrawing()) return;
    this.showWithdrawPanel.set(false);
  }

  async confirmWithdraw(): Promise<void> {
    const bid = this.bid();
    if (!bid || this.withdrawing()) return;

    this.withdrawing.set(true);
    const updated = await this.vendorService.withdrawBidAsync(
      bid.bidId,
      this.withdrawReason().trim() || undefined
    );
    this.withdrawing.set(false);
    this.showWithdrawPanel.set(false);

    // `withdrawBidAsync` returns the *fresh* bid on a 409 as well as on
    // success, so either way this leaves the screen showing what the server
    // actually holds. Null means even the re-read failed; it has already said
    // so, and overwriting the bid with null would blank the page.
    if (updated) this.bid.set(updated);
  }
```

- [ ] **Step 5: Render the real history instead of a derived one**

Replace `getStatusTimeline()` with a computed over `events`:

```ts
  /**
   * The bid's actual history.
   *
   * The old version derived four fixed steps from the current status and
   * stamped `updatedAt` on each intermediate one — so a bid that went straight
   * from submitted to awarded displayed a dated "Under Technical Review" step
   * that never happened. `events` is the server's append-only record; the
   * backend's own comment says award disputes are decided on it.
   */
  timeline = computed(() =>
    (this.bid()?.events ?? []).map(event => ({
      label: this.getStatusLabel(event.toStatus),
      date: event.occurredAt,
      note: event.note ?? '',
    }))
  );
```

Add `withdrawn: 'Withdrawn'` to `getStatusLabel`'s map — it is missing today, so a withdrawn bid renders the raw `withdrawn` string.

- [ ] **Step 6: Update the template**

Wrap the existing body and add the two missing branches at the top of `bid-detail.page.html`:

```html
@if (loadFailed()) {
  <app-empty-state
    icon="circle-x"
    title="Couldn't load this bid"
    message="It may have been removed, or the server could not be reached.">
    <button class="btn-outline" type="button" (click)="goBack()">Back to My Bids</button>
  </app-empty-state>
} @else if (loading()) {
  <app-empty-state icon="clock" title="Loading this bid…" message="" />
} @else if (bid(); as bid) {
  <!-- …the entire existing body, unchanged apart from the two edits below… -->
}
```

Add `EmptyStateComponent` to the component's `imports`.

Inside the body: swap the header's `{{ bid.bidId }}` and Quick Info's "Bid ID" value for `{{ bid.bidNumber }}` — against the real API `bidId` is an opaque GUID and means nothing to a vendor.

Replace the sidebar's timeline `@for (step of getStatusTimeline(); …)` with `@for (step of timeline(); track step.date)`, dropping the `active`/`completed` classes (there is no "future" step to render when the source is history rather than a fixed pipeline) and showing `step.note` where present.

In the sidebar's Actions card, above "View Original Tender":

```html
@if (bid.canWithdraw) {
  @if (showWithdrawPanel()) {
    <div class="withdraw-panel">
      <label for="withdraw-reason">Why are you withdrawing? (optional)</label>
      <textarea
        id="withdraw-reason"
        rows="3"
        [value]="withdrawReason()"
        (input)="withdrawReason.set($any($event.target).value)"
        [disabled]="withdrawing()"></textarea>
      <div class="withdraw-panel__actions">
        <button class="btn btn-outline" type="button" [disabled]="withdrawing()" (click)="cancelWithdraw()">
          Keep my bid
        </button>
        <button class="btn btn-danger" type="button" [disabled]="withdrawing()" (click)="confirmWithdraw()">
          {{ withdrawing() ? 'Withdrawing…' : 'Withdraw bid' }}
        </button>
      </div>
      <p class="withdraw-panel__note">
        A withdrawn bid cannot be resubmitted for this tender.
      </p>
    </div>
  } @else {
    <button class="btn btn-outline btn-full" type="button" (click)="openWithdrawPanel()">
      Withdraw bid
    </button>
  }
}
```

The note is not a flourish: `IX_bids_tender_id_vendor_id` and the submit handler's duplicate check both count a withdrawn bid, so withdrawal really is one-way for that tender. Telling the vendor before the click is the difference between a decision and a trap.

Style `.withdraw-panel` in `bid-detail.page.scss` with the existing tokens — no raw hex.

- [ ] **Step 7: Run the tests and build**

Run: `npx ng test --watch=false --browsers=ChromeHeadless`
Expected: `TOTAL: 88 SUCCESS` (85 + 3).

Run: `npx ng build`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat: a vendor can withdraw a bid, and the detail page shows its real history"
```

---

## Task 9: Per-tender bid status (D6) and the vendor dashboard's four counters

**Files:**
- Modify: `src/app/features/vendor/vendor.service.ts` (`getTenderDetailBundleAsync` returns `bidStatus`)
- Modify: `src/app/features/vendor/tender-detail/tender-detail.page.ts:72`
- Modify: `src/app/features/vendor/tender-detail/tender-detail.page.html:116-130`
- Modify: `src/app/features/dashboard/vendor-dashboard/vendor-dashboard.page.ts`
- Modify: `src/app/features/dashboard/vendor-dashboard/vendor-dashboard.page.html` (the four stat cards)

**Two roadmap items land here.** D6's single exception — "per-tender bid status moves from mock to the real Bid API" — and the `/mine/stats` bullet. Both were listed under Slice 4's *notes* while its *file list* named neither page.

**The bid status comes from the tender, not from the bid list.** There is no by-tender bid route, and scanning a page of `/api/bids/mine` is wrong past 100 bids. Task 1 put `myBid` on `GET /api/tenders/{id}` — the handler already loads the vendor, so it costs one indexed lookup and arrives in the bundle the page is already awaiting. That also removes the last `ngOnInit` snapshot on this page: `tender-detail.page.ts:72` currently calls the synchronous mock `getMyBidStatus()` *after* awaiting the bundle, which reads an empty local bid list in real-API mode and reports "not submitted" for a vendor who has bid.

**The dashboard is not computing four counters — it is inventing them.** `vendor-dashboard.page.ts:109` hard-codes `{openTenders: 24, myBids: 8, wonBids: 3, activeProjects: 2}` in `loadDashboardData()`. Delete them. On failure, or before the first response, the cards show `—`, not `0`: this is the same rule `noConfirmedStats` enforces on the vendor queue, and `0` here would tell a vendor with live bids that they have none.

**Interfaces:**
- Consumes: `getTenderDetailBundleAsync`'s `bidStatus` member (Task 6) and `getVendorBidStatsAsync` (Task 5).
- Produces: nothing other tasks read.

- [ ] **Step 1: Read the bid status from the bundle on the tender page**

`getTenderDetailBundleAsync` already carries `bidStatus` — Task 6 added it, because the wizard needed it first. This task is where the tender page stops calling the mock and reads it.

`tender-detail.page.ts:72` currently calls the synchronous mock `getMyBidStatus()` *after* awaiting the bundle. In real-API mode that reads an empty local bid list and reports "not submitted" for a vendor who has bid.

`tender-detail.page.ts`, replacing lines 70-73:

```ts
    this.bidStatus.set(bundle.bidStatus);
    // Still local-only: "saved" is a bookmark with no persistence story and no
    // endpoint (D6). Bid status used to be in this same sentence and no longer is.
    this.isSaved.set(this.vendorService.isTenderSaved(this.tenderId));
```

- [ ] **Step 2: Tell a withdrawn bidder the truth**

`tender-detail.page.html`, the action block at lines 116-130. A withdrawn bid is `submitted: true`, so the current `@else` would offer "View Your Bid" and never explain why Submit is gone:

```html
        @if (!bidStatus().submitted) {
          <button
            class="btn btn-primary btn-lg btn-block"
            (click)="startBidSubmission()"
            [disabled]="isBidWindowClosed()">
            Submit Bid Now
          </button>
        } @else {
          <button class="btn btn-outline btn-block" (click)="viewMyBid()">
            View Your Bid
          </button>
          @if (bidStatus().status === 'withdrawn') {
            <div class="bid-submitted-notice">
              <app-icon name="info" [size]="16" />
              You withdrew bid {{ bidStatus().bidNumber }}. This tender cannot be bid on again.
            </div>
          } @else {
            <div class="bid-submitted-notice">
              <app-icon name="check" [size]="16" />
              Bid {{ bidStatus().bidNumber }} submitted
            </div>
          }
        }
```

The old copy read "Bid submitted on {{ bidStatus().bidId }}" — which against the real API prints a GUID after the word "on".

- [ ] **Step 3: Wire the dashboard's counters**

In `vendor-dashboard.page.ts`, inject `VendorTenderService`, delete the hard-coded `this.stats.set({...})` from `loadDashboardData()`, and add:

```ts
  private readonly vendorService = inject(VendorTenderService);

  /** Null until a stats response lands. The cards render '—' rather than a zero we cannot vouch for. */
  stats = signal<VendorDashboardStats | null>(null);

  ngOnInit(): void {
    this.loadUserData();
    this.loadDashboardData();
    void this.loadStats();
  }

  /**
   * `GET /api/bids/mine/stats` — one call for all four counters, because a
   * dashboard that fires four requests renders in four stages and looks broken.
   *
   * Mock mode returns null and the cards show '—'. That is deliberate: the four
   * numbers here were hard-coded (24 / 8 / 3 / 2) and had never once reflected
   * anything, so a placeholder is strictly more truthful than what shipped.
   */
  private async loadStats(): Promise<void> {
    const stats = await this.vendorService.getVendorBidStatsAsync();
    if (stats) this.stats.set(stats);
  }

  statValue(pick: (s: VendorDashboardStats) => number): string {
    const stats = this.stats();
    return stats ? String(pick(stats)) : '—';
  }
```

`VendorDashboardStats` in `vendor-dashboard.model.ts` already has exactly `openTenders`/`myBids`/`wonBids`/`activeProjects` (plus an optional `rating` nothing sends) — no model change is needed. Update the four stat cards in `vendor-dashboard.page.html` to read `statValue(s => s.openTenders)` and so on, and drop any `rating` display, which no endpoint feeds.

The mock tender-opportunity and bid lists lower down the dashboard are **out of scope** — they belong to the dashboard's own wiring, not to Slice 4. Leave them and note it in the backlog entry.

- [ ] **Step 4: Run the tests and build**

Run: `npx ng test --watch=false --browsers=ChromeHeadless`
Expected: `TOTAL: 88 SUCCESS` — unchanged. This task rewires two pages onto data that already exists; it adds no specs of its own.

Run: `npx ng build`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: per-tender bid status and the dashboard counters come from the API"
```

---

## Task 10: Live verification, and the documentation that records what was actually proved

**Files:**
- Modify: `docs/BACKLOG.md`
- Modify: `docs/superpowers/plans/2026-08-02-services-portal-roadmap.md`
- Modify: this plan file, if any step above turned out wrong

**This task is the deliverable, not the paperwork after it.** Slices 2 and 3 both shipped with a verification item that was never performed and was later found by an audit; the roadmap says so in its own Status section. Every claim written here must be something you watched happen.

- [ ] **Step 1: Bring the stack up**

```bash
cd Heavenly-Job-Backend/src/Api/Heavenly-Job.Api && dotnet run
```

```bash
cd Heavenly-Frontend && npx ng serve --port 4300
```

Details, including the database and secrets, are in [`docs/backend/05-INTEGRATION-RUNBOOK.md`](../../backend/05-INTEGRATION-RUNBOOK.md) §Running it. Then flip `src/environments/environment.ts`'s `useRealApi` to `true` **locally**. It must be `false` again before the final commit — check with `git diff` before Step 6.

- [ ] **Step 2: Clear the debt Slice 2 left, before adding to it**

The roadmap records one item as genuinely unverified since Slice 2: *"log in as the approved vendor and reach `/vendor-dashboard`"* — its own Task 8 Step 4 item 7, the step it calls the gate. Slice 3 did not re-touch it. Every screen in this slice sits behind `vendorVerifiedGuard`, so it is not optional groundwork any more.

1. Register a fresh vendor through the real signup.
2. Log in as the seeded admin, find them in `/management`, approve them.
3. **Log out, log in as that vendor, and land on `/vendor-dashboard`.**

Record the outcome either way. If it fails, that is a blocker for this whole slice and belongs in the backlog before anything else here is claimed.

- [ ] **Step 3: Walk the slice's own gate**

As that verified vendor, against the real API, watching the network tab:

1. Open a published tender you are eligible for and click **Submit Bid Now** — it opens the wizard (this is the dead link from Task 6; confirm the URL is `/vendor/tenders/<id>/bid`).
2. Fill steps 1–3 including **three price-breakdown lines and two work references**. Watch a `PUT /api/bids/drafts/<tenderId>` land.
3. **Reload the page.** All three price lines and both references come back, on the step you left. This is the `patchValue` defect; one line coming back means Task 6's fix did not take.
4. Submit. Confirm **one** `POST /api/bids/tenders/<tenderId> → 201`, and that **no** draft-delete call follows it.
5. `/vendor/bids` lists the bid with its `BID-…` number (not a GUID) and status **Submitted**.
6. Open the detail. The timeline shows the real `submitted` event, not four fabricated steps.
7. **Withdraw it**, giving a reason. Confirm `POST /api/bids/<id>/withdraw → 200` and the status becomes Withdrawn.
8. Return to that tender. It must now say you withdrew, must **not** offer Submit, and the browse row's `hasBid` must be true — this is Task 1's `myBid`/`hasBid` fix and the one-way nature of withdrawal.
9. Submit a bid on a second tender, then have the admin **close** that tender while the bid is `submitted`. Reload the bid detail: **the Withdraw control is gone** even though the status is still Submitted. That is `canWithdraw`, and it is the one thing `isEditableByVendor` could not tell you.
10. **Stop the backend** and reload `/vendor/bids`. It must say it could not load them — not "You haven't submitted any bids".
11. Restart the backend. Attempt a bid as a vendor who fails an eligibility rule (e.g. a tender requiring an insurance certificate they lack), ticking the eligibility box. Confirm a **403** and that the screen lists the requirement rather than toasting something generic.
12. Attempt a second bid on a tender you have already bid on. Confirm a **409** and that Submit is disabled afterwards rather than inviting another click.

- [ ] **Step 4: Run both suites one final time**

```bash
npx ng test --watch=false --browsers=ChromeHeadless
```

```bash
npx ng build
```

```bash
cd ../Heavenly-Job-Backend && dotnet test
```

Expected: 88 frontend specs green, a clean build, 218 backend tests green. **Write down the numbers you actually saw.** If they differ from this plan, the plan is stale — correct it here and use the real numbers in Step 5. Three separate commits in Slice 3's history exist only to fix a test count asserted from memory.

- [ ] **Step 5: Update the documentation**

In `docs/BACKLOG.md`:

- Add an **F2.6 done** entry under F2, in the voice of the F2.1–F2.5 entries: what was wired, what was found, and — explicitly — what is *not* proved. Name the four defects this slice fixed that pre-dated it (the dead Submit link, the `patchValue` draft truncation, `hasBid` ignoring withdrawn bids, `isEditableByVendor` overstating what a vendor may do), and name the two backend DTO additions.
- Correct the **Tests** row of *Current state*: it says 55 frontend specs; the verified baseline before this slice was **62**. Use the real post-slice numbers.
- Update the *Services portal* row: bid submission is no longer on `localStorage`.
- Add **B14 — should withdrawing free the tender slot?** 🔵 needs a decision. Today a withdrawn bid permanently blocks a resubmission (unique index on tender+vendor, plus the submit handler's unfiltered duplicate check), and as of this slice the UI states that plainly rather than offering a button that 409s. Whether that is the intended rule is a product call, not a bug fix, and it was deliberately not changed under cover of a wiring slice.
- Add **F22 — `/vendor/bids` shows at most 100 bids.** Sibling of F18, but not silent: the page says "Showing your N most recent bids of M" and the stat cards render `—` rather than a count over a partial list. Needs paging or a per-status count endpoint to close properly.
- Add **F23 — the vendor dashboard's tender and bid widgets are still mock.** Only the four counters are wired. The opportunity list and recent-bids list below them are hard-coded arrays and were out of this slice's scope.
- Note under F2.4 that per-tender bid status is **no longer** in the "no backend endpoint" list — D6's one exception, now closed by `myBid` on the tender detail DTO. Saved tenders and "not interested" stay mock-only.

In the roadmap file:

- Mark Slice 4 done with the date, and move the `◀── NEXT` marker to Slice 5.
- Correct D6's wording: it says bid status "Slice 4 sources from the real Bid API", which is not what happened — there is no by-tender bid route; it comes from the tender detail DTO.
- Add a line to the Slice 4 section recording that its own file list omitted `tender-detail.page.ts` and `vendor-dashboard.page.ts`, which its notes required — the same class of internal contradiction Slice 3's plan corrected in its Context section, and worth flagging for Slices 5–9, which were written at the same time and in the same voice.
- Update the Status paragraph with whatever Step 2 found about Slice 2's outstanding item.

- [ ] **Step 6: Confirm the flag is back to `false`, then commit**

```bash
git diff src/environments/environment.ts
```

Expected: **no output.** If `useRealApi: true` shows up here, revert it before committing.

```bash
git add -A && git commit -m "docs: Slice 4 complete — bid submission, my bids, and withdrawal on the real API"
```

---

## Notes for dispatching subagents

Each task above is written to be handed to a subagent that has never seen this codebase. Some things do not fit inside a single task and are worth passing along with every dispatch:

- **Two repos, two branches.** Task 1 runs in `Heavenly-Job-Backend/` on `feature/vendor-bid-dtos`. Tasks 2–10 run in `Heavenly-Frontend/` on `feature/bid-submission`. Both are already cut from `dev-agentic`. A subagent that starts by creating a branch has misread its task.
- **Task 1 must land before Task 6** (which reads `dto.myBid` when widening the tender bundle) and **before Task 8** (which reads `canWithdraw`). Task 9 depends on Task 6's bundle, not on Task 1 directly. Everything else is strictly sequential — each frontend task compiles against the one before it. Do not parallelise 2→9.
- **The `Interfaces` block is the contract.** A subagent sees only its own task, so the names and types in that block are how it learns what its neighbours produce and expect. If an implementation has to deviate from it, that is a plan correction to make explicitly, not a detail to absorb quietly — the next task is written against the published names.
- **Expected test counts are predictions, not requirements.** Each task states the total it expects. If the number differs by exactly the specs that task added, the baseline in this plan is stale — record the real number and carry it forward. If it differs by more, something regressed. This project has three commits in its history that exist only to correct counts asserted from memory; do not add a fourth.
- **Docker must be running for `dotnet test`**, and `npx ng test` needs Chrome. A red suite is an environment question before it is a code question.
- **The review standard, stated so it is not a surprise:** a failed request that writes an empty list or a zero is a finding. A hand-rolled `loading` boolean where `createRequestState()` exists is a finding. A control offered on client-derived state where the server sends an explicit flag is a finding. A `catch {}` that swallows the server's reason and toasts something generic is a finding.

---

## Self-review

Checked against the roadmap's Slice 4 section and the code, 2026-08-23.

**Spec coverage.** Every screen, endpoint and note in the roadmap's Slice 4 section maps to a task: E4 → Task 6 · E5 → Task 7 · E6 → Task 8 · drafts → Tasks 5, 6 · submit → Tasks 5, 6 · `GET /api/bids/mine` → Tasks 5, 7 · `/mine/stats` → Tasks 5, 9 · `GET /api/bids/{id}` → Tasks 5, 8 · withdraw → Tasks 5, 8 · `request-state` on all three screens → Tasks 5, 7, 8 · draft keyed by `tenderId` → Task 5 · eligibility is server-side → Tasks 5, 6 · withdrawal hidden once closed → Tasks 1, 8 · `getMyBidStatus` off the mock (D6) → Tasks 1, 9. Nothing in that section is unassigned.

**Beyond the roadmap, and deliberately so.** Four defects that pre-date this slice are fixed inside it because its own verification gate walks through each: the dead Submit link, the `patchValue` draft truncation, `hasBid` ignoring withdrawn bids, and `isEditableByVendor` overstating what a vendor may do. Two are logged rather than fixed — B14 (a product decision) and F22 (needs an endpoint that does not exist).

**Type consistency.** `bidId` is the opaque route key throughout; `bidNumber` is the display reference throughout; nothing calls the same thing both. `canWithdraw` is server-sent everywhere and derived nowhere. `BidSummary` and `Bid` are separate types in every signature that names them. `refreshBidsAsync`/`getBidDetailAsync`/`withdrawBidAsync`/`getBidDraftAsync`/`saveBidDraftAsync`/`submitBidAsync`/`getVendorBidStatsAsync` are spelled identically in Task 5's `Interfaces` block, its implementation, and every consuming task. `getTenderDetailBundleAsync`'s widened return type is stubbed in Task 6's spec and defined in Task 9 — Task 9's step 5 calls out that ordering explicitly so it reads as intended rather than as a break.

**Known soft spot, named rather than hidden.** The `/vendor/bids` list caps at 100 with no way to page further, because closing it properly needs a per-status count endpoint the backend does not have. The page says so on screen and the gap is logged as F22. That is a smaller hole than F18's silent truncation, and it is the honest limit of what this slice can reach without backend work the roadmap assigns elsewhere.
