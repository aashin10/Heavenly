import { Component, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ServiceAuthService } from '../../../core/services/service-auth.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  RequesterType,
  RequesterSignupFormData,
  RequesterSignupStep1,
  RequesterSignupStep2,
  RequesterSignupStep3Individual,
  RequesterSignupStep3SME,
  RequesterSignupStep3LargeOrg
} from '../../../core/models/service.model';
import { REQUESTER_ACCOUNT_TYPES, StepInfo } from './service-requester-signup.model';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { LogoComponent } from '../../../shared/components/logo/logo.component';

const MIN_PASSWORD_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[\d\s\-+()]{10,}$/;

@Component({
  selector: 'app-service-requester-signup-page',
  standalone: true,
  imports: [FormsModule, RouterLink, IconComponent, LogoComponent],
  templateUrl: './service-requester-signup.page.html',
  styleUrl: './service-requester-signup.page.scss'
})
export class ServiceRequesterSignupPageComponent {
  private readonly router = inject(Router);
  private readonly serviceAuthService = inject(ServiceAuthService);
  private readonly toastService = inject(ToastService);

  readonly accountTypes = REQUESTER_ACCOUNT_TYPES;
  readonly currentStep = signal<number>(1);
  readonly totalSteps = 3;
  readonly error = signal<string>('');
  readonly isSubmitting = signal<boolean>(false);
  readonly showTerms = signal<boolean>(false);
  readonly termsAccepted = signal<boolean>(false);
  readonly marketingConsent = signal<boolean>(false);

  // Form data
  readonly step1Data = signal<RequesterSignupStep1>({ requesterType: 'individual' });
  readonly step2Data = signal<RequesterSignupStep2>({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  });
  readonly step3Individual = signal<RequesterSignupStep3Individual>({
    city: '',
    address: ''
  });
  readonly step3SME = signal<RequesterSignupStep3SME>({
    organizationName: '',
    gstNumber: '',
    businessAddress: '',
    city: '',
    authorizedPersonName: '',
    designation: ''
  });
  readonly step3LargeOrg = signal<RequesterSignupStep3LargeOrg>({
    organizationName: '',
    gstNumber: '',
    registeredAddress: '',
    city: '',
    authorizedPersonName: '',
    designation: '',
    department: ''
  });

  readonly steps = computed<StepInfo[]>(() => {
    const current = this.currentStep();
    return [
      { number: 1, title: 'Account Type', isActive: current === 1, isCompleted: current > 1 },
      { number: 2, title: 'Basic Info', isActive: current === 2, isCompleted: current > 2 },
      { number: 3, title: 'Details', isActive: current === 3, isCompleted: false }
    ];
  });

  readonly passwordStrength = computed(() => {
    const password = this.step2Data().password;
    if (!password) return { level: 0, label: '', color: '' };
    
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;

    if (strength <= 2) return { level: strength, label: 'Weak', color: 'red' };
    if (strength <= 3) return { level: strength, label: 'Medium', color: 'yellow' };
    return { level: strength, label: 'Strong', color: 'green' };
  });

  readonly selectedRequesterType = computed(() => this.step1Data().requesterType);

  selectAccountType(type: RequesterType): void {
    this.step1Data.set({ requesterType: type });
  }

  updateStep2Field<K extends keyof RequesterSignupStep2>(field: K, value: RequesterSignupStep2[K]): void {
    this.step2Data.update(current => ({ ...current, [field]: value }));
  }

  updateStep3IndividualField<K extends keyof RequesterSignupStep3Individual>(field: K, value: string): void {
    this.step3Individual.update(current => ({ ...current, [field]: value }));
  }

  updateStep3SMEField<K extends keyof RequesterSignupStep3SME>(field: K, value: string): void {
    this.step3SME.update(current => ({ ...current, [field]: value }));
  }

  updateStep3LargeOrgField<K extends keyof RequesterSignupStep3LargeOrg>(field: K, value: string): void {
    this.step3LargeOrg.update(current => ({ ...current, [field]: value }));
  }

