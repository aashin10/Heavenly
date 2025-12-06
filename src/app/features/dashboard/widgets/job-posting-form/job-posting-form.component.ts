import { Component, EventEmitter, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { JobFormData, DOMAINS, JOB_TYPES, INITIAL_JOB_FORM } from '../../dashboard.model';

@Component({
  selector: 'app-job-posting-form',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './job-posting-form.component.html',
  styleUrl: './job-posting-form.component.scss'
})
export class JobPostingFormComponent {
  @Output() submitJob = new EventEmitter<JobFormData>();
  @Output() cancelForm = new EventEmitter<void>();

  readonly domains = DOMAINS;
  readonly jobTypes = JOB_TYPES;

  formData = signal<JobFormData>({ ...INITIAL_JOB_FORM });

  updateField<K extends keyof JobFormData>(field: K, value: JobFormData[K]): void {
    this.formData.update(current => ({
      ...current,
      [field]: value
    }));
  }

  handleSubmit(): void {
    this.submitJob.emit(this.formData());
    this.formData.set({ ...INITIAL_JOB_FORM });
  }

  handleCancel(): void {
    this.cancelForm.emit();
  }
}
