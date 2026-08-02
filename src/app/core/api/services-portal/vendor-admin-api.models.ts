/**
 * Wire shapes for the admin vendor surface
 * (`/api/service-admin/vendors`, backend B2.2).
 *
 * Dates arrive as ISO 8601 strings and stay strings here — converting to Date
 * is the mapper's job, not the transport's.
 */

/** One row of the verification queue. Deliberately smaller than VendorDto. */
export interface VendorSummaryDto {
  id: string;
  businessName: string;
  businessType: string;
  city: string | null;
  state: string | null;
  primaryContactPerson: string | null;
  email: string | null;
  phone: string | null;
  serviceCapabilities: string[];
  verificationStatus: string;
  createdAt: string;
  verifiedAt: string | null;
}

/**
 * Counts across the *whole* queue, not the current filter — they drive the
 * tabs that change the filter, so filtering them would make every tab show the
 * count of the tab already selected.
 */
export interface VendorQueueStatsDto {
  pending: number;
  verified: number;
  rejected: number;
  suspended: number;
  total: number;
}

export interface VendorQueueDto {
  items: VendorSummaryDto[];
  stats: VendorQueueStatsDto;
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface VendorQueueParams {
  /** Lowercase status, e.g. 'pending'. Omit for every vendor. */
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}
