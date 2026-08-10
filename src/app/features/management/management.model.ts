// ==================== JOB MANAGEMENT ====================
export interface Job {
  id: string;
  title: string;
  company: string;
  domain: string;
  location: string;
  type: string;
  salary: string;
  description: string;
  requirements: string;
  postedDate: string;
  status: JobStatus;
  postedBy: string;
}

export type JobStatus = 'pending' | 'approved' | 'rejected';

export type JobFilter = 'all' | 'pending' | 'approved' | 'rejected';

export interface JobStatistics {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}

// ==================== SERVICE REQUEST MANAGEMENT ====================
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

export type ServiceRequestFilter = 
  | 'all' 
  | 'pending' 
  | 'under_review'
  | 'high_priority' 
  | 'technical' 
  | 'needs_attention' 
  | 'incomplete'
  | 'approved'
  | 'published';

// These four are declared once, in core/models/service.model.ts, and re-exported
// here so this file stays the single import for management screens.
//
// `RequesterType` is the reason this matters rather than being tidiness: the
// copy that used to live here said `'organization'` where the canonical type
// (and the server, and the signup flow) say `'large_organization'`. Any
// management screen that compared against it was comparing against a value the
// API never sends.
//
// `export type {...} from '...'` alone re-exports these names but does not
// bind them into this file's own scope, and the interfaces below (ServiceRequest,
// TenderDocument, ReviewFormData) reference them locally. So they're imported
// here too, not just re-exported.
import type {
  ServiceCategory,
  RequesterType,
  BudgetVisibility,
  TenderType,
} from '../../core/models/service.model';
export type {
  ServiceCategory,
  RequesterType,
  BudgetVisibility,
  TenderType,
} from '../../core/models/service.model';

export interface ServiceRequest {
  id: string;
  requestNumber: string;
  serviceId: string;
  serviceName: string;
  category: ServiceCategory;
  status: ServiceRequestStatus;
  
  // Requester info
  requesterId: string;
  requesterName: string;
  requesterEmail: string;
  requesterPhone: string;
  requesterType: RequesterType;
  
  // Location
  location: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  
  // Request details
  title: string;
  description: string;
  urgency: 'low' | 'medium' | 'high' | 'urgent';
  
  // Technical details (varies by category)
  technicalDetails?: Record<string, unknown>;
  
  // Commercial
  budgetMin?: number;
  budgetMax?: number;
  budgetCurrency: string;
  preferredPaymentTerms?: string;
  
  // Timeline
  preferredStartDate?: string;
  preferredEndDate?: string;
  flexibleDates: boolean;
  
  // Files
  attachments: ServiceRequestAttachment[];
  
  // Metadata
  submittedAt: string;
  lastUpdatedAt: string;
  
  // Flags
  hasWarnings: boolean;
  warnings: RequestWarning[];
  
  // Review info
  reviewedBy?: string;
  reviewedAt?: string;
  internalNotes?: string;
}

export interface ServiceRequestAttachment {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
  url: string;
}

export interface RequestWarning {
  type: 'low_clarity' | 'tight_budget' | 'tight_timeline' | 'missing_documents' | 'incomplete_info';
  message: string;
  severity: 'info' | 'warning' | 'error';
}

export interface ServiceRequestDashboardStats {
  pendingReview: number;
  underReview: number;
  approved: number;
  liveTenders: number;
  changesRequired: number;
  totalThisMonth: number;
}

// ==================== AI GENERATED DRAFT ====================
export interface AIGeneratedDraft {
  tenderTitle: string;
  scopeSummary: string;
  commercialStructure: string;
  tags: AITags;
  suggestedBidWindow: {
    start: string;
    end: string;
  };
  identifiedGaps: string[];
  clarityScore: number;
  suggestedEligibility: string[];
}

export interface AITags {
  complexityLevel: 'low' | 'medium' | 'high';
  riskLevel: 'low' | 'medium' | 'high';
  expectedVendorType: string;
}

// ==================== TENDER DOCUMENT ====================
export interface TenderDocument {
  tenderId: string;
  requestId: string;
  title: string;
  issueDate: string;
  category: string;
  
  scopeSummary: string;
  commercialStructure: string;
  
  sections: TenderSection[];
  
  bidWindowStart: string;
  bidWindowEnd: string;
  
  eligibilityCriteria: TenderEligibilityCriteria;
  budgetVisibility: BudgetVisibility;
  tenderType: TenderType;
  
  attachments?: TenderAttachment[];
  
  status: 'draft' | 'approved' | 'published' | 'closed';
  publishedAt?: string;
  publishedBy?: string;
}

export interface TenderAttachment {
  name: string;
  size: string;
  url: string;
}

export interface TenderEligibilityCriteria {
  certifications: { required: boolean; details?: string };
  insurance: { required: boolean; minCoverage?: string };
  bondCapability: { required: boolean; minAmount?: string };
  regionalPresence: { required: boolean; regions?: string[] };
  experienceYears: { required: boolean; minimum?: number };
}

export interface TenderSection {
  title: string;
  content: string;
  order: number;
}

export interface ReviewEligibilityCriteria {
  minExperience: boolean;
  minExperienceYears?: number;
  certifications: boolean;
  requiredCertifications?: string[];
  financialCapacity: boolean;
  previousWork: boolean;
  customCriteria?: string[];
}

// ==================== REVIEW FORM ====================
export interface ReviewFormData {
  tenderTitle: string;
  scopeSummary: string;
  commercialStructure: string;
  bidWindowStart: string;
  bidWindowEnd: string;
  budgetVisibility: BudgetVisibility;
  tenderType: TenderType;
  eligibilityCriteria: ReviewEligibilityCriteria;
  internalNotes: string;
}

// ==================== CLARIFICATIONS ====================
export interface Clarification {
  id: string;
  tenderId: string;
  vendorId: string;
  vendorName: string; // Anonymized in display
  question: string;
  askedAt: string;
  status: 'pending' | 'answered' | 'forwarded';
  answer?: string;
  answeredBy?: string;
  answeredAt?: string;
  visibleToAllVendors: boolean;
}

// ==================== PUBLISH SETTINGS ====================
export interface PublishSettings {
  notifyVendors: boolean;
  notifyRequester: boolean;
  inAppNotifications: boolean;
  scheduledPublishDate?: string;
}

// ==================== MANAGEMENT SETTINGS ====================
export interface ManagementSettings {
  autoApproveQuickServices: boolean;
  autoApproveLowRisk: boolean;
  defaultBidWindowDays: number;
  notifyOnNewRequest: boolean;
  notifyOnClarificationRequest: boolean;
  standardClauses: string;
}
