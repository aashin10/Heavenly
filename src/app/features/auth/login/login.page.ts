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

  handleLoginSubmit(): void {
    this.error.set('');
    this.isSubmitting.set(true);

    const data = this.loginData();
    const success = this.authService.login(data.email, data.password);

    if (success) {
      this.router.navigate(['/dashboard']);
    } else {
      this.error.set('Invalid email or password');
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
      phone: data.phone,
      company: data.userType === 'employer' ? data.company : undefined,
      location: data.location,
      acceptedTerms: this.termsAccepted(),
    });

    if (success) {
      this.toastService.success('Account created successfully! Please login.');
      this.isLogin.set(true);
      this.termsAccepted.set(false);
      this.signupData.set({ ...INITIAL_SIGNUP_DATA });
    } else {
      this.error.set('Email already exists');
    }

    this.isSubmitting.set(false);
  }
}
