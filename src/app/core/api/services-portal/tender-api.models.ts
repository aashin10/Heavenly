/**
 * Wire types for the .NET vendor-facing tender API (backend B2.5).
 */
import { BidStatus, ServiceCategory } from '../../models/service.model';

/**
 * The budget as a vendor is allowed to see it. Under `hide` this whole object
 * is absent — the backend has no field to leak, not just a blanked one.
 */
export interface TenderBudgetDto {
  exact: number | null;
  min: number | null;
  max: number | null;
}

export interface TenderEligibilityDto {
  certificationsRequired: boolean;
  certificationDetails: string | null;
  insuranceRequired: boolean;
  insuranceMinCoverage: string | null;
  bondCapabilityRequired: boolean;
  bondMinAmount: string | null;
  regionalPresenceRequired: boolean;
  experienceRequired: boolean;
  minimumExperienceYears: number | null;
  customCriteria: string | null;
  hasAnyRequirement: boolean;
}

export interface TenderAttachmentDto {
  id: string;
  fileName: string;
  fileUrl: string;
  contentType: string | null;
  fileSizeBytes: number | null;
  uploadedAt: string;
}

/** A clarification as published to bidders — the asker is never identified. */
export interface TenderClarificationDto {
  id: string;
  question: string;
  status: string;
  answer: string | null;
  askedAt: string;
  answeredAt: string | null;
}

/** Whether this vendor may bid, and everything stopping them if not. */
export interface TenderEligibilityResultDto {
  eligible: boolean;
  reasons: string[];
}

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

/** One tender in full, as a vendor sees it — `GET /api/tenders/{id}`. */
export interface VendorTenderDto {
  id: string;
  tenderNumber: string;
  title: string;
  category: ServiceCategory;
  serviceId: string;
  scopeSummary: string;
  detailedScope: string | null;
  commercialStructure: string | null;
  technicalRequirements: string[];
  tags: string[];
  location: string | null;
  city: string;
  state: string | null;
  budget: TenderBudgetDto | null;
  budgetVisibility: string;
  expectedTimeline: string | null;
  paymentStructure: string | null;
  warrantyExpectation: string | null;
  tenderType: string;
  status: string;
  bidWindowStart: string | null;
  bidWindowEnd: string | null;
  isAcceptingBids: boolean;
  isUrgent: boolean;
  eligibility: TenderEligibilityDto;
  eligibilityResult: TenderEligibilityResultDto | null;
  attachments: TenderAttachmentDto[];
  clarifications: TenderClarificationDto[];
  publishedAt: string | null;
  myBid: MyBidSummaryDto | null;
}

/** One row of the vendor's tender browse — `GET /api/tenders`. */
export interface TenderOpportunityDto {
  id: string;
  tenderNumber: string;
  title: string;
  category: ServiceCategory;
  serviceId: string;
  city: string;
  state: string | null;
  budget: TenderBudgetDto | null;
  budgetVisibility: string;
  deadline: string | null;
  isUrgent: boolean;
  isAcceptingBids: boolean;
  clarificationCount: number;
  bidCount: number;
  hasBid: boolean;
  publishedAt: string | null;
}

export interface TenderListDto<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface BrowseTendersParams {
  category?: ServiceCategory;
  city?: string;
  search?: string;
  closingSoon?: boolean;
  includeUnmatched?: boolean;
  page?: number;
  pageSize?: number;
}
