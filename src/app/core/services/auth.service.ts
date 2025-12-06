import { Injectable, signal, computed, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { User } from '../models/user.model';
import { ToastService } from './toast.service';

const USERS_KEY = 'heavenly_users';
const CURRENT_USER_KEY = 'heavenly_current_user';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly toastService = inject(ToastService);
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
    if (savedUser) {
      this.userSignal.set(JSON.parse(savedUser));
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
      }
      this.toastService.success(`Welcome back, ${foundUser.name}!`);
      return true;
    }

    return false;
  }

  logout(): void {
    this.userSignal.set(null);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem(CURRENT_USER_KEY);
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

  getInitials(name: string): string {
    return name
      .split(' ')
      .filter(n => n.length > 0)
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }
}
