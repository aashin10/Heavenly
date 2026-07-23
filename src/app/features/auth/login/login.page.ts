import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ServiceAuthService } from '../../../core/services/service-auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { UserType } from '../../../core/models/user.model';
import { Vendor } from '../../../core/models/service.model';
import { 
  LoginFormData, 
  SignupFormData, 
  ServiceLoginFormData,
  ServiceLoginUserType,
  PortalType,
  INITIAL_LOGIN_DATA, 
  INITIAL_SIGNUP_DATA,
  INITIAL_SERVICE_LOGIN_DATA
} from './login.model';
import { TermsModalComponent } from './terms-modal.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { LogoComponent } from '../../../shared/components/logo/logo.component';

const MIN_PASSWORD_LENGTH = 6;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[\d\s\-+()]{10,}$/;

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [FormsModule, RouterLink, TermsModalComponent, IconComponent, LogoComponent],
  templateUrl: './login.page.html',
  styleUrl: './login.page.scss'
})
export class LoginPageComponent {
  private readonly authService = inject(AuthService);
  private readonly serviceAuthService = inject(ServiceAuthService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  // Portal toggle - Jobs vs Services
  portalType = signal<PortalType>('jobs');

  /** Remember-me preference (UI only for now — wired when auth is unified). */
  rememberMe = signal<boolean>(false);

  // Service user type toggle - Requester vs Vendor
  serviceUserType = signal<ServiceLoginUserType>('service_requester');

  isLogin = signal<boolean>(true);
  showTerms = signal<boolean>(false);
  termsAccepted = signal<boolean>(false);
  error = signal<string>('');
  isSubmitting = signal<boolean>(false);

  loginData = signal<LoginFormData>({ ...INITIAL_LOGIN_DATA });
  signupData = signal<SignupFormData>({ ...INITIAL_SIGNUP_DATA });
  serviceLoginData = signal<ServiceLoginFormData>({ ...INITIAL_SERVICE_LOGIN_DATA });

  constructor() {
    // Allow deep-linking into a portal/role/mode, e.g. /login?portal=services
    // from the services page, or /login?mode=signup&role=employer from the
    // homepage "Hire Manpower" card.
    const portal = this.route.snapshot.queryParamMap.get('portal');
    if (portal === 'services' || portal === 'jobs') {
      this.portalType.set(portal);
    }
    if (this.route.snapshot.queryParamMap.get('mode') === 'signup') {
      this.isLogin.set(false);
    }
    const role = this.route.snapshot.queryParamMap.get('role');
    if (role === 'vendor' || role === 'service_requester') {
      this.portalType.set('services');
      this.serviceUserType.set(role);
      this.serviceLoginData.update(current => ({ ...current, serviceUserType: role }));
    } else if (role === 'employer' || role === 'applicant') {
      this.portalType.set('jobs');
      this.signupData.update(current => ({ ...current, userType: role }));
    }
  }

  handleRememberMeChange(event: Event): void {
    this.rememberMe.set((event.target as HTMLInputElement).checked);
  }

  setPortalType(type: PortalType): void {
    this.portalType.set(type);
    this.error.set('');
    // Reset forms when switching portals
    this.loginData.set({ ...INITIAL_LOGIN_DATA });
    this.serviceLoginData.set({ ...INITIAL_SERVICE_LOGIN_DATA });
  }

  setServiceUserType(type: ServiceLoginUserType): void {
    this.serviceUserType.set(type);
    this.serviceLoginData.update(current => ({
      ...current,
      serviceUserType: type
    }));
    this.error.set('');
  }

  updateServiceLoginField(field: keyof ServiceLoginFormData, value: string): void {
    this.serviceLoginData.update(current => ({
      ...current,
      [field]: value
    }));
  }

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

  handleServiceLoginSubmit(): void {
    this.error.set('');
    
    const data = this.serviceLoginData();
    
    // Validate email format
    if (!this.isValidEmail(data.email)) {
      this.error.set('Please enter a valid email address');
      return;
    }

    this.isSubmitting.set(true);
    const user = this.serviceAuthService.loginServiceUser(
      data.email, 
      data.password, 
      data.serviceUserType
    );

    if (user) {
      // Navigate based on user type - we use the form data since we know what type was selected
      if (data.serviceUserType === 'vendor') {
        const vendor = user as Vendor;
        if (vendor.verificationStatus === 'pending') {
          this.router.navigate(['/verification-pending']);
        } else {
          this.router.navigate(['/vendor-dashboard']);
        }
      } else {
        this.router.navigate(['/service-requester-dashboard']);
      }
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

    if (data.password.length < MIN_PASSWORD_LENGTH) {
      this.error.set(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
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
