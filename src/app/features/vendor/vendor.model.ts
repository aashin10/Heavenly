// ==================== TENDER MODELS ====================
export type TenderCategory = 'quick_service' | 'mid_complexity' | 'technical';
export type BudgetVisibility = 'show_exact' | 'show_range' | 'hide';
export type TenderStatus = 'published' | 'closed' | 'cancelled' | 'awarded';

export interface PublishedTender {
  id: string;
  tenderId: string;
  title: string;
  category: TenderCategory;
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
export type BidStatus = 
  | 'draft' 
  | 'submitted' 
  | 'under_review' 
  | 'shortlisted' 
  | 'awarded' 
  | 'rejected' 
  | 'withdrawn';

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

export interface Bid {
  bidId: string;
  tenderId: string;
  tenderTitle: string;
  tenderClosingDate: string;
  vendorId: string;
  
  // Proposals
  technicalProposal: TechnicalProposal;
  commercialProposal: CommercialProposal;
  bidAmount: number;
  
  // Status
  status: BidStatus;
  submittedAt: string;
  updatedAt?: string;
  
  // Rejection reason (if applicable)
  rejectionReason?: string;
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
  bidId?: string;
}
