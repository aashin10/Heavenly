import { TestBed } from '@angular/core/testing';
import { importProvidersFrom } from '@angular/core';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { APP_ICONS } from '../../../shared/icons/app-icons';
import { VendorReviewPageComponent } from './vendor-review.page';
import { VendorAdminService } from '../../../core/services/vendor-admin.service';
import { AuthService } from '../../../core/services/auth.service';
import { Vendor } from '../../../core/models/service.model';

function makeVendor(overrides: Partial<Vendor> = {}): Vendor {
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
    verificationStatus: 'pending',
    documentsUploaded: {},
    bankDetails: { accountHolderName: '', accountNumber: '', ifscCode: '', bankName: '' },
    createdAt: new Date('2026-01-01T00:00:00Z'),
    isEmailVerified: false,
    ...overrides,
  };
}

/**
 * Builds the page with a stubbed service whose reject/suspend outcome is
 * chosen per test. `null` is how `VendorAdminService` reports a refused or
 * failed decision — it toasts internally and hands back nothing.
 */
async function makePage(decisionResult: Vendor | null) {
  const calls: { reason: string }[] = [];
  const stub = {
    getVendorAsync: () => Promise.resolve(makeVendor()),
    rejectAsync: (_id: string, reason: string) => {
      calls.push({ reason });
      return Promise.resolve(decisionResult);
    },
    suspendAsync: (_id: string, reason: string) => {
      calls.push({ reason });
      return Promise.resolve(decisionResult);
    },
    approveAsync: () => Promise.resolve(decisionResult),
    reinstateAsync: () => Promise.resolve(decisionResult),
  };

  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    imports: [VendorReviewPageComponent],
    providers: [
      provideRouter([]),
      importProvidersFrom(LucideAngularModule.pick(APP_ICONS)),
      { provide: VendorAdminService, useValue: stub },
      { provide: AuthService, useValue: { user: () => ({ name: 'Platform Administrator' }) } },
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'v1' } } } },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(VendorReviewPageComponent);
  const page = fixture.componentInstance;
  await page.ngOnInit();
  return { page, calls };
}

describe('VendorReviewPageComponent reason panel', () => {
  it('keeps the typed reason when the decision fails', async () => {
    // The reason is the only feedback the vendor ever receives, and the
    // placeholder asks the admin to be specific — so it is the field most
    // likely to hold a paragraph. Discarding it on a 409 or a dropped
    // connection makes the admin retype the one thing that took thought.
    const { page } = await makePage(null);

    page.startReject();
    page.reasonText.set('Trade licence has expired; please re-upload a current one.');
    await page.confirmReason();

    expect(page.pendingAction()).toBe('reject');
    expect(page.reasonText()).toBe('Trade licence has expired; please re-upload a current one.');
  });

  it('clears the panel when the decision succeeds', async () => {
    const { page } = await makePage(makeVendor({ verificationStatus: 'rejected' }));

    page.startReject();
    page.reasonText.set('Documents incomplete.');
    await page.confirmReason();

    expect(page.pendingAction()).toBeNull();
    expect(page.reasonText()).toBe('');
    expect(page.vendor()?.verificationStatus).toBe('rejected');
  });

  it('sends the trimmed reason and refuses to submit a blank one', async () => {
    const { page, calls } = await makePage(makeVendor());

    page.startSuspend();
    page.reasonText.set('   ');
    await page.confirmReason();
    expect(calls.length).toBe(0);

    page.reasonText.set('  Repeated no-shows.  ');
    await page.confirmReason();
    expect(calls).toEqual([{ reason: 'Repeated no-shows.' }]);
  });
});
