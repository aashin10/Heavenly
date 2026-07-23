/**
 * Service Request and Tender Management System - Data Models
 * Separate from the job portal system with distinct user types and workflows.
 */

// ============================================
// User Types for Service Module
// ============================================

/** Service module user types (separate from job portal users) */
export type ServiceUserType = 'service_requester' | 'vendor' | 'service_admin';

/** Service requester account types */
export type RequesterType = 'individual' | 'sme' | 'large_organization';

/** Vendor business types */
export type VendorBusinessType = 
  | 'individual_contractor'
  | 'partnership'
  | 'private_limited'
  | 'llp'
  | 'others';

// ============================================
// Service Categories
// ============================================

/** Service categories mapping to form complexity */
export type ServiceCategory = 'quick_service' | 'mid_complexity' | 'technical';

/** Service category metadata */
export interface ServiceCategoryInfo {
  id: ServiceCategory;
  label: string;
  badge: string;
  formTime: string;
  indicator: string;
  /** Lucide icon name shown alongside the indicator label. */
  indicatorIcon: string;
  description: string;
}

export const SERVICE_CATEGORIES: Record<ServiceCategory, ServiceCategoryInfo> = {
  quick_service: {
    id: 'quick_service',
    label: 'Quick Services',
    badge: 'Fast & Easy',
    formTime: '5-10 min form',
    indicator: 'Quick Request',
    indicatorIcon: 'zap',
    description: 'Simple service requests with quick turnaround'
  },
  mid_complexity: {
    id: 'mid_complexity',
    label: 'Home & Office Services',
    badge: 'Mid-Complexity',
    formTime: '10-15 min form',
    indicator: 'Guided Form',
    indicatorIcon: 'clipboard-list',
    description: 'Standard service requests with detailed requirements'
  },
  technical: {
    id: 'technical',
    label: 'Industrial & Technical Services',
    badge: 'Engineering Services',
    formTime: 'Detailed specs required',
    indicator: 'Technical Details Needed',
    indicatorIcon: 'ruler',
    description: 'Complex technical services requiring specifications'
  }
};

// ============================================
// Service Types
// ============================================

/** Service type definition */
export interface ServiceType {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: ServiceCategory;
  isPopular?: boolean;
  aiAssisted?: boolean;
}

/** All available services */
export const SERVICES: ServiceType[] = [
  // Quick Services (Category 3)
  {
    id: 'ac-servicing',
    name: 'AC Servicing',
    description: 'Professional AC servicing and maintenance',
    icon: 'air-vent',
    category: 'quick_service',
    isPopular: true
  },
  {
    id: 'appliance-servicing',
    name: 'Appliance Servicing & Repair',
    description: 'Repair and maintenance for home appliances',
    icon: 'wrench',
    category: 'quick_service',
    isPopular: true
  },
  {
    id: 'tools-accessories',
    name: 'Tools & Accessories Supply',
    description: 'Quality tools and accessories for various needs',
    icon: 'hammer',
    category: 'quick_service'
  },

  // Home & Office Services (Category 2)
  {
    id: 'interior-finishing',
    name: 'Interior Finishing',
    description: 'Complete interior finishing solutions',
    icon: 'house',
    category: 'mid_complexity',
    isPopular: true
  },
  {
    id: 'paint-polish',
    name: 'Paint & Polish',
    description: 'Professional painting and polishing services',
    icon: 'paintbrush',
    category: 'mid_complexity'
  },
  {
    id: 'office-furniture',
    name: 'Office Furniture Supply',
    description: 'Quality office furniture solutions',
    icon: 'armchair',
    category: 'mid_complexity'
  },
  {
    id: 'puff-panel-furniture',
    name: 'Puff Panel Furniture',
    description: 'Custom puff panel furniture manufacturing',
    icon: 'armchair',
    category: 'mid_complexity'
  },
  {
    id: 'boundary-wall',
    name: 'Boundary Wall',
    description: 'Boundary wall construction and repair',
    icon: 'brick-wall',
    category: 'mid_complexity'
  },
  {
    id: 'signage-works',
    name: 'Signage Works',
    description: 'Custom signage design and installation',
    icon: 'signpost',
    category: 'mid_complexity'
  },

  // Industrial & Technical Services (Category 1)
  {
    id: 'transformer-rewinding',
    name: 'Transformer Rewinding',
    description: 'Expert transformer rewinding and repair',
    icon: 'cable',
    category: 'technical',
    aiAssisted: true
  },
  {
    id: 'structure-brickwork',
    name: 'Structure & Brickwork',
    description: 'Structural construction and brickwork',
    icon: 'building-2',
    category: 'technical',
    aiAssisted: true
  },
  {
    id: 'electrical-materials',
    name: 'Electrical Materials Supply',
    description: 'Quality electrical materials and components',
    icon: 'lightbulb',
    category: 'technical',
    isPopular: true
  },
  {
    id: 'fabrication',
    name: 'Fabrication (MS/SS/Aluminium)',
    description: 'Metal fabrication services for various materials',
    icon: 'factory',
    category: 'technical',
    aiAssisted: true
  },
  {
    id: 'cctv-fire',
    name: 'CCTV & Fire Systems',
    description: 'Security and fire safety system installation',
    icon: 'cctv',
    category: 'technical',
    isPopular: true
  }
];

