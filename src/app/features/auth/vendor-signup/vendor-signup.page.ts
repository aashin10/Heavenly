import { Component, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ServiceAuthService } from '../../../core/services/service-auth.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  VendorSignupFormData,
  VendorSignupStep1,
  VendorSignupStep2,
  VendorSignupStep3,
  VendorSignupStep4,
  VendorBankDetails,
  SERVICES
} from '../../../core/models/service.model';
import { INDIAN_STATES, MAJOR_CITIES, getGroupedServices } from '../../../shared/utils/service-category.util';
import { BUSINESS_TYPES, VendorStepInfo } from './vendor-signup.model';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { LogoComponent } from '../../../shared/components/logo/logo.component';

const MIN_PASSWORD_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[\d\s\-+()]{10,}$/;
const GST_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[\dA-Z]$/;
const PAN_PATTERN = /^[A-Z]{5}\d{4}[A-Z]$/;
const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;

@Component({
  selector: 'app-vendor-signup-page',
  standalone: true,
  imports: [FormsModule, RouterLink, IconComponent, LogoComponent],
  templateUrl: './vendor-signup.page.html',
  styleUrl: './vendor-signup.page.scss'
})
export class VendorSignupPageComponent {
  private readonly router = inject(Router);
  private readonly serviceAuthService = inject(ServiceAuthService);
  private readonly toastService = inject(ToastService);

  readonly businessTypes = BUSINESS_TYPES;
  readonly states = INDIAN_STATES;
  readonly cities = MAJOR_CITIES;
  readonly allServices = SERVICES;
  readonly groupedServices = getGroupedServices();

  readonly currentStep = signal<number>(1);
  readonly totalSteps = 4;
  readonly error = signal<string>('');
  readonly isSubmitting = signal<boolean>(false);
  readonly showTerms = signal<boolean>(false);
  readonly termsAccepted = signal<boolean>(false);

  // Form data
  readonly step1Data = signal<VendorSignupStep1>({
    businessName: '',
    businessType: 'individual_contractor',
    gstNumber: '',
    panNumber: '',
    yearEstablished: new Date().getFullYear()
  });

  readonly step2Data = signal<VendorSignupStep2>({
    primaryContactPerson: '',
    designation: '',
    email: '',
    phone: '',
    alternatePhone: '',
    registeredAddress: '',
    city: '',
    state: '',
    pinCode: ''
  });

  readonly step3Data = signal<VendorSignupStep3>({
    serviceCapabilities: [],
    serviceAreas: []
  });

  readonly step4Data = signal<VendorSignupStep4>({
    bankDetails: {
      accountHolderName: '',
      accountNumber: '',
      ifscCode: '',
      bankName: ''
    },
    password: '',
    confirmPassword: '',
    termsAccepted: false
  });

  readonly steps = computed<VendorStepInfo[]>(() => {
    const current = this.currentStep();
    return [
      { number: 1, title: 'Business Info', isActive: current === 1, isCompleted: current > 1 },
      { number: 2, title: 'Contact', isActive: current === 2, isCompleted: current > 2 },
      { number: 3, title: 'Services', isActive: current === 3, isCompleted: current > 3 },
      { number: 4, title: 'Credentials', isActive: current === 4, isCompleted: false }
    ];
  });

