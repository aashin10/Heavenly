# Screen Inventory

**Derived from:** `app.routes.ts` + all nested `*.routes.ts`, verified 2026-07-19.

The complete surface the backend has to serve. **29 page components across 27 routes.** This is the map — API contracts are written per-screen against it, two screens at a time.

Legend — **Auth**: 🌐 public · 🔒 authenticated · 👤 role-gated.
**API status**: ✅ documented · ⬜ not yet · ⛔ screen does not exist (see [UI_ISSUES.md §1](../UI_ISSUES.md)).

---

## A. Public / marketing

| # | Route | Component | Auth | API needs | API |
|---|---|---|---|---|---|
| A1 | `/` | `home.page` | 🌐 | None — static config arrays | ⬜ |
| A2 | `/about` | `about.page` | 🌐 | None — static | ⬜ |
| A3 | `/careers` | `careers.page` | 🌐 | Job listings (public subset) | ⬜ |
| A4 | `/contact` | `contact.page` | 🌐 | **Contact form submit** | ⬜ |
| A5 | `/services` | `services.page` | 🌐 | Service catalogue (currently a hard-coded `SERVICES` const) | ⬜ |

> A1/A2 are config-driven and need no API. A5's catalogue is a compile-time constant today — worth an endpoint only if Heavenly wants to add services without a redeploy. Given the stated plan to enter new streams, **recommend making it an endpoint.**

## B. Authentication

| # | Route | Component | Auth | API needs | API |
|---|---|---|---|---|---|
| B1 | `/login` | `login.page` | 🌐 | Login (2 portals × 3 roles), portal/role deep-link | **✅ [01](01-API-AUTH.md)** |
| B2 | `/vendor-signup` | `vendor-signup.page` | 🌐 | 4-step vendor registration + doc upload | **✅ [01](01-API-AUTH.md)** |
| B3 | `/service-requester-signup` | `service-requester-signup.page` | 🌐 | 3-step requester registration (3 variants) | **✅ [01](01-API-AUTH.md)** |
| B4 | `/verification-pending` | `verification-pending.page` | 🔒 vendor | **Status-aware** (pending/rejected/suspended) + resubmit — UI_SETS Set 4 | **✅ [01](01-API-AUTH.md)** |

## C. Jobs portal

| # | Route | Component | Auth | API needs | API |
|---|---|---|---|---|---|
| C1 | `/dashboard` | `dashboard.page` | 🔒 | Role-dispatch shell | ⬜ |
| C2 | ↳ employer view | `pages/employer.page` | 👤 employer | Post job, list own jobs + applicants | ⬜ |
| C3 | ↳ job-seeker view | `pages/job-seeker.page` | 👤 applicant | Browse/filter jobs, apply | ⬜ |
| C4 | `/profile` | `profile.page` | 🔒 | Read/update own profile | ⬜ |

## D. Service requests (requester)

| # | Route | Component | Auth | API needs | API |
|---|---|---|---|---|---|
| D1 | `/service-requester-dashboard` | `service-requester-dashboard.page` | 👤 requester | Stats, recent requests, drafts, quick actions — **now wired to real data** | ◐ lists in [04](04-API-SERVICE-REQUESTS.md) |
| D4 | `/my-requests` + `/my-requests/:id` | `my-requests-list.page` / `my-request-detail.page` | 👤 requester | Request list (tabs/filters), detail with timeline, cancel, edit&resubmit — **screen built** (UI_SETS Set 2) | ◐ [04](04-API-SERVICE-REQUESTS.md) (+ resubmit/cancel endpoints) |
| D2 | `/service-request/new` | `service-request-form.page` | 👤 requester | 3 form variants by category, autosave drafts | **✅ [04](04-API-SERVICE-REQUESTS.md)** |
| D3 | `/service-request/preview` | `service-request-preview.page` | 👤 requester | Draft read-back, submit | **✅ [04](04-API-SERVICE-REQUESTS.md)** |

> D2 is the most complex form in the app — three distinct schemas (`quick_service`, `mid_complexity`, `technical`) driven by `FORM_CONFIGS`, with autosave and 7-day draft expiry (`autoDeleteAt`).

## E. Vendor portal