// ============================================
// Request Statuses
// ============================================

/** Service request statuses */
export type RequestStatus = 
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'changes_required'
  | 'approved'
  | 'published'
  | 'closed'
  | 'cancelled';

/** Request status metadata */
export interface RequestStatusInfo {
  id: RequestStatus;
  label: string;
  color: string;
  description: string;
}

export const REQUEST_STATUSES: Record<RequestStatus, RequestStatusInfo> = {
  draft: {
    id: 'draft',
    label: 'Draft',
    color: 'gray',
    description: 'Request is incomplete and saved as draft'
  },
  submitted: {
    id: 'submitted',
    label: 'Submitted',
    color: 'blue',
    description: 'Request has been submitted for review'
  },
  under_review: {
    id: 'under_review',
    label: 'Under Review',
    color: 'yellow',
    description: 'Request is being reviewed by our team'
  },
  changes_required: {
    id: 'changes_required',
    label: 'Changes Required',
    color: 'orange',
    description: 'Request requires modifications'
  },
  approved: {
    id: 'approved',
    label: 'Approved',
    color: 'green',
    description: 'Request has been approved'
  },
  published: {
    id: 'published',
    label: 'Published',
    color: 'green',
    description: 'Request is live and accepting tenders'
  },
  closed: {
    id: 'closed',
    label: 'Closed',
    color: 'gray',
    description: 'Request has been closed'
  },
  cancelled: {
    id: 'cancelled',
    label: 'Cancelled',
    color: 'red',
    description: 'Request has been cancelled'
  }
};

// ============================================
// Vendor Statuses
// ============================================

/** Vendor verification statuses */
export type VendorStatus = 'pending' | 'verified' | 'rejected' | 'suspended';

/** Vendor status metadata */
export interface VendorStatusInfo {
  id: VendorStatus;
  label: string;
  color: string;
  description: string;
}

export const VENDOR_STATUSES: Record<VendorStatus, VendorStatusInfo> = {
  pending: {
    id: 'pending',
    label: 'Pending Verification',
    color: 'yellow',
    description: 'Account is pending verification'
  },
  verified: {
    id: 'verified',
    label: 'Verified',
    color: 'green',
    description: 'Account has been verified'
  },
  rejected: {
    id: 'rejected',
    label: 'Rejected',
    color: 'red',
    description: 'Account verification was rejected'
  },
  suspended: {
    id: 'suspended',
    label: 'Suspended',
    color: 'red',
    description: 'Account has been suspended'
  }
};

// ============================================
// Service Request Interface
// ============================================

/** Service request data structure */
export interface ServiceRequest {
  id: string;
  requesterId: string;
  serviceType: string;
  serviceName: string;
  category: ServiceCategory;
  status: RequestStatus;
  title?: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  lastEditedAt?: Date;
  submittedAt?: Date;
  autoDeleteAt?: Date; // For drafts: createdAt + 7 days
  isDraft: boolean;
  // Additional fields will be added in Phase 2
}

