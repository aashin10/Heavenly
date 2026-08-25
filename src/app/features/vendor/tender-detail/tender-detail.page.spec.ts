import { TestBed } from '@angular/core/testing';
import { importProvidersFrom } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, ActivatedRoute, Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { APP_ICONS } from '../../../shared/icons/app-icons';
import { TenderDetailPageComponent } from './tender-detail.page';
import { VendorTenderService } from '../vendor.service';
import { ToastService } from '../../../core/services/toast.service';
import { BidStatusResult, EligibilityResult, PublishedTender } from '../vendor.model';

function tender(overrides: Partial<PublishedTender> = {}): PublishedTender {
  return {
    id: 't-1',
    tenderId: 'TND-2026-00087',
    title: 'Quarterly AC servicing',
    category: 'technical',
    categoryLabel: 'Technical',
    location: 'Kottayam, Kerala',
    city: 'Kottayam',
    state: 'Kerala',
    scopeSummary: 'Annual maintenance contract.',
    technicalRequirements: [],
    budgetVisibility: 'hide',
    expectedTimeline: '12 months',
    bidWindowStart: '2026-01-01T00:00:00Z',
    bidWindowEnd: '2099-01-01T00:00:00Z',
    publishedAt: '2026-01-01T00:00:00Z',
    paymentStructure: '',
    warrantyExpectation: '',
    eligibilityCriteria: [],
    tags: [],
    serviceType: 'ac_servicing',
    attachments: [],
    status: 'published',
    ...overrides,
  };
}

async function makeComponent(
  eligibility: EligibilityResult = { eligible: true, reasons: [], missingRequirements: [] },
  bidStatus: BidStatusResult = { submitted: false }
) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [TenderDetailPageComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      importProvidersFrom(LucideAngularModule.pick(APP_ICONS)),
      { provide: ActivatedRoute, useValue: { snapshot: { params: { id: 't-1' } } } },
      {
        provide: VendorTenderService,
        useValue: {
          getTenderDetailBundleAsync: () =>
            Promise.resolve({
              tender: tender(),
              clarifications: [],
              eligibility,
              bidStatus,
            }),
          isTenderSaved: () => false,
        },
      },
      { provide: ToastService, useValue: { error: () => undefined, success: () => undefined, info: () => undefined } },
    ],
  });

  const fixture = TestBed.createComponent(TenderDetailPageComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  const router = TestBed.inject(Router);
  return { fixture, component: fixture.componentInstance, router };
}

describe('TenderDetailPageComponent', () => {
  it('navigates to the bid submission route when the vendor is eligible', async () => {
    const { component, router } = await makeComponent({ eligible: true, reasons: [], missingRequirements: [] });
    const navigateSpy = spyOn(router, 'navigate');

    component.startBidSubmission();

    // Was '/vendor/bid/submit', which no route declares — the dead-route fix
    // this test guards against regressing.
    expect(navigateSpy).toHaveBeenCalledWith(['/vendor/tenders', 't-1', 'bid']);
  });

  it('opens the eligibility modal instead of navigating when the vendor is ineligible', async () => {
    const { component, router } = await makeComponent({
      eligible: false,
      reasons: ['Profile incomplete'],
      missingRequirements: ['Business Registration Certificate'],
    });
    const navigateSpy = spyOn(router, 'navigate');

    component.startBidSubmission();

    expect(component.showEligibilityModal()).toBe(true);
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('shows the Submit Bid button when the vendor has not bid yet', async () => {
    const { fixture } = await makeComponent(
      { eligible: true, reasons: [], missingRequirements: [] },
      { submitted: false }
    );
    expect(fixture.nativeElement.textContent).toContain('Submit Bid Now');
  });

  it('hides the Submit Bid button once a bid is on record', async () => {
    const { fixture } = await makeComponent(
      { eligible: true, reasons: [], missingRequirements: [] },
      { submitted: true, status: 'submitted', bidId: 'b-1', bidNumber: 'BID-2026-00001' }
    );
    expect(fixture.nativeElement.textContent).not.toContain('Submit Bid Now');
  });

  it('shows the withdrawn-specific notice, not the generic submitted copy, for a withdrawn bid', async () => {
    const { fixture } = await makeComponent(
      { eligible: true, reasons: [], missingRequirements: [] },
      { submitted: true, status: 'withdrawn', bidId: 'b-1', bidNumber: 'BID-2026-00001' }
    );
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('You withdrew bid BID-2026-00001');
    expect(text).not.toContain('Bid BID-2026-00001 submitted');
  });

  it('shows the generic submitted notice for a live (non-withdrawn) bid', async () => {
    const { fixture } = await makeComponent(
      { eligible: true, reasons: [], missingRequirements: [] },
      { submitted: true, status: 'under_review', bidId: 'b-1', bidNumber: 'BID-2026-00001' }
    );
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Bid BID-2026-00001 submitted');
    expect(text).not.toContain('You withdrew');
  });
});
