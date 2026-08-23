import { TestBed } from '@angular/core/testing';
import { ServiceAuthService } from './service-auth.service';
import { AuthApiService } from '../api/auth-api.service';
import { ToastService } from './toast.service';
import { VendorApiService } from '../api/services-portal/vendor-api.service';
import { RequesterApiService } from '../api/services-portal/requester-api.service';
import { environment } from '../../../environments/environment';

const SERVICE_USERS_KEY = 'heavenly_service_users';

/**
 * F5.3/Slice 3's model change collapsed the requester address field: the
 * frontend model used to carry `businessAddress` (SME) / `registeredAddress`
 * (large org) / `address` (individual) as three separate names for one
 * concept, and now every branch reads/writes a single `address` field. A
 * record written to `localStorage` *before* that change has the old field
 * name and no `address` at all — `getServiceRequesters()` used to be a bare
 * `JSON.parse` with no normalization, so reading such a record gave
 * `address === undefined`, and the profile page would silently drop it on
 * the next save. `getServiceRequesters()` now normalizes on read, falling
 * `address` back through the old field names.
 */
describe('ServiceAuthService — pre-migration requester records', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthApiService, useValue: {} },
        { provide: VendorApiService, useValue: {} },
        { provide: RequesterApiService, useValue: {} },
        { provide: ToastService, useValue: { success: () => undefined, error: () => undefined, info: () => undefined } },
      ],
    });
    localStorage.clear();
  });

  afterEach(() => {
    environment.useRealApi = false;
    localStorage.clear();
  });

  it('falls back to businessAddress for a pre-migration SME record with no address field', () => {
    const preMigrationSME = {
      id: 'sr_pre1',
      email: 'sme@example.com',
      phone: '9000000001',
      requesterType: 'sme',
      organizationName: 'Old Co',
      authorizedPersonName: 'A Person',
      designation: 'Owner',
      city: 'Kochi',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      isEmailVerified: false,
      businessAddress: '42 Legacy Lane',
      // no `address` field — written before this branch's model change
    };
    localStorage.setItem(SERVICE_USERS_KEY, JSON.stringify([preMigrationSME]));

    const service = TestBed.inject(ServiceAuthService);
    const loggedIn = service.loginServiceRequester('sme@example.com', 'whatever');

    expect(loggedIn).toBe(true);
    expect(service.serviceRequester()?.address).toBe('42 Legacy Lane');
  });

  it('falls back to registeredAddress for a pre-migration large-org record with no address field', () => {
    const preMigrationLargeOrg = {
      id: 'sr_pre2',
      email: 'org@example.com',
      phone: '9000000002',
      requesterType: 'large_organization',
      organizationName: 'Old Corp',
      gstNumber: 'GST123',
      authorizedPersonName: 'B Person',
      designation: 'Manager',
      city: 'Kochi',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      isEmailVerified: false,
      registeredAddress: '7 Legacy Tower',
    };
    localStorage.setItem(SERVICE_USERS_KEY, JSON.stringify([preMigrationLargeOrg]));

    const service = TestBed.inject(ServiceAuthService);
    const loggedIn = service.loginServiceRequester('org@example.com', 'whatever');

    expect(loggedIn).toBe(true);
    expect(service.serviceRequester()?.address).toBe('7 Legacy Tower');
  });

  it('leaves a post-migration record with an address field untouched', () => {
    const postMigration = {
      id: 'sr_post1',
      email: 'individual@example.com',
      phone: '9000000003',
      requesterType: 'individual',
      fullName: 'C Person',
      city: 'Kochi',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      isEmailVerified: false,
      address: '1 Current Street',
    };
    localStorage.setItem(SERVICE_USERS_KEY, JSON.stringify([postMigration]));

    const service = TestBed.inject(ServiceAuthService);
    service.loginServiceRequester('individual@example.com', 'whatever');

    expect(service.serviceRequester()?.address).toBe('1 Current Street');
  });
});