  nextStep(): void {
    this.error.set('');
    
    if (this.currentStep() === 2 && !this.validateStep2()) {
      return;
    }

    if (this.currentStep() < this.totalSteps) {
      this.currentStep.update(step => step + 1);
    }
  }

  prevStep(): void {
    this.error.set('');
    if (this.currentStep() > 1) {
      this.currentStep.update(step => step - 1);
    }
  }

  private validateStep2(): boolean {
    const data = this.step2Data();

    if (!data.fullName.trim()) {
      this.error.set('Full name is required');
      return false;
    }

    if (!EMAIL_PATTERN.test(data.email)) {
      this.error.set('Please enter a valid email address');
      return false;
    }

    if (!PHONE_PATTERN.test(data.phone)) {
      this.error.set('Please enter a valid phone number');
      return false;
    }

    if (data.password.length < MIN_PASSWORD_LENGTH) {
      this.error.set(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return false;
    }

    if (data.password !== data.confirmPassword) {
      this.error.set('Passwords do not match');
      return false;
    }

    return true;
  }

  private validateStep3(): boolean {
    const type = this.selectedRequesterType();

    switch (type) {
      case 'individual':
        return this.validateIndividual();
      case 'sme':
        return this.validateSME();
      case 'large_organization':
        return this.validateLargeOrg();
      default:
        return false;
    }
  }

  private validateIndividual(): boolean {
    const data = this.step3Individual();
    if (!data.city.trim()) {
      this.error.set('City is required');
      return false;
    }
    return true;
  }

  private validateSME(): boolean {
    const data = this.step3SME();
    if (!data.organizationName.trim()) {
      this.error.set('Organization name is required');
      return false;
    }
    if (!data.businessAddress.trim()) {
      this.error.set('Business address is required');
      return false;
    }
    if (!data.city.trim()) {
      this.error.set('City is required');
      return false;
    }
    if (!data.authorizedPersonName.trim()) {
      this.error.set('Authorized person name is required');
      return false;
    }
    if (!data.designation.trim()) {
      this.error.set('Designation is required');
      return false;
    }
    return true;
  }

  private validateLargeOrg(): boolean {
    const data = this.step3LargeOrg();
    if (!data.organizationName.trim()) {
      this.error.set('Organization name is required');
      return false;
    }
    if (!data.gstNumber.trim()) {
      this.error.set('GST number is required for large organizations');
      return false;
    }
    if (!data.registeredAddress.trim()) {
      this.error.set('Registered address is required');
      return false;
    }
    if (!data.city.trim()) {
      this.error.set('City is required');
      return false;
    }
    if (!data.authorizedPersonName.trim()) {
      this.error.set('Authorized person name is required');
      return false;
    }
    if (!data.designation.trim()) {
      this.error.set('Designation is required');
      return false;
    }
    return true;
  }

  handleTermsChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.termsAccepted.set(target.checked);
  }

  handleMarketingChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.marketingConsent.set(target.checked);
  }

  openTerms(): void {
    this.showTerms.set(true);
  }

  closeTerms(): void {
    this.showTerms.set(false);
  }

  acceptTerms(): void {
    this.termsAccepted.set(true);
    this.showTerms.set(false);
  }

  handleSubmit(): void {
    this.error.set('');

    if (!this.validateStep3()) {
      return;
    }

    if (!this.termsAccepted()) {
      this.error.set('You must accept the Terms and Conditions');
      return;
    }

    this.isSubmitting.set(true);

    const formData: RequesterSignupFormData = {
      step1: this.step1Data(),
      step2: this.step2Data(),
      termsAccepted: this.termsAccepted(),
      marketingConsent: this.marketingConsent()
    };

    // Add step 3 data based on requester type
    const type = this.selectedRequesterType();
    if (type === 'individual') {
      formData.step3Individual = this.step3Individual();
    } else if (type === 'sme') {
      formData.step3SME = this.step3SME();
    } else {
      formData.step3LargeOrg = this.step3LargeOrg();
    }

    const success = this.serviceAuthService.signupServiceRequester(formData);

    if (success) {
      this.router.navigate(['/service-requester-dashboard']);
    } else {
      this.error.set('An account with this email already exists');
    }

    this.isSubmitting.set(false);
  }
}