/** Draft request summary for display */
export interface DraftRequestSummary {
  id: string;
  serviceName: string;
  lastEdited: Date;
  expiresIn?: number; // Hours until auto-delete
}

// ============================================
// Service Requester Interface
// ============================================

/** Service requester base profile */
export interface ServiceRequesterBase {
  id: string;
  email: string;
  phone: string;
  requesterType: RequesterType;
  city: string;
  createdAt: Date;
  isEmailVerified: boolean;
}

/** Individual service requester */
export interface IndividualRequester extends ServiceRequesterBase {
  requesterType: 'individual';
  fullName: string;
  address?: string;
}

/** SME service requester */
export interface SMERequester extends ServiceRequesterBase {
  requesterType: 'sme';
  organizationName: string;
  gstNumber?: string;
  businessAddress: string;
  authorizedPersonName: string;
  designation: string;
}

/** Large organization service requester */
export interface LargeOrgRequester extends ServiceRequesterBase {
  requesterType: 'large_organization';
  organizationName: string;
  gstNumber: string;
  registeredAddress: string;
  authorizedPersonName: string;
  designation: string;
  department?: string;
}

/** Union type for all requester types */
export type ServiceRequester = IndividualRequester | SMERequester | LargeOrgRequester;

// ============================================
// Vendor Interface
// ============================================

/** Vendor uploaded documents */
export interface VendorDocuments {
  businessCertificate?: string;
  gstCertificate?: string;
  tradeLicense?: string;
  insuranceCertificate?: string;
}

/** Vendor bank details */
export interface VendorBankDetails {
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  bankName: string;
}

/** A past-work entry on the vendor's profile (feeds profile completion). */
export interface PortfolioEntry {
  id: string;
  title: string;
  description: string;
  year: number;
  clientName?: string;
}

/** Vendor profile */
export interface Vendor {
  id: string;
  businessName: string;
  businessType: VendorBusinessType;
  gstNumber?: string;
  panNumber: string;
  yearEstablished: number;
  
  // Contact Information
  primaryContactPerson: string;
  designation: string;
  email: string;
  phone: string;
  alternatePhone?: string;
  registeredAddress: string;
  city: string;
  state: string;
  pinCode: string;
  
  // Service Capabilities
  serviceCapabilities: string[]; // Array of service IDs
  serviceAreas: string[]; // Cities/regions
  experienceByService?: Record<string, number>; // Service ID -> years
  
  // Verification
  verificationStatus: VendorStatus;
  documentsUploaded: VendorDocuments;
  bankDetails: VendorBankDetails;

  // Past work shown to admins during evaluation
  portfolio?: PortfolioEntry[];
  
  // Timestamps
  createdAt: Date;
  verifiedAt?: Date;
  isEmailVerified: boolean;

  // Verification audit (set by admin review — see F8)
  rejectionReason?: string;
  reviewedBy?: string;
  verificationEvents?: VendorVerificationEvent[];
}

/** One entry in a vendor's verification history — powers the review timeline. */
export interface VendorVerificationEvent {
  status: VendorStatus;
  at: Date;
  actor?: string;
  note?: string;
}

// ============================================
// Activity Timeline
// ============================================

/** Activity types for timeline */
export type ActivityType = 
  | 'request_created'
  | 'request_submitted'
  | 'request_approved'
  | 'tender_published'
  | 'bid_received'
  | 'tender_closed'
  | 'vendor_selected';

/** Activity item for timeline display */
export interface ActivityItem {
  id: string;
  type: ActivityType;
  message: string;
  timestamp: Date;
  relatedId?: string; // Request ID or Tender ID
}

// ============================================
// Dashboard Statistics
// ============================================

/** Service requester dashboard stats */
export interface RequesterDashboardStats {
  totalRequests: number;
  pendingApproval: number;
  liveTenders: number;
  completed: number;
  draftsCount: number;
}

/** Vendor dashboard stats */
export interface VendorDashboardStats {
  newTenderMatches: number;
  activeBids: number;
  underEvaluation: number;
  wonBids: number;
  profileCompletion: number;
}

