import { TestBed } from '@angular/core/testing';
import { importProvidersFrom, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { APP_ICONS } from '../../../shared/icons/app-icons';
import { VendorQueueComponent } from './vendor-queue.component';
import { VendorAdminService, VendorQueueStats } from '../../../core/services/vendor-admin.service';
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

const NO_STATS: VendorQueueStats = { pending: 0, verified: 0, rejected: 0, suspended: 0 };

/**
 * Renders the queue with `useRealApi` forced either way.
 *
 * `useRealApi` is a plain field on the real service, read straight off
 * `environment`, so a stub is the only way to exercise the real-API branch —
 * and that branch is the one no human has ever looked at, since the flag ships
 * committed `false`.
 */
async function renderQueue(useRealApi: boolean, vendors: Vendor[]) {
  const stub = {
    vendors: signal<Vendor[]>(vendors),
    queueStats: signal<VendorQueueStats>(NO_STATS),
    useRealApi,
    refreshAsync: () => Promise.resolve(),
  };

  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    imports: [VendorQueueComponent],
    providers: [
      provideRouter([]),
      importProvidersFrom(LucideAngularModule.pick(APP_ICONS)),
      { provide: VendorAdminService, useValue: stub },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(VendorQueueComponent);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('VendorQueueComponent table columns', () => {
  // These two are forward-looking invariants, not regressions for a bug that
  // happened: the pre-fix template kept both counts at 7, so it would have
  // passed these. They exist because the Docs column is the first conditional
  // column in this table, and the next one added is where a real mismatch
  // becomes possible — Angular renders that silently, shifting every later
  // column one place left. The behavioural regression is the third test.
  it('keeps header and body column counts equal in mock mode', async () => {
    const el = await renderQueue(false, [makeVendor()]);

    const headers = el.querySelectorAll('thead tr th').length;
    const cells = el.querySelectorAll('tbody tr:first-child td').length;

    expect(headers).toBe(cells);
  });

  it('keeps header and body column counts equal in real-API mode', async () => {
    const el = await renderQueue(true, [makeVendor()]);

    const headers = el.querySelectorAll('thead tr th').length;
    const cells = el.querySelectorAll('tbody tr:first-child td').length;

    expect(headers).toBe(cells);
  });

  it('shows the Docs column in mock mode and hides it in real-API mode', async () => {
    // The actual regression. The queue's summary endpoint carries no document
    // count (B13), so a real-API row would render a false "0/4" — hiding the
    // column beats a number that reads as "checked, none uploaded". The first
    // attempt hid only the count, leaving an empty header over an empty cell;
    // verified by running this spec against the pre-fix template, where it is
    // the one test that fails.
    const mockEl = await renderQueue(false, [makeVendor()]);
    const mockHeaders = Array.from(mockEl.querySelectorAll('thead tr th')).map(h =>
      h.textContent?.trim()
    );
    expect(mockHeaders).toContain('Docs');

    const realEl = await renderQueue(true, [makeVendor()]);
    const realHeaders = Array.from(realEl.querySelectorAll('thead tr th')).map(h =>
      h.textContent?.trim()
    );
    expect(realHeaders).not.toContain('Docs');
  });
});
