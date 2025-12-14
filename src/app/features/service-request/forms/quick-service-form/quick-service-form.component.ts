import { Component, Input, Output, EventEmitter, inject, signal, computed, OnInit, OnDestroy, ElementRef, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray, AbstractControl, ValidationErrors } from '@angular/forms';
import { DraftService } from '../../../../core/services/draft.service';
import { ToastService } from '../../../../core/services/toast.service';
import { interval, Subscription } from 'rxjs';
import { FormStepperComponent } from '../../../../shared/components/form-stepper/form-stepper.component';
import { FormProgressComponent } from '../../../../shared/components/form-progress/form-progress.component';
import { AutoSaveIndicatorComponent } from '../../../../shared/components/auto-save-indicator/auto-save-indicator.component';
import { FileUploadComponent } from '../../../../shared/components/file-upload/file-upload.component';

// Custom validator for future date
function futureDateValidator(control: AbstractControl): ValidationErrors | null {
  if (control.value) {
    const date = new Date(control.value);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (date < today) {
      return { futureDate: true };
    }
  }
  return null;
}

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
    FileUploadComponent
  ],
  templateUrl: './quick-service-form.component.html',
  styleUrl: './quick-service-form.component.scss'
})
export class QuickServiceFormComponent implements OnInit, OnDestroy, OnChanges {
  @Input({ required: true }) serviceId!: string;
  @Input({ required: true }) serviceName!: string;
  @Input() draftId: string | null = null;
  @Input() initialStep = 1;

  @Output() saved = new EventEmitter<string>();
  @Output() completed = new EventEmitter<string>();
  @Output() cancelled = new EventEmitter<void>();

  private readonly fb = inject(FormBuilder);
  private readonly draftService = inject(DraftService);
  private readonly toastService = inject(ToastService);
  private readonly elementRef = inject(ElementRef);
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

  // Equipment types signal - populated on init for proper template binding
  equipmentTypes = signal<string[]>([]);

  // Common equipment/appliance types for quick services
  private readonly commonEquipment: Record<string, string[]> = {
    'ac': ['Split AC', 'Window AC', 'Cassette AC', 'Central AC'],
    'washing': ['Front Load Washer', 'Top Load Washer', 'Semi-Automatic', 'Dryer'],
    'refrigerator': ['Single Door', 'Double Door', 'Side by Side', 'Mini Fridge'],
    'appliance': ['Microwave', 'Dishwasher', 'Water Purifier', 'Geyser', 'Chimney', 'Other'],
    'default': ['Type 1', 'Type 2', 'Type 3', 'Other']
  };

