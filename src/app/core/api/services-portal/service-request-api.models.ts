/**
 * Wire types for the .NET service-request API (backend B2.4).
 */
import { ServiceCategory } from '../../models/service.model';

export interface ServiceRequestDraftDto {
  id: string;
  serviceId: string;
  serviceName: string;
  category: ServiceCategory;
  currentStep: number;
  totalSteps: number;
  formData: Record<string, unknown>;
  resubmitOfRequestId: string | null;
  lastSaved: string;
  createdAt: string;
  expiresAt: string;
  isExpired: boolean;
  daysRemaining: number;
}

/** PUT /api/service-requests/drafts/{serviceId} */
export interface SaveDraftRequest {
  serviceName: string;
  category: ServiceCategory;
  currentStep: number;
  totalSteps: number;
  formData: Record<string, unknown>;
  resubmitOfRequestId?: string;
}

/** POST /api/service-requests */
export interface SubmitServiceRequestRequest {
  serviceId: string;
  serviceName: string;
  category: ServiceCategory;
  formData: Record<string, unknown>;
  resubmitOfRequestId?: string;
}

export interface ServiceRequestEventDto {
  fromStatus: string | null;
  toStatus: string;
  actorId: string | null;
  note: string | null;
  occurredAt: string;
}

/** A service request as the requester sees it. */
export interface ServiceRequestDto {
  id: string;
  requestNumber: string;
  requesterId: string;
  serviceId: string;
  serviceName: string;
  category: ServiceCategory;
  status: string;
  formData: Record<string, unknown>;
  reviewNote: string | null;
  isEditableByRequester: boolean;
  isCancellableByRequester: boolean;
  submittedAt: string;
  updatedAt: string;
  events: ServiceRequestEventDto[];
}

/** One row of the requester's "my requests" list. */
export interface ServiceRequestSummaryDto {
  id: string;
  requestNumber: string;
  serviceId: string;
  serviceName: string;
  category: ServiceCategory;
  status: string;
  requesterId: string;
  requesterDisplayName: string | null;
  submittedAt: string;
  updatedAt: string;
}

export interface CancelServiceRequestRequest {
  reason?: string;
}
