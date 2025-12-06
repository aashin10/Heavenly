import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ContactFormData, SubjectOption } from './contact.model';

@Component({
  selector: 'app-contact-page',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './contact.page.html',
  styleUrl: './contact.page.scss'
})
export class ContactPageComponent {
  formData = signal<ContactFormData>({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
  });

  readonly subjectOptions: SubjectOption[] = [
    { value: '', label: 'Select a subject' },
    { value: 'employer', label: "I'm an Employer" },
    { value: 'jobseeker', label: "I'm a Job Seeker" },
    { value: 'partnership', label: 'Partnership Inquiry' },
    { value: 'general', label: 'General Inquiry' },
    { value: 'support', label: 'Technical Support' },
  ];

  onSubmit(): void {
    alert('Thank you for contacting us! We will get back to you soon.\n\nThis is a demo. In a real application, this would send your message to our team.');
    this.resetForm();
  }

  updateField(field: keyof ContactFormData, value: string): void {
    this.formData.update(current => ({
      ...current,
      [field]: value
    }));
  }

  private resetForm(): void {
    this.formData.set({
      name: '',
      email: '',
      phone: '',
      subject: '',
      message: '',
    });
  }
}
