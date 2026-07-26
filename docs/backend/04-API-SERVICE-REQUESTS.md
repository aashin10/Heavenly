# API — Service Request Creation & Preview

**Screens:** D2 `/service-request/new` · D3 `/service-request/preview` (plus the drafts widget on D1)

**Frontend sources:** `core/services/draft.service.ts`, `core/services/service-request.service.ts`, `features/service-request/service-request.model.ts` (`FORM_CONFIGS`), the three form components under `features/service-request/forms/`, `preview/service-request-preview.page.ts`, `shared/utils/form-formatting.util.ts`

Read [README.md](README.md) for conventions and [03-EXISTING-BACKEND-REVIEW.md](03-EXISTING-BACKEND-REVIEW.md) for backend state.

> **Status: entirely new.** No `ServiceRequest` entity exists in the backend. This is the entry point of the request → tender → bid pipeline, so the shapes here cascade into F2/F3 (admin review/publish) and everything downstream.

---

## 1. How the frontend actually works

The flow, as built:

```
/services (catalogue) ──"Request"──> /service-request/new?serviceId=…&category=…
                                          │  multi-step wizard (4 or 5 steps by category)
                                          │  autosave every 30 s + on step change → draft
                                          ▼
                                     /service-request/preview?draftId=…
                                          │  read-back of all sections, edit links back into steps
                                          ▼  Submit
                                     requester dashboard (request now in "Recent Requests")
```

Key behaviours the API must preserve:

1. **Drafts are the working state.** The wizard never holds unsaved data for more than 30 seconds (`interval(30000)` autosave) and also saves on every step transition. The preview page renders **from the draft**, not from in-memory form state.
2. **One draft per service per user.** `getDraftByServiceId` is the restore lookup — starting "AC Servicing" again offers to resume the existing AC Servicing draft (`DraftRestoreModal`), not create a second one.
3. **Drafts expire after 7 days** (`DRAFT_RETENTION_DAYS`), with `daysRemaining` surfaced in the restore modal and dashboard.
4. **Submission is atomic**: validate → create request `submitted` → delete the source draft. The current mock does exactly this and the API must too, or a crash between steps leaves both a request and a stale draft.
5. **`formData` is schema-per-category.** Three different wizards produce three different shapes under the same field (§4).

### Today's mock IDs

- Draft: `draft_<ts>_<rand>` (client-generated)
- Request: `REQ-<ts36>-<rand4>`, e.g. `REQ-LX2K9F-A7QZ`
- Requester: **hard-coded `'temp-requester-id'`** in `service-request-preview.page.ts:94` — submission is not actually tied to the session yet. The API derives the requester from the token; this constant must go.

---

## 2. Endpoints

### `GET /api/service-requests/drafts`

Drafts list for the dashboard widget (D1) and restore checks.

**Auth:** required · role `service_requester`. Returns only the caller's drafts.

**200**
```jsonc
{
  "items": [
    {
      "id": "0190f6a1-…",
      "serviceId": "ac-servicing",
      "serviceName": "AC Servicing",
      "category": "quick_service",
      "currentStep": 2,
      "totalSteps": 4,
      "lastSaved": "2026-07-19T10:42:00Z",
      "createdAt": "2026-07-18T09:15:00Z",
      "expiresAt": "2026-07-25T09:15:00Z"
    }
  ]
}
```

List items exclude `formData` — the dashboard renders name/step/expiry only. No pagination: the one-draft-per-service rule caps the list at the size of the catalogue.

---

### `PUT /api/service-requests/drafts/{serviceId}`

Create-or-update, keyed by service — this **is** the one-draft-per-service rule, enforced by the URL rather than by client-side lookup. The autosave loop calls it every 30 s while the wizard is dirty.

**Auth:** required · role `service_requester`.

```jsonc
{
  "serviceName": "AC Servicing",
  "category": "quick_service",
  "currentStep": 2,
  "totalSteps": 4,
  "formData": { /* category schema — see §4. Stored opaquely, not validated */ }
}
```

**200**
```jsonc
{
  "id": "0190f6a1-…",
  "lastSaved": "2026-07-19T10:42:30Z",
  "expiresAt": "2026-07-26T10:42:30Z"
}
```

