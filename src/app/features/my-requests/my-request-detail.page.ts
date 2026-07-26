import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ServiceAuthService } from '../../core/services/service-auth.service';
import {
  RequestEvent,
  RequestStatus,
  ServiceRequestService,
  ServiceRequestSubmission,
} from '../../core/services/service-request.service';
import { DraftService } from '../../core/services/draft.service';
import { FORM_CONFIGS } from '../service-request/service-request.model';
import { getCategoryShortLabel } from '../../shared/utils/service-category.util';
import {
  formatCategoryFormData,
  PreviewSection,
} from '../../shared/utils/form-formatting.util';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { AppDateTimePipe } from '../../shared/pipes/app-date.pipe';

@Component({
  selector: 'app-my-request-detail-page',
  standalone: true,
  imports: [RouterLink, IconComponent, StatusBadgeComponent, AppDateTimePipe],
  templateUrl: './my-request-detail.page.html',
  styleUrl: './my-request-detail.page.scss',
})
export class MyRequestDetailPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly serviceAuthService = inject(ServiceAuthService);
  private readonly requestService = inject(ServiceRequestService);
  private readonly draftService = inject(DraftService);

  request = signal<ServiceRequestSubmission | null>(null);
  notFound = signal(false);

  /** One-time success banner shown when arriving straight from submission. */
  justSubmitted = signal(false);

  sections = computed<PreviewSection[]>(() => {
    const req = this.request();
    if (!req) return [];
    return formatCategoryFormData(req.category, req.formData);
  });

  timeline = computed<RequestEvent[]>(() => {
    const req = this.request();
    if (!req) return [];
    // Fall back to a single "Submitted" entry for older mock records that
    // predate event tracking.
    if (req.events?.length) return req.events;
    return req.submittedAt ? [{ status: 'submitted', at: req.submittedAt }] : [];
  });

  canCancel = computed(() => {
    const req = this.request();
    return !!req && this.requestService.canCancel(req.status);
  });

  canResubmit = computed(() => {
    const req = this.request();
    return !!req && this.requestService.canEditAndResubmit(req.status);
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.notFound.set(true);
      return;
    }
    const req = this.requestService.getRequest(id);
    if (!req) {
      this.notFound.set(true);
      return;
    }
    this.request.set(req);
    this.justSubmitted.set(this.route.snapshot.queryParamMap.get('submitted') === '1');
  }

  dismissSubmittedBanner(): void {
    this.justSubmitted.set(false);
  }

  categoryLabel(category: string): string {
    return getCategoryShortLabel(category);
  }

  eventLabel(status: RequestStatus): string {
    return this.requestService.getStatusLabel(status);
  }

  cancel(): void {
    const req = this.request();
    if (!req?.id) return;
    if (this.requestService.cancelRequest(req.id)) {
      this.request.set(this.requestService.getRequest(req.id));
    }
  }

  /**
   * Clone this request's form data into a fresh draft that remembers which
   * request it resubmits, then open the wizard. On submit the wizard updates
   * the original request rather than creating a new one.
   */
  editAndResubmit(): void {
    const req = this.request();
    if (!req?.id) return;

    const draftId = this.draftService.saveDraft({
      serviceId: req.serviceId,
      serviceName: req.serviceName,
      category: req.category,
      formData: req.formData,
      currentStep: 1,
      totalSteps: FORM_CONFIGS[req.category].totalSteps,
      resubmitOfRequestId: req.id,
    });

    this.router.navigate(['/service-request/new'], { queryParams: { draftId } });
  }
}
