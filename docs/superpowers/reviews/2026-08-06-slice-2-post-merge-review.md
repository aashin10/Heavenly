# Slice 2 — Post-Merge Code Review

**Date:** 2026-08-06 · **Scope:** the whole of Slice 2 (vendor verification queue + review), as merged into `dev-agentic` in both repos
**Question asked:** is everything as per the Slice 2 plan, and is it free of bugs?
**Short answer:** the shipped code is sound — no defect was found in it that makes the admin verification flow wrong. But one plan step was substituted during execution, and that substitution hid a Critical defect for the entire slice. A second step, the one the plan itself calls *the gate*, was never performed at all.

---

## Method

Four independent reviewers were run against the merged code, each on a distinct axis and each instructed to treat source as the only truth — not comments, not commit messages, not this backlog, not each other:

| Axis | Looking for |
|---|---|
| Plan conformance | every prescribed Step vs. what shipped, sorted into *plan updated deliberately* / *code right & plan stale* / *code wrong* |
| Client-server contract | any way the Angular client and the .NET API can disagree — enum spelling, nullability, transition legality, HTTP semantics |
| Async state & races | any interleaving of clicks, responses and lifecycles that leaves the screen showing something false |
| Backend security & privacy | whether the reviewer-name privacy boundary holds, and whether its test actually proves it |

Every load-bearing claim was then re-verified directly, and **every fix in this document was red-green verified** — run against the pre-fix code and confirmed to fail first. That discipline caught a wrong claim in my own earlier write-up (see *Corrections*).

**Baseline, freshly run:** backend **215/215**, frontend **34/34**, both builds clean, `useRealApi` committed `false`, both trees clean.

---

## 1. The Critical: a `ServiceAdmin` cannot open `/management`

**Severity: Critical · Live today · Not fixed here (deliberately) · Tracked as F16**

The backend authorizes the six admin vendor routes as `[Authorize(Roles = "ServiceAdmin,Admin")]` and emits `userType: "service_admin"` for such an account. The frontend gate is:

```ts
// auth.service.ts:28
readonly isAdmin = computed(() => this.userSignal()?.userType === 'admin');
```

against a union of `'employer' | 'applicant' | 'admin'`. So a real `ServiceAdmin` hits `adminGuard`, is told **"Access denied. Admin privileges required."**, and is redirected to `/dashboard`. The navbar hides the Management link for them too. Only the seeded platform `Admin` can reach the screen.

**Why this matters beyond one guard:** Slice 1's entire deliverable was a grant/revoke endpoint so an `Admin` could hand out `ServiceAdmin`. That endpoint works, and the grantee still cannot verify a vendor through the UI. The capability the two slices were built to deliver is not actually delivered for the role designed to hold it.

**How it survived:** Task 8 Step 2 said, in as many words, *grant `ServiceAdmin` to the account you will review vendors with*. Execution substituted the seeded `Admin` on the reasoning that `Admin` satisfies the same `[Authorize]` attribute. That reasoning is true of the backend and false of the frontend. Following the step as written would have surfaced this in minutes.

> **The transferable lesson:** when a verification step names a specific principal, the principal *is* the step. Substituting a more convenient one that "satisfies the same check" only tests the check you were already thinking about.

**Recommended fix** — make the guard mirror the controller's own `Roles=` string. `roles[]` is already on the wire and already modelled client-side; it is read nowhere (verified: zero occurrences in `AuthService`).

```ts
readonly isAdmin = computed(() => {
  const roles = this.userSignal()?.roles ?? [];
  return roles.includes('admin') || roles.includes('service_admin');
});
```

**Why I did not apply it.** This is an auth path. Verifying it honestly needs a running stack and an actual `ServiceAdmin` login — neither available in this pass — and shipping an unverified auth change on reasoning alone is precisely what this review's own discipline forbids. It also overlaps F3 (collapse the two auth stores): `ServiceAuthService` already has a correct `isServiceAdmin()`, and the real defect is that `/management` consults the *jobs* store. A minimal bridge risks entrenching the split F3 exists to remove. This needs a deliberate fix with a live pass.

---

## 2. The unverified gate

**Severity: Important (a documentation/evidence gap, not a code defect) · Tracked in the plan and F2.4**

