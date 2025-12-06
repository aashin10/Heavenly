import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { UserType } from '../../../core/models/user.model';
import { 
  LoginFormData, 
  SignupFormData, 
  INITIAL_LOGIN_DATA, 
  INITIAL_SIGNUP_DATA 
} from './login.model';
import { TermsModalComponent } from './terms-modal.component';

/** Email validation regex pattern */
const EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/** Phone number validation regex pattern (optional, but must be valid if provided) */
const PHONE_PATTERN = /^[\d\s\-()+]*$/;

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [FormsModule, RouterLink, TermsModalComponent],
  templateUrl: './login.page.html',
  styleUrl: './login.page.scss'
})
export class LoginPageComponent {
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);

  isLogin = signal<boolean>(true);
  showTerms = signal<boolean>(false);
  termsAccepted = signal<boolean>(false);
  error = signal<string>('');
  isSubmitting = signal<boolean>(false);

  loginData = signal<LoginFormData>({ ...INITIAL_LOGIN_DATA });
  signupData = signal<SignupFormData>({ ...INITIAL_SIGNUP_DATA });

  updateLoginField(field: keyof LoginFormData, value: string): void {
    this.loginData.update(current => ({
      ...current,
      [field]: value
    }));
  }

  updateSignupField<K extends keyof SignupFormData>(field: K, value: SignupFormData[K]): void {
    this.signupData.update(current => ({
      ...current,
      [field]: value
    }));
  }

  setUserType(type: UserType): void {
    this.updateSignupField('userType', type);
  }

  toggleView(isLoginView: boolean): void {
    this.isLogin.set(isLoginView);
    this.error.set('');
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

  /** Type-safe handler for checkbox change events */
  handleTermsCheckboxChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.termsAccepted.set(target.checked);
  }

  /** Validates email format */
  private isValidEmail(email: string): boolean {
    return EMAIL_PATTERN.test(email);
  }

  /** Validates phone format (if provided) */
  private isValidPhone(phone: string): boolean {
    return !phone || PHONE_PATTERN.test(phone);
  }

  handleLoginSubmit(): void {
    this.error.set('');
    
    const data = this.loginData();
    
    // Validate email format
    if (!this.isValidEmail(data.email)) {
      this.error.set('Please enter a valid email address');
      return;
    }

    this.isSubmitting.set(true);
    const success = this.authService.login(data.email, data.password);

    if (success) {
      this.router.navigate(['/dashboard']);
    } else {
      // Generic error message to prevent user enumeration
      this.error.set('Invalid credentials. Please check your email and password.');
    }
    
    this.isSubmitting.set(false);
  }

  handleSignupSubmit(): void {
    this.error.set('');
    const data = this.signupData();

    if (!this.termsAccepted()) {
      this.error.set('You must accept the Terms and Conditions to create an account');
      return;
    }

    // Validate email format
    if (!this.isValidEmail(data.email)) {
      this.error.set('Please enter a valid email address');
      return;
    }

    // Validate company name for employers
    if (data.userType === 'employer' && !data.company.trim()) {
      this.error.set('Company name is required for employers');
      return;
    }

    // Validate phone format if provided
    if (!this.isValidPhone(data.phone)) {
      this.error.set('Please enter a valid phone number');
      return;
    }

    if (data.password !== data.confirmPassword) {
      this.error.set('Passwords do not match');
      return;
    }

    if (data.password.length < 6) {
      this.error.set('Password must be at least 6 characters');
      return;
    }

    this.isSubmitting.set(true);

    const success = this.authService.signup({
      name: data.name,
      email: data.email,
      password: data.password,
      userType: data.userType,
      phone: data.phone || undefined,
      company: data.userType === 'employer' ? data.company : undefined,
      location: data.location || undefined,
      acceptedTerms: this.termsAccepted(),
    });

    if (success) {
      this.toastService.success('Account created successfully! Please login.');
      this.isLogin.set(true);
      this.termsAccepted.set(false);
      this.signupData.set({ ...INITIAL_SIGNUP_DATA });
    } else {
      // Generic error message to prevent user enumeration
      this.error.set('Unable to create account. Please try again or contact support.');
    }

    this.isSubmitting.set(false);
  }
}
