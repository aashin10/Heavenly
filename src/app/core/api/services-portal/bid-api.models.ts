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
