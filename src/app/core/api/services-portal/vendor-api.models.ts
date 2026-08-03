/**
 * Wire types for the .NET vendor API (docs/backend/02-API-VENDOR-DASHBOARD.md).
 *
 * Enum-typed fields (`businessType`, `verificationStatus`, ...) are sent and
 * received as the same lowercase snake_case strings the domain model already
 * uses — the API's `JsonStringEnumConverter` accepts and emits that form
 * directly, so no int-mapping layer is needed anywhere in this file.
 */
import {
  VendorBusinessType,
  VendorStatus,
} from '../../models/service.model';

export interface VendorBankDetailsDto {
  accountHolderName: string | null;
  /** Always masked (`"••••1234"`) or null — the full number is never returned. */
  maskedAccountNumber: string | null;
  ifscCode: string | null;
  bankName: string | null;
  isComplete: boolean;
}

export interface VendorDocumentDto {
  id: string;
  documentType: string;
  fileUrl: string;
  fileName: string | null;
  fileSizeBytes: number | null;
  uploadedAt: string;
  expiresAt: string | null;
}

export interface VendorPortfolioEntryDto {
  id: string;
  title: string;
  description: string;
  year: number;
  clientName: string | null;
}

export interface VendorVerificationEventDto {
  status: VendorStatus;
  occurredAt: string;
  actorId: string | null;
  /**
   * Populated on admin reads only (backend joins it from the acting user's
   * account at read time — never stored on the event, so it can't go stale).
   * The vendor's own profile read leaves this null; only the id is visible
   * there, matching the same admin/vendor visibility split the rest of this
   * DTO already has for e.g. internal notes.
   */
  actorName: string | null;
  note: string | null;
}

export interface VendorProfileSectionDto {
  id: string;
  label: string;
  isComplete: boolean;
  route: string;
}

export interface VendorProfileCompletionDto {
  completedSections: number;
  totalSections: number;
  percentage: number;
  sections: VendorProfileSectionDto[];
}

/** GET /api/vendors/me, /api/service-admin/vendors/{id} — the full profile. */
export interface VendorDto {
  id: string;
  userId: string;
  businessName: string;
  businessType: VendorBusinessType;
  gstNumber: string | null;
  panNumber: string | null;
  yearEstablished: number | null;
  primaryContactPerson: string | null;
  designation: string | null;
  email: string | null;
  phone: string | null;
  alternatePhone: string | null;
  registeredAddress: string | null;
  city: string | null;
  state: string | null;
  pinCode: string | null;
  serviceCapabilities: string[];
  serviceAreas: string[];
  experienceByService: Record<string, number>;
  verificationStatus: VendorStatus;
  verifiedAt: string | null;
  rejectionReason: string | null;
  reviewedById: string | null;
  canBid: boolean;
  bankDetails: VendorBankDetailsDto;
  documents: VendorDocumentDto[];
  portfolio: VendorPortfolioEntryDto[];
  verificationEvents: VendorVerificationEventDto[];
  profileCompletion: VendorProfileCompletionDto;
  isEmailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

/** POST /api/vendors/register */
export interface RegisterVendorRequest {
  email: string;
  password: string;
  businessName: string;
  businessType: VendorBusinessType;
  gstNumber?: string;
  panNumber?: string;
  yearEstablished?: number;
  primaryContactPerson: string;
  designation?: string;
  phone: string;
  alternatePhone?: string;
  registeredAddress?: string;
  city?: string;
  state?: string;
  pinCode?: string;
  serviceCapabilities: string[];
  serviceAreas: string[];
  bankAccountHolderName?: string;
  bankAccountNumber?: string;
  bankIfscCode?: string;
  bankName?: string;
  acceptedTerms: boolean;
}

/** PUT /api/vendors/me/basic */
export interface UpdateVendorBasicInfoRequest {
  businessName: string;
  businessType: VendorBusinessType;
  gstNumber?: string | null;
  panNumber?: string | null;
  yearEstablished?: number | null;
  primaryContactPerson?: string | null;
  designation?: string | null;
  email?: string | null;
  phone?: string | null;
  alternatePhone?: string | null;
  registeredAddress?: string | null;
  city?: string | null;
  state?: string | null;
  pinCode?: string | null;
}

/** PUT /api/vendors/me/services */
export interface UpdateVendorServicesRequest {
  serviceCapabilities: string[];
  serviceAreas: string[];
  experienceByService: Record<string, number>;
}

/** PUT /api/vendors/me/bank — always the complete set; there is nothing to merge with. */
export interface UpdateVendorBankDetailsRequest {
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  bankName: string;
}

/** PUT /api/vendors/me/documents */
export interface UpsertVendorDocumentRequest {
  documentType: string;
  fileUrl: string;
  fileName?: string;
  fileSizeBytes?: number;
  expiresAt?: string;
}

/** POST /api/vendors/me/portfolio */
export interface AddVendorPortfolioEntryRequest {
  title: string;
  description: string;
  year: number;
  clientName?: string;
}
