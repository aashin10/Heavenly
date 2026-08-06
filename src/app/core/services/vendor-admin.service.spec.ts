import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { VendorAdminService } from './vendor-admin.service';
import { ToastService } from './toast.service';
import { Vendor, VendorStatus } from '../models/service.model';

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