  readonly passwordStrength = computed(() => {
    const password = this.step4Data().password;
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

  // Step 1 updaters
  updateStep1Field<K extends keyof VendorSignupStep1>(field: K, value: VendorSignupStep1[K]): void {
    this.step1Data.update(current => ({ ...current, [field]: value }));
  }

  // Step 2 updaters
  updateStep2Field<K extends keyof VendorSignupStep2>(field: K, value: string): void {
    this.step2Data.update(current => ({ ...current, [field]: value }));
  }

  // Step 3 updaters
  toggleService(serviceId: string): void {
    this.step3Data.update(current => {
      const services = [...current.serviceCapabilities];
      const index = services.indexOf(serviceId);
      if (index === -1) {
        services.push(serviceId);
      } else {
        services.splice(index, 1);
      }
      return { ...current, serviceCapabilities: services };
    });
  }

  isServiceSelected(serviceId: string): boolean {
    return this.step3Data().serviceCapabilities.includes(serviceId);
  }

  toggleCity(city: string): void {
    this.step3Data.update(current => {
      const areas = [...current.serviceAreas];
      const index = areas.indexOf(city);
      if (index === -1) {
        areas.push(city);
      } else {
        areas.splice(index, 1);
      }
      return { ...current, serviceAreas: areas };
    });
  }

  isCitySelected(city: string): boolean {
    return this.step3Data().serviceAreas.includes(city);
  }

  // Step 4 updaters
  updateStep4Field<K extends keyof VendorSignupStep4>(field: K, value: VendorSignupStep4[K]): void {
    this.step4Data.update(current => ({ ...current, [field]: value }));
  }

  updateBankField<K extends keyof VendorBankDetails>(field: K, value: string): void {
    this.step4Data.update(current => ({
      ...current,
      bankDetails: { ...current.bankDetails, [field]: value }
    }));
  }

  nextStep(): void {
    this.error.set('');

    let isValid = false;
    switch (this.currentStep()) {
      case 1:
        isValid = this.validateStep1();
        break;
      case 2:
        isValid = this.validateStep2();
        break;
      case 3:
        isValid = this.validateStep3();
        break;
      default:
        isValid = true;
    }

    if (isValid && this.currentStep() < this.totalSteps) {
      this.currentStep.update(step => step + 1);
    }
  }

  prevStep(): void {
    this.error.set('');
    if (this.currentStep() > 1) {
      this.currentStep.update(step => step - 1);
    }
  }

  private validateStep1(): boolean {
    const data = this.step1Data();

    if (!data.businessName.trim()) {
      this.error.set('Business name is required');
      return false;
    }

    if (!data.panNumber.trim()) {
      this.error.set('PAN number is required');
      return false;
    }

    if (!PAN_PATTERN.test(data.panNumber.toUpperCase())) {
      this.error.set('Please enter a valid PAN number');
      return false;
    }

    if (data.businessType !== 'individual_contractor' && data.gstNumber) {
      if (!GST_PATTERN.test(data.gstNumber.toUpperCase())) {
        this.error.set('Please enter a valid GST number');
        return false;
      }
    }

    const currentYear = new Date().getFullYear();
    if (data.yearEstablished < 1900 || data.yearEstablished > currentYear) {
      this.error.set('Please enter a valid year of establishment');
      return false;
    }

    return true;
  }

  private validateStep2(): boolean {
    const data = this.step2Data();

    if (!data.primaryContactPerson.trim()) {
      this.error.set('Primary contact person is required');
      return false;
    }

    if (!data.designation.trim()) {
      this.error.set('Designation is required');
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

    if (!data.registeredAddress.trim()) {
      this.error.set('Registered address is required');
      return false;
    }

    if (!data.city.trim()) {
      this.error.set('City is required');
      return false;
    }

    if (!data.state.trim()) {
      this.error.set('State is required');
      return false;
    }

    if (!data.pinCode.trim() || data.pinCode.length !== 6) {
      this.error.set('Please enter a valid 6-digit PIN code');
      return false;
    }

    return true;
  }

  private validateStep3(): boolean {
    const data = this.step3Data();

    if (data.serviceCapabilities.length === 0) {
      this.error.set('Please select at least one service you provide');
      return false;
    }

    if (data.serviceAreas.length === 0) {
      this.error.set('Please select at least one service area');
      return false;
    }

    return true;
  }

  private validateStep4(): boolean {
    const data = this.step4Data();
    const bank = data.bankDetails;

    if (!bank.accountHolderName.trim()) {
      this.error.set('Account holder name is required');
      return false;
    }

    if (!bank.accountNumber.trim()) {
      this.error.set('Account number is required');
      return false;
    }

    if (!IFSC_PATTERN.test(bank.ifscCode.toUpperCase())) {
      this.error.set('Please enter a valid IFSC code');
      return false;
    }

    if (!bank.bankName.trim()) {
      this.error.set('Bank name is required');
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

  handleTermsChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.termsAccepted.set(target.checked);
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

  async handleSubmit(): Promise<void> {
    this.error.set('');

    if (!this.validateStep4()) {
      return;
    }

    if (!this.termsAccepted()) {
      this.error.set('You must accept the Terms and Conditions');
      return;
    }

    this.isSubmitting.set(true);

    const formData: VendorSignupFormData = {
      step1: this.step1Data(),
      step2: this.step2Data(),
      step3: this.step3Data(),
      step4: {
        ...this.step4Data(),
        termsAccepted: this.termsAccepted()
      }
    };

    const success = await this.serviceAuthService.signupVendorAsync(formData);

    if (success) {
      this.router.navigate(['/verification-pending']);
    } else {
      this.error.set('An account with this email already exists');
    }

    this.isSubmitting.set(false);
  }
}
