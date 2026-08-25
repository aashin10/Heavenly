import { Component, inject, signal, NgZone, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { VendorTenderService } from '../vendor.service';
import { PublishedTender, BidFormData, WorkReference, PriceItem, EligibilityResult, BidDraft } from '../vendor.model';
import { ToastService } from '../../../core/services/toast.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-bid-submission-page',
  standalone: true,
  imports: [ReactiveFormsModule, IconComponent, EmptyStateComponent],
  templateUrl: './bid-submission.page.html',
  styleUrl: './bid-submission.page.scss'
})
export class BidSubmissionPageComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly vendorService = inject(VendorTenderService);
  private readonly toastService = inject(ToastService);
  private readonly ngZone = inject(NgZone);

  tenderId = '';
  tender = signal<PublishedTender | null>(null);
  eligibility = signal<EligibilityResult>({ eligible: false, reasons: [], missingRequirements: [] });
  loading = signal(true);
  loadFailed = signal(false);

  /** Why the last submit was refused, if it was. Null while nothing has been refused. */
  submitRefusal = signal<
    | { kind: 'ineligible'; reasons: string[] }
    | { kind: 'validation'; messages: string[] }
    | { kind: 'conflict'; message: string }
    | { kind: 'failed'; message: string }
    | null
  >(null);

  /** Set once the server says the tender no longer accepts bids. Hides Submit and stops autosave. */
  biddingClosed = signal(false);

  submitting = signal(false);

  currentStep = signal(1);
  totalSteps = 4;
  stepLabels = ['Eligibility', 'Technical Proposal', 'Commercial Proposal', 'Review'];

  bidForm!: FormGroup;
  finalConfirmation = signal(false);

  lastSavedTime = signal<Date | null>(null);
  autoSaveInterval: ReturnType<typeof setInterval> | null = null;

  showSuccessModal = signal(false);
  submittedBidId = signal('');
  submittedBidNumber = signal('');

  ngOnInit(): void {
    this.tenderId = this.route.snapshot.params['id'];
    this.initializeForm();
    void this.load();
  }

  ngOnDestroy(): void {
    this.stopAutoSave();
  }

  goBack(): void {
    this.router.navigate(['/vendor/tenders']);
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

  /**
   * One awaited load, not three synchronous reads.
   *
   * `getTenderDetail()` was a `tendersSignal` lookup: on a deep link in
   * real-API mode the constructor's tender refresh may not have resolved yet,
   * so it read `undefined` and bounced the vendor out with "Tender not found".
   * The bundle also carries this vendor's eligibility, so the wizard can say
   * up front what a submit would be refused for.
   */
  private async load(): Promise<void> {
    this.loading.set(true);
    const bundle = await this.vendorService.getTenderDetailBundleAsync(this.tenderId);
    this.loading.set(false);

    if (!bundle) {
      // Deliberately not a toast-and-redirect. That collapsed a transient 500
      // and a tender that genuinely doesn't exist into the same experience —
      // the same anti-pattern fixed on bid-detail.page.ts's load().
      this.loadFailed.set(true);
      return;
    }

    this.tender.set(bundle.tender);
    this.eligibility.set(bundle.eligibility);

    // Already bid — the server refuses a second one (409), withdrawn bids
    // included, so offering the form would waste the vendor's time.
    if (bundle.bidStatus.submitted && bundle.bidStatus.bidId) {
      this.toastService.info('You have already bid on this tender.');
      this.router.navigate(['/vendor/bids', bundle.bidStatus.bidId]);
      return;
    }

    await this.restoreDraft();
    this.setupAutoSave();
  }

  private async restoreDraft(): Promise<void> {
    const draft = await this.vendorService.getBidDraftAsync(this.tenderId);
    if (!draft) return;

    const data = draft.formData ?? {};

    // Rebuild both FormArrays to the length the draft actually holds *before*
    // patching. `FormArray.patchValue` ignores values past the last existing
    // control, and the form seeds exactly one of each — so a three-line price
    // breakdown came back as one line, silently.
    this.resizeArray(this.similarWorkReferencesArray, data.similarWorkReferences?.length ?? 1,
      () => this.addReference());
    this.resizeArray(this.priceBreakdownArray, data.priceBreakdown?.length ?? 1,
      () => this.addPriceItem());

    this.bidForm.patchValue(data);
    this.currentStep.set(draft.currentStep);
    this.lastSavedTime.set(new Date(draft.lastSaved));
    this.toastService.info('Draft restored');
  }

  /** Grows or shrinks a FormArray to `length` (minimum one row, which is what the form starts with). */
  private resizeArray(array: FormArray, length: number, addOne: () => void): void {
    const target = Math.max(1, length);
    while (array.length > target) array.removeAt(array.length - 1);
    while (array.length < target) addOne();
  }

  /**
   * Scheduled outside Angular's zone: a bare `setInterval` here is a macro
   * task that never clears, so `NgZone`/`ApplicationRef.isStable` (and with
   * it `ComponentFixture.whenStable()`) would never fire again as long as
   * the timer runs — hanging both real change-detection stability checks and
   * every `await fixture.whenStable()` in this page's spec. The callback
   * re-enters the zone so the signal writes inside `saveDraft` still trigger
   * change detection normally.
   */
  private setupAutoSave(): void {
    this.ngZone.runOutsideAngular(() => {
      this.autoSaveInterval = setInterval(() => {
        this.ngZone.run(() => void this.saveDraft(true));
      }, 30000); // Auto-save every 30 seconds
    });
  }

  private stopAutoSave(): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
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
      void this.saveDraft(true);
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
  async saveDraft(silent = false): Promise<void> {
    const draft: BidDraft = {
      tenderId: this.tenderId,
      formData: this.bidForm.value,
      currentStep: this.currentStep(),
      // The server validates 1..20 and `currentStep <= totalSteps`; sending the
      // wizard's own step count keeps a resumed draft on the step it left.
      totalSteps: this.totalSteps,
      lastSaved: new Date().toISOString(),
    };

    const result = await this.vendorService.saveBidDraftAsync(draft);

    if (result === 'closed') {
      // 409: the tender stopped accepting bids. Nothing about that resolves by
      // retrying, and the timer would fire it every thirty seconds.
      this.stopAutoSave();
      this.biddingClosed.set(true);
      this.toastService.error('This tender is no longer accepting bids.');
      return;
    }

    if (result === 'failed') {
      // Silent autosaves stay silent — a transient failure is retried in
      // thirty seconds and does not need a toast each time.
      if (!silent) this.toastService.error('Could not save your draft.');
      return;
    }

    this.lastSavedTime.set(new Date());
    if (!silent) this.toastService.success('Draft saved');
  }

  async saveDraftAndExit(): Promise<void> {
    await this.saveDraft();
    this.router.navigate(['/vendor/tenders', this.tenderId]);
  }

  confirmExit(): void {
    if (confirm('Save your progress before leaving?')) {
      void this.saveDraftAndExit();
    } else {
      this.router.navigate(['/vendor/tenders', this.tenderId]);
    }
  }

  // Submission
  async submitBid(): Promise<void> {
    if (!this.finalConfirmation()) {
      this.toastService.error('Please confirm the terms and conditions');
      return;
    }

    if (this.bidForm.invalid) {
      this.toastService.error('Please complete all required fields');
      return;
    }

    if (this.submitting()) return; // one click, one bid
    this.submitting.set(true);
    this.submitRefusal.set(null);

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

    const result = await this.vendorService.submitBidAsync(formData, this.tenderId);
    this.submitting.set(false);

    if (result.ok) {
      this.stopAutoSave(); // the draft is gone server-side; nothing left to save
      this.submittedBidId.set(result.bidId);
      this.submittedBidNumber.set(result.bidNumber);
      this.showSuccessModal.set(true);
      return;
    }

    switch (result.kind) {
      case 'ineligible':
        // `confirmEligibility` is an attestation, not the check. The server
        // re-ran it and listed everything this vendor falls short on.
        this.submitRefusal.set({ kind: 'ineligible', reasons: result.reasons });
        break;
      case 'validation':
        this.submitRefusal.set({ kind: 'validation', messages: result.messages });
        this.applyServerFieldErrors(result.fieldErrors);
        break;
      case 'conflict':
        // Already bid, or the window shut. Neither resolves by clicking again.
        this.biddingClosed.set(true);
        this.stopAutoSave();
        this.submitRefusal.set({ kind: 'conflict', message: result.message });
        break;
      default:
        this.submitRefusal.set({ kind: 'failed', message: result.message });
    }
  }

  /**
   * Binds the server's validation messages to the controls they name, so the
   * error appears beside the field rather than only in a summary. Keys arrive
   * already camelCased by `problemFieldErrors`.
   */
  private applyServerFieldErrors(fieldErrors: Record<string, string[]>): void {
    for (const [control, messages] of Object.entries(fieldErrors)) {
      const target = this.bidForm.get(control);
      if (!target) continue;
      target.setErrors({ ...(target.errors ?? {}), server: messages.join(' ') });
      target.markAsTouched();
    }
  }

  serverError(fieldName: string): string | null {
    return (this.bidForm.get(fieldName)?.errors?.['server'] as string) ?? null;
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
