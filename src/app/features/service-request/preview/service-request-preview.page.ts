import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { DraftService, ServiceRequestDraft } from '../../../core/services/draft.service';
import { ServiceRequestService } from '../../../core/services/service-request.service';
import { ServiceAuthService } from '../../../core/services/service-auth.service';
import { FORM_CONFIGS } from '../service-request.model';
import { ToastService } from '../../../core/services/toast.service';
import { formatFormData, PreviewSection } from '../../../shared/utils/form-formatting.util';
import { IconComponent } from '../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-service-request-preview-page',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './service-request-preview.page.html',
  styleUrl: './service-request-preview.page.scss'
})
export class ServiceRequestPreviewPage implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly draftService = inject(DraftService);
  private readonly serviceRequestService = inject(ServiceRequestService);
  private readonly serviceAuthService = inject(ServiceAuthService);
  private readonly toastService = inject(ToastService);

  // State
  isLoading = signal(true);
  isSubmitting = signal(false);
  draft = signal<ServiceRequestDraft | null>(null);
  formConfig = signal<{ stepLabels: string[] } | null>(null);
  
  // Formatted data for display
  sections = signal<PreviewSection[]>([]);

  ngOnInit(): void {
    const draftId = this.route.snapshot.queryParams['draftId'];

    if (!draftId) {
      this.router.navigate(['/services']);
      return;
    }

    void this.loadDraft(draftId);
  }

  private async loadDraft(draftId: string): Promise<void> {
    const draft = await this.draftService.getDraftAsync(draftId);

    if (!draft) {
      this.router.navigate(['/services']);
      return;
    }

    this.draft.set(draft);
    this.formConfig.set(FORM_CONFIGS[draft.category]);
    this.sections.set(formatFormData(draft));
    this.isLoading.set(false);
  }

  editStep(stepNumber: number): void {
    const draft = this.draft();
    if (!draft) return;

    this.router.navigate(['/service-request/new'], {
      queryParams: {
        draftId: draft.id,
        step: stepNumber
      }
    });
  }

  goBack(): void {
    const draft = this.draft();
    if (!draft) {
      this.router.navigate(['/services']);
      return;
    }

    this.router.navigate(['/service-request/new'], {
      queryParams: {
        draftId: draft.id,
        step: draft.totalSteps
      }
    });
  }

  async submitRequest(): Promise<void> {
    const draft = this.draft();
    if (!draft) return;

    this.isSubmitting.set(true);

    // Edit-and-resubmit path: this draft is a re-edit of a request the admin
    // sent back. Update that request in place rather than creating a new one.
    if (draft.resubmitOfRequestId) {
      const ok = await this.serviceRequestService.resubmitRequestAsync(
        draft.resubmitOfRequestId,
        draft.serviceId,
        draft.serviceName,
        draft.category,
        draft.formData
      );
      if (ok) {
        await this.draftService.clearDraftAsync(draft.id);
        this.toastService.success('Request resubmitted for review.');
        this.router.navigate(['/my-requests', draft.resubmitOfRequestId]);
      } else {
        this.isSubmitting.set(false);
        this.toastService.error('Could not resubmit the request. Please try again.');
      }
      return;
    }

    try {
      const requesterId =
        this.serviceAuthService.getCurrentUserSession()?.id ?? 'temp-requester-id';

      const result = await this.serviceRequestService.submitRequestAsync(
        draft.serviceId,
        draft.serviceName,
        draft.category,
        draft.formData,
        requesterId
      );

      if (result.success && result.requestId) {
        // No explicit draft cleanup here: both submitRequest (mock) and the
        // real submit endpoint already delete the source draft as part of
        // the submission itself — a second delete here was previously
        // hitting the real API's (now-fixed) non-idempotent DELETE and
        // reporting the whole submission as failed.
        this.toastService.success(`Request ${result.requestId} submitted successfully!`);

        // Land on the request detail, where the requester sees its status and
        // timeline. `?submitted=1` triggers a one-time success banner there —
        // the confirmation, without a separate route. (The old
        // '/services/request/confirmation' target bounced to the homepage.)
        this.router.navigate(['/my-requests', result.requestId], {
          queryParams: { submitted: 1 },
        });
      } else {
        console.error('Failed to submit request:', result.message);
        this.isSubmitting.set(false);
        this.toastService.error(result.message || 'Failed to submit request. Please try again.');
      }
    } catch (error) {
      console.error('Failed to submit request:', error);
      this.isSubmitting.set(false);
      this.toastService.error('Failed to submit request. Please try again.');
    }
  }
}
