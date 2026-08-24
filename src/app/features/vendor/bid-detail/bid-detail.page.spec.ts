import { TestBed } from '@angular/core/testing';
import { importProvidersFrom } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { APP_ICONS } from '../../../shared/icons/app-icons';
import { BidDetailPageComponent } from './bid-detail.page';
import { VendorTenderService } from '../vendor.service';
import { ToastService } from '../../../core/services/toast.service';
import { Bid } from '../vendor.model';

function bid(overrides: Partial<Bid> = {}): Bid {
  return {
    bidId: 'b-1',
    bidNumber: 'BID-2026-00231',
    tenderId: 't-1',
    tenderNumber: 'TND-2026-00087',
    tenderTitle: 'Quarterly AC servicing',
    status: 'submitted',
    bidAmount: 52000,
    tenderClosingDate: '2099-01-01T00:00:00Z',
    submittedAt: '2026-08-20T10:00:00Z',
    vendorId: 'v-1',
    technicalProposal: {
      companyProfile: '', relevantExperience: '', similarWorkReferences: [],
      technicalApproach: '', manpowerPlan: '', equipmentPlan: '',
      deliveryTimeline: '', deviations: '',
    },
    commercialProposal: {
      totalPrice: 52000, priceBreakdown: [], taxesAndDuties: '',
      paymentTerms: '', validityPeriod: '', warrantyPricing: '', amcPricing: '',
    },
    canWithdraw: true,
    isLive: true,
    events: [{ toStatus: 'submitted', note: 'Submitted', occurredAt: '2026-08-20T10:00:00Z' }],
    ...overrides,
  };
}

async function makeComponent(detail: Bid | null, withdraw = () => Promise.resolve(bid())) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [BidDetailPageComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      importProvidersFrom(LucideAngularModule.pick(APP_ICONS)),
      { provide: ActivatedRoute, useValue: { snapshot: { params: { id: 'b-1' } } } },
      {
        provide: VendorTenderService,
        useValue: {
          getBidDetailAsync: () => Promise.resolve(detail),
          withdrawBidAsync: withdraw,
          getTenderDetailBundleAsync: () => Promise.resolve(null),
        },
      },
      { provide: ToastService, useValue: { error: () => undefined, success: () => undefined, info: () => undefined } },
    ],
  });

  const fixture = TestBed.createComponent(BidDetailPageComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

describe('BidDetailPageComponent', () => {
  it('offers Withdraw only when the server says the bid can be withdrawn', async () => {
    const open = await makeComponent(bid({ canWithdraw: true }));
    expect(open.nativeElement.textContent).toContain('Withdraw');
  });

  it('hides Withdraw on a submitted bid whose window has shut', async () => {
    // Status is still `submitted` — an admin closed the tender early. Deriving
    // the control from the status would show a button the server 409s.
    const closed = await makeComponent(bid({ status: 'submitted', canWithdraw: false }));
    expect(closed.nativeElement.textContent).not.toContain('Withdraw');
  });

  it('says the bid could not be loaded instead of rendering a blank page', async () => {
    const failed = await makeComponent(null);
    expect(failed.nativeElement.textContent).toContain("Couldn't load this bid");
  });
});
