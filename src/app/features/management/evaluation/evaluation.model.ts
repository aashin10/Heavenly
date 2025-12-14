// ==================== TENDER STATUS TYPES ====================
export type EvaluationPhase = 
  | 'accepting_bids' 
  | 'bid_closed' 
  | 'technical_review' 
  | 'commercial_review' 
  | 'shortlisted' 
  | 'awarded' 
  | 'cancelled';

export type TechnicalStatus = 'pending' | 'qualified' | 'disqualified';
export type CommercialStatus = 'sealed' | 'opened' | 'evaluated';
export type NegotiationStatus = 'not_started' | 'in_progress' | 'completed';

// ==================== DASHBOARD MODELS ====================
export interface TenderStats {
  activeTenders: number;
  receivingBids: number;
  readyForEvaluation: number;
  underEvaluation: number;
  awarded: number;
  totalBidsReceived: number;
}

export interface LiveTender {
  id: string;
  tenderId: string;
  title: string;
  category: string;
  categoryLabel: string;
  publishedAt: string;
  bidWindowStart: string;
  bidWindowEnd: string;
  totalBids: number;
  technicalCompliant: number;
  technicalRejected: number;
  commercialEvaluated: number;
  shortlistedCount: number;
  awardedBidId: string | null;
  evaluationPhase: EvaluationPhase;
  requesterName: string;
  requesterId: string;
  budgetEstimate: number;
}

// ==================== BID EVALUATION MODELS ====================
export interface EvaluationBid {
  id: string;
  bidId: string;
  tenderId: string;
  vendorId: string;
  vendorCode: string;
  vendorDisplayName: string;
  companyName: string;
  
  // Submission details
  submittedAt: string;
  
  // Technical Proposal
  companyProfile: string;
  relevantExperience: string;
  yearsOfExperience: number;
  similarWorkReferences: WorkReference[];
  technicalApproach: string;
  manpowerPlan: string;
  equipmentPlan: string;
  deliveryTimeline: string;
  deviations: string;
  location: string;
  
  // Documents
  documents: BidDocument[];
  
  // Commercial Proposal (sealed until technical complete)
  totalPrice: number;
  priceBreakdown: PriceBreakdownItem[];
  taxesAndDuties: string;
  paymentTerms: string;
  validityPeriod: string;
  warrantyPricing: string;
  amcPricing: string;
  
  // Evaluation Status
  technicalStatus: TechnicalStatus;
  commercialStatus: CommercialStatus;
  shortlisted: boolean;
  
  // Technical Evaluation Results
  technicalEvaluation?: TechnicalEvaluation;
  technicalScore: number;
  technicalNotes: string;
  
  // Commercial Evaluation Results
  valueScore: number;
  
  // Negotiation
  negotiationStatus: NegotiationStatus;
  negotiationNotes: NegotiationNote[];
  originalBidAmount: number;
  negotiatedAmount: number | null;
  
  // Final Status
  status: 'submitted' | 'under_review' | 'shortlisted' | 'awarded' | 'rejected';
  rejectionReason?: string;
  disqualificationReason?: string;
}

export interface WorkReference {
  clientName: string;
  projectType: string;
  contactPerson: string;
  phone: string;
}

export interface BidDocument {
  id: string;
  name: string;
  type: string;
  size: number;
  uploaded: boolean;
  url?: string;
}

export interface PriceBreakdownItem {
  description: string;
  amount: number;
}

// ==================== TECHNICAL EVALUATION ====================
export interface TechnicalEvaluation {
  id: string;
  bidId: string;
  complianceScore: number;
  experienceRating: number;
  technicalApproachRating: number;
  timelineRating: number;
  overallScore: number;
  notes: string;
  status: 'draft' | 'submitted';
  evaluatedBy: string;
  evaluatedAt: string;
}

export interface TechnicalChecklist {
  meetsExperience: boolean;
  hasReferences: boolean;
  timelineAcceptable: boolean;
  hasCertifications: boolean;
  documentsComplete: boolean;
}

// ==================== NEGOTIATION ====================
export interface NegotiationNote {
  id: string;
  bidId: string;
  text: string;
  negotiatedAmount?: number;
  channel: 'phone' | 'email' | 'meeting' | 'video' | 'platform';
  createdBy: string;
  createdAt: string;
}

// ==================== AWARD ====================
export interface AwardData {
  tenderId: string;
  selectedBidId: string;
  awardJustification: string;
  contractAmount: number;
  paymentTerms: string;
  startDate: string;
  completionDate: string;
  notifyWinner: boolean;
  notifyOthers: boolean;
  notifyRequester: boolean;
  awardedBy: string;
  awardedAt: string;
}

export interface AwardResult {
  success: boolean;
  contractId: string;
  tenderId: string;
  awardedBidId: string;
  message: string;
}

// ==================== COMPARISON ====================
export interface BidComparison {
  bidId: string;
  vendorCode: string;
  vendorName: string;
  technicalScore: number;
  bidAmount: number;
  paymentTerms: string;
  warranty: string;
  validityPeriod: string;
  valueScore: number;
  shortlisted: boolean;
}

// ==================== DISQUALIFICATION ====================
export type DisqualificationReason = 
  | 'non_compliance'
  | 'missing_documents'
  | 'inadequate_experience'
  | 'unrealistic_timeline'
  | 'eligibility_issue'
  | 'other';

export interface DisqualifyData {
  bidId: string;
  reason: DisqualificationReason;
  explanation: string;
  notifyVendor: boolean;
}