Task 8 Step 4 item 7 reads: *"Confirm the vendor now passes `vendorVerifiedGuard`… **This is the gate — it is what unblocks Slices 4 onward.**"*

Items 1–6, 8 and 9 were performed and recorded in detail. Nothing anywhere records item 7. Meanwhile `docs/BACKLOG.md` claimed F2.4's blocked-vendor gap was *"resolved by F2.5."*

What was actually proven is narrower: **a vendor can be moved to `verified` through the admin UI.** Whether that vendor then reaches `/vendor-dashboard` is untested — and it is not a formality, because `vendorVerifiedGuard` reads `ServiceAuthService`'s *cached* session, so a vendor already signed in when the approval lands keeps a stale `pending` session until it rehydrates. Both documents have been corrected to claim only what was shown.

---

## 3. Fixed in this review

Each was small, well-diagnosed, and verified red-green.

### 3.1 The mock performed transitions the server refuses — *this is how the original F9 bug hid*

`VendorAdminService.transition()` had no transition rules of its own. `useRealApi` is committed `false`, so **the mock is what actually ships** — and it would carry out whatever the template offered. That is the precise mechanism by which F9's "Return to Queue on a rejected vendor" bug went unnoticed: the server refuses it with a 409, the mock performed it, so nothing surfaced the divergence locally. `legalVendorActions()` was guarding only the template.

It now enforces the same rule the server does, with the server's own message. Proven by deleting the guard and watching a *rejected* vendor get reinstated to `verified` — a state the server would refuse:

```
refuses an action the server would reject FAILED
  Expected true to be false.
  Expected 'verified' to be 'rejected'.
```

Reinstate also now records a `"Reinstated"` note, matching the server. Both approve and reinstate land on `verified`; without the note the admin's timeline cannot tell which happened.

### 3.2 The reviewer-name lookup loaded whole `User` rows, hashes included

```csharp
// before — selectors run client-side; SQL is SELECT *
.ToDictionaryAsync(u => u.Id, u => u.Name, ct);
```

`ToDictionaryAsync` takes `Func`, not `Expression`, so this reads like a projection and is not one. Every admin vendor read and every review decision pulled the reviewing admins' bcrypt hashes, emails and phone numbers into process memory to use one `Name`. Nothing reached the wire — this is exposure surface (heap/crash dumps, future logging), not a live disclosure — but it runs constantly. Now projected server-side with `.Select(u => new { u.Id, u.Name })`.

### 3.3 `IncludeReviewerNames` was missing the codebase's own anti-over-posting guard

Every other server-populated property on a command or query here carries `[JsonIgnore]`, each with a comment calling it *"load-bearing, not cosmetic."* This flag — the one thing separating an admin read from a vendor read — had none. It is not bindable today (both controllers use object initialisers), so this is latent rather than exploitable. But the day someone adds `[FromQuery]` to support filters, a vendor sending `?includeReviewerNames=true` learns which administrator rejected them, and **no existing test would fail**. Added, with the reasoning recorded.

### 3.4 Test coverage where there was none

12 frontend specs and 1 backend, each red-green verified:

| Spec | Guards | Proven by |
|---|---|---|
| `vendor-admin.service.spec.ts` | mock refuses illegal transitions; legal ones still work; missing vendor reported distinctly; reinstate doesn't stamp `verifiedAt`; reinstate is noted | removing the guard → 2 failures |
| `vendor-queue.component.spec.ts` | Docs column hidden in real-API mode; header/cell counts stay equal | pre-fix template → 1 failure |
| `vendor-review.page.spec.ts` | a failed decision keeps the admin's typed reason; success clears it; blank reasons refused, trimmed reasons sent | reverting the fix → 1 failure |
| `VendorsOwnWriteResponses_DoNotNameTheReviewer` | the six vendor *write* endpoints also return the timeline — none was under test | — |

The two components had **zero** coverage despite two runtime changes landing in them *after* Task 8's live walk, i.e. verified by nothing but "it compiles."

### 3.5 Plan document corrected