// ============================================
// Signup Form Data
// ============================================

/** Service requester signup step 1 data */
export interface RequesterSignupStep1 {
  requesterType: RequesterType;
}

/** Service requester signup step 2 data */
export interface RequesterSignupStep2 {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
}

/** Service requester signup step 3 data (Individual) */
export interface RequesterSignupStep3Individual {
  city: string;
  address?: string;
}

/** Service requester signup step 3 data (SME) */
export interface RequesterSignupStep3SME {
  organizationName: string;
  gstNumber?: string;
  businessAddress: string;
  city: string;
  authorizedPersonName: string;
  designation: string;
}

/** Service requester signup step 3 data (Large Org) */
export interface RequesterSignupStep3LargeOrg {
  organizationName: string;
  gstNumber: string;
  registeredAddress: string;
  city: string;
  authorizedPersonName: string;
  designation: string;
  department?: string;
}

/** Complete requester signup data */
export interface RequesterSignupFormData {
  step1: RequesterSignupStep1;
  step2: RequesterSignupStep2;
  step3Individual?: RequesterSignupStep3Individual;
  step3SME?: RequesterSignupStep3SME;
  step3LargeOrg?: RequesterSignupStep3LargeOrg;
  termsAccepted: boolean;
  marketingConsent: boolean;
}

/** Vendor signup step 1 data */
export interface VendorSignupStep1 {
  businessName: string;
  businessType: VendorBusinessType;
  gstNumber: string;
  panNumber: string;
  yearEstablished: number;
}

/** Vendor signup step 2 data */
export interface VendorSignupStep2 {
  primaryContactPerson: string;
  designation: string;
  email: string;
  phone: string;
  alternatePhone?: string;
  registeredAddress: string;
  city: string;
  state: string;
  pinCode: string;
}

/** Vendor signup step 3 data */
export interface VendorSignupStep3 {
  serviceCapabilities: string[];
  serviceAreas: string[];
}

/** Vendor signup step 4 data */
export interface VendorSignupStep4 {
  businessCertificateFile?: File;
  gstCertificateFile?: File;
  tradeLicenseFile?: File;
  insuranceCertificateFile?: File;
  bankDetails: VendorBankDetails;
  password: string;
  confirmPassword: string;
  termsAccepted: boolean;
}

/** Complete vendor signup data */
export interface VendorSignupFormData {
  step1: VendorSignupStep1;
  step2: VendorSignupStep2;
  step3: VendorSignupStep3;
  step4: VendorSignupStep4;
}

// ============================================
// Helper Functions
// ============================================

/** Get services by category */
export function getServicesByCategory(category: ServiceCategory): ServiceType[] {
  return SERVICES.filter(s => s.category === category);
}

/** Get popular services */
export function getPopularServices(): ServiceType[] {
  return SERVICES.filter(s => s.isPopular);
}

/** Get service by ID */
export function getServiceById(id: string): ServiceType | undefined {
  return SERVICES.find(s => s.id === id);
}

/** Get category info for a service */
export function getCategoryForService(serviceId: string): ServiceCategoryInfo | undefined {
  const service = getServiceById(serviceId);
  return service ? SERVICE_CATEGORIES[service.category] : undefined;
}

/** Calculate auto-delete date for drafts (7 days from creation) */
export function calculateAutoDeleteDate(createdAt: Date): Date {
  const deleteDate = new Date(createdAt);
  deleteDate.setDate(deleteDate.getDate() + 7);
  return deleteDate;
}

/** Check if draft is expiring soon (less than 24 hours) */
export function isDraftExpiringSoon(autoDeleteAt: Date): boolean {
  const now = new Date();
  const hoursRemaining = (autoDeleteAt.getTime() - now.getTime()) / (1000 * 60 * 60);
  return hoursRemaining > 0 && hoursRemaining <= 24;
}

/** Get hours remaining until draft expires */
export function getHoursUntilDraftExpires(autoDeleteAt: Date): number {
  const now = new Date();
  const hoursRemaining = (autoDeleteAt.getTime() - now.getTime()) / (1000 * 60 * 60);
  return Math.max(0, Math.floor(hoursRemaining));
}
