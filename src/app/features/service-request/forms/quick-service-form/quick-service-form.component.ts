import { Component, Input, Output, EventEmitter, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { DraftService } from '../../../../core/services/draft.service';
import { interval, Subscription } from 'rxjs';
import { FormStepperComponent } from '../../../../shared/components/form-stepper/form-stepper.component';
import { FormProgressComponent } from '../../../../shared/components/form-progress/form-progress.component';
import { AutoSaveIndicatorComponent } from '../../../../shared/components/auto-save-indicator/auto-save-indicator.component';
import { FileUploadComponent } from '../../../../shared/components/file-upload/file-upload.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';

const STEP_LABELS = [
  'Service Type',
  'Equipment List',
  'Service Context',
  'Budget & Timing'
];

@Component({
  selector: 'app-quick-service-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormStepperComponent,
    FormProgressComponent,
    AutoSaveIndicatorComponent,
    FileUploadComponent,
    IconComponent
  ],
  templateUrl: './quick-service-form.component.html',
  styleUrl: './quick-service-form.component.scss'
})
export class QuickServiceFormComponent implements OnInit, OnDestroy {
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
  totalSteps = signal(4);
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

  // Common equipment/appliance types for quick services
  commonEquipment: Record<string, string[]> = {
    'ac': ['Split AC', 'Window AC', 'Cassette AC', 'Central AC'],
    'washing': ['Front Load Washer', 'Top Load Washer', 'Semi-Automatic', 'Dryer'],
    'refrigerator': ['Single Door', 'Double Door', 'Side by Side', 'Mini Fridge'],
    'appliance': ['Microwave', 'Dishwasher', 'Water Purifier', 'Geyser', 'Chimney', 'Other'],
    'default': ['Type 1', 'Type 2', 'Type 3', 'Other']
  };

  serviceTypes = ['Regular Service', 'Deep Cleaning', 'Repair', 'Installation', 'Gas Refill', 'Inspection'];
  urgencyLevels = ['Today', 'Tomorrow', 'Within 3 days', 'Within a week', 'Flexible'];
  budgetRanges = ['Under ₹500', '₹500 - ₹1,000', '₹1,000 - ₹2,500', '₹2,500 - ₹5,000', 'Above ₹5,000'];

  async ngOnInit(): Promise<void> {
    this.initializeForm();
    await this.loadDraftIfExists();
    this.startAutoSave();
    this.currentStep.set(this.initialStep);
  }

  ngOnDestroy(): void {
    this.autoSaveSubscription?.unsubscribe();
  }

  private initializeForm(): void {
    this.form = this.fb.group({
      // Step 1: Service Type
      step1: this.fb.group({
        serviceType: ['', Validators.required],
        issueDescription: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(500)]],
        issuePhoto: [null]
      }),

      // Step 2: Equipment List
      step2: this.fb.group({
        equipmentList: this.fb.array([
          this.createEquipmentGroup()
        ]),
        additionalNotes: ['']
      }),

      // Step 3: Service Context
      step3: this.fb.group({
        address: ['', Validators.required],
        landmark: [''],
        pincode: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
        contactName: ['', Validators.required],
        contactPhone: ['', [Validators.required, Validators.pattern(/^[6-9]\d{9}$/)]],
        preferredDate: ['', Validators.required],
        preferredTime: ['', Validators.required],
        accessInstructions: ['']
      }),

      // Step 4: Budget & Timing
      step4: this.fb.group({
        budgetRange: ['', Validators.required],
        urgency: ['', Validators.required],
        paymentMode: ['', Validators.required],
        specialRequests: [''],
        termsAccepted: [false, Validators.requiredTrue]
      })
    });
  }

  private createEquipmentGroup(): FormGroup {
    return this.fb.group({
      type: ['', Validators.required],
      brand: [''],
      model: [''],
      quantity: [1, [Validators.required, Validators.min(1)]]
    });
  }

  private async loadDraftIfExists(): Promise<void> {
    if (this.draftId) {
      const draft = await this.draftService.getDraftAsync(this.draftId);
      if (draft?.formData) {
        // Handle equipment list array
        const formData = draft.formData;
        const step2Data = formData['step2'] as Record<string, unknown> | undefined;
        const equipmentData = step2Data?.['equipmentList'] as unknown[] | undefined;
        if (equipmentData && equipmentData.length > 1) {
          const equipmentList = this.getEquipmentList();
          for (let i = 1; i < equipmentData.length; i++) {
            equipmentList.push(this.createEquipmentGroup());
          }
        }
        this.form.patchValue(draft.formData);
        this.lastSaved.set(new Date(draft.lastSaved));
      }
    }
  }

  private startAutoSave(): void {
    this.autoSaveSubscription = interval(30000).subscribe(() => {
      if (this.form.dirty) {
        void this.saveDraft();
      }
    });
  }

  async saveDraft(): Promise<void> {
    this.saveStatus.set('saving');

    try {
      const draftData = {
        id: this.draftId || undefined,
        serviceId: this.serviceId,
        serviceName: this.serviceName,
        category: 'quick_service' as const,
        formData: this.form.value,
        currentStep: this.currentStep(),
        totalSteps: this.totalSteps()
      };

      const savedId = await this.draftService.saveDraftAsync(draftData);

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
      void this.saveDraft();
    }
  }

  nextStep(): void {
    if (this.canGoNext() && this.isCurrentStepValid()) {
      this.currentStep.update(s => s + 1);
      void this.saveDraft();
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
        const control = stepGroup.get(key);
        if (control instanceof FormArray) {
          control.controls.forEach(c => {
            if (c instanceof FormGroup) {
              Object.keys(c.controls).forEach(k => c.get(k)?.markAsTouched());
            }
          });
        } else {
          control?.markAsTouched();
        }
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

  getEquipmentTypes(): string[] {
    const serviceKey = this.serviceId.toLowerCase();
    for (const key of Object.keys(this.commonEquipment)) {
      if (serviceKey.includes(key)) {
        return this.commonEquipment[key];
      }
    }
    return this.commonEquipment['default'];
  }

  // Equipment List FormArray helpers
  getEquipmentList(): FormArray {
    return this.form.get('step2.equipmentList') as FormArray;
  }

  addEquipment(): void {
    const list = this.getEquipmentList();
    list.push(this.createEquipmentGroup());
  }

  removeEquipment(index: number): void {
    const list = this.getEquipmentList();
    if (list.length > 1) {
      list.removeAt(index);
    }
  }

  getEquipmentControl(index: number, controlName: string) {
    const list = this.getEquipmentList();
    return list.at(index)?.get(controlName);
  }

  hasEquipmentError(index: number, controlName: string, error: string): boolean {
    const control = this.getEquipmentControl(index, controlName);
    return control ? control.hasError(error) && control.touched : false;
  }

  // Submission
  async onSubmit(): Promise<void> {
    if (this.form.valid) {
      await this.saveDraft();
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
