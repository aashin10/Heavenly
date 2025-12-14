import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { ServiceRequestManagementService } from '../service-request-management.service';
import { ServiceRequest, TenderDocument, PublishSettings } from '../management.model';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-tender-publish',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe],
  templateUrl: './tender-publish.page.html',
  styleUrl: './tender-publish.page.scss'
})
export class TenderPublishPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly srService = inject(ServiceRequestManagementService);
  private readonly toastService = inject(ToastService);

  requestId = '';
  request = signal<ServiceRequest | null>(null);
  tender = signal<TenderDocument | null>(null);

  publishSettings!: FormGroup;
  showSuccessModal = signal(false);

  ngOnInit(): void {
    this.requestId = this.route.snapshot.params['id'];
    this.initializeForm();
    this.loadData();
  }

  private initializeForm(): void {
    this.publishSettings = this.fb.group({
      notifyVendors: [true],
      notifyRequester: [true],
      inAppNotifications: [true],
      scheduledPublishDate: ['']
    });
  }

  private loadData(): void {
    const request = this.srService.getRequest(this.requestId);
    if (!request) {
      this.toastService.error('Request not found');
      this.router.navigate(['/management']);
      return;
    }
    this.request.set(request);

    const tender = this.srService.getTenderByRequestId(this.requestId);
    if (!tender) {
      this.toastService.error('Tender not found. Please approve the request first.');
      this.router.navigate(['/management']);
      return;
    }
    this.tender.set(tender);
  }

  goBack(): void {
    this.router.navigate(['/management']);
  }

  downloadPDF(): void {
    this.toastService.info('PDF download feature coming soon');
  }

  previewFullDocument(): void {
    this.toastService.info('Full document preview coming soon');
  }

  scheduleForLater(): void {
    if (!this.publishSettings.value.scheduledPublishDate) {
      this.toastService.error('Please select a date to schedule publishing');
      return;
    }
    this.publishTender(true);
  }

  publishNow(): void {
    this.publishTender(false);
  }

  private publishTender(isScheduled: boolean): void {
    const tender = this.tender();
    if (!tender) return;

    const settings: PublishSettings = {
      notifyVendors: this.publishSettings.value.notifyVendors,
      notifyRequester: this.publishSettings.value.notifyRequester,
      inAppNotifications: this.publishSettings.value.inAppNotifications,
      scheduledPublishDate: isScheduled ? this.publishSettings.value.scheduledPublishDate : undefined
    };

    this.srService.publishTender(tender.tenderId, settings);
    this.showSuccessModal.set(true);
  }

  closeSuccessModal(): void {
    this.showSuccessModal.set(false);
    this.router.navigate(['/management']);
  }

  viewLiveTender(): void {
    // Would navigate to public tender view
    this.toastService.info('Tender view coming soon');
    this.showSuccessModal.set(false);
    this.router.navigate(['/management']);
  }

  formatBudgetVisibility(visibility: string): string {
    switch (visibility) {
      case 'show_exact': return 'Exact budget visible';
      case 'show_range': return 'Budget range visible';
      case 'hide': return 'Budget hidden';
      default: return visibility;
    }
  }
}
