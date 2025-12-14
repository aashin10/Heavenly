import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { ServiceRequestManagementService } from '../service-request-management.service';
import { ServiceRequest, AIGeneratedDraft, ReviewFormData } from '../management.model';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { CollapsibleSectionComponent } from '../../../shared/components/collapsible-section/collapsible-section.component';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-service-request-review',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    DatePipe,
    TitleCasePipe,
    StatusBadgeComponent,
    CollapsibleSectionComponent
  ],
  templateUrl: './service-request-review.page.html',
  styleUrl: './service-request-review.page.scss'
})
export class ServiceRequestReviewPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly srService = inject(ServiceRequestManagementService);
  private readonly toastService = inject(ToastService);

  requestId = '';
  request = signal<ServiceRequest | null>(null);
  aiDraft = signal<AIGeneratedDraft | null>(null);
  loading = signal(false);

  // Modals
  showClarificationModal = signal(false);
  showRejectModal = signal(false);
  showApprovalSuccessModal = signal(false);

  // Review Form
  reviewForm!: FormGroup;

  // Clarification Form
  clarificationForm!: FormGroup;

  // Reject Form
  rejectForm!: FormGroup;

  ngOnInit(): void {
    this.requestId = this.route.snapshot.params['id'];
    this.initializeForms();
    this.loadRequestDetails();
  }

  private initializeForms(): void {
    this.reviewForm = this.fb.group({
      tenderTitle: ['', [Validators.required, Validators.minLength(10)]],
      scopeSummary: ['', [Validators.required, Validators.minLength(50)]],
      commercialStructure: [''],
      bidWindowStart: ['', Validators.required],
      bidWindowEnd: ['', Validators.required],
      budgetVisibility: ['show_range', Validators.required],
      tenderType: ['open', Validators.required],
      eligibilityCriteria: this.fb.group({
        minExperience: [true],
        minExperienceYears: [2],
        certifications: [false],
        financialCapacity: [false],
        previousWork: [false]
      }),
      internalNotes: ['']
    });

    this.clarificationForm = this.fb.group({
      subject: ['', Validators.required],
      message: ['', [Validators.required, Validators.minLength(20)]],
      markUrgent: [false]
    });

    this.rejectForm = this.fb.group({
      reason: ['', Validators.required],
      customReason: [''],
      message: ['']
    });
  }

  private loadRequestDetails(): void {
    const request = this.srService.getRequest(this.requestId);
    if (!request) {
      this.toastService.error('Request not found');
      this.router.navigate(['/management']);
      return;
    }

    this.request.set(request);

    // Mark as under review if submitted
    if (request.status === 'submitted') {
      this.srService.startReview(this.requestId);
    }

    // Load AI draft
    const draft = this.srService.getAIDraft(this.requestId);
    this.aiDraft.set(draft);

    // Populate form with AI draft
    this.reviewForm.patchValue({
      tenderTitle: draft.tenderTitle,
      scopeSummary: draft.scopeSummary,
      commercialStructure: draft.commercialStructure,
      bidWindowStart: draft.suggestedBidWindow.start.split('T')[0],
      bidWindowEnd: draft.suggestedBidWindow.end.split('T')[0]
    });

    // Check for saved draft
    const savedDraft = this.srService.getReviewDraft(this.requestId);
    if (savedDraft) {
      this.reviewForm.patchValue(savedDraft);
    }
  }

  goBack(): void {
    this.router.navigate(['/management']);
  }

  viewOriginalForm(): void {
    // Could open in modal or navigate to read-only view
    this.toastService.info('Original form view coming soon');
  }

  getTimeAgo(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    return `${diffDays} days ago`;
  }

  getClarityLabel(score: number): string {
    if (score >= 80) return 'High Clarity';
    if (score >= 60) return 'Medium Clarity';
    return 'Low Clarity - Review Carefully';
  }

  getClarityClass(score: number): string {
    if (score >= 80) return 'clarity--high';
    if (score >= 60) return 'clarity--medium';
    return 'clarity--low';
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  // ==================== ACTIONS ====================

  openClarificationModal(): void {
    this.clarificationForm.reset({ markUrgent: false });
    this.showClarificationModal.set(true);
  }

  closeClarificationModal(): void {
    this.showClarificationModal.set(false);
  }

  sendClarification(): void {
    if (this.clarificationForm.invalid) return;

    const { subject, message, markUrgent } = this.clarificationForm.value;
    this.srService.requestClarification(this.requestId, subject, message, markUrgent);
    this.showClarificationModal.set(false);
    this.router.navigate(['/management']);
  }

  openRejectModal(): void {
    this.rejectForm.reset();
    this.showRejectModal.set(true);
  }

  closeRejectModal(): void {
    this.showRejectModal.set(false);
  }

  confirmReject(): void {
    if (this.rejectForm.invalid) return;

    const { reason, customReason, message } = this.rejectForm.value;
    const finalReason = reason === 'other' ? customReason : reason;
    this.srService.rejectRequest(this.requestId, finalReason, message);
    this.showRejectModal.set(false);
    this.router.navigate(['/management']);
  }

  saveDraft(): void {
    const draftData = this.reviewForm.value;
    this.srService.saveReviewDraft(this.requestId, draftData);
  }

  approveRequest(): void {
    if (this.reviewForm.invalid) {
      this.toastService.error('Please fill in all required fields');
      return;
    }

    const reviewData: ReviewFormData = this.reviewForm.value;
    this.srService.approveRequest(this.requestId, reviewData);
    this.showApprovalSuccessModal.set(true);
  }

  closeApprovalSuccessModal(): void {
    this.showApprovalSuccessModal.set(false);
  }

  publishNow(): void {
    this.showApprovalSuccessModal.set(false);
    this.router.navigate(['/management/publish', this.requestId]);
  }

  publishLater(): void {
    this.showApprovalSuccessModal.set(false);
    this.router.navigate(['/management']);
  }
}
