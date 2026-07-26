import { Component, inject, signal, OnInit } from '@angular/core';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { ServiceCategory, ServiceType, SERVICES } from '../../../core/models/service.model';
import { DraftService, ServiceRequestDraft } from '../../../core/services/draft.service';
import { ServiceAuthService } from '../../../core/services/service-auth.service';
import { getCategoryByServiceName } from '../../../shared/utils/service-category.util';
import { FORM_CONFIGS, ServiceFormConfig, DraftRestoreModalState } from '../service-request.model';
import { TechnicalServiceFormComponent } from '../forms/technical-service-form/technical-service-form.component';
import { MidComplexityFormComponent } from '../forms/mid-complexity-form/mid-complexity-form.component';
import { QuickServiceFormComponent } from '../forms/quick-service-form/quick-service-form.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-service-request-form-page',
  standalone: true,
  imports: [
    RouterLink,
    TechnicalServiceFormComponent,
    MidComplexityFormComponent,
    QuickServiceFormComponent,
    IconComponent
  ],
  templateUrl: './service-request-form.page.html',
  styleUrl: './service-request-form.page.scss'
})
export class ServiceRequestFormPageComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly draftService = inject(DraftService);
  private readonly serviceAuthService = inject(ServiceAuthService);

  // Route params
  serviceId = signal<string>('');
  category = signal<ServiceCategory>('mid_complexity');
  initialStep = signal<number>(1);
  draftId = signal<string | null>(null);

  // Service info
  service = signal<ServiceType | null>(null);
  formConfig = signal<ServiceFormConfig | null>(null);

  // Draft restore modal
  restoreModal = signal<DraftRestoreModalState>({
    isOpen: false,
    draftId: null,
    lastSaved: null,
    currentStep: 1
  });

  // Loading state
  isLoading = signal(true);

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      const serviceId = params['serviceId'];
      const categoryParam = params['category'] as ServiceCategory;
      const draftIdParam = params['draftId'];
      const stepParam = params['step'];

      if (!serviceId && !draftIdParam) {
        this.router.navigate(['/services']);
        return;
      }

      // If we have a draftId, load from draft
      if (draftIdParam) {
        this.loadFromDraft(draftIdParam, stepParam ? Number.parseInt(stepParam, 10) : undefined);
        return;
      }

      // Load service and check for existing draft
      this.loadService(serviceId, categoryParam);
    });
  }

  private loadService(serviceId: string, categoryParam?: ServiceCategory): void {
    const service = SERVICES.find(s => s.id === serviceId);
    
    if (!service) {
      this.router.navigate(['/services']);
      return;
    }

    this.service.set(service);
    this.serviceId.set(serviceId);
    
    // Determine category from param or service
    const category = categoryParam || getCategoryByServiceName(service.name);
    this.category.set(category);

    // Set form config
    const config = FORM_CONFIGS[category];
    this.formConfig.set({
      ...config,
      serviceId,
      serviceName: service.name
    });

    // Check for existing draft
    const existingDraft = this.draftService.getDraftByServiceId(serviceId);
    if (existingDraft) {
      this.showRestoreModal(existingDraft);
    }

    this.isLoading.set(false);
  }

  private loadFromDraft(draftId: string, step?: number): void {
    const draft = this.draftService.getDraft(draftId);
    
    if (!draft) {
      this.router.navigate(['/services']);
      return;
    }

    const service = SERVICES.find(s => s.id === draft.serviceId);
    if (!service) {
      this.router.navigate(['/services']);
      return;
    }

    this.service.set(service);
    this.serviceId.set(draft.serviceId);
    this.category.set(draft.category);
    this.draftId.set(draftId);
    this.initialStep.set(step || draft.currentStep);

    const config = FORM_CONFIGS[draft.category];
    this.formConfig.set({
      ...config,
      serviceId: draft.serviceId,
      serviceName: draft.serviceName
    });

    this.isLoading.set(false);
  }

  private showRestoreModal(draft: ServiceRequestDraft): void {
    this.restoreModal.set({
      isOpen: true,
      draftId: draft.id,
      lastSaved: draft.lastSaved,
      currentStep: draft.currentStep
    });
  }

  onRestoreDraft(): void {
    const modal = this.restoreModal();
    if (modal.draftId) {
      this.draftId.set(modal.draftId);
      this.initialStep.set(modal.currentStep);
    }
    this.restoreModal.update(m => ({ ...m, isOpen: false }));
  }

  onStartFresh(): void {
    const modal = this.restoreModal();
    if (modal.draftId) {
      this.draftService.clearDraft(modal.draftId);
    }
    this.draftId.set(null);
    this.initialStep.set(1);
    this.restoreModal.update(m => ({ ...m, isOpen: false }));
  }

  onFormSaved(draftId: string): void {
    this.draftId.set(draftId);
  }

  onFormComplete(): void {
    // Navigate to preview
    this.router.navigate(['/service-request/preview'], {
      queryParams: { draftId: this.draftId() }
    });
  }

  onFormCancel(): void {
    this.router.navigate(['/services']);
  }

  formatLastSaved(date: Date | null): string {
    if (!date) return '';
    return this.draftService.formatLastSaved(date);
  }
}
