import { Component, Input, Output, EventEmitter, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { DraftService } from '../../../../core/services/draft.service';
import { interval, Subscription } from 'rxjs';
import { FormStepperComponent } from '../../../../shared/components/form-stepper/form-stepper.component';
import { FormProgressComponent } from '../../../../shared/components/form-progress/form-progress.component';
import { AutoSaveIndicatorComponent } from '../../../../shared/components/auto-save-indicator/auto-save-indicator.component';
import { FileUploadComponent } from '../../../../shared/components/file-upload/file-upload.component';

const STEP_LABELS = [
  'Service Selection',
  'Area & Quantity',
  'Materials & Finish',
  'Execution Context',
  'Budget & Timeline'
];

@Component({
  selector: 'app-mid-complexity-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormStepperComponent,
    FormProgressComponent,
    AutoSaveIndicatorComponent,
    FileUploadComponent
  ],
  templateUrl: './mid-complexity-form.component.html',
  styleUrl: './mid-complexity-form.component.scss'
})
export class MidComplexityFormComponent implements OnInit, OnDestroy {
  @Input({ required: true }) serviceId!: string;
  @Input({ required: true }) serviceName!: string;
  @Input() draftId: string | null = null;
  @Input() initialStep = 1;

  @Output() saved = new EventEmitter<string>();
  @Output() completed = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  private readonly fb = inject(FormBuilder);
  private readonly draftService = inject(DraftService);
  private autoSaveSubscription?: Subscription;

  // State
  currentStep = signal(1);
  totalSteps = signal(5);
  stepLabels = signal(STEP_LABELS);
  lastSaved = signal<Date | null>(null);
  saveStatus = signal<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Computed
  progress = computed(() => (this.currentStep() / this.totalSteps()) * 100);
  canGoBack = computed(() => this.currentStep() > 1);
  canGoNext = computed(() => this.currentStep() < this.totalSteps());
  isLastStep = computed(() => this.currentStep() === this.totalSteps());

  // Form
  form!: FormGroup;

  // Options
  propertyTypes = ['Apartment', 'Independent House', 'Villa', 'Office', 'Retail Shop', 'Warehouse', 'Other'];
  serviceSubTypes: Record<string, string[]> = {
    'plumbing': ['Leak Repair', 'Pipe Installation', 'Fixture Installation', 'Drain Cleaning', 'Water Heater', 'Other'],
    'electrical': ['Wiring', 'Switch/Socket', 'Fan Installation', 'Light Fixtures', 'Electrical Panel', 'Other'],
    'painting': ['Interior Walls', 'Exterior Walls', 'Ceiling', 'Wood Finishing', 'Texture/Design', 'Other'],
    'carpentry': ['Furniture', 'Doors/Windows', 'Cabinets', 'Flooring', 'Repair', 'Other'],
    'default': ['Installation', 'Repair', 'Maintenance', 'Replacement', 'Other']
  };
  qualityLevels = ['Economy', 'Standard', 'Premium', 'Luxury'];
  executionPreferences = ['Weekdays only', 'Weekends only', 'Any day', 'Specific dates'];
  budgetRanges = [
    'Under ₹10,000',
    '₹10,000 - ₹25,000',
    '₹25,000 - ₹50,000',
    '₹50,000 - ₹1,00,000',
    '₹1,00,000 - ₹2,50,000',
    'Above ₹2,50,000'
  ];

  ngOnInit(): void {
    this.initializeForm();
    this.loadDraftIfExists();
    this.startAutoSave();
    this.currentStep.set(this.initialStep);
  }

  ngOnDestroy(): void {
    this.autoSaveSubscription?.unsubscribe();
  }

