import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { VendorTenderService } from '../vendor.service';
import { PublishedTender, BidFormData, WorkReference, PriceItem } from '../vendor.model';
import { ToastService } from '../../../core/services/toast.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-bid-submission-page',
  standalone: true,
  imports: [ReactiveFormsModule, IconComponent],
  templateUrl: './bid-submission.page.html',
  styleUrl: './bid-submission.page.scss'
})
export class BidSubmissionPageComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly vendorService = inject(VendorTenderService);
  private readonly toastService = inject(ToastService);

  tenderId = '';
  tender = signal<PublishedTender | null>(null);
  
  currentStep = signal(1);
  totalSteps = 4;
  stepLabels = ['Eligibility', 'Technical Proposal', 'Commercial Proposal', 'Review'];
  
  bidForm!: FormGroup;
  finalConfirmation = signal(false);
  
  lastSavedTime = signal<Date | null>(null);
  autoSaveInterval: ReturnType<typeof setInterval> | null = null;
  
  showSuccessModal = signal(false);
  submittedBidId = signal('');

  ngOnInit(): void {
    this.tenderId = this.route.snapshot.params['id'];
    this.initializeForm();
    this.loadTenderDetails();
    this.checkForDraft();
    this.setupAutoSave();
  }

  ngOnDestroy(): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }
  }

  private initializeForm(): void {
    this.bidForm = this.fb.group({
      // Step 1: Eligibility
      confirmEligibility: [false, Validators.requiredTrue],
      
      // Step 2: Technical Proposal
      companyProfile: ['', Validators.required],
      relevantExperience: ['', Validators.required],
      similarWorkReferences: this.fb.array([]),
      technicalApproach: ['', Validators.required],
      manpowerPlan: [''],
      equipmentPlan: [''],
      deliveryTimeline: ['', Validators.required],
      deviations: [''],
      
      // Step 3: Commercial Proposal
      totalPrice: ['', [Validators.required, Validators.min(1)]],
      priceBreakdown: this.fb.array([]),
      taxesAndDuties: ['', Validators.required],
      paymentTerms: ['', Validators.required],
      validityPeriod: ['', Validators.required],
      warrantyPricing: [''],
      amcPricing: ['']
    });
    
    // Add initial reference and price item
    this.addReference();
    this.addPriceItem();
  }

  private loadTenderDetails(): void {
    const tender = this.vendorService.getTenderDetail(this.tenderId);
    if (!tender) {
      this.toastService.error('Tender not found');
      this.router.navigate(['/vendor/tenders']);
      return;
    }
    this.tender.set(tender);
  }

  private checkForDraft(): void {
    const draft = this.vendorService.getBidDraft(this.tenderId);
    if (draft) {
      // Restore from draft
      this.bidForm.patchValue(draft.formData);
      this.currentStep.set(draft.currentStep);
      this.lastSavedTime.set(new Date(draft.lastSaved));
      this.toastService.info('Draft restored');
    }
  }

  private setupAutoSave(): void {
    this.autoSaveInterval = setInterval(() => {
      this.saveDraft(true);
    }, 30000); // Auto-save every 30 seconds
  }

  // Form Arrays
  get similarWorkReferencesArray(): FormArray {
    return this.bidForm.get('similarWorkReferences') as FormArray;
  }

  get priceBreakdownArray(): FormArray {
    return this.bidForm.get('priceBreakdown') as FormArray;
  }

  addReference(): void {
    const refGroup = this.fb.group({
      clientName: [''],
      projectType: [''],
      contactPerson: [''],
      phone: ['']
    });
    this.similarWorkReferencesArray.push(refGroup);
  }

  removeReference(index: number): void {
    if (this.similarWorkReferencesArray.length > 1) {
      this.similarWorkReferencesArray.removeAt(index);
    }
  }

  addPriceItem(): void {
    const itemGroup = this.fb.group({
      description: [''],
      amount: [0]
    });
    this.priceBreakdownArray.push(itemGroup);
  }

  removePriceItem(index: number): void {
    if (this.priceBreakdownArray.length > 1) {
      this.priceBreakdownArray.removeAt(index);
    }
  }

  // Navigation
  nextStep(): void {
    if (this.validateCurrentStep()) {
      this.saveDraft(true);
      this.currentStep.update(s => Math.min(s + 1, this.totalSteps));
    }
  }

  previousStep(): void {
    this.currentStep.update(s => Math.max(s - 1, 1));
  }

  goToStep(step: number): void {
    if (step < this.currentStep()) {
      this.currentStep.set(step);
    }
  }

  private validateCurrentStep(): boolean {
    const step = this.currentStep();
    const stepFields = this.getStepFields(step);
    let isValid = true;

    stepFields.forEach(fieldName => {
      const control = this.bidForm.get(fieldName);
      if (control) {
        control.markAsTouched();
        if (control.invalid) {
          isValid = false;
        }
      }
    });

    if (!isValid) {
      this.toastService.error('Please fill in all required fields');
    }

    return isValid;
  }

  private getStepFields(step: number): string[] {
    const fieldsByStep: Record<number, string[]> = {
      1: ['confirmEligibility'],
      2: ['companyProfile', 'relevantExperience', 'technicalApproach', 'deliveryTimeline'],
      3: ['totalPrice', 'taxesAndDuties', 'paymentTerms', 'validityPeriod'],
      4: []
    };
    return fieldsByStep[step] || [];
  }

  isFieldInvalid(fieldName: string): boolean {
    const control = this.bidForm.get(fieldName);
    return control ? control.invalid && control.touched : false;
  }

  // Draft Management
  saveDraft(silent = false): void {
    const draftData = {
      tenderId: this.tenderId,
      formData: this.bidForm.value,
      currentStep: this.currentStep(),
      totalSteps: this.totalSteps,
      lastSaved: new Date().toISOString()
    };
    
    this.vendorService.saveBidDraft(draftData);
    this.lastSavedTime.set(new Date());
    
    if (!silent) {
      this.toastService.success('Draft saved');
    }
  }

  saveDraftAndExit(): void {
    this.saveDraft();
    this.router.navigate(['/vendor/tenders', this.tenderId]);
  }

  confirmExit(): void {
    if (confirm('Save your progress before leaving?')) {
      this.saveDraftAndExit();
    } else {
      this.router.navigate(['/vendor/tenders', this.tenderId]);
    }
  }

  // Submission
  submitBid(): void {
    if (!this.finalConfirmation()) {
      this.toastService.error('Please confirm the terms and conditions');
      return;
    }

    if (this.bidForm.invalid) {
      this.toastService.error('Please complete all required fields');
      return;
    }

    const formData: BidFormData = {
      confirmEligibility: this.bidForm.value.confirmEligibility,
      companyProfile: this.bidForm.value.companyProfile,
      relevantExperience: this.bidForm.value.relevantExperience,
      similarWorkReferences: this.bidForm.value.similarWorkReferences.filter(
        (ref: WorkReference) => ref.clientName || ref.projectType
      ),
      technicalApproach: this.bidForm.value.technicalApproach,
      manpowerPlan: this.bidForm.value.manpowerPlan,
      equipmentPlan: this.bidForm.value.equipmentPlan,
      deliveryTimeline: this.bidForm.value.deliveryTimeline,
      deviations: this.bidForm.value.deviations,
      totalPrice: Number(this.bidForm.value.totalPrice),
      priceBreakdown: this.bidForm.value.priceBreakdown.filter(
        (item: PriceItem) => item.description && item.amount > 0
      ),
      taxesAndDuties: this.bidForm.value.taxesAndDuties,
      paymentTerms: this.bidForm.value.paymentTerms,
      validityPeriod: this.bidForm.value.validityPeriod,
      warrantyPricing: this.bidForm.value.warrantyPricing,
      amcPricing: this.bidForm.value.amcPricing
    };

    const result = this.vendorService.submitBid(formData, this.tenderId);
    this.submittedBidId.set(result.bidId);
    this.showSuccessModal.set(true);
  }

  closeSuccessModal(): void {
    this.showSuccessModal.set(false);
    this.router.navigate(['/vendor/bids']);
  }

  viewSubmittedBid(): void {
    this.router.navigate(['/vendor/bids', this.submittedBidId()]);
  }

  // Utility
  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(value);
  }

  truncateText(text: string, maxLength: number): string {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }
}
