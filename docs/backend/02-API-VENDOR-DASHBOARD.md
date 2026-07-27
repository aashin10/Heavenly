# API — Vendor Dashboard

**Screen:** E1 `/vendor-dashboard`

**Frontend sources:** `features/dashboard/vendor-dashboard/vendor-dashboard.page.ts`, `.page.html`, `vendor-dashboard.model.ts`

Read [README.md](README.md) for conventions, [01-API-AUTH.md](01-API-AUTH.md) for the session model, and [03-EXISTING-BACKEND-REVIEW.md](03-EXISTING-BACKEND-REVIEW.md) for what already exists.

> **Status update 2026-07-27.** The **`Vendor` aggregate and its full API now exist** (backend B2.1 + B2.2). Live endpoints:
>
> | | |
> |---|---|
> | `POST /api/vendors/register` | account + role + profile in one transaction, returns tokens |
> | `GET /api/vendors/me` | full profile incl. `profileCompletion` |
> | `GET /api/vendors/me/profile-completion` | just the checklist block (this doc's §4) |
> | `PUT /api/vendors/me/{basic,services,bank,documents}` | per-section saves |
> | `POST`/`DELETE /api/vendors/me/portfolio[/{id}]` | portfolio entries |
> | `GET /api/service-admin/vendors[?status=&search=&page=]` | verification queue + counts |
> | `GET /api/service-admin/vendors/{id}` | review detail incl. timeline |
> | `POST /api/service-admin/vendors/{id}/{approve,reject,suspend,reinstate}` | the four decisions |
>
> `Tender`, `Bid` and `Award` are **still greenfield**, so `GET /api/vendors/me/dashboard` below cannot be built yet — its `stats`, `opportunities` and `recentBids` blocks have no entities behind them. The `vendor` and `profileCompletion` blocks are available today from `GET /api/vendors/me`. See [03 §1](03-EXISTING-BACKEND-REVIEW.md).
>
> ⚠️ **Two contract notes for the frontend:**
> - **The full bank account number is never returned by any endpoint.** `bankDetails` carries `maskedAccountNumber` (`"••••9012"`) and `isComplete` only. The edit form must re-collect the number to change it.
> - **Verification transitions are server-enforced and stricter than the client** — see F9.

---

## 1. What the screen renders

Five regions, verified against the template:

| Region | Template | Data |
|---|---|---|
| Greeting | `:8` | Time-of-day greeting + `businessName`; verified badge at `:11` |
| KPI cards ×4 | `:42–72` | `openTenders`, `myBids`, `wonBids`, `activeProjects` |
| Tender opportunities | `:87` | Matched open tenders, urgency flag, deadline, bid count |
| My recent bids | `:140` | Own bids with status and amount |
| Profile completion | `:175–184` | Progress ring + `X of Y sections complete` + 5-row checklist |

Everything is read-only. The only writes reachable from here are navigations into other screens.

**One call, not five.** A dashboard that fires five parallel requests renders in five stages and looks broken on a slow connection. This is a single aggregate endpoint.

---

## 2. `GET /api/vendors/me/dashboard`

**Auth:** required · role `vendor` · `verificationStatus === 'verified'`

A `pending` vendor gets **403** with the `vendor-not-verified` problem type ([01-API-AUTH.md §4](01-API-AUTH.md)); the frontend routes them to `/verification-pending`.

### Query parameters

| Param | Default | Notes |
|---|---|---|
| `opportunityLimit` | `5` | Max 20 |
| `bidLimit` | `5` | Max 20 |

Both lists are previews — "View All" links go to `/vendor/tenders` and `/vendor/bids`, which have their own paginated endpoints.

### 200

```jsonc
{
  "vendor": {
    "id": "0190f2c1-…",
    "businessName": "Sharma Electricals",
    "verificationStatus": "verified",
    "rating": 4.6                       // null until enough completed jobs
  },

  "stats": {
    "openTenders": 12,
    "myBids": 8,
    "wonBids": 3,
    "activeProjects": 2
  },

  "opportunities": [
    {
      "id": "0190f3a2-…",
      "tenderNumber": "TND-2026-00087",
      "title": "Quarterly AC servicing — 3 office floors",
      "category": "quick_service",
      "location": "Gurugram, Haryana",
      "budget": {                        // null when budgetVisibility = "hide"
        "min": { "amount": 4500000, "currency": "INR" },
        "max": { "amount": 6000000, "currency": "INR" }
      },
      "deadline": "2026-07-26T18:29:59Z",
      "bidCount": 4,
      "postedAt": "2026-07-15T09:00:00Z",
      "isUrgent": true,
      "hasBid": false
    }
  ],

  "recentBids": [
    {
      "id": "0190f4b1-…",
      "bidNumber": "BID-2026-00231",
      "tenderId": "0190f3a2-…",
      "tenderTitle": "Transformer rewinding — 250 kVA",
      "category": "technical",
      "bidAmount": { "amount": 18500000, "currency": "INR" },
      "status": "under_review",
      "submittedAt": "2026-07-12T14:22:00Z"
    }
  ],

  "profileCompletion": {
    "completedSections": 3,
    "totalSections": 5,
    "percentage": 60,
    "sections": [
      { "id": "basic",     "label": "Basic Information",  "isComplete": true,  "route": "/vendor-profile/basic" },
      { "id": "documents", "label": "Business Documents", "isComplete": true,  "route": "/vendor-profile/documents" },
      { "id": "services",  "label": "Services Offered",   "isComplete": true,  "route": "/vendor-profile/services" },
      { "id": "portfolio", "label": "Portfolio",          "isComplete": false, "route": "/vendor-profile/portfolio" },
      { "id": "bank",      "label": "Bank Details",       "isComplete": false, "route": "/vendor-profile/bank" }
    ]
  }
}
```

---

## 3. Field-by-field

### `stats`

| Field | Definition | Query |
|---|---|---|
| `openTenders` | Open tenders **matching this vendor's `serviceCapabilities` and `serviceAreas`** that they are eligible for | Not a global count — see below |
| `myBids` | Bids in a live state (`submitted`, `under_review`, `shortlisted`) | Excludes `draft`, `withdrawn`, terminal states |
| `wonBids` | Bids with `status = 'awarded'`, all time | |
| `activeProjects` | Awarded bids whose work is not yet complete | **Needs a definition — see §7** |

**`openTenders` must be the matched count, not all open tenders.** The card sits next to "My Bids" and reads as *your* opportunities. A global count would show 400 and mean nothing. Use the GIN index on `service_capabilities`.

### `opportunities[]`

Maps `TenderOpportunity` (`vendor-dashboard.model.ts:4`) with three additions:

- **`tenderNumber`** — the frontend currently shows only the title; a human reference is needed for phone/email support.
- **`hasBid`** — lets the card show "Bid submitted" instead of inviting a duplicate. The current UI has no way to know, so a vendor can click into a tender they have already bid on.
- **`budget` is nullable** — `PublishedTender.budgetVisibility` may be `hide`. **Omit the numbers server-side; do not send them with a flag.** A hidden budget that ships in the payload is visible in devtools.

`deadline` drives `deadlineLabel()`/`isUrgent()` (`shared/utils/deadline.util.ts`). `isUrgent` is **also** computed server-side because the threshold is a business rule (≤ 3 days) that the tender browse screen and any notification job must agree on.

> Note the IST boundary: `2026-07-26T18:29:59Z` is end-of-day 26 July in Asia/Kolkata. Deadlines are set in IST and stored UTC.

### `recentBids[]`

Maps `VendorBid` (`vendor-dashboard.model.ts:16`) — **with a status correction.**

The frontend declares:
```ts
status: 'pending' | 'under-review' | 'accepted' | 'rejected';   // hyphen
```

But `BidStatus` in `vendor.model.ts:74` — the canonical bid type used by every other vendor screen — declares:
```ts
'draft' | 'submitted' | 'under_review' | 'shortlisted' | 'awarded' | 'rejected' | 'withdrawn'   // underscore
```

**Two problems:** `under-review` vs `under_review`, and `pending`/`accepted` which do not exist in `BidStatus` at all.

**The API returns canonical `BidStatus`.** The dashboard model must be corrected to import `BidStatus` rather than redeclaring it. The shared `app-status-badge` already normalises hyphens to underscores, so this renders correctly today **by accident** — the badge would have shown a raw fallback for `pending`/`accepted` otherwise.

### `profileCompletion`

The frontend derives `percentage` from the checklist so the ring and caption cannot disagree — that was bug BG6 (ring said 75%, caption said "2 of 5"). **The API sends all three anyway**, computed from the same source, so the same invariant holds server-side.

`isComplete` rules — these belong to the backend because they gate verification:

| Section | Complete when |
|---|---|
| `basic` | `businessName`, `businessType`, `gstNumber`, `panNumber`, `yearEstablished` **and** `primaryContactPerson`, `phone`, `registeredAddress`, `city`, `state`, `pinCode` |
| `documents` | `businessCertificate` **and** `gstCertificate` uploaded (trade licence and insurance optional) |
| `services` | `serviceCapabilities` and `serviceAreas` both non-empty |
| `portfolio` | ≥ 1 portfolio entry (`vendor_portfolio_entries`) |
| `bank` | All four `bankDetails` fields present |

> **Reconciled 2026-07-26.** This table originally listed only the five business-identity fields for `basic`, while `computeProfileSections()` on the frontend also required the six contact fields. The **contact fields are included** — a profile with no phone or address is not reviewable — and `Vendor.GetProfileCompletion()` implements exactly this list. The two sides now agree.

> ⚠️ **All five `route` values are dead links.** `/vendor-profile/*` is not a registered route and the `**` wildcard bounces users to the homepage — see [UI_ISSUES.md §1](../UI_ISSUES.md). The API returns them for forward-compatibility; **the screens must be built before this widget is useful.** It is the dashboard's primary CTA and currently every row of it dead-ends.

---

## 4. Supporting endpoints

The dashboard itself needs only the aggregate. These back the links out of it, and are specified here because they share shapes:

### `GET /api/tenders?matched=true&limit=20&cursor=…`

Full opportunity list (E2 `/vendor/tenders`). Same `opportunities[]` item shape, cursor-paginated, plus filters (`category`, `location`, `closingSoon`) and facet counts for the filter sidebar.

### `GET /api/bids/mine?status=…&limit=20&cursor=…`

Full bid list (E5 `/vendor/bids`). Same `recentBids[]` item shape.

### `GET /api/vendors/me/profile-completion`

Just the `profileCompletion` block, for cheap refresh after the vendor edits a section without refetching the dashboard.

---

## 5. Performance

The aggregate spans four subject areas. Target **p95 < 300 ms**.

```
stats.openTenders   → COUNT over tenders matching capabilities/areas   ← most expensive
stats.myBids        → COUNT bids WHERE vendor_id = ? AND status IN (…)
stats.wonBids       → COUNT bids WHERE vendor_id = ? AND status='awarded'
stats.activeProjects→ COUNT awards WHERE vendor_id = ? AND NOT complete
opportunities       → SELECT … LIMIT 5, ordered by deadline
recentBids          → SELECT … LIMIT 5, ordered by submitted_at DESC
profileCompletion   → single vendor row + document rows
```

- Run the four counts as one query with `FILTER` clauses, not four round trips.
- `hasBid` on each opportunity: resolve with one `WHERE tender_id = ANY(…)` over the 5 ids, **not** N queries.
- Index: `tenders (status, deadline)`, `bids (vendor_id, status)`, `vendors USING GIN (service_capabilities)`.
- Implement as a single CQRS query slice (`Features/Vendors/Queries/GetVendorDashboard/`) following the existing handler pattern.
- Cache `stats` for ~60 s per vendor if the matched-tender count proves slow. The lists must stay fresh — a stale "you have not bid" on a tender the vendor just bid on is worse than a stale count.

---

## 6. Frontend changes required

| # | Change | Why |
|---|---|---|
| 1 | `VendorBid.status` → import `BidStatus` from `vendor.model.ts` | Removes the hyphen/underscore split and the two non-existent statuses |
| 2 | Replace mock signals with one HTTP call | `loadDashboardData()` currently populates from local mocks |
| 3 | Handle `403 vendor-not-verified` → `/verification-pending` | Currently the guard checks locally |
| 4 | Show "Bid submitted" when `hasBid` | Stops vendors re-entering a tender they have bid on |
| 5 | Handle `budget: null` | Template assumes a budget exists |
| 6 | Add loading + error states | Dashboard has no error path today |
| 7 | Build `/vendor-profile/*` | Five dead links ([UI_ISSUES.md §1](../UI_ISSUES.md)) |

---

## 7. Open questions

1. **What is an "active project"?** No entity models post-award work. Options: (a) derive from `awarded` bids without a completion flag — needs an `awards` table with status; (b) drop the KPI until project tracking exists. **Recommend (a)** — a minimal `awards` table is needed for the evaluation flow regardless.

2. ~~**Portfolio is not modelled.**~~ ✅ **Resolved 2026-07-26.** Modelled as `VendorPortfolioEntry` — title, description, year, optional client name. Deliberately no photos in v1: images need the B10 upload path, and the section's purpose (evidence of comparable past work) is served by text. 100% completion is now reachable.

3. **How is `rating` calculated?** `VendorDashboardStats.rating` is optional and nothing produces it. Needs a review mechanism (requester rates vendor post-completion) or removal.

4. **Tender matching precision.** Is `openTenders` matched on `serviceCapabilities` **and** `serviceAreas`, or capabilities only? Recommend both — a Delhi vendor should not see Chennai tenders in their count. Also decide whether eligibility criteria (insurance, bond capability, years of experience — `TenderEligibilityCriteria`) filter the count or only the detail view. **Recommend filtering the count too**, otherwise the number promises work the vendor cannot bid on.

5. **Should `pending` vendors see a read-only dashboard?** Currently they are hard-blocked. Letting them browse tenders (without bidding) would show the value of finishing verification. Product call.
