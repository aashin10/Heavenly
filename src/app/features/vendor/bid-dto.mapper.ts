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