**Design decisions**

- **`formData` is stored as `jsonb`, unvalidated.** A draft is allowed to be half-finished and invalid — that is what a draft is. Validation happens once, at submit. Cap the payload (256 KB) and reject non-object roots; nothing more.
- **Autosave refreshes expiry** (`expiresAt = lastSaved + 7 days`), matching the current client behaviour where saving pushes the window out. An actively-edited draft never expires mid-edit.
- **Last-write-wins is acceptable.** Two tabs editing the same draft is the same person; a 30-second autosave cadence makes conflict resolution overkill. Do not add ETags here.
- Server timestamps only — the client clock never sets `lastSaved`/`expiresAt`.

**404** if `serviceId` is not in the catalogue. **413** if `formData` exceeds the cap.

---

### `GET /api/service-requests/drafts/{serviceId}`

Restore lookup when the wizard opens (`getDraftByServiceId`) — includes full `formData` for `patchValue`.

**200** → full draft including `formData`, plus `daysRemaining` (integer, server-computed, drives the restore modal).
**404** → no draft, or expired (expired drafts are deleted on read, exactly as `DraftService.getDraft` does today).

---

### `DELETE /api/service-requests/drafts/{serviceId}`

"Start fresh" in the restore modal, and cleanup. **204.** Idempotent — deleting a missing draft is still 204.

---

### `POST /api/service-requests`

The submission — D3's Submit button.

**Auth:** required · role `service_requester`. **Idempotency-Key: required** — the double-submit risk is real (1.5 s of latency today, a spinner, and an eager user).

```jsonc
{
  "serviceId": "ac-servicing",
  "category": "quick_service",
  "formData": { /* full wizard output, category schema */ }
}
```

`serviceName` is **not** accepted — the server resolves it from the catalogue. Client-supplied display names end up in admin screens and vendor tenders; do not trust them.

**201**
```jsonc
{
  "id": "0190f7c2-…",
  "requestNumber": "SR-2026-00143",
  "status": "submitted",
  "submittedAt": "2026-07-19T11:03:00Z",
  "serviceName": "AC Servicing",
  "category": "quick_service"
}
```

**Server-side transaction:** validate `formData` against the category schema (§4) → insert request (`submitted`) → delete the caller's draft for that `serviceId` → enqueue admin notification (F1 review queue). All or nothing.

**Errors**

| Status | When |
|---|---|
| `422` | Schema validation failed. `errors` keyed by **dotted form path** (`step2.equipmentList.0.type`) so the frontend can route the user back to the right wizard step — the step number is derivable from the first path segment |
| `409` | Idempotency-Key replay → return the original `201` body, not an error |
| `404` | `serviceId` not in catalogue |

**Request number:** `SR-<year>-<sequence>` from a Postgres sequence, not derived from timestamps (the current `REQ-LX2K9F-A7QZ` mock format is unreadable over the phone — this was the same lesson as `tenderNumber` in [02](02-API-VENDOR-DASHBOARD.md)).

---

### `GET /api/service-requests/mine?status=…&limit=…&cursor=…`

Requester's own requests — D1's "Recent Requests" and the eventual history screen (currently one of the dead quick-action routes, [UI_ISSUES.md §1](../UI_ISSUES.md)).

**200** → paginated list of `{ id, requestNumber, serviceName, category, status, submittedAt, updatedAt }`. Status values: the `RequestStatus` union from `service-request.service.ts` (`submitted | under_review | changes_required | approved | published | closed | cancelled` — `draft` is not a request status here; drafts live in their own endpoint).

---

## 3. File uploads inside the wizard

Three fields carry files: `issuePhoto` (quick), `referenceImages` (mid), and the technical form's site documents. Today they hold browser `File` objects that go nowhere — `formData` serialised to JSON silently drops them.

Same pattern as vendor documents ([01 §file-upload](01-API-AUTH.md)): sign → PUT to GCS → reference. Inside `formData`, an uploaded file is stored as its reference:

```jsonc
"issuePhoto": { "uploadId": "0190f8d3-…", "fileName": "ac-unit.jpg" }
```

