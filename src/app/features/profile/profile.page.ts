import { Component, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { ProfileFormData, INITIAL_PROFILE_DATA } from './profile.model';
import { AppDatePipe } from '../../shared/pipes/app-date.pipe';
import { IconComponent } from '../../shared/components/icon/icon.component';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[\d\s\-+()]{10,}$/;

@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [FormsModule, AppDatePipe, IconComponent],
  templateUrl: './profile.page.html',
  styleUrl: './profile.page.scss'
})
export class ProfilePageComponent {
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);

  readonly user = this.authService.user;
  readonly isEditing = signal(false);
  readonly formData = signal<ProfileFormData>({ ...INITIAL_PROFILE_DATA });

  readonly userTypeLabel = computed(() => {
    const userType = this.user()?.userType;
    switch (userType) {
      case 'employer':
        return 'Employer';
      case 'admin':
        return 'Administrator';
      default:
        return 'Job Seeker';
    }
  });

  readonly skillsArray = computed(() => {
    const skills = this.user()?.skills;
    return skills?.filter(s => s.length > 0) ?? [];
  });

  readonly isEmployer = computed(() => this.user()?.userType === 'employer');
  readonly isApplicant = computed(() => this.user()?.userType === 'applicant');

  constructor() {
    this.resetFormData();
  }

  startEditing(): void {
    this.resetFormData();
    this.isEditing.set(true);
  }

  cancelEditing(): void {
    this.resetFormData();
    this.isEditing.set(false);
  }

  updateField<K extends keyof ProfileFormData>(field: K, value: ProfileFormData[K]): void {
    const sanitizedValue = value.replaceAll(/[<>]/g, '');
    this.formData.update(current => ({
      ...current,
      [field]: sanitizedValue
    }));
  }

  handleSubmit(event: Event): void {
    event.preventDefault();
    
    const data = this.formData();
    
    if (!data.name.trim()) {
      this.toastService.error('Name is required');
      return;
    }

    if (data.phone && !PHONE_PATTERN.test(data.phone)) {
      this.toastService.error('Please enter a valid phone number');
      return;
    }

    if (this.isEmployer() && !data.company.trim()) {
      this.toastService.error('Company name is required for employers');
      return;
    }

    const skillsArray = data.skills
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    try {
      this.authService.updateProfile({
        name: data.name.trim(),
        phone: data.phone.trim() || undefined,
        location: data.location.trim() || undefined,
        company: data.company.trim() || undefined,
        bio: data.bio.trim() || undefined,
        skills: skillsArray.length > 0 ? skillsArray : undefined,
        experience: data.experience.trim() || undefined
      });

      this.toastService.success('Profile updated successfully!');
      this.isEditing.set(false);
    } catch (error) {
      console.error('Failed to update profile:', error);
      this.toastService.error('Failed to update profile. Please try again.');
    }
  }

  private resetFormData(): void {
    const currentUser = this.user();
    if (currentUser) {
      this.formData.set({
        name: currentUser.name || '',
        phone: currentUser.phone || '',
        location: currentUser.location || '',
        company: currentUser.company || '',
        bio: currentUser.bio || '',
        skills: currentUser.skills?.join(', ') || '',
        experience: currentUser.experience || ''
      });
    }
  }
}
