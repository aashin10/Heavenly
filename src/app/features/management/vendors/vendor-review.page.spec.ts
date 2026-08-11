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
 * Builds the page with a stubbed service. Each of the four decision methods
 * can be overridden individually — the default resolves to `null`, how
 * `VendorAdminService` reports a refused or failed decision (it toasts
 * internally and hands back nothing).
 */
async function makePageWith(
  overrides: Partial<{
    getVendorAsync: () => Promise<Vendor | null>;
    rejectAsync: (id: string, reason: string, actor: string) => Promise<Vendor | null>;
    suspendAsync: (id: string, reason: string, actor: string) => Promise<Vendor | null>;
    approveAsync: (id: string, actor: string) => Promise<Vendor | null>;
    reinstateAsync: (id: string, actor: string) => Promise<Vendor | null>;
  }> = {}
) {
  const calls: { reason: string }[] = [];
  const stub = {
    getVendorAsync: overrides.getVendorAsync ?? (() => Promise.resolve(makeVendor())),
    rejectAsync: (id: string, reason: string, actor: string) => {
      calls.push({ reason });
      return (overrides.rejectAsync ?? (() => Promise.resolve(null)))(id, reason, actor);
    },
    suspendAsync: (id: string, reason: string, actor: string) => {
      calls.push({ reason });
      return (overrides.suspendAsync ?? (() => Promise.resolve(null)))(id, reason, actor);
    },
    approveAsync: overrides.approveAsync ?? (() => Promise.resolve(null)),
    reinstateAsync: overrides.reinstateAsync ?? (() => Promise.resolve(null)),
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

/**
 * The original shape: every decision method resolves to the same fixed
 * result, kept for the specs that don't need per-method control.
 */
async function makePage(decisionResult: Vendor | null) {
  return makePageWith({
    rejectAsync: () => Promise.resolve(decisionResult),
    suspendAsync: () => Promise.resolve(decisionResult),
    approveAsync: () => Promise.resolve(decisionResult),
    reinstateAsync: () => Promise.resolve(decisionResult),
  });
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

  it('keeps the typed reason when a 409 reloads the vendor without the action landing', async () => {
    // `VendorAdminService.decide()` responds to a 409 by re-reading the vendor
    // and handing back that (truthy) fresh copy instead of `null` — so a bare
    // `if (updated)` would wrongly treat this as success and wipe the panel.
    // Here the reload comes back still 'pending', proving the reject never
    // actually landed.
    const { page } = await makePageWith({
      rejectAsync: () => Promise.resolve(makeVendor({ verificationStatus: 'pending' })),
    });

    page.startReject();
    page.reasonText.set('Trade licence has expired; please re-upload a current one.');
    await page.confirmReason();

    expect(page.pendingAction()).toBe('reject');
    expect(page.reasonText()).toBe('Trade licence has expired; please re-upload a current one.');
    // The displayed vendor still refreshes — that's the point of the 409
    // reload — even though the panel itself stays open.
    expect(page.vendor()?.verificationStatus).toBe('pending');
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

describe('VendorReviewPageComponent in-flight guard', () => {
  it('ignores a second decision while the first is in flight', async () => {
    let resolve!: (v: Vendor | null) => void;
    const pending = new Promise<Vendor | null>(r => (resolve = r));
    let calls = 0;

    const { page } = await makePageWith({
      approveAsync: () => {
        calls++;
        return pending;
      },
    });

    const first = page.approve();
    void page.approve(); // the double-click
    expect(calls).toBe(1);

    resolve(makeVendor({ verificationStatus: 'verified' }));
    await first;
    expect(page.deciding()).toBe(false);
  });

  it('will not cancel the reason panel while a decision is in flight', async () => {
    let resolve!: (v: Vendor | null) => void;
    const pending = new Promise<Vendor | null>(r => (resolve = r));

    const { page } = await makePageWith({ rejectAsync: () => pending });

    page.startReject();
    page.reasonText.set('Docs missing.');
    const run = page.confirmReason();

    page.cancelReason();
    expect(page.pendingAction()).toBe('reject');

    resolve(makeVendor({ verificationStatus: 'rejected' }));
    await run;
  });
});