Upload purpose `service_request_attachment`; images ≤ 5 MB (`[maxSize]="5"` in the component today), PDF allowed for technical documents. Orphan uploads (drafts abandoned) are cleaned by the same scheduled job that purges expired drafts.

---

## 4. `formData` schemas

One schema per category, matching the reactive-form structure **exactly** — keys are the wizard's `stepN` groups. The backend validates these **only at submit**. Field lists verified against the three components' `fb.group` definitions.

### `quick_service` (4 steps)

```jsonc
{
  "step1": {
    "serviceType": "Repair",              // required; one of the form's serviceTypes
    "issueDescription": "…",              // required, 10–500 chars
    "issuePhoto": { "uploadId": "…" }     // optional
  },
  "step2": {
    "equipmentList": [                     // ≥ 1 entry
      { "type": "Split AC", "brand": "LG", "model": "", "quantity": 1 }  // type+quantity required, quantity ≥ 1
    ],
    "additionalNotes": ""
  },
  "step3": {
    "address": "…", "landmark": "",
    "pincode": "110027",                   // required, 6 digits
    "contactName": "…", "contactPhone": "…", "preferredTime": "…"   // required (per form)
  },
  "step4": {
    "budgetRange": "₹1,000 - ₹2,500",     // required; one of budgetRanges
    "urgency": "Within 3 days",           // required; one of urgencyLevels
    "paymentMode": "…",                   // required
    "specialRequests": ""
  }
}
```

### `mid_complexity` (5 steps)

```jsonc
{
  "step1": { "serviceSubType": "…", "serviceSubTypeOther": "", "problemDescription": "…" /* 20–1000 */, "urgencyLevel": "…", "propertyType": "…", "propertyTypeOther": "" },
  "step2": { "numberOfRooms": 1 /* ≥1 */, "totalArea": "…", "areaUnit": "sqft", "floorNumber": "", "hasElevatorAccess": false, "parkingAvailable": false, "additionalAreas": [{ "name": "Balcony", "area": "50 sqft" }] },
  "step3": { "materialPreference": "…", "qualityLevel": "…", "brandPreferences": "", "colorPreferences": "", "finishType": "", "referenceImages": [{ "uploadId": "…" }] },
  "step4": { "occupancyStatus": "…", "furnitureMovingRequired": false, "coveringRequired": false, "accessRestrictions": "", "petInHouse": false, "childrenInHouse": false },
  "step5": { "estimatedBudget": "…", "budgetIncludes": "…", "paymentPreference": "…", "expectedStartDate": "…", "flexibleOnDates": false, "mustCompleteBy": "" }
}
```

### `technical` (5 steps)

```jsonc
{
  "step1": { "requestTitle": "…" /* 10–100 */, "equipmentType": "…", "equipmentTypeOther": "", "equipmentCapacity": "…", "make": "", "model": "" },
  "step2": { "siteType": "…", "siteAddress": "…", "city": "…", "state": "…", "pincode": "110027", "primaryContactName": "…" /* + contact fields */ },
  "step3": { "scopeOfWork": "…" /* 100–5000 */, "technicalRequirements": ["…"], "voltageRequirement": "", "loadCapacity": "", "environmentConditions": "", "safetyRequirements": "" },
  "step4": { "estimatedBudget": "…", "budgetFlexibility": "…", "quotationRequired": true, "preferredQuotations": 3 /* 1–10 */, "preferredPaymentTerms": "", "gstRegistered": false },
  "step5": { "operationalConstraints": "", "workingHoursRestriction": false, "allowedWorkingHours": "", "noiseRestrictions": false, "hazardousMaterials": false, "hazardousMaterialsDescription": "", "customFields": [{ "name": "…", "value": "…" }] }
}
```

**Implementation note (.NET):** don't build 60 DTO properties. Store `formData` as `jsonb`; validate with one **FluentValidation validator per category** walking `JsonDocument`, sharing rules with the frontend's `Validators` (same lengths, same patterns). The admin review screen (F2) reads the same structure via `formatFormData`'s section layout, so the schema is already a de-facto contract between two frontend screens — the API just makes it explicit.

