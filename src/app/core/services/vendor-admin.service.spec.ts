import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Subject } from 'rxjs';
import { VendorAdminService } from './vendor-admin.service';
import { ToastService } from './toast.service';
import { Vendor, VendorStatus } from '../models/service.model';
import { environment } from '../../../environments/environment';
import { VendorAdminApiService } from '../api/services-portal/vendor-admin-api.service';
import { VendorQueueDto } from '../api/services-portal/vendor-admin-api.models';

const VENDORS_KEY = 'heavenly_vendors';

function seedVendor(status: VendorStatus): Vendor {
  return {
    id: 'v1',
    businessName: 'Acme Interiors',
    businessType: 'private_limited',
    panNumber: 'ABCDE1234F',
    yearEstablished: 2015,
    primaryContactPerson: 'A. Contact',
    designation: 'Owner',
    email: 'a@example.com',
    phone: '9000000000',
    registeredAddress: '1 Street',
    city: 'Kochi',
    state: 'Kerala',
    pinCode: '682001',
    serviceCapabilities: ['electrical'],
    serviceAreas: ['Kochi'],
    verificationStatus: status,
    documentsUploaded: {},
    bankDetails: { accountHolderName: '', accountNumber: '', ifscCode: '', bankName: '' },
    createdAt: new Date('2026-01-01T00:00:00Z'),
    isEmailVerified: false,
  };
}

function makeService(status: VendorStatus) {
  localStorage.setItem(VENDORS_KEY, JSON.stringify([seedVendor(status)]));
  const errors: string[] = [];

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      {
        provide: ToastService,
        useValue: {
          error: (m: string) => errors.push(m),
          success: () => undefined,
        },
      },
    ],
  });

  return { service: TestBed.inject(VendorAdminService), errors };
}

describe('VendorAdminService mock transitions', () => {
  afterEach(() => localStorage.removeItem(VENDORS_KEY));

  // `useRealApi` is committed false, so the mock is what actually ships. It
  // previously performed any transition the template offered, with no rules of
  // its own — which is how F9's "Return to Queue on a rejected vendor" bug went
  // unnoticed: the server 409s it, the mock carried it out.
  it('refuses an action the server would reject', () => {
    const { service, errors } = makeService('rejected');

    // reinstate is legal from `suspended` alone — the exact F9 case.
    expect(service.reinstate('v1', 'Admin')).toBe(false);
    expect(service.getVendor('v1')?.verificationStatus).toBe('rejected');
    expect(errors[0]).toContain('not allowed');
  });

  it('refuses suspending a pending vendor', () => {
    const { service } = makeService('pending');

    expect(service.suspend('v1', 'Admin', 'reason')).toBe(false);
    expect(service.getVendor('v1')?.verificationStatus).toBe('pending');
  });

  it('still performs every legal transition', () => {
    const approve = makeService('pending');
    expect(approve.service.approve('v1', 'Admin')).toBe(true);
    expect(approve.service.getVendor('v1')?.verificationStatus).toBe('verified');

    const reject = makeService('pending');
    expect(reject.service.reject('v1', 'Admin', 'Docs missing')).toBe(true);
    expect(reject.service.getVendor('v1')?.verificationStatus).toBe('rejected');

    const suspend = makeService('verified');
    expect(suspend.service.suspend('v1', 'Admin', 'No-shows')).toBe(true);
    expect(suspend.service.getVendor('v1')?.verificationStatus).toBe('suspended');

    const reinstate = makeService('suspended');
    expect(reinstate.service.reinstate('v1', 'Admin')).toBe(true);
    expect(reinstate.service.getVendor('v1')?.verificationStatus).toBe('verified');
  });

  it('reports a missing vendor distinctly from an illegal action', () => {
    const { service, errors } = makeService('pending');

    expect(service.approve('does-not-exist', 'Admin')).toBe(false);
    expect(errors[0]).toContain('could not be found');
  });

  it('does not stamp verifiedAt on reinstate, matching the server', () => {
    const { service } = makeService('suspended');

    service.reinstate('v1', 'Admin');

    // Vendor.Reinstate() sets Verified without touching VerifiedAt — the
    // original verification date survives a suspend/reinstate round trip.
    expect(service.getVendor('v1')?.verifiedAt).toBeUndefined();
  });

  it('notes a reinstatement so it is distinguishable from an approval', () => {
    const { service } = makeService('suspended');

    service.reinstate('v1', 'Admin');

    // Both land on `verified`; without a note the timeline cannot tell the
    // admin which one happened. The server records "Reinstated" here.
    const events = service.getVendor('v1')?.verificationEvents ?? [];
    expect(events[events.length - 1].note).toBe('Reinstated');
  });
});

function fakeQueueDto(overrides: Partial<VendorQueueDto> = {}): VendorQueueDto {
  return {
    items: [],
    stats: { pending: 0, verified: 0, rejected: 0, suspended: 0, total: 0 },
    page: 1,
    pageSize: 100,
    totalCount: 0,
    totalPages: 0,
    ...overrides,
  };
}

/**
 * `refreshAsync`'s real-API branch, exercised against a stubbed
 * `VendorAdminApiService` rather than `HttpTestingController` — resolution
 * order is the whole point of these specs, and a `Subject` per call lets each
 * test settle requests in whatever order it needs, including out of order.
 */
describe('VendorAdminService.refreshAsync real-API sequencing', () => {
  afterEach(() => {
    environment.useRealApi = false;
  });

  function makeRealApiService() {
    const errors: string[] = [];
    const responses: Subject<VendorQueueDto>[] = [];
    const queueSpy = jasmine.createSpy('queue').and.callFake(() => {
      const subject = new Subject<VendorQueueDto>();
      responses.push(subject);
      return subject;
    });

    environment.useRealApi = true;
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: VendorAdminApiService, useValue: { queue: queueSpy } },
        {
          provide: ToastService,
          useValue: {
            error: (m: string) => errors.push(m),
            success: () => undefined,
          },
        },
      ],
    });

    return { service: TestBed.inject(VendorAdminService), errors, responses };
  }

  // The regression this pins: before the Task 6 refactor, the catch opened
  // with `if (requestId !== this.refreshRequestId) return;`, which guarded
  // every side effect below it, toast included. `createRequestState()`'s
  // `fail()` re-guards the signal writes internally, but a bare call to it
  // is not itself an early return — so without a guard ahead of it, a stale
  // failure still reaches the toast even though it can no longer touch state.
  it('does not toast for a request that fails after a newer one already succeeded', async () => {
    const { service, errors, responses } = makeRealApiService();

    const stale = service.refreshAsync('pending'); // request 1, issued first
    const fresh = service.refreshAsync('verified'); // request 2, issued second — the current one

    responses[1].next(fakeQueueDto()); // request 2 resolves first and succeeds
    responses[1].complete();
    await fresh;

    responses[0].error(new Error('boom')); // request 1 resolves late and fails
    await stale;

    expect(errors).toEqual([]);
  });

  it('still toasts when the only outstanding request fails', async () => {
    const { service, errors, responses } = makeRealApiService();

    const only = service.refreshAsync('pending');
    responses[0].error(new Error('boom'));
    await only;

    expect(errors).toEqual(['Could not load the vendor queue.']);
  });
});
