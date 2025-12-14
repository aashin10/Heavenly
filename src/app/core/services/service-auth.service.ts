import { Injectable, signal, computed, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ToastService } from './toast.service';
import {
  ServiceUserType,
  ServiceRequester,
  Vendor,
  VendorStatus,
  RequesterSignupFormData,
  VendorSignupFormData
} from '../models/service.model';

const SERVICE_USERS_KEY = 'heavenly_service_users';
const VENDORS_KEY = 'heavenly_vendors';
const CURRENT_SERVICE_USER_KEY = 'heavenly_current_service_user';
const SERVICE_LOGIN_TIMESTAMP_KEY = 'heavenly_service_login_timestamp';
const SESSION_TIMEOUT_MS = 3600000; // 1 hour

export interface ServiceUserSession {
  id: string;
  email: string;
  userType: ServiceUserType;
  displayName: string;
  vendorStatus?: VendorStatus;
}

@Injectable({
  providedIn: 'root'
})
export class ServiceAuthService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly toastService = inject(ToastService);
  
  private readonly currentUserSignal = signal<ServiceUserSession | null>(null);
  private readonly serviceRequesterSignal = signal<ServiceRequester | null>(null);
  private readonly vendorSignal = signal<Vendor | null>(null);

  readonly currentUser = this.currentUserSignal.asReadonly();
  readonly serviceRequester = this.serviceRequesterSignal.asReadonly();
  readonly vendor = this.vendorSignal.asReadonly();

  readonly isServiceLoggedIn = computed(() => this.currentUserSignal() !== null);
  readonly isServiceRequester = computed(() => this.currentUserSignal()?.userType === 'service_requester');
  readonly isVendor = computed(() => this.currentUserSignal()?.userType === 'vendor');
  readonly isServiceAdmin = computed(() => this.currentUserSignal()?.userType === 'service_admin');
  readonly isVendorVerified = computed(() => this.vendorSignal()?.verificationStatus === 'verified');
  readonly isVendorPending = computed(() => this.vendorSignal()?.verificationStatus === 'pending');

  constructor() {
    this.loadUserFromStorage();
  }

  private loadUserFromStorage(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const savedSession = localStorage.getItem(CURRENT_SERVICE_USER_KEY);
    const loginTimestamp = localStorage.getItem(SERVICE_LOGIN_TIMESTAMP_KEY);

    if (savedSession && loginTimestamp) {
      const now = Date.now();
      const loginTime = Number.parseInt(loginTimestamp, 10);

      if (now - loginTime > SESSION_TIMEOUT_MS) {
        this.logout();
        this.toastService.info('Session expired. Please login again.');
        return;
      }

      const session: ServiceUserSession = JSON.parse(savedSession);
      this.currentUserSignal.set(session);

      // Refresh session timestamp on successful load (extends session on page refresh)
      localStorage.setItem(SERVICE_LOGIN_TIMESTAMP_KEY, Date.now().toString());

      // Load full profile based on user type
      if (session.userType === 'service_requester') {
        this.loadServiceRequesterProfile(session.id);
      } else if (session.userType === 'vendor') {
        this.loadVendorProfile(session.id);
      }
    }
  }

  private loadServiceRequesterProfile(id: string): void {
    const requesters = this.getServiceRequesters();
    const requester = requesters.find(r => r.id === id);
    if (requester) {
      this.serviceRequesterSignal.set(requester);
    }
  }

  private loadVendorProfile(id: string): void {
    const vendors = this.getVendors();
    const vendor = vendors.find(v => v.id === id);
    if (vendor) {
      this.vendorSignal.set(vendor);
    }
  }

  private getServiceRequesters(): ServiceRequester[] {
    if (!isPlatformBrowser(this.platformId)) return [];
    const data = localStorage.getItem(SERVICE_USERS_KEY);
    return data ? JSON.parse(data) : [];
  }

  private saveServiceRequesters(requesters: ServiceRequester[]): void {
    if (!isPlatformBrowser(this.platformId)) return;
    localStorage.setItem(SERVICE_USERS_KEY, JSON.stringify(requesters));
  }

  private getVendors(): Vendor[] {
    if (!isPlatformBrowser(this.platformId)) return [];
    const data = localStorage.getItem(VENDORS_KEY);
    return data ? JSON.parse(data) : [];
  }

  private saveVendors(vendors: Vendor[]): void {
    if (!isPlatformBrowser(this.platformId)) return;
    localStorage.setItem(VENDORS_KEY, JSON.stringify(vendors));
  }

  signupServiceRequester(formData: RequesterSignupFormData): boolean {
    const requesters = this.getServiceRequesters();

    // Check if email already exists
    if (requesters.some(r => r.email === formData.step2.email)) {
      return false;
    }

    const now = new Date();
    const baseData = {
      id: `sr_${Date.now()}`,
      email: formData.step2.email,
      phone: formData.step2.phone,
      requesterType: formData.step1.requesterType,
      city: '',
      createdAt: now,
      isEmailVerified: false
    };

    let newRequester: ServiceRequester;

    switch (formData.step1.requesterType) {
      case 'individual':
        newRequester = {
          ...baseData,
          requesterType: 'individual',
          fullName: formData.step2.fullName,
          city: formData.step3Individual?.city || '',
          address: formData.step3Individual?.address
        };
        break;
      case 'sme':
        newRequester = {
          ...baseData,
          requesterType: 'sme',
          organizationName: formData.step3SME?.organizationName || '',
          gstNumber: formData.step3SME?.gstNumber,
          businessAddress: formData.step3SME?.businessAddress || '',
          city: formData.step3SME?.city || '',
          authorizedPersonName: formData.step3SME?.authorizedPersonName || '',
          designation: formData.step3SME?.designation || ''
        };
        break;
      case 'large_organization':
        newRequester = {
          ...baseData,
          requesterType: 'large_organization',
          organizationName: formData.step3LargeOrg?.organizationName || '',
          gstNumber: formData.step3LargeOrg?.gstNumber || '',
          registeredAddress: formData.step3LargeOrg?.registeredAddress || '',
          city: formData.step3LargeOrg?.city || '',
          authorizedPersonName: formData.step3LargeOrg?.authorizedPersonName || '',
          designation: formData.step3LargeOrg?.designation || '',
          department: formData.step3LargeOrg?.department
        };
        break;
    }

    requesters.push(newRequester);
    this.saveServiceRequesters(requesters);

    // Auto-login after signup
    const session: ServiceUserSession = {
      id: newRequester.id,
      email: newRequester.email,
      userType: 'service_requester',
      displayName: this.getRequesterDisplayName(newRequester)
    };

    this.setSession(session);
    this.serviceRequesterSignal.set(newRequester);
    this.toastService.success('Account created successfully!');

    return true;
  }

  signupVendor(formData: VendorSignupFormData): boolean {
    const vendors = this.getVendors();

    // Check if email already exists
    if (vendors.some(v => v.email === formData.step2.email)) {
      return false;
    }

    const now = new Date();
    const newVendor: Vendor = {
      id: `vendor_${Date.now()}`,
      businessName: formData.step1.businessName,
      businessType: formData.step1.businessType,
      gstNumber: formData.step1.gstNumber,
      panNumber: formData.step1.panNumber,
      yearEstablished: formData.step1.yearEstablished,
      primaryContactPerson: formData.step2.primaryContactPerson,
      designation: formData.step2.designation,
      email: formData.step2.email,
      phone: formData.step2.phone,
      alternatePhone: formData.step2.alternatePhone,
      registeredAddress: formData.step2.registeredAddress,
      city: formData.step2.city,
      state: formData.step2.state,
      pinCode: formData.step2.pinCode,
      serviceCapabilities: formData.step3.serviceCapabilities,
      serviceAreas: formData.step3.serviceAreas,
      verificationStatus: 'pending',
      documentsUploaded: {
        businessCertificate: formData.step4.businessCertificateFile?.name,
        gstCertificate: formData.step4.gstCertificateFile?.name,
        tradeLicense: formData.step4.tradeLicenseFile?.name,
        insuranceCertificate: formData.step4.insuranceCertificateFile?.name
      },
      bankDetails: formData.step4.bankDetails,
      createdAt: now,
      isEmailVerified: false
    };

    vendors.push(newVendor);
    this.saveVendors(vendors);

    // Auto-login after signup (but with pending status)
    const session: ServiceUserSession = {
      id: newVendor.id,
      email: newVendor.email,
      userType: 'vendor',
      displayName: newVendor.businessName,
      vendorStatus: 'pending'
    };

    this.setSession(session);
    this.vendorSignal.set(newVendor);
    this.toastService.success('Application submitted for verification!');

    return true;
  }

  loginServiceRequester(email: string, _password: string): boolean {
    const requesters = this.getServiceRequesters();
    const requester = requesters.find(r => r.email === email);

    if (requester) {
      const session: ServiceUserSession = {
        id: requester.id,
        email: requester.email,
        userType: 'service_requester',
        displayName: this.getRequesterDisplayName(requester)
      };

      this.setSession(session);
      this.serviceRequesterSignal.set(requester);
      this.toastService.success(`Welcome back!`);
      return true;
    }

    return false;
  }

  loginVendor(email: string, _password: string): boolean {
    const vendors = this.getVendors();
    const vendor = vendors.find(v => v.email === email);

    if (vendor) {
      const session: ServiceUserSession = {
        id: vendor.id,
        email: vendor.email,
        userType: 'vendor',
        displayName: vendor.businessName,
        vendorStatus: vendor.verificationStatus
      };

      this.setSession(session);
      this.vendorSignal.set(vendor);
      this.toastService.success(`Welcome back, ${vendor.businessName}!`);
      return true;
    }

    return false;
  }

  private setSession(session: ServiceUserSession): void {
    this.currentUserSignal.set(session);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(CURRENT_SERVICE_USER_KEY, JSON.stringify(session));
      localStorage.setItem(SERVICE_LOGIN_TIMESTAMP_KEY, Date.now().toString());
    }
  }

  /**
   * Refresh the session timestamp to extend the session.
   * This should be called on user activity to prevent session expiry during active use.
   */
  refreshSession(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.currentUserSignal()) {
      localStorage.setItem(SERVICE_LOGIN_TIMESTAMP_KEY, Date.now().toString());
    }
  }

  logout(): void {
    this.currentUserSignal.set(null);
    this.serviceRequesterSignal.set(null);
    this.vendorSignal.set(null);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem(CURRENT_SERVICE_USER_KEY);
      localStorage.removeItem(SERVICE_LOGIN_TIMESTAMP_KEY);
    }
  }

  private getRequesterDisplayName(requester: ServiceRequester): string {
    switch (requester.requesterType) {
      case 'individual':
        return requester.fullName;
      case 'sme':
      case 'large_organization':
        return requester.organizationName;
    }
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

  /**
   * Get the current logged-in user's session (includes userType)
   */
  getCurrentUserSession(): ServiceUserSession | null {
    return this.currentUserSignal();
  }

  /**
   * Get the current logged-in user's full profile
   * Returns ServiceRequester or Vendor based on user type
   */
  getCurrentUser(): ServiceRequester | Vendor | null {
    const session = this.currentUserSignal();
    if (!session) return null;

    if (session.userType === 'service_requester') {
      return this.serviceRequesterSignal();
    } else if (session.userType === 'vendor') {
      return this.vendorSignal();
    }
    return null;
  }

  /**
   * Unified login method for service portal
   */
  loginServiceUser(email: string, password: string, userType: 'service_requester' | 'vendor'): ServiceRequester | Vendor | null {
    if (userType === 'service_requester') {
      const success = this.loginServiceRequester(email, password);
      return success ? this.serviceRequesterSignal() : null;
    } else {
      const success = this.loginVendor(email, password);
      return success ? this.vendorSignal() : null;
    }
  }

  updateServiceRequesterProfile(updates: Partial<ServiceRequester>): void {
    const currentRequester = this.serviceRequesterSignal();
    if (!currentRequester) return;

    const updatedRequester = { ...currentRequester, ...updates } as ServiceRequester;
    this.serviceRequesterSignal.set(updatedRequester);

    const requesters = this.getServiceRequesters();
    const index = requesters.findIndex(r => r.id === currentRequester.id);
    if (index !== -1) {
      requesters[index] = updatedRequester;
      this.saveServiceRequesters(requesters);
    }
  }

  updateVendorProfile(updates: Partial<Vendor>): void {
    const currentVendor = this.vendorSignal();
    if (!currentVendor) return;

    const updatedVendor = { ...currentVendor, ...updates };
    this.vendorSignal.set(updatedVendor);

    const vendors = this.getVendors();
    const index = vendors.findIndex(v => v.id === currentVendor.id);
    if (index !== -1) {
      vendors[index] = updatedVendor;
      this.saveVendors(vendors);
    }

    // Update session if vendor status changed
    const currentSession = this.currentUserSignal();
    if (currentSession && updates.verificationStatus) {
      this.setSession({
        ...currentSession,
        vendorStatus: updates.verificationStatus
      });
    }
  }
}