> **Budget fields are display strings** (`"₹1,000 - ₹2,500"`), not amounts — they are preset ranges, not money. Do not convert them to `Money`; the review screen shows them verbatim. Only tenders (F3) carry real amounts.

---

## 5. Data model (Postgres)

```sql
CREATE TABLE service_request_drafts (
  id            UUID PRIMARY KEY,
  requester_id  UUID NOT NULL REFERENCES service_requesters(id),
  service_id    TEXT NOT NULL,
  category      TEXT NOT NULL,
  current_step  INT  NOT NULL DEFAULT 1,
  total_steps   INT  NOT NULL,
  form_data     JSONB NOT NULL DEFAULT '{}',
  last_saved    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL,
  UNIQUE (requester_id, service_id)          -- the one-draft-per-service rule
);

CREATE TABLE service_requests (
  id              UUID PRIMARY KEY,
  request_number  TEXT UNIQUE NOT NULL,      -- SR-2026-00143
  requester_id    UUID NOT NULL REFERENCES service_requesters(id),
  service_id      TEXT NOT NULL,
  service_name    TEXT NOT NULL,             -- snapshot at submit; catalogue names can change
  category        TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'submitted',
  form_data       JSONB NOT NULL,
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON service_requests (requester_id, submitted_at DESC);
CREATE INDEX ON service_requests (status);

CREATE SEQUENCE service_request_seq;         -- feeds request_number per year

-- every status transition; F2's approve/reject/changes-required writes here
CREATE TABLE service_request_events (
  id          UUID PRIMARY KEY,
  request_id  UUID NOT NULL REFERENCES service_requests(id),
  from_status TEXT,
  to_status   TEXT NOT NULL,
  actor_id    UUID,
  note        TEXT,                          -- e.g. the "changes required" message
  at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Draft expiry job:** Cloud Scheduler → authenticated endpoint → `DELETE FROM service_request_drafts WHERE expires_at < now()` + orphaned-upload cleanup. The current client-side cleanup only runs when someone opens the app.

This is the **canonical** `ServiceRequest` — the resolution of the duplicate-model problem ([UI_ISSUES.md §3](../UI_ISSUES.md)). The management screen's flattened view (requester name/phone, location) is a **projection** joining `service_requesters`, not extra columns here; location lives inside `form_data` per category (step3/step2 address blocks).

---

## 6. Frontend changes required

| # | Change | Why |
|---|---|---|
| 1 | `DraftService` → HTTP calls, drop `localStorage` | Drafts survive device changes; expiry enforced server-side |
| 2 | Keep the 30 s autosave cadence, add a dirty check | Don't PUT an unchanged draft every 30 s forever |
| 3 | Delete `requesterId = 'temp-requester-id'` | Server derives the requester from the token |
| 4 | Wire file fields to the sign→upload→reference flow | `File` objects currently vanish in JSON serialisation |
| 5 | Map `422` dotted paths → wizard step + control errors | First path segment (`step2`) identifies the step to return to |
| 6 | Send `Idempotency-Key` on submit | Double-submit protection |
| 7 | ~~Post-submit confirmation route~~ **already fixed** | `/services/request/confirmation` was unregistered (bounced to homepage); submit now lands on the requester dashboard with the request number in the toast |

## 7. Open questions

1. **`changes_required` round-trip — ANSWERED (2026-07-19): yes.** The requester can re-edit and resubmit. Mechanism: `changes_required` clones `form_data` back into a draft (bypassing the one-draft-per-service uniqueness for this case, or replacing the existing draft after confirmation), the request keeps status `changes_required` until a resubmit — `POST /api/service-requests/{id}/resubmit` — replaces its `form_data`, sets `submitted`, and writes a `service_request_events` row. UI lands in Set 2 of [UI_SETS.md](../UI_SETS.md) (request detail page).
2. **Can a requester cancel a submitted request?** `cancelled` exists in the union; no UI triggers it. Recommend allowing cancel while `submitted`/`under_review` only.
3. **Dedicated confirmation screen** — worth building? The dashboard landing works, but a proper confirmation (request number, what happens next, timeline) is better UX. Product call; cheap to add later without API changes.
