# Slice 3 — Model Divergences + the Async UI Convention — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every client type that Slice 4+ sends over the wire agree with the server's own enums, and establish the one busy/loading/error convention those slices' screens will need — so neither has to be retrofitted across five screens later.

**Architecture:** Two independent halves that share a branch. The first is pure type surgery in the Angular model layer, driven by the compiler: delete duplicate declarations, correct values that disagree with `Domain/Enums/*.cs`, and collapse three names for one requester field into one. The second adds a tiny shared request-state primitive (`core/utils/request-state.ts`) and applies it to the two management screens Slice 2 shipped, closing F12/F14/F17. Nothing in this slice adds an endpoint or changes a payload; it changes what the client believes those payloads contain.

**Tech Stack:** Angular 17 (standalone, signals) · TypeScript strict · Karma/Jasmine · .NET 10 backend (read-only reference for canonical enum values)

## Global Constraints

Every task's requirements implicitly include this section.

- **Branch:** frontend `feature/model-divergences` off `dev-agentic`. No backend branch — this slice touches no backend code. `dev-agentic` is the integration branch for this roadmap.
- **`useRealApi` stays committed `false`.** Every mock path keeps working unchanged.
- **Backend is the canon for every enum value.** When this plan and `Domain/Enums/*.cs` disagree, the `.cs` file wins — read it, do not trust this document's transcription.
- **Wire format:** `camelCase` JSON; enums lowercase `snake_case`; dates ISO 8601 UTC; IDs opaque strings.
- **Frontend tests:** `npx ng test --watch=false --browsers=ChromeHeadless`. Baseline is **40 specs** and must stay green. New specs go beside the file they cover.
- **Build:** `npx ng build` must stay clean — this slice is compiler-driven, so a clean build is a large part of its evidence.
- **Race-condition rule:** never snapshot service state in `ngOnInit()` when an async refresh may still be in flight. Derive page state with `computed()`.
- **Commits:** conventional prefixes (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`), one concern per commit.
- **`docs/BACKLOG.md` is updated at the end of the slice**, not retroactively.

---

## Context: what is actually wrong

Read this before Task 1. **Three of the roadmap's Slice 3 claims are wrong**, verified against the code on 2026-08-06 — it was written before Slices 1–2 shipped and before the Slice 2 review. Corrections:

| Roadmap said | Actually |
|---|---|
| "`VendorBid.status` … in `vendor.model.ts`" | `vendor.model.ts:74`'s `BidStatus` is **already canonical** and matches `BidStatus.cs` exactly. The divergence is in a *different* file: `features/dashboard/vendor-dashboard/vendor-dashboard.model.ts:23`. |
| "`ServiceCategory` and `BudgetVisibility` deduplicated" | `BudgetVisibility` is **not duplicated** — it exists only in `management.model.ts`. Same for `TenderType`. Only `ServiceCategory` and `RequesterType` are genuinely declared twice. |
| "One canonical `ServiceRequest`; management consumes a projection" | The backend deliberately models **three** shapes (`ServiceRequestDto`, `ServiceRequestAdminDto`, `ServiceRequestSummaryDto`). Two frontend types is *correct*; sharing the bare name `ServiceRequest` is the defect. This slice renames rather than merges. |

**And one divergence the roadmap missed entirely**, which would have bitten Slice 5: `management.model.ts`'s `ServiceRequestStatus` carries a **`rejected`** value the server has no concept of, and is **missing `cancelled`**, which the server can genuinely send. `service-request-management.service.ts:196` already calls `updateRequestStatus(requestId, 'rejected', …)` — against the real API that is an unrepresentable state today and a dead branch forever. The admin endpoints are `start-review | approve | request-changes | close`; there is no reject.

**The canonical values, read from the backend on 2026-08-06:**

```
BidStatus.cs            Draft Submitted UnderReview Shortlisted Awarded Rejected Withdrawn
ServiceRequestStatus.cs Draft Submitted UnderReview ChangesRequired Approved Published Closed Cancelled
```

Both serialize lowercase `snake_case` (`under_review`, `changes_required`).

`core/models/service.model.ts:208`'s `RequestStatus` **already matches `ServiceRequestStatus.cs` exactly** — it is the canonical one; `management.model.ts`'s copy is the broken one.

**On the requester address (F10):** the backend already returns **one** `Address` field (`ServiceRequesterDto.cs:27`), and its own doc comment names this frontend split as the reason. The client's three names (`address?` on individual, `businessAddress` on SME, `registeredAddress` on large-org) are a client-only invention.

**On the async convention (F12/F14/F17):** no `busy` / `loading` / `error` pattern exists anywhere in `features/management/`. Consequences live today in `vendor-admin.service.ts`: a failed queue load writes `[]` **and** all-zero stats, so a 403 or 500 renders "Pending 0 / Verified 0 … No vendors here" as confident fact; a filter switch renders an empty list beside a stat card contradicting it; a 409 — which by definition means the client's status is stale — leaves the stale badge and the same impossible button on screen forever. Slice 4 adds three more async screens. Establishing the pattern here means applying it twice now instead of five times later.

---

## File Structure

**Create**

| File | Responsibility |
|---|---|
| `src/app/core/utils/request-state.ts` | The one request-state primitive: `createRequestState()` returning `{ loading, error }` signals plus `begin()`/`isCurrent()`/`succeed()`/`fail()`. Sequences requests and records failure instead of fabricating empty success. Deliberately does not own the data — see Task 6. |
| `src/app/core/utils/request-state.spec.ts` | Its spec — sequencing, error capture, and the "a stale failure must not overwrite a newer success" rule. |
| `src/app/features/management/management.model.spec.ts` | Guards the corrected enums against the backend's values, so a future edit that reintroduces `rejected` fails a test rather than a live request. |

**Modify**

| File | Change |
|---|---|
| `src/app/features/management/management.model.ts` | Delete duplicate `ServiceCategory`/`RequesterType`; re-export the canonical ones. Fix `ServiceRequestStatus`. Rename `ServiceRequest` → `AdminServiceRequest`. |
| `src/app/core/models/service.model.ts` | Host `BudgetVisibility`/`TenderType`; collapse the requester address to one `address`. |
| `src/app/features/dashboard/vendor-dashboard/vendor-dashboard.model.ts` | `VendorBid.status` uses canonical `BidStatus`. |
| `src/app/features/dashboard/vendor-dashboard/vendor-dashboard.page.ts` | Mock rows + label/class maps move to canonical values. |
| `src/app/core/services/service-auth.service.ts` | Reads/writes one `address` instead of three names. |
| `src/app/features/management/management.page.ts`, `publish/tender-publish.page.ts`, `review/service-request-review.page.ts`, `service-request-management.service.ts` | Follow the renames; drop the unreachable `rejected` path. |
| `src/app/core/services/vendor-admin.service.ts` | Replace the hand-rolled `refreshRequestId` with `createRequestState()`; stop fabricating zeros on failure; refetch on 409. |
| `src/app/features/management/vendors/vendor-queue.component.{ts,html}` | Render loading and error states instead of an empty state that lies. |
| `src/app/features/management/vendors/vendor-review.page.{ts,html}` | In-flight guard on all five controls; refetch on 409. |

---

## Task 1: Canonical shared enums — delete the duplicates

**Files:**
- Modify: `src/app/features/management/management.model.ts:49-52`
- Modify: `src/app/core/models/service.model.ts` (add `BudgetVisibility`, `TenderType`)

**Interfaces:**
- Consumes: nothing.
- Produces: `ServiceCategory`, `RequesterType`, `BudgetVisibility`, `TenderType` all exported from `core/models/service.model.ts`. `management.model.ts` re-exports them so its five importers keep working unchanged.

- [ ] **Step 1: Create the branch**

```bash
cd /Users/admin/Heavenly-agentic/Heavenly-Frontend && git checkout dev-agentic && git pull && git checkout -b feature/model-divergences
```

- [ ] **Step 2: Add the two types that belong in core**

`BudgetVisibility` and `TenderType` are *not* duplicated — they live only in `management.model.ts` today. They move to core because Slice 6 (tender create/publish) needs them outside the management feature, and moving them now costs nothing.

In `src/app/core/models/service.model.ts`, directly below the `ServiceCategory` declaration at line 29, add:

```ts
/**
 * Whether a tender shows vendors the budget. Mirrors `BudgetVisibility.cs`.
 *
 * This is an access rule, not a display hint — the vendor-facing tender DTOs
 * have no field capable of carrying a withheld figure, so `hide` is enforced
 * by the shape of the payload rather than by remembering to blank a field.
 */
export type BudgetVisibility = 'show_exact' | 'show_range' | 'hide';

/** How a tender selects its bidders. Mirrors `TenderType.cs`. */
export type TenderType = 'open' | 'limited' | 'single';
```

- [ ] **Step 3: Replace the duplicates with re-exports**

In `src/app/features/management/management.model.ts`, replace lines 49–52 exactly:

```ts
export type ServiceCategory = 'technical' | 'mid_complexity' | 'quick_service';
export type RequesterType = 'individual' | 'sme' | 'organization';
export type BudgetVisibility = 'show_exact' | 'show_range' | 'hide';
export type TenderType = 'open' | 'limited' | 'single';
```

with:

```ts
// These four are declared once, in core/models/service.model.ts, and re-exported
// here so this file stays the single import for management screens.
//
// `RequesterType` is the reason this matters rather than being tidiness: the
// copy that used to live here said `'organization'` where the canonical type
// (and the server, and the signup flow) say `'large_organization'`. Any
// management screen that compared against it was comparing against a value the
// API never sends.
export type {
  ServiceCategory,
  RequesterType,
  BudgetVisibility,
  TenderType,
} from '../../core/models/service.model';
```

- [ ] **Step 4: Build and let the compiler find the fallout**

Run: `npx ng build`
Expected: any place that assigned `'organization'` now fails to compile. Fix each by using `'large_organization'`. If the build is clean, nothing was comparing against the wrong value — record that in the commit message rather than assuming the change was inert.

- [ ] **Step 5: Run the suite**

Run: `npx ng test --watch=false --browsers=ChromeHeadless`
Expected: `TOTAL: 40 SUCCESS`

- [ ] **Step 6: Commit**

```bash
git add src/app/core/models/service.model.ts src/app/features/management/management.model.ts
git commit -m "refactor: one declaration each for ServiceCategory, RequesterType, BudgetVisibility, TenderType"
```

---

## Task 2: `ServiceRequestStatus` — drop the phantom, add the real one

**Files:**
- Modify: `src/app/features/management/management.model.ts:29-37`
- Modify: `src/app/features/management/service-request-management.service.ts:196`
- Create: `src/app/features/management/management.model.spec.ts`

**Interfaces:**
- Consumes: Task 1's re-export block.
- Produces: `ServiceRequestStatus` with values matching `ServiceRequestStatus.cs`, minus `draft` (an admin never sees a draft — drafts live in their own table).

- [ ] **Step 1: Write the failing spec**

Create `src/app/features/management/management.model.spec.ts`:

```ts
import { ServiceRequestStatus } from './management.model';

/**
 * These assertions exist because the admin status union carried a `rejected`
 * value the server has no concept of, and lacked `cancelled`, which it can
 * genuinely send. Both are silent until a real payload arrives — a type union
 * cannot be wrong at runtime, it can only leave the UI with no branch to take.
 *
 * The canonical set is ServiceRequestStatus.cs. `draft` is deliberately absent
 * here: a draft request lives in its own table and never reaches an admin queue.
 */
describe('ServiceRequestStatus', () => {
  it('is exactly the seven statuses an admin can see, no more, no fewer', () => {
    // A Record, not an array: TS errors on this object literal if the union
    // gains a member with no key here ("Property 'x' is missing"), and errors
    // on the key itself if the object has one the union doesn't. An array
    // typed as ServiceRequestStatus[] only checks its elements are valid
    // members — it would keep compiling if a member were silently dropped or
    // added, which is the exact failure this spec exists to catch.
    const ADMIN_VISIBLE: Record<ServiceRequestStatus, true> = {
      submitted: true,
      under_review: true,
      changes_required: true,
      approved: true,
      published: true,
      closed: true,
      cancelled: true,
    };
    expect(Object.keys(ADMIN_VISIBLE).length).toBe(7);
  });

  it('has no `rejected` status', () => {
    // The admin endpoints are start-review | approve | request-changes | close.
    // There is no reject, and `rejected` was never a state the server could
    // return — service-request-management.service.ts used to set it anyway.
    // A Record<ServiceRequestStatus, true> above would fail to compile with an
    // extra 'rejected' key (TS disallows excess properties on a fresh object
    // literal), so this runtime check is the belt to that compile-time brace —
    // it still catches a `rejected` re-added to the union AND listed correctly.
    const values: string[] = Object.keys({
      submitted: true, under_review: true, changes_required: true,
      approved: true, published: true, closed: true, cancelled: true,
    } satisfies Record<ServiceRequestStatus, true>);
    expect(values).not.toContain('rejected');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx ng test --watch=false --browsers=ChromeHeadless`
Expected: FAIL — a compile error, something like `Object literal may only specify known properties, and 'cancelled' does not exist in type 'Record<ServiceRequestStatus, true>'` (the current union has no `cancelled`) alongside `'rejected' does not exist` in the second test (the object literal there still has the pre-fix key list — leave it as written; both tests fail for the same underlying reason). That compile failure *is* the red phase; do not "fix" it by editing the spec.

- [ ] **Step 3: Correct the union**

In `src/app/features/management/management.model.ts`, replace lines 29–37:

```ts
export type ServiceRequestStatus = 
  | 'submitted' 
  | 'under_review' 
  | 'changes_required' 
  | 'approved' 
  | 'published' 
  | 'closed'
  | 'rejected';
```

with:

```ts
/**
 * The statuses an admin can see on a service request. Mirrors
 * `ServiceRequestStatus.cs` minus `Draft` — a draft lives in its own table and
 * never reaches the admin queue.
 *
 * `rejected` used to be here and is not a server state: the admin actions are
 * start-review, approve, request-changes and close. A request that will not
 * proceed is *closed*. `cancelled` was missing and is real — a requester can
 * cancel their own request.
 */
export type ServiceRequestStatus = 
  | 'submitted' 
  | 'under_review' 
  | 'changes_required' 
  | 'approved' 
  | 'published' 
  | 'closed'
  | 'cancelled';
```

- [ ] **Step 4: Fix the one caller that set the phantom status**

`src/app/features/management/service-request-management.service.ts:196` currently reads:

```ts
    this.updateRequestStatus(requestId, 'rejected', fullReason);
```

Replace with:

```ts
    // `closed`, not `rejected`: the server has no reject action for service
    // requests, and never had. The reason is still recorded — closing with a
    // reason is exactly what the admin "reject" button always meant.
    this.updateRequestStatus(requestId, 'closed', fullReason);
```

Then read the enclosing method. If its name says "reject" it may now misdescribe itself — rename it to match what it does, and update its callers (the compiler will list them).

- [ ] **Step 5: Run the suite and build**

Run: `npx ng test --watch=false --browsers=ChromeHeadless && npx ng build`
Expected: `TOTAL: 42 SUCCESS`, build clean.

- [ ] **Step 6: Commit**

```bash
git add src/app/features/management/management.model.ts src/app/features/management/management.model.spec.ts src/app/features/management/service-request-management.service.ts
git commit -m "fix: admin request statuses match the server — no phantom rejected, cancelled present"
```

---

## Task 3: Rename management's `ServiceRequest` to `AdminServiceRequest`

**Files:**
- Modify: `src/app/features/management/management.model.ts:54`
- Modify: `src/app/features/management/management.page.ts`, `publish/tender-publish.page.ts`, `review/service-request-review.page.ts`, `service-request-management.service.ts`

**Interfaces:**
- Consumes: Task 2's corrected `ServiceRequestStatus`.
- Produces: `AdminServiceRequest` — the admin's rich projection. `core/models`' `ServiceRequest` keeps its name and stays the requester-facing one.

- [ ] **Step 1: Rename the interface**

The two types are **not** duplicates to merge. The backend models three distinct shapes deliberately (`ServiceRequestDto`, `ServiceRequestAdminDto`, `ServiceRequestSummaryDto`) — the admin one carries joined requester contact details, warnings and `internalNotes` that must never reach a requester. Two client types is correct. One bare shared name is the defect: an import from the wrong module type-checks silently against the wrong shape.

In `src/app/features/management/management.model.ts` line 54, rename and document:

```ts
/**
 * The admin's view of a service request — mirrors `ServiceRequestAdminDto`.
 *
 * Deliberately *not* the same type as `ServiceRequest` in
 * `core/models/service.model.ts`, which is the requester's own view. This one
 * carries joined requester contact details, warnings, and `internalNotes`,
 * which must never reach a requester. Naming both `ServiceRequest` meant an
 * import from the wrong module type-checked against the wrong shape in silence.
 */
export interface AdminServiceRequest {
```

- [ ] **Step 2: Follow the compiler**

Run: `npx ng build`

Update every reported site to `AdminServiceRequest`. The importers are `management.page.ts`, `publish/tender-publish.page.ts` and `review/service-request-review.page.ts` — check each import line names the new type, and each local annotation with it.

- [ ] **Step 3: Confirm no bare `ServiceRequest` survives in management**

Run:

```bash
grep -rn "\bServiceRequest\b" src/app/features/management --include="*.ts" | grep -v "AdminServiceRequest\|ServiceRequestStatus\|ServiceRequestFilter\|ServiceRequestAttachment\|ServiceRequestDashboardStats\|service-request"
```

Expected: no output. Any hit is either a missed rename or a genuine (and now explicit) use of the requester-facing type.

- [ ] **Step 4: Build and test**

Run: `npx ng build && npx ng test --watch=false --browsers=ChromeHeadless`
Expected: build clean, `TOTAL: 42 SUCCESS`

- [ ] **Step 5: Commit**

```bash
git add src/app/features/management
git commit -m "refactor: management's request type is AdminServiceRequest, not a second ServiceRequest"
```

---

## Task 4: `VendorBid.status` — canonical `BidStatus`

**Files:**
- Modify: `src/app/features/dashboard/vendor-dashboard/vendor-dashboard.model.ts:23`
- Modify: `src/app/features/dashboard/vendor-dashboard/vendor-dashboard.page.ts:150-215`

**Interfaces:**
- Consumes: `BidStatus` from `features/vendor/vendor.model.ts` — **already canonical**, verified against `BidStatus.cs`. Do not redeclare it.
- Produces: `VendorBid.status: BidStatus`. Slice 4 reads this when it wires `GET /api/bids/mine`.

- [ ] **Step 1: Point the interface at the canonical union**

This is the divergence the roadmap located in the wrong file. `vendor.model.ts:74`'s `BidStatus` is already correct; the broken copy is this inline union, with hyphens and two values (`pending`, `accepted`) that exist in no backend enum.

In `src/app/features/dashboard/vendor-dashboard/vendor-dashboard.model.ts`, add to the imports at line 1:

```ts
import { BidStatus } from '../../vendor/vendor.model';
```

and replace line 23:

```ts
  status: 'pending' | 'under-review' | 'accepted' | 'rejected';
```

with:

```ts
  // Canonical BidStatus, matching BidStatus.cs. This was an inline union with
  // hyphens and two values the domain has never had (`pending`, `accepted`),
  // which Slice 4 would have had to translate at the API boundary — exactly
  // the translation layer the wire-format conventions exist to avoid.
  status: BidStatus;
```

- [ ] **Step 2: Move the mock rows to real values**

In `vendor-dashboard.page.ts`, the three mock bids use `'under-review'`, `'accepted'` and `'pending'`. Map them to the nearest true statuses: `'under_review'`, `'awarded'`, `'submitted'`.

```ts
        status: 'under_review',
```
```ts
        status: 'awarded',
```
```ts
        status: 'submitted',
```

- [ ] **Step 3: Cover every canonical status in the label and class maps**

The current maps have four entries and would render a raw enum string for any other value. Replace `getBidStatusLabel` and `getBidStatusClass` with maps keyed by the full union, typed so a future added status is a compile error rather than a raw string on screen:

```ts
  getBidStatusLabel(status: BidStatus): string {
    const labels: Record<BidStatus, string> = {
      draft: 'Draft',
      submitted: 'Submitted',
      under_review: 'Under Review',
      shortlisted: 'Shortlisted',
      awarded: 'Awarded',
      rejected: 'Not Selected',
      withdrawn: 'Withdrawn',
    };
    return labels[status];
  }

  getBidStatusClass(status: BidStatus): string {
    const classes: Record<BidStatus, string> = {
      draft: 'status-draft',
      submitted: 'status-submitted',
      under_review: 'status-review',
      shortlisted: 'status-shortlisted',
      awarded: 'status-accepted',
      rejected: 'status-rejected',
      withdrawn: 'status-withdrawn',
    };
    return classes[status];
  }
```

Import `BidStatus` in this file too. Note `rejected` reads "Not Selected" — the vendor-facing wording for a losing bid; the raw enum name is the server's word, not the vendor's.

- [ ] **Step 4: Check the stylesheet has the classes**

Run:

```bash
grep -n "status-draft\|status-submitted\|status-shortlisted\|status-withdrawn\|status-accepted\|status-review\|status-rejected" src/app/features/dashboard/vendor-dashboard/vendor-dashboard.page.scss
```

Add any missing rule beside its siblings, reusing the existing colour tokens. A class with no rule renders unstyled text, which looks like a bug to a user.

- [ ] **Step 5: Build and test**

Run: `npx ng build && npx ng test --watch=false --browsers=ChromeHeadless`
Expected: build clean, `TOTAL: 42 SUCCESS`

- [ ] **Step 6: Commit**

```bash
git add src/app/features/dashboard/vendor-dashboard
git commit -m "fix: VendorBid.status uses the canonical BidStatus, not hyphens and phantom values"
```

---

## Task 5: One requester address (F10)

**Files:**
- Modify: `src/app/core/models/service.model.ts:366-391`
- Modify: `src/app/core/services/service-auth.service.ts` (the sites the compiler flags)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `ServiceRequesterBase.address: string` — one field on the base, inherited by all three branches. Slice 5 reads it.

- [ ] **Step 1: Move the field onto the base**

One concept — where the requester is — currently has three names by branch. The backend already returns a single `Address` (`ServiceRequesterDto.cs:27`), and its own doc comment names this frontend split as the reason it does.

In `src/app/core/models/service.model.ts`, add to `ServiceRequesterBase` (line 355):

```ts
export interface ServiceRequesterBase {
  id: string;
  email: string;
  phone: string;
  requesterType: RequesterType;
  /**
   * Where the requester is. One field for all three branches: this was
   * `address?` / `businessAddress` / `registeredAddress`, one concept under
   * three names, and the API has only ever returned one `address` (B2.3).
   */
  address: string;
  city: string;
  createdAt: Date;
  isEmailVerified: boolean;
}
```

Then delete `address?: string;` from `IndividualRequester`, `businessAddress: string;` from `SMERequester`, and `registeredAddress: string;` from `LargeOrgRequester`.

- [ ] **Step 2: Follow the compiler through `service-auth.service.ts`**

Run: `npx ng build`

Each error is a read or write of one of the three old names. Replace with `address`. The mapping sites are around lines 237, 249, 507–508, 601–602 and 673 — but **use the compiler's list, not this one**, and read each site: some are reading a *form* field (the signup wizard's `step3SME.businessAddress`), which is a different thing and must keep its name. Only the `ServiceRequester` model's field changes.

Where a ternary previously chose which name to read by requester type, it collapses to one read:

```ts
// before
address:
  type === 'sme' ? formData.step3SME?.businessAddress :
  formData.step3LargeOrg?.registeredAddress,
```

That ternary is still correct on the **form** side — the wizard genuinely has differently-named fields per branch — so it stays; only the property it assigns *to* is now `address`.

- [ ] **Step 3: Check the templates**

Run:

```bash
grep -rn "businessAddress\|registeredAddress" src/app --include="*.html"
```

Any hit binding a `ServiceRequester` must become `address`. A hit binding a signup **form control** stays. Read each one; the two look identical in a grep.

- [ ] **Step 4: Build and test**

Run: `npx ng build && npx ng test --watch=false --browsers=ChromeHeadless`
Expected: build clean, `TOTAL: 42 SUCCESS`

- [ ] **Step 5: Commit**

```bash
git add src/app/core
git commit -m "fix: one requester address field, matching what the API returns (F10)"
```

---

## Task 6: The request-state primitive

**Files:**
- Create: `src/app/core/utils/request-state.ts`
- Create: `src/app/core/utils/request-state.spec.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `createRequestState()` → `{ loading, error, begin(), isCurrent(id), succeed(id), fail(id, message) }`. Task 7 replaces `VendorAdminService`'s hand-rolled `refreshRequestId` with it. Slice 4's three screens use it rather than inventing their own.

**Why this shape and not an `AsyncState<T>` that owns the data:** the first real consumer (`VendorAdminService.refreshAsync`) writes **two** independent data signals from one response — the vendor rows and the server-side counts — and the review page's guard writes none. A primitive that owns a single `data` signal fits neither, and would have to be worked around at its first use site. This one owns exactly what is common to every async call in this app — *is one in flight, did the last one fail, and is this response still the newest* — and leaves the data to the caller.

- [ ] **Step 1: Write the failing spec**

Create `src/app/core/utils/request-state.spec.ts`:

```ts
import { createRequestState } from './request-state';

describe('createRequestState', () => {
  it('is loading between begin and succeed', () => {
    const state = createRequestState();
    expect(state.loading()).toBe(false);

    const id = state.begin();
    expect(state.loading()).toBe(true);

    state.succeed(id);
    expect(state.loading()).toBe(false);
    expect(state.error()).toBeNull();
  });

  it('records the message on failure', () => {
    const state = createRequestState();
    const id = state.begin();

    state.fail(id, 'Could not load the vendor queue.');

    expect(state.loading()).toBe(false);
    expect(state.error()).toBe('Could not load the vendor queue.');
  });

  it('clears a previous error when a new request begins', () => {
    const state = createRequestState();
    state.fail(state.begin(), 'boom');

    state.begin();

    expect(state.error()).toBeNull();
  });

  it('reports a superseded request as no longer current', () => {
    const state = createRequestState();
    const first = state.begin();
    const second = state.begin();

    expect(state.isCurrent(first)).toBe(false);
    expect(state.isCurrent(second)).toBe(true);
  });

  it('ignores a stale success — it must not clear a newer request loading flag', () => {
    const state = createRequestState();
    const first = state.begin();
    const second = state.begin();

    state.succeed(first);

    // The newer request is still in flight; the older one landing late must
    // not tell the screen the work is done.
    expect(state.loading()).toBe(true);

    state.succeed(second);
    expect(state.loading()).toBe(false);
  });

  it('ignores a stale failure — it must not overwrite a newer success', () => {
    // The subtler half, and a real bug this replaces: VendorAdminService
    // guarded its success path with a request id but the failure path could
    // still write. A fast-failing request could therefore overwrite the result
    // of a slower one that had already succeeded.
    const state = createRequestState();
    const first = state.begin();
    const second = state.begin();

    state.succeed(second);
    state.fail(first, 'late failure');

    expect(state.error()).toBeNull();
    expect(state.loading()).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx ng test --watch=false --browsers=ChromeHeadless`
Expected: FAIL — `request-state.ts` does not exist.

- [ ] **Step 3: Write the implementation**

Create `src/app/core/utils/request-state.ts`:

```ts
import { signal, Signal } from '@angular/core';

/**
 * The state every async call in this app needs: whether one is in flight,
 * whether the last one failed, and whether a given response is still the newest.
 *
 * It deliberately does **not** own the data. Its first consumer writes two
 * independent signals from one response (vendor rows and server-side counts),
 * and the review page's decision guard writes none — a primitive holding a
 * single `data` signal would have to be worked around at both.
 *
 * Three rules, each because its absence produced a real bug here:
 *
 * 1. **Only the newest request may write anything — success *or* failure.**
 *    Guarding just the success path let a fast-failing request overwrite a
 *    slower one that had already succeeded.
 * 2. **A failure records an error; it never fabricates data.** The catch in
 *    `refreshAsync` used to write an empty list and all-zero counts, so a 403
 *    rendered as a confident "0 pending — no vendors here". Zeros must come
 *    from a server that said zero.
 * 3. **`loading` is true from `begin()` until the matching settle**, so a screen
 *    can say "loading" instead of an empty state asserting there is nothing.
 */
export interface RequestState {
  readonly loading: Signal<boolean>;
  readonly error: Signal<string | null>;
  /** Marks a new request in flight and clears any previous error. Returns its id. */
  begin(): number;
  /** Whether `id` is still the most recently issued request. */
  isCurrent(id: number): boolean;
  succeed(id: number): void;
  fail(id: number, message: string): void;
}

export function createRequestState(): RequestState {
  const loading = signal(false);
  const error = signal<string | null>(null);
  let latestId = 0;

  const isCurrent = (id: number) => id === latestId;

  return {
    loading: loading.asReadonly(),
    error: error.asReadonly(),

    begin(): number {
      loading.set(true);
      error.set(null);
      return ++latestId;
    },

    isCurrent,

    succeed(id: number): void {
      if (!isCurrent(id)) return;
      loading.set(false);
    },

    fail(id: number, message: string): void {
      if (!isCurrent(id)) return;
      loading.set(false);
      error.set(message);
    },
  };
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx ng test --watch=false --browsers=ChromeHeadless`
Expected: `TOTAL: 48 SUCCESS`

- [ ] **Step 5: Commit**

```bash
git add src/app/core/utils/request-state.ts src/app/core/utils/request-state.spec.ts
git commit -m "feat: one request-state primitive — sequenced, and a failure never fabricates data"
```

---

## Task 7: The vendor queue tells the truth when a load fails

**Files:**
- Modify: `src/app/core/services/vendor-admin.service.ts`
- Modify: `src/app/features/management/vendors/vendor-queue.component.ts`
- Modify: `src/app/features/management/vendors/vendor-queue.component.html`
- Modify: `src/app/features/management/vendors/vendor-queue.component.spec.ts`

**Interfaces:**
- Consumes: `createRequestState` from Task 6.
- Produces: `VendorAdminService.queueLoading: Signal<boolean>` and `queueError: Signal<string | null>`, both read by the queue template. Task 8 reads neither.

- [ ] **Step 1: Replace the hand-rolled counter with the primitive**

`refreshAsync` already sequences with a private `refreshRequestId` counter. That counter does one of the three jobs Task 6's primitive does, so it is replaced rather than sat alongside — two sequencing mechanisms in one method is how they drift.

In `src/app/core/services/vendor-admin.service.ts`, add the import:

```ts
import { createRequestState } from '../utils/request-state';
```

Delete this line:

```ts
  private refreshRequestId = 0;
```

and put in its place:

```ts
  private readonly queueRequest = createRequestState();

  /** True while a queue fetch is in flight — the queue renders a loading state. */
  readonly queueLoading = this.queueRequest.loading;

  /** Set when the last queue fetch failed; cleared when the next one begins. */
  readonly queueError = this.queueRequest.error;
```

- [ ] **Step 2: Rewrite `refreshAsync`'s body around it**

Replace everything from `const requestId = ++this.refreshRequestId;` to the end of the method with:

```ts
    const requestId = this.queueRequest.begin();

    try {
      const dto = await firstValueFrom(
        this.api.queue({
          status: status && status !== 'all' ? status : undefined,
          pageSize: 100,
        })
      );
      if (!this.queueRequest.isCurrent(requestId)) return;
      this.vendorsSignal.set(dto.items.map(item => this.summaryToVendor(item)));
      this.serverStatsSignal.set({
        pending: dto.stats.pending,
        verified: dto.stats.verified,
        rejected: dto.stats.rejected,
        suspended: dto.stats.suspended,
      });
      this.queueRequest.succeed(requestId);
    } catch {
      // Deliberately does NOT write an empty list or zero counts. Those are
      // assertions about the queue, and a failed request is no evidence for
      // them — writing them rendered a 403 as a confident "0 pending, no
      // vendors here". The last good data stays on screen behind an error
      // state, which is both truer and more useful than a fabricated empty.
      this.queueRequest.fail(requestId, 'Could not load the vendor queue.');
      this.toastService.error('Could not load the vendor queue.');
    }
```

**Correction (2026-08-06, caught in Task 6's review, before this section was ever dispatched):** the sentence that used to stand here claimed "the old code did not [guard the error branch]." That's wrong for the code as it exists *now* — `vendor-admin.service.ts:99` already has `if (requestId !== this.refreshRequestId) return;` on the catch, added in Slice 2's Task 5 fix round (commit `396757b`), well before this plan was written. The bug that sentence described was real, but historical: it existed only between `6830d0c` (which introduced the unguarded catch) and `396757b` (which fixed it) — both in Slice 2, both already on `dev-agentic`. `request-state.ts`'s own doc comment correctly uses past tense ("used to") for exactly this reason.

What this step actually changes, then, is narrower than "add a missing guard": it's a **refactor** — replacing the hand-rolled `refreshRequestId` counter with `createRequestState()`, so this call site uses the shared primitive instead of duplicating its logic locally. The guard behavior itself (both success and failure paths already correctly sequenced) doesn't change; what changes is where that sequencing logic lives.

- [ ] **Step 3: Expose them on the component**

In `vendor-queue.component.ts`, beside `readonly stats`:

```ts
  readonly loading = this.vendorAdmin.queueLoading;
  readonly loadError = this.vendorAdmin.queueError;
```

- [ ] **Step 4: Render loading and error before the empty state**

In `vendor-queue.component.html`, replace the opening of the results block:

```html
  @if (filteredVendors().length === 0) {
    <app-empty-state
      icon="handshake"
      title="No vendors here"
      message="Vendors matching this filter will appear here as they register and are reviewed." />
  } @else {
```

with:

```html
  @if (loadError()) {
    <!-- Before the empty state, deliberately. "No vendors here" is a claim
         about the queue; after a failed request we have no basis for it. -->
    <app-empty-state
      icon="circle-x"
      title="Couldn't load the queue"
      [message]="loadError()!" />
  } @else if (loading() && filteredVendors().length === 0) {
    <app-empty-state icon="clock" title="Loading vendors…" message="" />
  } @else if (filteredVendors().length === 0) {
    <app-empty-state
      icon="handshake"
      title="No vendors here"
      message="Vendors matching this filter will appear here as they register and are reviewed." />
  } @else {
```

The `loading() && length === 0` condition matters: on a *filter switch* the previous filter's rows are still in the signal, and blanking them to show a spinner is a worse experience than leaving them until the new set lands.

- [ ] **Step 5: Extend the queue spec**

Add to `vendor-queue.component.spec.ts` — the stub needs the two new signals, so update `renderQueue`'s stub object first:

```ts
    queueLoading: signal(false),
    queueError: signal<string | null>(null),
```

then add:

```ts
describe('VendorQueueComponent load states', () => {
  it('shows an error state, not "no vendors", when the load failed', async () => {
    const el = await renderQueue(true, [], { error: 'Could not load the vendor queue.' });

    expect(el.textContent).toContain("Couldn't load the queue");
    expect(el.textContent).not.toContain('No vendors here');
  });
});
```

Give `renderQueue` a third parameter `opts: { error?: string; loading?: boolean } = {}` and feed it into the stub's signals.

- [ ] **Step 6: Verify red-green on the error state**

Temporarily revert Step 1's catch to the old zero-writing version, run the suite, and confirm the new spec fails. Restore it and confirm it passes. A test that has only ever passed proves nothing.

Run: `npx ng test --watch=false --browsers=ChromeHeadless`
Expected: `TOTAL: 50 SUCCESS` **(corrected 2026-08-06 — this said 49 when first written, before Task 6's real fix round added a test the plan didn't anticipate at write-time, shifting Task 6's actual final baseline from 48 to 49. 49 (Task 6's real baseline) + 1 (this task's own new spec) = 50.)**

- [ ] **Step 7: Commit**

```bash
git add src/app/core/services/vendor-admin.service.ts src/app/features/management/vendors/vendor-queue.component.ts src/app/features/management/vendors/vendor-queue.component.html src/app/features/management/vendors/vendor-queue.component.spec.ts
git commit -m "fix: a failed queue load no longer renders as a confident empty queue"
```

---

## Task 8: In-flight guard and 409 reconciliation on the review page

**Files:**
- Modify: `src/app/core/services/vendor-admin.service.ts`
- Modify: `src/app/features/management/vendors/vendor-review.page.ts`
- Modify: `src/app/features/management/vendors/vendor-review.page.html`
- Modify: `src/app/features/management/vendors/vendor-review.page.spec.ts`

**Interfaces:**
- Consumes: nothing from Task 7 — this is the same convention applied to a different screen, deliberately not sharing a signal (they are different requests).
- Produces: closes F12 and the 409 half of F17.

- [ ] **Step 1: Make `decide()` distinguish a 409 and report it**

In `vendor-admin.service.ts`, `decide()`'s catch maps every failure to `null`, so callers cannot tell a 409 (the client's status is stale) from a network blip (it is not). Replace the catch:

```ts
    } catch (error) {
      const status = (error as { status?: number })?.status;
      this.toastService.error(
        status === 409
          ? 'That action is not allowed for this vendor’s current status.'
          : 'The decision could not be saved.'
      );
      return null;
    }
```

with:

```ts
    } catch (error) {
      const status = (error as { status?: number })?.status;
      if (status === 409) {
        // A 409 *is* the server telling us our copy is stale — another admin
        // acted, or this tab has been open a while. Re-reading is the only
        // response that leaves the screen true; returning null alone left the
        // stale badge and the same impossible button on screen forever.
        this.toastService.error('That vendor’s status changed. Reloading it.');
        return await this.getVendorAsync(id);
      }
      this.toastService.error('The decision could not be saved.');
      return null;
    }
```

Because every caller already does `if (updated) this.vendor.set(updated)`, the refetched vendor flows into the page and the buttons re-derive from the real status with no page-level change.

- [ ] **Step 2: Add the in-flight guard to the page**

In `vendor-review.page.ts`, add beside the other signals:

```ts
  /**
   * True while any decision is in flight. Guards all five controls, Cancel
   * included: cancelling only hides the panel, it cannot recall a request
   * already sent, so leaving Cancel live let an admin dismiss the panel and
   * then act again on a vendor whose decision had already landed.
   */
  deciding = signal(false);
```

Wrap each of the four decision methods. `approve()` becomes:

```ts
  async approve(): Promise<void> {
    const v = this.vendor();
    if (!v || this.deciding()) return;
    this.deciding.set(true);
    try {
      const updated = await this.vendorAdmin.approveAsync(v.id, this.actor());
      if (updated) this.vendor.set(updated);
    } finally {
      this.deciding.set(false);
    }
  }
```

Apply the identical shape to `reinstate()`. For `confirmReason()`, guard and wrap the same way, keeping the existing "only clear on success" body inside the `try`. Add the guard to `cancelReason()` as an early return:

```ts
  cancelReason(): void {
    if (this.deciding()) return;
    this.pendingAction.set(null);
    this.reasonText.set('');
  }
```

- [ ] **Step 3: Disable the controls in the template**

In `vendor-review.page.html`, add `[disabled]="deciding()"` to the four decision buttons (lines ~152, ~157, ~160, ~165) and to the Cancel button (~143). The Confirm button already has a `[disabled]`; extend it:

```html
                    <button type="button" class="btn-danger" [disabled]="!reasonText().trim() || deciding()" (click)="confirmReason()">
```

- [ ] **Step 4: Write the failing specs**

Add to `vendor-review.page.spec.ts`:

```ts
describe('VendorReviewPageComponent in-flight guard', () => {
  it('ignores a second decision while the first is in flight', async () => {
    let resolve!: (v: Vendor | null) => void;
    const pending = new Promise<Vendor | null>(r => (resolve = r));
    let calls = 0;

    const { page } = await makePageWith({
      approveAsync: () => {
        calls++;
        return pending;
      },
    });

    const first = page.approve();
    void page.approve(); // the double-click
    expect(calls).toBe(1);

    resolve(makeVendor({ verificationStatus: 'verified' }));
    await first;
    expect(page.deciding()).toBe(false);
  });

  it('will not cancel the reason panel while a decision is in flight', async () => {
    let resolve!: (v: Vendor | null) => void;
    const pending = new Promise<Vendor | null>(r => (resolve = r));

    const { page } = await makePageWith({ rejectAsync: () => pending });

    page.startReject();
    page.reasonText.set('Docs missing.');
    const run = page.confirmReason();

    page.cancelReason();
    expect(page.pendingAction()).toBe('reject');

    resolve(makeVendor({ verificationStatus: 'rejected' }));
    await run;
  });
});
```

Refactor the existing `makePage(decisionResult)` into `makePageWith(overrides)` so both shapes are available — keep `makePage` delegating to it so the existing three specs are untouched.

- [ ] **Step 5: Verify red-green**

Comment out the `deciding` guards, run the suite, confirm both new specs fail. Restore them and confirm they pass.

Run: `npx ng test --watch=false --browsers=ChromeHeadless`
Expected: `TOTAL: 52 SUCCESS` **(corrected 2026-08-06, same off-by-one as Task 7's count — see that task's note. Task 7's real baseline is 50, not the plan's originally-assumed 49; this task adds its own 2 new specs, so 50 + 2 = 52.)**

- [ ] **Step 6: Build and commit**

```bash
npx ng build
git add src/app/core/services/vendor-admin.service.ts src/app/features/management/vendors/vendor-review.page.ts src/app/features/management/vendors/vendor-review.page.html src/app/features/management/vendors/vendor-review.page.spec.ts
git commit -m "fix: guard decisions in flight and reload the vendor on a 409 (F12)"
```

---

## Task 9: Live verification and documentation

**Files:**
- Modify: `docs/BACKLOG.md`
- Modify: `docs/superpowers/plans/2026-08-02-services-portal-roadmap.md`

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

Kill anything already on `:5212` or `:4300` first — a server started before this slice's code silently serves the old build and invalidates the whole pass.

- [ ] **Step 2: Turn the real API on locally**

Set `useRealApi: true` in `src/environments/environment.ts`. Reverted in Step 6; **must not be committed**.

- [ ] **Step 3: Verify the screens this slice's types touch still work**

This slice changed types the already-wired screens use, so the risk is regression, not new behaviour. Sign in as the seeded admin (see `docs/BACKLOG.md` § NEEDS YOU for the current credential) and confirm:

1. `/management` → **Vendors** tab loads, counts correct, rows render.
2. Open a vendor. The action buttons match its status.
3. As a requester, `/service-requester-profile` loads and the address renders in one field — this is Task 5's change against a real payload.
4. `/my-requests` still lists and opens a request — Task 3's rename touched its neighbours.

- [ ] **Step 4: Verify the new load states against a real failure**

The states in Task 7 are the ones no test can fully prove, because they are about what a real failed request looks like:

1. With the queue open, **stop the backend** (`Ctrl-C` the `dotnet run`).
2. Switch filter tabs to force a fetch.
3. Confirm the screen shows **"Couldn't load the queue"** — *not* "No vendors here", and *not* four stat cards reading 0.
4. Restart the backend, switch tabs again, confirm it recovers.

- [ ] **Step 5: Verify the in-flight guard**

With the backend running and the browser devtools network tab throttled to "Slow 3G", open a pending vendor and double-click **Approve**. Confirm exactly **one** `POST …/approve` in the network tab, and that the button is visibly disabled between click and response.

- [ ] **Step 6: Revert the flag**

```bash
cd /Users/admin/Heavenly-agentic/Heavenly-Frontend && git checkout -- src/environments/environment.ts && grep -n "useRealApi:" src/environments/environment.ts
```

Expected: `useRealApi: false`. Stop both dev servers and `docker compose stop`.

- [ ] **Step 7: Update the backlog**

In `docs/BACKLOG.md`:

1. Close **F5** — record what was actually found, which was narrower and more specific than the entry assumed: `BidStatus` was already canonical in `vendor.model.ts`; the divergence was an inline union in `vendor-dashboard.model.ts`. `BudgetVisibility`/`TenderType` were never duplicated. The two `ServiceRequest` types were renamed rather than merged, because the backend deliberately models three shapes. Note the divergence the entry missed: a phantom `rejected` status and a missing `cancelled`.
2. Close **F10** — one `address` on `ServiceRequesterBase`, matching what B2.3 has always returned.
3. Close **F12** — the in-flight guard now covers all five controls including Cancel.
4. Update **F17** — the loading, error and 409-reconciliation halves are done; note whether `adjustServerStats`' stale-`from` problem remains open (it does unless Task 8 was extended).
5. Update **F14** — closed if Task 8's 409 branch also distinguished 404; still open otherwise. Check before claiming.
6. Update the **Current state** table: frontend specs 40 → the final count.
7. Add a changelog entry dated the day the work lands.

- [ ] **Step 8: Update the roadmap**

In `docs/superpowers/plans/2026-08-02-services-portal-roadmap.md`, Slice 3's section: correct the three wrong claims (they will otherwise mislead whoever reads the roadmap next), note the added async-convention scope, and link this plan file. Add a line to Slice 4's section noting that the busy/loading/error convention now exists in `core/utils/request-state.ts` and its three screens should use it rather than inventing their own.

- [ ] **Step 9: Final verification and commit**

```bash
npx ng build && npx ng test --watch=false --browsers=ChromeHeadless && git status --short
```

Expected: build clean, all specs pass, and `src/environments/environment.ts` **absent** from the status output.

```bash
git add docs/BACKLOG.md docs/superpowers/plans/2026-08-02-services-portal-roadmap.md
git commit -m "docs: Slice 3 complete — model divergences closed, async convention established"
```

---

## Verification gate

Slice 3 is done when: `npx ng build` is clean, the full spec suite passes, the four already-wired screens still work against the real API, a stopped backend produces an error state rather than a fabricated empty queue, and a double-clicked Approve produces exactly one POST.
