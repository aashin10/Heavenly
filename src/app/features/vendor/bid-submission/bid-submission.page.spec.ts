import { TestBed } from '@angular/core/testing';
import { importProvidersFrom } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { APP_ICONS } from '../../../shared/icons/app-icons';
import { BidSubmissionPageComponent } from './bid-submission.page';
import { VendorTenderService } from '../vendor.service';
import { ToastService } from '../../../core/services/toast.service';
import { BidDraft, BidSubmitResult, PublishedTender } from '../vendor.model';

function makeComponent(overrides: Partial<Record<string, unknown>> = {}) {
  const toasts: string[] = [];

  const vendorService = {
    getTenderDetailBundleAsync: () =>
      Promise.resolve({
        tender: { id: 't-1', title: 'Quarterly AC servicing', bidWindowEnd: '2099-01-01T00:00:00Z' } as PublishedTender,
        clarifications: [],
        eligibility: { eligible: true, reasons: [], missingRequirements: [] },
        bidStatus: { submitted: false },
      }),
    getBidDraftAsync: () => Promise.resolve(null as BidDraft | null),
    saveBidDraftAsync: () => Promise.resolve('saved' as const),
    submitBidAsync: () => Promise.resolve({ ok: true, bidId: 'b-1', bidNumber: 'BID-1' } as BidSubmitResult),
    ...overrides,
  };

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [BidSubmissionPageComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      importProvidersFrom(LucideAngularModule.pick(APP_ICONS)),
      { provide: VendorTenderService, useValue: vendorService },
      { provide: ActivatedRoute, useValue: { snapshot: { params: { id: 't-1' } } } },
      {
        provide: ToastService,
        useValue: {
          error: (m: string) => toasts.push(m),
          success: (m: string) => toasts.push(m),
          info: (m: string) => toasts.push(m),
        },
      },
    ],
  });

  const fixture = TestBed.createComponent(BidSubmissionPageComponent);
  return { fixture, component: fixture.componentInstance, toasts };
}

describe('BidSubmissionPageComponent', () => {
  it('rebuilds the repeatable rows a restored draft actually contains', async () => {
    // patchValue cannot grow a FormArray. The form seeds one blank price line,
    // so before this fix a three-line draft came back with one line and the
    // vendor silently resubmitted a different bid from the one they saved.
    const draft: BidDraft = {
      tenderId: 't-1',
      currentStep: 3,
      totalSteps: 4,
      lastSaved: '2026-08-22T10:00:00Z',
      formData: {
        priceBreakdown: [
          { description: 'Labour', amount: 30000 },
          { description: 'Consumables', amount: 15000 },
          { description: 'Transport', amount: 7000 },
        ],
        similarWorkReferences: [
          { clientName: 'Acme', projectType: 'AC servicing', contactPerson: '', phone: '' },
          { clientName: 'Globex', projectType: 'AC servicing', contactPerson: '', phone: '' },
        ],
      },
    };

    const { fixture, component } = makeComponent({ getBidDraftAsync: () => Promise.resolve(draft) });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.priceBreakdownArray.length).toBe(3);
    expect(component.priceBreakdownArray.at(2).value.description).toBe('Transport');
    expect(component.similarWorkReferencesArray.length).toBe(2);
    expect(component.currentStep()).toBe(3);
  });

  it('shows every eligibility reason instead of a generic failure', async () => {
    const { fixture, component } = makeComponent({
      submitBidAsync: () =>
        Promise.resolve({
          ok: false,
          kind: 'ineligible',
          reasons: [
            'An insurance certificate is required on your profile.',
            'At least 5 years’ experience in this service is required.',
          ],
        } as BidSubmitResult),
    });
    fixture.detectChanges();
    await fixture.whenStable();

    component.finalConfirmation.set(true);
    component.bidForm.patchValue({
      confirmEligibility: true, companyProfile: 'p', relevantExperience: 'e',
      technicalApproach: 'a', deliveryTimeline: '3 days', totalPrice: 52000,
      taxesAndDuties: 'GST', paymentTerms: '50/50', validityPeriod: '60 days',
    });

    await component.submitBid();

    const refusal = component.submitRefusal();
    expect(refusal?.kind).toBe('ineligible');
    expect(refusal?.kind === 'ineligible' ? refusal.reasons.length : -1).toBe(2);
    expect(component.showSuccessModal()).toBe(false);
  });

  it('stops autosaving once the tender stops accepting bids', async () => {
    // The server 409s a draft save on a closed tender. Left running, the timer
    // would fire that every thirty seconds for as long as the tab is open.
    const { fixture, component } = makeComponent({
      saveBidDraftAsync: () => Promise.resolve('closed' as const),
    });
    fixture.detectChanges();
    await fixture.whenStable();

    await component.saveDraft(true);

    expect(component.autoSaveInterval).toBeNull();
    expect(component.biddingClosed()).toBe(true);
  });
});