  private initializeForm(): void {
    this.form = this.fb.group({
      // Step 1: Service Selection
      step1: this.fb.group({
        serviceSubType: ['', Validators.required],
        serviceSubTypeOther: [''],
        problemDescription: ['', [Validators.required, Validators.minLength(20), Validators.maxLength(1000)]],
        urgencyLevel: ['', Validators.required],
        propertyType: ['', Validators.required],
        propertyTypeOther: ['']
      }),

      // Step 2: Area & Quantity
      step2: this.fb.group({
        numberOfRooms: [1, [Validators.required, Validators.min(1)]],
        totalArea: ['', Validators.required],
        areaUnit: ['sqft', Validators.required],
        floorNumber: [''],
        hasElevatorAccess: [false],
        parkingAvailable: [false],
        additionalAreas: this.fb.array([]),
        siteAddress: ['', Validators.required],
        city: ['', Validators.required],
        pincode: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]]
      }),

      // Step 3: Materials & Finish
      step3: this.fb.group({
        materialPreference: ['', Validators.required],
        qualityLevel: ['', Validators.required],
        brandPreferences: [''],
        colorPreferences: [''],
        finishType: [''],
        referenceImages: [null],
        existingMaterialsToRetain: [''],
        disposalRequired: [false],
        specificProducts: this.fb.array([])
      }),

      // Step 4: Execution Context
      step4: this.fb.group({
        occupancyStatus: ['', Validators.required],
        furnitureMovingRequired: [false],
        coveringRequired: [false],
        accessRestrictions: [''],
        petInHouse: [false],
        childrenInHouse: [false],
        preferredExecutionDays: ['', Validators.required],
        preferredTimeSlot: ['', Validators.required],
        expectedDuration: [''],
        contactName: ['', Validators.required],
        contactPhone: ['', [Validators.required, Validators.pattern(/^[6-9]\d{9}$/)]],
        contactEmail: ['', Validators.email]
      }),

      // Step 5: Budget & Timeline
      step5: this.fb.group({
        estimatedBudget: ['', Validators.required],
        budgetIncludes: ['', Validators.required],
        paymentPreference: ['', Validators.required],
        expectedStartDate: ['', Validators.required],
        flexibleOnDates: [false],
        mustCompleteBy: [''],
        quotationsNeeded: [true],
        numberOfQuotations: [3],
        additionalNotes: [''],
        termsAccepted: [false, Validators.requiredTrue]
      })
    });
  }

  private loadDraftIfExists(): void {
    if (this.draftId) {
      const draft = this.draftService.getDraft(this.draftId);
      if (draft?.formData) {
        this.form.patchValue(draft.formData);
        this.lastSaved.set(new Date(draft.lastSaved));
      }
    }
  }

  private startAutoSave(): void {
    this.autoSaveSubscription = interval(30000).subscribe(() => {
      if (this.form.dirty) {
        this.saveDraft();
      }
    });
  }

  saveDraft(): void {
    this.saveStatus.set('saving');

    try {
      const draftData = {
        id: this.draftId || undefined,
        serviceId: this.serviceId,
        serviceName: this.serviceName,
        category: 'mid_complexity' as const,
        formData: this.form.value,
        currentStep: this.currentStep(),
        totalSteps: this.totalSteps()
      };

      const savedId = this.draftService.saveDraft(draftData);
      
      if (!this.draftId) {
        this.draftId = savedId;
        this.saved.emit(savedId);
      }

      this.lastSaved.set(new Date());
      this.saveStatus.set('saved');
      this.form.markAsPristine();

      setTimeout(() => {
        if (this.saveStatus() === 'saved') {
          this.saveStatus.set('idle');
        }
      }, 3000);
    } catch {
      this.saveStatus.set('error');
    }
  }

  // Step Navigation
  goToStep(step: number): void {
    if (step >= 1 && step <= this.totalSteps()) {
      if (step > this.currentStep()) {
        if (!this.isCurrentStepValid()) {
          this.markCurrentStepAsTouched();
          return;
        }
      }
      this.currentStep.set(step);
      this.saveDraft();
    }
  }

  nextStep(): void {
    if (this.canGoNext() && this.isCurrentStepValid()) {
      this.currentStep.update(s => s + 1);
      this.saveDraft();
    } else {
      this.markCurrentStepAsTouched();
    }
  }

  previousStep(): void {
    if (this.canGoBack()) {
      this.currentStep.update(s => s - 1);
    }
  }

  private isCurrentStepValid(): boolean {
    const stepGroup = this.form.get(`step${this.currentStep()}`) as FormGroup;
    return stepGroup ? stepGroup.valid : false;
  }

  private markCurrentStepAsTouched(): void {
    const stepGroup = this.form.get(`step${this.currentStep()}`) as FormGroup;
    if (stepGroup) {
      Object.keys(stepGroup.controls).forEach(key => {
        stepGroup.get(key)?.markAsTouched();
      });
    }
  }

  // Form Helpers
  getStepGroup(step: number): FormGroup {
    return this.form.get(`step${step}`) as FormGroup;
  }

  getControl(step: number, controlName: string) {
    return this.getStepGroup(step)?.get(controlName);
  }

  hasError(step: number, controlName: string, error: string): boolean {
    const control = this.getControl(step, controlName);
    return control ? control.hasError(error) && control.touched : false;
  }

  getServiceSubTypes(): string[] {
    const category = this.serviceId.toLowerCase();
    for (const key of Object.keys(this.serviceSubTypes)) {
      if (category.includes(key)) {
        return this.serviceSubTypes[key];
      }
    }
    return this.serviceSubTypes['default'];
  }

  // FormArray helpers
  getAdditionalAreas(): FormArray {
    return this.form.get('step2.additionalAreas') as FormArray;
  }

  addAdditionalArea(): void {
    const areas = this.getAdditionalAreas();
    areas.push(this.fb.group({
      name: ['', Validators.required],
      area: ['', Validators.required]
    }));
  }

  removeAdditionalArea(index: number): void {
    const areas = this.getAdditionalAreas();
    areas.removeAt(index);
  }

  getSpecificProducts(): FormArray {
    return this.form.get('step3.specificProducts') as FormArray;
  }

  addSpecificProduct(): void {
    const products = this.getSpecificProducts();
    products.push(this.fb.group({
      name: ['', Validators.required],
      quantity: ['']
    }));
  }

  removeSpecificProduct(index: number): void {
    const products = this.getSpecificProducts();
    products.removeAt(index);
  }

  // Submission
  onSubmit(): void {
    if (this.form.valid) {
      this.saveDraft();
      this.completed.emit();
    } else {
      this.markCurrentStepAsTouched();
    }
  }

  onCancel(): void {
    this.cancelled.emit();
  }

  formatLastSaved(): string {
    const saved = this.lastSaved();
    if (!saved) return '';
    return this.draftService.formatLastSaved(saved);
  }
}
