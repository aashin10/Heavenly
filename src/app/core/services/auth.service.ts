import { Injectable, signal, computed, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { User, UserType } from '../models/user.model';
import { ToastService } from './toast.service';
import { environment } from '../../../environments/environment';
import { AuthApiService } from '../api/auth-api.service';
import { TokenStore } from '../api/token-store.service';
import { AuthResponse } from '../api/auth-api.models';

const USERS_KEY = 'heavenly_users';
const CURRENT_USER_KEY = 'heavenly_current_user';
const LOGIN_TIMESTAMP_KEY = 'heavenly_login_timestamp';
const SESSION_TIMEOUT_MS = 3600000; // 1 hour

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly toastService = inject(ToastService);
  private readonly authApi = inject(AuthApiService);
  private readonly tokenStore = inject(TokenStore);
  private readonly userSignal = signal<User | null>(null);
  
  readonly user = this.userSignal.asReadonly();
  readonly isLoggedIn = computed(() => this.userSignal() !== null);
  readonly isAdmin = computed(() => this.userSignal()?.userType === 'admin');

  constructor() {
    this.loadUserFromStorage();
  }

  private loadUserFromStorage(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const savedUser = localStorage.getItem(CURRENT_USER_KEY);
    const loginTimestamp = localStorage.getItem(LOGIN_TIMESTAMP_KEY);

    if (savedUser && loginTimestamp) {
      const now = Date.now();
      const loginTime = Number.parseInt(loginTimestamp, 10);
      
      if (now - loginTime > SESSION_TIMEOUT_MS) {
        this.logout();
        this.toastService.info('Session expired. Please login again.');
        return;
      }

      this.userSignal.set(JSON.parse(savedUser));
    } else if (savedUser) {
      // If we have a user but no timestamp (legacy session), expire it to be safe
      this.logout();
    }
  }

  private getUsers(): User[] {
    if (!isPlatformBrowser(this.platformId)) return [];

    const users = localStorage.getItem(USERS_KEY);
    return users ? JSON.parse(users) : [];
  }

  private saveUsers(users: User[]): void {
    if (!isPlatformBrowser(this.platformId)) return;

    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  signup(userData: Omit<User, 'id' | 'createdAt'> & { password: string }): boolean {
    const users = this.getUsers();
    
    if (users.some(u => u.email === userData.email)) {
      return false;
    }

    const newUser: User = {
      id: Date.now().toString(),
      email: userData.email,
      name: userData.name,
      userType: userData.userType,
      phone: userData.phone,
      company: userData.company,
      location: userData.location,
      bio: userData.bio,
      skills: userData.skills,
      experience: userData.experience,
      acceptedTerms: userData.acceptedTerms,
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);
    this.saveUsers(users);
    
    return true;
  }

  login(email: string, password: string): boolean {
    const users = this.getUsers();
    const foundUser = users.find(u => u.email === email);

    if (foundUser) {
      // NOTE: Password validation is intentionally skipped for demo purposes.
      // In a real application, you must hash and verify passwords securely.
      this.userSignal.set(foundUser);
      if (isPlatformBrowser(this.platformId)) {
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(foundUser));
        localStorage.setItem(LOGIN_TIMESTAMP_KEY, Date.now().toString());
      }
      this.toastService.success(`Welcome back, ${foundUser.name}!`);
      return true;
    }

    return false;
  }

  /**
   * Login used by the UI. Delegates to the real API when `useRealApi` is on,
   * otherwise runs the synchronous localStorage mock (wrapped in a resolved
   * promise so callers have one async shape either way). Returns whether login
   * succeeded; the caller shows the generic error on `false`.
   */
  async loginAsync(email: string, password: string): Promise<boolean> {
    if (!environment.useRealApi) {
      return this.login(email, password);
    }

    try {
      const res = await firstValueFrom(this.authApi.login({ email, password }));
      this.applyAuthResponse(res);
      this.toastService.success(`Welcome back, ${res.name}!`);
      return true;
    } catch {
      return false;
    }
  }

  /** Signup used by the UI — real API when enabled, else the mock. */
  async signupAsync(
    userData: Omit<User, 'id' | 'createdAt'> & { password: string }
  ): Promise<boolean> {
    if (!environment.useRealApi) {
      return this.signup(userData);
    }

    try {
      // Current API register returns { userId } only; log in afterwards to get
      // a session. Once register returns tokens, collapse this to one call.
      await firstValueFrom(
        this.authApi.register({
          fullName: userData.name,
          email: userData.email,
          phone: userData.phone ?? '',
          location: userData.location,
          password: userData.password,
          companyName: userData.company,
          userType: this.toApiUserType(userData.userType),
        })
      );
      return await this.loginAsync(userData.email, userData.password);
    } catch {
      return false;
    }
  }

  /** Stores tokens + maps an AuthResponse into the session user signal. */
  private applyAuthResponse(res: AuthResponse): void {
    this.tokenStore.set(res.accessToken, res.refreshToken);
    const user: User = {
      id: res.userId,
      email: res.email,
      name: res.name,
      userType: res.userType.toLowerCase() as UserType,
      company: res.company ?? undefined,
      acceptedTerms: true,
      createdAt: new Date().toISOString(),
    };
    this.userSignal.set(user);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
      localStorage.setItem(LOGIN_TIMESTAMP_KEY, Date.now().toString());
    }
  }

  /** Domain enum ('employer') → the PascalCase name the current API expects. */
  private toApiUserType(userType: UserType): string {
    return userType.charAt(0).toUpperCase() + userType.slice(1);
  }

  logout(): void {
    // Best-effort server-side invalidation when running against the real API.
    if (environment.useRealApi && this.tokenStore.accessToken) {
      firstValueFrom(this.authApi.logout()).catch(() => undefined);
    }
    this.tokenStore.clear();
    this.userSignal.set(null);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem(CURRENT_USER_KEY);
      localStorage.removeItem(LOGIN_TIMESTAMP_KEY);
    }
  }

  updateProfile(updates: Partial<User>): void {
    const currentUser = this.userSignal();
    if (!currentUser) return;

    const updatedUser = { ...currentUser, ...updates };
    this.userSignal.set(updatedUser);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updatedUser));
    }

    const users = this.getUsers();
    const userIndex = users.findIndex(u => u.id === currentUser.id);
    if (userIndex !== -1) {
      users[userIndex] = updatedUser;
      this.saveUsers(users);
    }
  }

  acceptTerms(): void {
    this.updateProfile({ acceptedTerms: true });
  }

  getInitials(name: string | null | undefined): string {
    // A malformed session must degrade to an empty avatar, not crash the navbar.
    if (!name) return '';
    return name
      .split(' ')
      .filter(n => n.length > 0)
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }
}