The plan is partly as-built documentation, so staleness in it is a real defect — re-running it reproduces old bugs. Fixed: the missing `actorName` wiring step (**re-running the plan without it reproduces the raw-GUID bug**, because the gap falls between a backend task and a frontend task on different branches and no task owned it); Task 4's untyped DTO block; Task 7's `confirmReason` block, which still showed the version that discards the admin's typed reason; an incomplete File Structure table; and the two execution deviations above, recorded inline where the steps are.

---

## 4. Logged, not fixed

All dormant behind `useRealApi: false`, all live the moment it flips — they belong to whichever slice does that.

| Item | Finding |
|---|---|
| **F17** | No error, loading, or 409-reconciliation states. A failed load asserts *"0 pending / No vendors here"* as fact; a filter switch shows an empty list beside a stat card contradicting it; a 409 — which by definition means the client is stale — leaves the stale badge and the same impossible button, forever. `adjustServerStats` also guesses its `from` bucket from a possibly-stale queue row. These want **one** shared convention, alongside F12's in-flight guard. |
| **F18** | The queue requests exactly the server's 100-row ceiling, reads neither `totalCount` nor `totalPages` (both already on the wire), and offers no paging or search. With 137 pending, the card says 137 and the list says 100 and stops. |
| **F19** | Mapper fallbacks render as data: **"Year Established: 0"**, an address line reading **", ,"**, **"Jane Doe ()"** — on the screen whose job is judging profile completeness, where incomplete profiles are the norm. Plus an unbounded reason textarea against a 1000-char server limit whose 400 surfaces as a generic failure. |

---

## 5. Verified clean

Worth recording, because these were the things most likely to be wrong:

- **`legalVendorActions` matches `Vendor.cs` exactly**, in both directions, across all four statuses — no offered action the server would refuse, no legal action hidden. Destinations agree too: reinstate lands on `verified`, not `pending`, and does not stamp `VerifiedAt`.
- **Every DTO matches field-for-field** against the real backend records, including enum wire formats and the `Llp → 'llp'` edge case. No field exists on one side only.
- **All 9 `VendorDto.From` call sites enumerated:** exactly 2 pass a name map, both admin-only; the 6 vendor self-service writes and the vendor's own read pass none. The privacy boundary holds.
- **The privacy guard test is genuinely non-vacuous** — proven by mutation: deleting the guard clause in `GetVendorProfileQuery` makes it fail with its own assertion message. It approves as a real admin first, so a name genuinely exists to leak, and pins the assertion to the review event rather than the actor-less registration event.
- **Task 2's "pure move, zero behaviour change" claim is true** — byte-identical at its own commit apart from the added `export`.
- **Authorization is uniform** across all six admin routes and consistent with the four sibling admin controllers.
- **The two-consumer refresh ordering is correct, not merely deterministic** — the queue sits behind `@if`, so its filtered request is always last-issued.
- **SSR is unaffected**: `/management` is guarded, so nothing in this slice executes during prerender.

---

## Corrections to earlier claims

Applying this review's own standard to my own prior write-up:

**The "Docs column" fix was misdiagnosed.** Commit `075ce62`, the backlog changelog, and my report to you all described a header/cell **count mismatch** that would *"misalign every column after Services,"* citing an Angular requirement. Rendering the pre-fix template proves that is wrong: both counts were 7 and matched. The `<th>` was unconditional, not "already conditional" as the commit message claimed. The real defect was cosmetic — an empty "Docs" header above an empty cell in real-API mode — exactly as Task 6's original review had characterised it before I restated it more dramatically.

The fix stands and is still an improvement. The diagnosis did not survive being executed rather than reasoned about, which is the whole argument for executing it. `docs/BACKLOG.md` and the new spec's comments now carry the corrected account.

---

## Verdict

**As per plan?** The shipped code, yes — every deviation found in it was a case of the code being right and the plan text being stale, now fixed. The *execution* deviated in two places, and both mattered: one substitution hid a Critical defect, and one skipped step means the slice's headline claim — that it unblocks Slices 4+ — is still unproven.

**Free of bugs?** In the shipped Slice 2 code, no bug was found that makes the verification flow wrong, and its core guarantee (never offer an action the server refuses) is now enforced in both modes rather than one. The Critical is in pre-existing auth code the slice depended on without exercising.

**Before Slices 4+:** fix F16 and verify it live, and perform the gate step. Those two are the difference between "a vendor can be verified" and "a verified vendor can do anything."
