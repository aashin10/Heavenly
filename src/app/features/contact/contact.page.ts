import { Component, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ContactFormData, SubjectOption } from './contact.model';
import { ToastService } from '../../core/services/toast.service';
import { IconComponent } from '../../shared/components/icon/icon.component';

const INITIAL_FORM_DATA: ContactFormData = {
  name: '',
  email: '',
  phone: '',
  subject: '',
  message: '',
};

@Component({
  selector: 'app-contact-page',
  standalone: true,
  imports: [FormsModule, IconComponent],
  templateUrl: './contact.page.html',
  styleUrl: './contact.page.scss'
})
export class ContactPageComponent {
  private readonly toastService = inject(ToastService);
  private readonly sanitizer = inject(DomSanitizer);

  formData = signal<ContactFormData>({ ...INITIAL_FORM_DATA });
  isSubmitting = signal<boolean>(false);

  /** Google Maps embed pinned to the office's exact coordinates (no API key required). */
  readonly mapUrl: SafeResourceUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
    'https://www.google.com/maps?q=28.6581170,77.1182416&output=embed'
  );

  readonly subjectOptions: SubjectOption[] = [
    { value: '', label: 'Select a subject' },
    { value: 'employer', label: "I'm an Employer" },
    { value: 'jobseeker', label: "I'm a Job Seeker" },
    { value: 'partnership', label: 'Partnership Inquiry' },
    { value: 'general', label: 'General Inquiry' },
    { value: 'support', label: 'Technical Support' },
  ];

  onSubmit(form: NgForm): void {
    if (form.invalid) {
      this.toastService.error('Please fill in all required fields correctly.');
      return;
    }

    this.isSubmitting.set(true);

    // Simulate API call
    setTimeout(() => {
      this.toastService.success('Thank you for contacting us! We will get back to you soon.');
      this.resetForm(form);
      this.isSubmitting.set(false);
    }, 1500);
  }

  updateField(field: keyof ContactFormData, value: string): void {
    const sanitizedValue = this.sanitizeInput(value);
    this.formData.update(current => ({
      ...current,
      [field]: sanitizedValue
    }));
  }

  private sanitizeInput(input: string): string {
    // Basic sanitization to prevent XSS
    return input.replace(/[<>]/g, '');
  }

  private resetForm(form?: NgForm): void {
    this.formData.set({ ...INITIAL_FORM_DATA });
    if (form) {
      form.resetForm({ ...INITIAL_FORM_DATA });
    }
  }
}