| # | Route | Component | Auth | API needs | API |
|---|---|---|---|---|---|
| E1 | `/vendor-dashboard` | `vendor-dashboard.page` | 👤 vendor + verified | Stats, opportunities, bids, profile completion | **✅ [02](02-API-VENDOR-DASHBOARD.md)** |
| E2 | `/vendor/tenders` | `tender-browse.page` | 👤 vendor + verified | Tender search, filters, facets, saved tenders | ⬜ |
| E3 | `/vendor/tenders/:id` | `tender-detail.page` | 👤 vendor + verified | Tender detail, eligibility, clarifications Q&A | ⬜ |
| E4 | `/vendor/tenders/:id/bid` | `bid-submission.page` | 👤 vendor + verified | Bid draft + submit (technical + commercial) | ⬜ |
| E5 | `/vendor/bids` | `my-bids.page` | 👤 vendor + verified | Own bids list, filter by status | ⬜ |
| E6 | `/vendor/bids/:id` | `bid-detail.page` | 👤 vendor + verified | Bid detail, timeline, withdraw | ⬜ |
| E7 | `/vendor-profile/:section` | `vendor-profile.page` | 👤 vendor (any status) | Profile editor: basic, documents, services, portfolio, bank — **screen now built** (UI_SETS Set 1); API = the profile endpoints in [02](02-API-VENDOR-DASHBOARD.md) | ⬜ |

## F. Management / admin

| # | Route | Component | Auth | API needs | API |
|---|---|---|---|---|---|
| F1 | `/management` | `management.page` | 👤 admin | Job moderation + service-request queue, KPIs | ⬜ |
| F2 | `/management/review/:id` | `service-request-review.page` | 👤 admin | Review request, AI draft, approve/reject/changes | ⬜ |
| F3 | `/management/publish/:id` | `tender-publish.page` | 👤 admin | Tender preview, notification + schedule settings, publish | ⬜ |
| F4 | `/management/evaluation` | `live-tenders-dashboard.page` | 👤 admin | Live tenders with bid counts + phase | ⬜ |
| F5 | `/management/evaluation/:id` | `bid-evaluation.page` | 👤 admin | Evaluation workspace: technical → commercial → shortlist → award | ⬜ |
| F6 | `…/:id/technical/:bidId` | `technical-bid-review.page` | 👤 admin | Score technical proposal, qualify/disqualify | ⬜ |
| F7 | `…/:id/commercial/:bidId` | `commercial-bid-detail.page` | 👤 admin | Commercial proposal (sealed until phase opens) | ⬜ |
| F8 | `/management` (Vendors tab) + `/management/vendors/:id` | `vendor-queue` / `vendor-review.page` | 👤 admin | Queue + review: approve/reject/suspend/reinstate, audited — **screen built** (UI_SETS Set 3) | ⬜ vendor-admin endpoints |

> **F8 does not exist and is required.** `vendorVerifiedGuard` blocks the entire vendor portal on `verificationStatus === 'verified'`, but nothing in the app can set it. See [UI_ISSUES.md §2](../UI_ISSUES.md).

---

## Domain summary

Five aggregates, in workflow order:

```
Account ──┬── JobSeeker / Employer      (jobs portal)
          ├── ServiceRequester          (services portal)
          └── Vendor ── VerificationStatus ── Documents, BankDetails

ServiceRequest ──(admin review)──> Tender ──(vendor bids)──> Bid ──(evaluation)──> Award
   D2/D3              F2              F3         E4            F5/F6/F7
```

The request → tender → bid → award pipeline is the core of the product and touches the most screens (D2, D3, F2, F3, E2–E6, F4–F7). It should drive the schema design; the jobs portal (C1–C4) is a separate, simpler bounded context that happens to share an account.

## Recommended documentation order

Ordered by what unblocks the most downstream work:

1. **Auth** (B1–B4) — everything is gated on it, and it decides the account model. ✅ **done**
2. **Vendor dashboard** (E1) — read-heavy, exercises tenders + bids + stats + profile in one screen; validates the aggregate shapes cheaply before committing to write endpoints. ✅ **done**
3. **Service request creation (D2, D3)** — the pipeline's entry point. ✅ **done**
4. **Admin review + publish (F2, F3)** — request → tender transition. ⬅️ **next** (blocked on the `changes_required` product question in [04 §7](04-API-SERVICE-REQUESTS.md))
5. Tender browse + detail (E2, E3).
6. Bid submission (E4) + my bids (E5, E6).
7. Evaluation (F4–F7) — most complex, and safe to leave last since it operates on data the earlier steps produce.
8. Jobs portal (C1–C4) — independent; can be built in parallel by another dev.

Two screens per pass, per the agreed working rhythm.
