import { Injectable, signal, computed, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { ToastService } from './toast.service';
import { environment } from '../../../environments/environment';
import { AuthApiService } from '../api/auth-api.service';
import { TokenStore } from '../api/token-store.service';
import { VendorApiService } from '../api/services-portal/vendor-api.service';
import { RequesterApiService } from '../api/services-portal/requester-api.service';
import {
  RegisterVendorRequest,
  UpdateVendorBankDetailsRequest,
  UpdateVendorBasicInfoRequest,
  UpdateVendorServicesRequest,
  VendorDto,
} from '../api/services-portal/vendor-api.models';
import { mapVendorDto } from '../api/services-portal/vendor-dto.mapper';
import {
  RegisterServiceRequesterRequest,
  ServiceRequesterDto,
  UpdateServiceRequesterProfileRequest,
} from '../api/services-portal/requester-api.models';
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
  private readonly authApi = inject(AuthApiService);
  private readonly tokenStore = inject(TokenStore);
  private readonly vendorApi = inject(VendorApiService);
  private readonly requesterApi = inject(RequesterApiService);

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
    // The cached session is only a fast first paint against the real API — the
    // server decides whether it is still valid, same as the jobs AuthService.
    if (environment.useRealApi) {
      void this.rehydrateSession();
    }
  }

  private loadUserFromStorage(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const savedSession = localStorage.getItem(CURRENT_SERVICE_USER_KEY);
    const loginTimestamp = localStorage.getItem(SERVICE_LOGIN_TIMESTAMP_KEY);

    if (savedSession && loginTimestamp) {
      // Against the real API the token's own expiry is authoritative; this
      // client-side timeout only guards the mock session.
      if (!environment.useRealApi) {
        const now = Date.now();
        const loginTime = Number.parseInt(loginTimestamp, 10);

        if (now - loginTime > SESSION_TIMEOUT_MS) {
          this.logout();
          this.toastService.info('Session expired. Please login again.');
          return;
        }
      }

      const session: ServiceUserSession = JSON.parse(savedSession);
      this.currentUserSignal.set(session);

      // Refresh session timestamp on successful load (extends session on page refresh)
      localStorage.setItem(SERVICE_LOGIN_TIMESTAMP_KEY, Date.now().toString());

      // Load full profile based on user type
      if (!environment.useRealApi) {
        if (session.userType === 'service_requester') {
          this.loadServiceRequesterProfile(session.id);
        } else if (session.userType === 'vendor') {
          this.loadVendorProfile(session.id);
        }
      }
    }
  }

  /**
   * Confirms the restored session against the API and refreshes the profile.
   *
   * Which endpoint to call is decided by the cached session's `userType` —
   * this store still models "logged in as vendor" and "logged in as
   * requester" as separate identities (frontend F3 unifies this once the two
   * auth stores collapse into one). A failure clears the session rather than
   * leaving a stale one on screen.
   */
  private async rehydrateSession(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    const session = this.currentUserSignal();
    if (!session || !this.tokenStore.accessToken) {
      if (session) this.clearSession();
      return;
    }

    try {
      if (session.userType === 'vendor') {
        const dto = await firstValueFrom(this.vendorApi.me());
        this.applyVendorDto(dto);
      } else if (session.userType === 'service_requester') {
        const dto = await firstValueFrom(this.requesterApi.me());
        this.applyRequesterDto(dto);
      }
    } catch {
      // 401/403/404 → the token no longer grants this role. The interceptor
      // handles a bare 401 redirect; here we just drop the stale identity.
      this.clearSession();
    }
  }

  private clearSession(): void {
    this.currentUserSignal.set(null);
    this.serviceRequesterSignal.set(null);
    this.vendorSignal.set(null);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem(CURRENT_SERVICE_USER_KEY);
      localStorage.removeItem(SERVICE_LOGIN_TIMESTAMP_KEY);
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

  /**
   * A record written before this branch's Task 5 (which collapsed
   * `businessAddress`/`registeredAddress`/`address` into one `address`
   * field) has no `address` at all — a bare `JSON.parse` would give
   * `address === undefined`, and the profile page would silently drop it on
   * the requester's next save. Normalizing here, once, on read, keeps every
   * mock path working unchanged on old data, matching the plan's global
   * constraint that `useRealApi: false` mock paths never regress.
   */
  private getServiceRequesters(): ServiceRequester[] {
    if (!isPlatformBrowser(this.platformId)) return [];
    const data = localStorage.getItem(SERVICE_USERS_KEY);
    if (!data) return [];
    const parsed = JSON.parse(data) as (ServiceRequester & {
      businessAddress?: string;
      registeredAddress?: string;
    })[];
    return parsed.map(r => ({
      ...r,
      address: r.address ?? r.businessAddress ?? r.registeredAddress ?? '',
    }));
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

  // ================= mock (localStorage) implementations =================

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
          address: formData.step3Individual?.address || ''
        };
        break;
      case 'sme':
        newRequester = {
          ...baseData,
          requesterType: 'sme',
          organizationName: formData.step3SME?.organizationName || '',
          gstNumber: formData.step3SME?.gstNumber,
          address: formData.step3SME?.businessAddress || '',
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
          address: formData.step3LargeOrg?.registeredAddress || '',
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

  /**
   * Refresh the session timestamp to extend the session.
   * Called on user activity (e.g. autosaving a draft) to prevent session
   * expiry during active use. Real-API mode doesn't need this — the token's
   * own expiry is authoritative — but writing the timestamp anyway is
   * harmless, so this stays unconditional rather than adding a branch.
   */
  refreshSession(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.currentUserSignal()) {
      localStorage.setItem(SERVICE_LOGIN_TIMESTAMP_KEY, Date.now().toString());
    }
  }

  /**
   * Unified login method for service portal — mock path.
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

  // ================= real API =================

  /** Signup used by the UI — real API when enabled, else the mock. */
  async signupVendorAsync(formData: VendorSignupFormData): Promise<boolean> {
    if (!environment.useRealApi) {
      return this.signupVendor(formData);
    }

    const body: RegisterVendorRequest = {
      email: formData.step2.email,
      password: formData.step4.password,
      businessName: formData.step1.businessName,
      businessType: formData.step1.businessType,
      gstNumber: formData.step1.gstNumber || undefined,
      panNumber: formData.step1.panNumber || undefined,
      yearEstablished: formData.step1.yearEstablished || undefined,
      primaryContactPerson: formData.step2.primaryContactPerson,
      designation: formData.step2.designation || undefined,
      phone: formData.step2.phone,
      alternatePhone: formData.step2.alternatePhone || undefined,
      registeredAddress: formData.step2.registeredAddress || undefined,
      city: formData.step2.city || undefined,
      state: formData.step2.state || undefined,
      pinCode: formData.step2.pinCode || undefined,
      serviceCapabilities: formData.step3.serviceCapabilities,
      serviceAreas: formData.step3.serviceAreas,
      bankAccountHolderName: formData.step4.bankDetails?.accountHolderName || undefined,
      bankAccountNumber: formData.step4.bankDetails?.accountNumber || undefined,
      bankIfscCode: formData.step4.bankDetails?.ifscCode || undefined,
      bankName: formData.step4.bankDetails?.bankName || undefined,
      acceptedTerms: formData.step4.termsAccepted,
    };

    try {
      const auth = await firstValueFrom(this.vendorApi.register(body));
      this.tokenStore.set(auth.accessToken, auth.refreshToken);
      const dto = await firstValueFrom(this.vendorApi.me());
      this.applyVendorDto(dto);
      this.toastService.success('Application submitted for verification!');
      return true;
    } catch {
      return false;
    }
  }

  async signupServiceRequesterAsync(formData: RequesterSignupFormData): Promise<boolean> {
    if (!environment.useRealApi) {
      return this.signupServiceRequester(formData);
    }

    const type = formData.step1.requesterType;
    const body: RegisterServiceRequesterRequest = {
      email: formData.step2.email,
      password: formData.step2.password,
      phone: formData.step2.phone,
      requesterType: type,
      acceptedTerms: formData.termsAccepted,
      city:
        type === 'individual' ? (formData.step3Individual?.city || '') :
        type === 'sme' ? (formData.step3SME?.city || '') :
        (formData.step3LargeOrg?.city || ''),
      fullName: type === 'individual' ? formData.step2.fullName : undefined,
      address:
        type === 'individual' ? formData.step3Individual?.address :
        type === 'sme' ? formData.step3SME?.businessAddress :
        formData.step3LargeOrg?.registeredAddress,
      organizationName:
        type === 'sme' ? formData.step3SME?.organizationName :
        type === 'large_organization' ? formData.step3LargeOrg?.organizationName : undefined,
      gstNumber:
        type === 'sme' ? formData.step3SME?.gstNumber :
        type === 'large_organization' ? formData.step3LargeOrg?.gstNumber : undefined,
      authorizedPersonName:
        type === 'sme' ? formData.step3SME?.authorizedPersonName :
        type === 'large_organization' ? formData.step3LargeOrg?.authorizedPersonName : undefined,
      designation:
        type === 'sme' ? formData.step3SME?.designation :
        type === 'large_organization' ? formData.step3LargeOrg?.designation : undefined,
      department: type === 'large_organization' ? formData.step3LargeOrg?.department : undefined,
    };

    try {
      const auth = await firstValueFrom(this.requesterApi.register(body));
      this.tokenStore.set(auth.accessToken, auth.refreshToken);
      const dto = await firstValueFrom(this.requesterApi.me());
      this.applyRequesterDto(dto);
      this.toastService.success('Account created successfully!');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Unified login — real API when enabled, else the mock.
   *
   * Authentication itself goes through the same `/api/auth/login` the jobs
   * portal uses: the backend treats vendors and requesters as `User`s with
   * roles, not a separate account type. After login, the selected
   * `userType`'s role must be among the account's roles, or this is treated
   * as a login failure — trying to sign into a portal the account has no role
   * in is indistinguishable from wrong credentials, same as the mock's generic
   * error.
   */
  async loginServiceUserAsync(
    email: string,
    password: string,
    userType: 'service_requester' | 'vendor'
  ): Promise<ServiceRequester | Vendor | null> {
    if (!environment.useRealApi) {
      return this.loginServiceUser(email, password, userType);
    }

    try {
      const auth = await firstValueFrom(this.authApi.login({ email, password }));
      const requiredRole = userType === 'vendor' ? 'vendor' : 'service_requester';
      if (!auth.roles?.map(r => r.toLowerCase()).includes(requiredRole)) {
        return null;
      }

      this.tokenStore.set(auth.accessToken, auth.refreshToken);

      if (userType === 'vendor') {
        const dto = await firstValueFrom(this.vendorApi.me());
        this.applyVendorDto(dto);
        this.toastService.success(`Welcome back, ${dto.businessName}!`);
        return this.vendorSignal();
      } else {
        const dto = await firstValueFrom(this.requesterApi.me());
        this.applyRequesterDto(dto);
        this.toastService.success('Welcome back!');
        return this.serviceRequesterSignal();
      }
    } catch {
      return null;
    }
  }

  /** Whole-profile replace — real API when enabled, else the mock. */
  async updateServiceRequesterProfileAsync(updates: Partial<ServiceRequester>): Promise<void> {
    if (!environment.useRealApi) {
      this.updateServiceRequesterProfile(updates);
      return;
    }

    const current = this.serviceRequesterSignal();
    if (!current) return;

    const merged = { ...current, ...updates } as ServiceRequester & Record<string, unknown>;
    const type = merged.requesterType;

    const body: UpdateServiceRequesterProfileRequest = {
      requesterType: type,
      city: merged.city,
      phone: (merged['phone'] as string) || undefined,
      fullName: type === 'individual' ? (merged['fullName'] as string) : undefined,
      address: merged.address,
      organizationName: type !== 'individual' ? (merged['organizationName'] as string) : undefined,
      gstNumber: type !== 'individual' ? (merged['gstNumber'] as string | undefined) : undefined,
      authorizedPersonName: type !== 'individual' ? (merged['authorizedPersonName'] as string) : undefined,
      designation: type !== 'individual' ? (merged['designation'] as string) : undefined,
      department: type === 'large_organization' ? (merged['department'] as string | undefined) : undefined,
    };

    const dto = await firstValueFrom(this.requesterApi.updateProfile(body));
    this.applyRequesterDto(dto);
  }

  /**
   * Vendor profile updates — real API when enabled, else the mock.
   *
   * Routes to the matching per-section endpoint by which keys `updates`
   * carries, mirroring how the profile editor's five sections each save
   * independently. `documentsUploaded` is not wired: the API stores a real
   * `fileUrl`, and there is no upload endpoint yet (backlog B10) — that update
   * is a no-op against the real API with a toast explaining why, rather than
   * silently discarding what the user just did.
   */
  async updateVendorProfileAsync(updates: Partial<Vendor>): Promise<void> {
    if (!environment.useRealApi) {
      this.updateVendorProfile(updates);
      return;
    }

    if ('documentsUploaded' in updates) {
      this.toastService.info('Document uploads need a file host, which is not wired up yet.');
      return;
    }

    let dto: VendorDto;

    if ('bankDetails' in updates && updates.bankDetails) {
      const body: UpdateVendorBankDetailsRequest = {
        accountHolderName: updates.bankDetails.accountHolderName,
        accountNumber: updates.bankDetails.accountNumber,
        ifscCode: updates.bankDetails.ifscCode,
        bankName: updates.bankDetails.bankName,
      };
      dto = await firstValueFrom(this.vendorApi.updateBankDetails(body));
    } else if ('serviceCapabilities' in updates || 'serviceAreas' in updates) {
      const current = this.vendorSignal();
      const body: UpdateVendorServicesRequest = {
        serviceCapabilities: updates.serviceCapabilities ?? current?.serviceCapabilities ?? [],
        serviceAreas: updates.serviceAreas ?? current?.serviceAreas ?? [],
        experienceByService: current?.experienceByService ?? {},
      };
      dto = await firstValueFrom(this.vendorApi.updateServices(body));
    } else if ('portfolio' in updates) {
      // Sections persist portfolio changes via the dedicated add/remove
      // methods below; a bulk replace here would not map onto the API's
      // per-entry endpoints. Refresh from the server instead of guessing.
      dto = await firstValueFrom(this.vendorApi.me());
    } else {
      const current = this.vendorSignal();
      if (!current) return;
      const merged = { ...current, ...updates };
      const body: UpdateVendorBasicInfoRequest = {
        businessName: merged.businessName,
        businessType: merged.businessType,
        gstNumber: merged.gstNumber || undefined,
        panNumber: merged.panNumber || undefined,
        yearEstablished: merged.yearEstablished || undefined,
        primaryContactPerson: merged.primaryContactPerson || undefined,
        designation: merged.designation || undefined,
        email: merged.email || undefined,
        phone: merged.phone || undefined,
        alternatePhone: merged.alternatePhone || undefined,
        registeredAddress: merged.registeredAddress || undefined,
        city: merged.city || undefined,
        state: merged.state || undefined,
        pinCode: merged.pinCode || undefined,
      };
      dto = await firstValueFrom(this.vendorApi.updateBasicInfo(body));
    }

    this.applyVendorDto(dto);
  }

  async addVendorPortfolioEntryAsync(entry: {
    title: string;
    description: string;
    year: number;
    clientName?: string;
  }): Promise<void> {
    if (!environment.useRealApi) {
      const current = this.vendorSignal();
      if (!current) return;
      const next = [...(current.portfolio ?? []), { id: `pf_${Date.now()}`, ...entry }];
      this.updateVendorProfile({ portfolio: next });
      return;
    }

    const dto = await firstValueFrom(this.vendorApi.addPortfolioEntry(entry));
    this.applyVendorDto(dto);
  }

  async removeVendorPortfolioEntryAsync(entryId: string): Promise<void> {
    if (!environment.useRealApi) {
      const current = this.vendorSignal();
      if (!current) return;
      this.updateVendorProfile({ portfolio: (current.portfolio ?? []).filter(e => e.id !== entryId) });
      return;
    }

    const dto = await firstValueFrom(this.vendorApi.removePortfolioEntry(entryId));
    this.applyVendorDto(dto);
  }

  /** Maps a fetched VendorDto into the domain model and updates the signals + cached session. */
  private applyVendorDto(dto: VendorDto): void {
    const vendor = mapVendorDto(dto);
    this.vendorSignal.set(vendor);
    this.setSession({
      id: dto.userId,
      email: dto.email ?? '',
      userType: 'vendor',
      displayName: vendor.businessName,
      vendorStatus: vendor.verificationStatus,
    });
  }

  /** Maps a fetched ServiceRequesterDto into the domain model and updates the signals + cached session. */
  private applyRequesterDto(dto: ServiceRequesterDto): void {
    const requester = mapRequesterDto(dto);
    this.serviceRequesterSignal.set(requester);
    this.setSession({
      id: dto.userId,
      email: dto.email,
      userType: 'service_requester',
      displayName: dto.displayName,
    });
  }

  private setSession(session: ServiceUserSession): void {
    this.currentUserSignal.set(session);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(CURRENT_SERVICE_USER_KEY, JSON.stringify(session));
      localStorage.setItem(SERVICE_LOGIN_TIMESTAMP_KEY, Date.now().toString());
    }
  }

  logout(): void {
    // Best-effort server-side invalidation when running against the real API.
    if (environment.useRealApi && this.tokenStore.accessToken) {
      firstValueFrom(this.authApi.logout()).catch(() => undefined);
      this.tokenStore.clear();
    }
    this.clearSession();
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
   * A rejected vendor, having fixed their profile, puts themselves back in the
   * admin queue. Records an audited event so the admin sees the resubmission
   * in the review timeline (F8). No-op unless the vendor is currently rejected.
   *
   * Mock-only for now: the real API has no self-service "resubmit" endpoint —
   * an admin can already move Rejected → Verified directly via approve(), so
   * the only gap against the real backend is this queue-visibility nicety.
   * Flagged rather than silently faked against a real account.
   */
  requestReverification(): boolean {
    if (environment.useRealApi) {
      this.toastService.info('Edit your profile and contact support to be re-reviewed.');
      return false;
    }

    const vendor = this.vendorSignal();
    if (!vendor || vendor.verificationStatus !== 'rejected') return false;

    this.updateVendorProfile({
      verificationStatus: 'pending',
      rejectionReason: undefined,
      verificationEvents: [
        ...(vendor.verificationEvents ?? []),
        { status: 'pending', at: new Date(), actor: vendor.businessName, note: 'Resubmitted for review' },
      ],
    });
    return true;
  }
}

// ================= DTO → domain mappers =================

function mapRequesterDto(dto: ServiceRequesterDto): ServiceRequester {
  const base = {
    id: dto.id,
    email: dto.email,
    phone: dto.phone ?? '',
    city: dto.city,
    createdAt: new Date(dto.createdAt),
    isEmailVerified: dto.isEmailVerified,
  };

  switch (dto.requesterType) {
    case 'individual':
      return {
        ...base,
        requesterType: 'individual',
        fullName: dto.fullName ?? '',
        address: dto.address ?? '',
      };
    case 'sme':
      return {
        ...base,
        requesterType: 'sme',
        organizationName: dto.organizationName ?? '',
        gstNumber: dto.gstNumber ?? undefined,
        address: dto.address ?? '',
        authorizedPersonName: dto.authorizedPersonName ?? '',
        designation: dto.designation ?? '',
      };
    case 'large_organization':
      return {
        ...base,
        requesterType: 'large_organization',
        organizationName: dto.organizationName ?? '',
        gstNumber: dto.gstNumber ?? '',
        address: dto.address ?? '',
        authorizedPersonName: dto.authorizedPersonName ?? '',
        designation: dto.designation ?? '',
        department: dto.department ?? undefined,
      };
  }
}
