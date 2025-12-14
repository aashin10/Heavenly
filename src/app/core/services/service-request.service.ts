import { Injectable, inject, signal } from '@angular/core';
import { ServiceCategory } from '../models/service.model';
import { ToastService } from './toast.service';
import { DraftService } from './draft.service';

export type RequestStatus = 
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'changes_required'
  | 'approved'
  | 'published'
  | 'closed'
  | 'cancelled';

export interface ServiceRequestSubmission {
  id?: string;
  serviceId: string;
  serviceName: string;
  category: ServiceCategory;
  formData: Record<string, unknown>;
  status: RequestStatus;
  requesterId: string;
  submittedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubmissionResult {
  success: boolean;
  requestId?: string;
  message: string;
  errors?: string[];
}

const REQUESTS_STORAGE_KEY = 'heavenly_service_requests';

@Injectable({
  providedIn: 'root'
})
export class ServiceRequestService {
  private readonly toastService = inject(ToastService);
  private readonly draftService = inject(DraftService);

  readonly isSubmitting = signal<boolean>(false);
  readonly lastSubmittedId = signal<string | null>(null);

  /**
   * Generate a unique request ID
   */
  private generateRequestId(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `REQ-${timestamp}-${random}`;
  }

  /**
   * Get all submitted requests from localStorage
   */
  getAllRequests(): ServiceRequestSubmission[] {
    try {
      const stored = localStorage.getItem(REQUESTS_STORAGE_KEY);
      if (!stored) return [];

      const requests: ServiceRequestSubmission[] = JSON.parse(stored);
      return requests.map(req => ({
        ...req,
        submittedAt: req.submittedAt ? new Date(req.submittedAt) : undefined,
        createdAt: new Date(req.createdAt),
        updatedAt: new Date(req.updatedAt)
      }));
    } catch {
      return [];
    }
  }

  /**
   * Save requests to localStorage
   */
  private saveRequestsToStorage(requests: ServiceRequestSubmission[]): void {
    try {
      localStorage.setItem(REQUESTS_STORAGE_KEY, JSON.stringify(requests));
    } catch (error) {
      console.error('Failed to save requests:', error);
    }
  }

  /**
   * Submit a service request
   */
  async submitRequest(
    serviceId: string,
    serviceName: string,
    category: ServiceCategory,
    formData: Record<string, unknown>,
    requesterId: string
  ): Promise<SubmissionResult> {
    this.isSubmitting.set(true);

    try {
      // Simulate API call delay
      await this.simulateApiDelay(1500);

      // Validate form data
      const validationErrors = this.validateSubmission(formData, category);
      if (validationErrors.length > 0) {
        return {
          success: false,
          message: 'Validation failed',
          errors: validationErrors
        };
      }

      const requestId = this.generateRequestId();
      const now = new Date();

      const request: ServiceRequestSubmission = {
        id: requestId,
        serviceId,
        serviceName,
        category,
        formData,
        status: 'submitted',
        requesterId,
        submittedAt: now,
        createdAt: now,
        updatedAt: now
      };

      // Save to localStorage
      const requests = this.getAllRequests();
      requests.push(request);
      this.saveRequestsToStorage(requests);

      // Clear the draft after successful submission
      const draft = this.draftService.getDraftByServiceId(serviceId);
      if (draft) {
        this.draftService.clearDraft(draft.id);
      }

      this.lastSubmittedId.set(requestId);
      this.toastService.success('Service request submitted successfully!');

      return {
        success: true,
        requestId,
        message: 'Your service request has been submitted and is pending review.'
      };

    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unexpected error occurred';
      this.toastService.error(message);
      return {
        success: false,
        message,
        errors: [message]
      };
    } finally {
      this.isSubmitting.set(false);
    }
  }

  /**
   * Get a specific request by ID
   */
  getRequest(requestId: string): ServiceRequestSubmission | null {
    const requests = this.getAllRequests();
    return requests.find(r => r.id === requestId) || null;
  }

  /**
   * Get requests for a specific requester
   */
  getRequestsByRequester(requesterId: string): ServiceRequestSubmission[] {
    const requests = this.getAllRequests();
    return requests.filter(r => r.requesterId === requesterId);
  }

  /**
   * Get requests by status
   */
  getRequestsByStatus(status: RequestStatus): ServiceRequestSubmission[] {
    const requests = this.getAllRequests();
    return requests.filter(r => r.status === status);
  }

  /**
   * Update request status
   */
  updateRequestStatus(requestId: string, status: RequestStatus): boolean {
    const requests = this.getAllRequests();
    const index = requests.findIndex(r => r.id === requestId);
    
    if (index === -1) return false;

    requests[index] = {
      ...requests[index],
      status,
      updatedAt: new Date()
    };

    this.saveRequestsToStorage(requests);
    return true;
  }

  /**
   * Validate submission data based on category
   */
  private validateSubmission(formData: Record<string, unknown>, category: ServiceCategory): string[] {
    const errors: string[] = [];

    // Common validations
    if (!formData['contactPerson']) {
      errors.push('Contact person name is required');
    }
    if (!formData['phoneNumber']) {
      errors.push('Phone number is required');
    }
    if (!formData['email']) {
      errors.push('Email is required');
    }

    // Category-specific validations
    switch (category) {
      case 'technical':
        if (!formData['serviceCategory']) {
          errors.push('Service category is required');
        }
        if (!formData['projectType']) {
          errors.push('Project type is required');
        }
        if (!formData['scopeNature']) {
          errors.push('Scope nature is required');
        }
        break;

      case 'mid_complexity':
        if (!formData['serviceType']) {
          errors.push('Service type is required');
        }
        break;

      case 'quick_service':
        if (!formData['serviceType'] && !formData['assets']) {
          errors.push('At least one service or asset is required');
        }
        break;
    }

    return errors;
  }

  /**
   * Simulate API delay for realistic UX
   */
  private simulateApiDelay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get status label for display
   */
  getStatusLabel(status: RequestStatus): string {
    const labels: Record<RequestStatus, string> = {
      draft: 'Draft',
      submitted: 'Submitted',
      under_review: 'Under Review',
      changes_required: 'Changes Required',
      approved: 'Approved',
      published: 'Published',
      closed: 'Closed',
      cancelled: 'Cancelled'
    };
    return labels[status];
  }

  /**
   * Get status badge class for styling
   */
  getStatusClass(status: RequestStatus): string {
    const classes: Record<RequestStatus, string> = {
      draft: 'status-draft',
      submitted: 'status-submitted',
      under_review: 'status-review',
      changes_required: 'status-changes',
      approved: 'status-approved',
      published: 'status-published',
      closed: 'status-closed',
      cancelled: 'status-cancelled'
    };
    return classes[status];
  }
}
