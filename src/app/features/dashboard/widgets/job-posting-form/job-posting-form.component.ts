import { Component, EventEmitter, Output, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { JobFormData, DOMAINS, JOB_TYPES, INITIAL_JOB_FORM } from '../../dashboard.model';
import { ToastService } from '../../../../core/services/toast.service';

interface ValidationErrors {
  title?: string;
  company?: string;
  location?: string;
  salary?: string;
  description?: string;
  requirements?: string;
}

@Component({
  selector: 'app-job-posting-form',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './job-posting-form.component.html',
  styleUrl: './job-posting-form.component.scss'
})
export class JobPostingFormComponent {
  private readonly toastService = inject(ToastService);

  @Output() submitJob = new EventEmitter<JobFormData>();
  @Output() cancelForm = new EventEmitter<void>();

  readonly domains = DOMAINS;
  readonly jobTypes = JOB_TYPES;

  formData = signal<JobFormData>({ ...INITIAL_JOB_FORM });
  validationErrors = signal<ValidationErrors>({});
  submitted = signal(false);

  readonly isFormValid = computed(() => {
    const data = this.formData();
    return !!(
      data.title.trim() &&
      data.company.trim() &&
      data.domain &&
      data.location.trim() &&
      data.type &&
      data.salary.trim() &&
      data.description.trim() &&
      data.requirements.trim()
    );
  });

  updateField<K extends keyof JobFormData>(field: K, value: JobFormData[K]): void {
    this.formData.update(current => ({
      ...current,
      [field]: value
    }));
    
    // Clear validation error when field is updated
    if (this.submitted()) {
      this.validateField(field);
    }
  }

  private validateField(field: keyof JobFormData): void {
    const data = this.formData();
    const errors = { ...this.validationErrors() };
    const fieldValue = data[field]?.toString().trim();
    
    if (field in errors || !fieldValue) {
      if (fieldValue) {
        delete errors[field as keyof ValidationErrors];
      } else {
        errors[field as keyof ValidationErrors] = 'This field is required';
      }
      this.validationErrors.set(errors);
    }
  }

  private validateForm(): boolean {
    const data = this.formData();
    const errors: ValidationErrors = {};

    if (!data.title.trim()) errors.title = 'Job title is required';
    if (!data.company.trim()) errors.company = 'Company name is required';
    if (!data.location.trim()) errors.location = 'Location is required';
    if (!data.salary.trim()) errors.salary = 'Salary range is required';
    if (!data.description.trim()) errors.description = 'Job description is required';
    if (!data.requirements.trim()) errors.requirements = 'Requirements are required';

    this.validationErrors.set(errors);
    return Object.keys(errors).length === 0;
  }

  handleSubmit(): void {
    this.submitted.set(true);
    
    if (!this.validateForm()) {
      this.toastService.error('Please fill in all required fields');
      return;
    }

    this.submitJob.emit(this.formData());
    this.formData.set({ ...INITIAL_JOB_FORM });
    this.validationErrors.set({});
    this.submitted.set(false);
  }

  handleCancel(): void {
    this.cancelForm.emit();
  }

  getFieldError(field: keyof ValidationErrors): string | undefined {
    return this.validationErrors()[field];
  }
}
