// ==================== TENDER MODELS ====================
// BudgetVisibility is declared once, in core/models/service.model.ts. It's
// imported here for local use (PublishedTender.budgetVisibility below) and
// re-exported so vendor.service.ts's `import { BudgetVisibility } from
// './vendor.model'` keeps working — `export type {...} from '...'` alone
// re-exports a name without binding it into this file's own scope.
import type { BidStatus, BudgetVisibility, ServiceCategory } from '../../core/models/service.model';
export type { BidStatus, BudgetVisibility, ServiceCategory } from '../../core/models/service.model';

export type TenderStatus = 'published' | 'closed' | 'cancelled' | 'awarded';

export interface PublishedTender {
  id: string;
  tenderId: string;
  title: string;
  category: ServiceCategory;
  categoryLabel: string;
  
  // Location
  location: string;
  city: string;
  state: string;
  
  // Scope
  scopeSummary: string;
  detailedScope?: string;
  technicalRequirements: string[];
  
  // Budget
  budgetVisibility: BudgetVisibility;
  budgetMin?: number;
  budgetMax?: number;
  budgetExact?: number;
  
  // Timeline
  expectedTimeline: string;
  bidWindowStart: string;
  bidWindowEnd: string;
  publishedAt: string;
  
  // Commercial Terms
  paymentStructure: string;
  warrantyExpectation: string;
  
  // Eligibility
  eligibilityCriteria: string[];
  
  // Tags
  tags: string[];
  serviceType: string;
  
  // Attachments
  attachments: TenderAttachment[];
  
  // Status
  status: TenderStatus;
}

export interface TenderAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
}

export interface TenderClarification {
  id: string;
  tenderId: string;
  vendorId: string;
  question: string;
  askedAt: string;
  status: 'pending' | 'answered';
  answer?: string;
  answeredAt?: string;
  answeredBy?: string;
}

// ==================== BID MODELS ====================
export interface TechnicalProposal {
  companyProfile: string;
  relevantExperience: string;
  similarWorkReferences: WorkReference[];
  technicalApproach: string;
  manpowerPlan: string;
  equipmentPlan: string;
  deliveryTimeline: string;
  deviations: string;
}

export interface CommercialProposal {
  totalPrice: number;
  priceBreakdown: PriceItem[];
  taxesAndDuties: string;
  paymentTerms: string;
  validityPeriod: string;
  warrantyPricing: string;
  amcPricing: string;
}

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

export interface WorkReference {
  clientName: string;
  projectType: string;
  contactPerson: string;
  phone: string;
}

export interface PriceItem {
  description: string;
  amount: number;
}

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  uploadedAt: string;
  url: string;
}

export interface BidDraft {
  tenderId: string;
  formData: Partial<BidFormData>;
  currentStep: number;
  /** Required by `PUT /api/bids/drafts/{tenderId}`, which validates 1..20 and `currentStep <= totalSteps`. */
  totalSteps: number;
  lastSaved: string;
}

export interface BidFormData {
  // Eligibility
  confirmEligibility: boolean;
  
  // Technical
  companyProfile: string;
  relevantExperience: string;
  similarWorkReferences: WorkReference[];
  technicalApproach: string;
  manpowerPlan: string;
  equipmentPlan: string;
  deliveryTimeline: string;
  deviations: string;
  
  // Commercial
  totalPrice: number;
  priceBreakdown: PriceItem[];
  taxesAndDuties: string;
  paymentTerms: string;
  validityPeriod: string;
  warrantyPricing: string;
  amcPricing: string;
}

// ==================== VENDOR STATS ====================
export interface VendorDashboardStats {
  openTenders: number;
  activeBids: number;
  wonBids: number;
  pendingBids: number;
  profileCompletion: number;
  savedTenders: number;
}

export interface ProfileCompletion {
  percentage: number;
  hasBusinessCertificate: boolean;
  hasServiceCapabilities: boolean;
  hasPortfolio: boolean;
  hasBankDetails: boolean;
  hasContactInfo: boolean;
}

export interface UrgentAction {
  type: 'closing_soon' | 'clarification_response' | 'document_expiring';
  tenderId?: string;
  tenderTitle?: string;
  message: string;
  dueDate: string;
}

// ==================== FILTER OPTIONS ====================
export interface FilterOptions {
  serviceTypes: { value: string; label: string }[];
  locations: string[];
  categories: { value: string; label: string }[];
}

export interface TenderFilters {
  serviceTypes: string[];
  locations: string[];
  budgetRange: { min: number; max: number };
  closingSoon: string | null;
  searchQuery: string;
}

// ==================== ELIGIBILITY ====================
export interface EligibilityResult {
  eligible: boolean;
  reasons: string[];
  missingRequirements: string[];
}

export interface BidStatusResult {
  submitted: boolean;
  status?: BidStatus;
  /** Opaque id — used to route to `/vendor/bids/:id`. */
  bidId?: string;
  /** Human reference, for display. */
  bidNumber?: string;
}