  serviceTypes = ['Regular Service', 'Deep Cleaning', 'Repair', 'Installation', 'Gas Refill', 'Inspection'];
  urgencyLevels = ['Today', 'Tomorrow', 'Within 3 days', 'Within a week', 'Flexible'];
  budgetRanges = ['Under ₹500', '₹500 - ₹1,000', '₹1,000 - ₹2,500', '₹2,500 - ₹5,000', 'Above ₹5,000'];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['serviceId']) {
      this.initializeEquipmentTypes();
    }
  }

  ngOnInit(): void {
    this.initializeEquipmentTypes();
    this.initializeForm();
    this.loadDraftIfExists();
    this.startAutoSave();
    this.currentStep.set(this.initialStep);
  }

  ngOnDestroy(): void {
    this.autoSaveSubscription?.unsubscribe();
  }

  private initializeEquipmentTypes(): void {
    const serviceKey = this.serviceId?.toLowerCase() || '';
    for (const key of Object.keys(this.commonEquipment)) {
      if (serviceKey.includes(key)) {
        this.equipmentTypes.set(this.commonEquipment[key]);
        return;
      }
    }
    this.equipmentTypes.set(this.commonEquipment['default']);
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
        preferredDate: ['', [Validators.required, futureDateValidator]],
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

  private loadDraftIfExists(): void {
    if (this.draftId) {
      const draft = this.draftService.getDraft(this.draftId);
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
        category: 'quick_service' as const,
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
      const invalidFields: string[] = [];
      Object.keys(stepGroup.controls).forEach(key => {
        const control = stepGroup.get(key);
        if (control instanceof FormArray) {
          control.controls.forEach(c => {
            if (c instanceof FormGroup) {
              Object.keys(c.controls).forEach(k => {
                const fc = c.get(k);
                fc?.markAsTouched();
                if (fc?.invalid) {
                  const label = this.getFieldLabel(k);
                  if (fc.hasError('required')) invalidFields.push(`${label} (Required)`);
                  else if (fc.hasError('minlength')) invalidFields.push(`${label} (Too Short)`);
                  else if (fc.hasError('maxlength')) invalidFields.push(`${label} (Too Long)`);
                  else if (fc.hasError('pattern')) invalidFields.push(`${label} (Invalid Format)`);
                  else if (fc.hasError('futureDate')) invalidFields.push(`${label} (Must be future date)`);
                  else invalidFields.push(label);
                }
              });
            }
          });
        } else {
          control?.markAsTouched();
          if (control?.invalid) {
            const label = this.getFieldLabel(key);
            if (control.hasError('required')) invalidFields.push(`${label} (Required)`);
            else if (control.hasError('minlength')) invalidFields.push(`${label} (Too Short)`);
            else if (control.hasError('maxlength')) invalidFields.push(`${label} (Too Long)`);
            else if (control.hasError('pattern')) invalidFields.push(`${label} (Invalid Format)`);
            else if (control.hasError('futureDate')) invalidFields.push(`${label} (Must be future date)`);
            else invalidFields.push(label);
          }
        }
      });
      
      // Show validation toast with specific field names
      if (invalidFields.length > 0) {
        const uniqueFields = [...new Set(invalidFields)];
        const fieldList = uniqueFields.slice(0, 3).join(', ');
        const more = uniqueFields.length > 3 ? ` and ${uniqueFields.length - 3} more` : '';
        this.toastService.show({
          message: `Validation failed: ${fieldList}${more}`,
          type: 'error',
          duration: 4000
        });
      }
      
      // Scroll to first invalid field
      this.scrollToFirstError();
    }
  }

  private scrollToFirstError(): void {
    setTimeout(() => {
      const invalidElements = this.elementRef.nativeElement.querySelectorAll('.ng-invalid.ng-touched, .error');
      for (let i = 0; i < invalidElements.length; i++) {
        const element = invalidElements[i] as HTMLElement;
        // Check if element is visible
        if (element.offsetParent !== null) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          if (element.tagName === 'INPUT' || element.tagName === 'SELECT' || element.tagName === 'TEXTAREA') {
            element.focus();
          }
          return;
        }
        
        // If hidden (like radio input), try to scroll to parent
        let parent = element.parentElement;
        while (parent) {
          if (parent.offsetParent !== null && (parent.classList.contains('form-group') || parent.classList.contains('radio-card') || parent.classList.contains('quality-card'))) {
            parent.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
          }
          parent = parent.parentElement;
          if (!parent || parent === this.elementRef.nativeElement) break;
        }
      }
    }, 100);
  }

  private getFieldLabel(controlName: string): string {
    const labels: Record<string, string> = {
      serviceType: 'Service Type',
      issueDescription: 'Issue Description',
      type: 'Equipment Type',
      quantity: 'Quantity',
      address: 'Address',
      pincode: 'PIN Code',
      contactName: 'Contact Name',
      contactPhone: 'Contact Phone',
      preferredDate: 'Preferred Date',
      preferredTime: 'Preferred Time',
      budgetRange: 'Budget Range',
      urgency: 'Urgency',
      paymentMode: 'Payment Mode',
      termsAccepted: 'Terms & Conditions'
    };
    return labels[controlName] || controlName.replaceAll(/([A-Z])/g, ' $1').trim();
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
  onSubmit(): void {
    if (this.form.valid) {
      this.saveDraft();
      this.completed.emit(this.draftId || undefined);
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
