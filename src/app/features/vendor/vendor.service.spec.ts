import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, of, throwError } from 'rxjs';
import { VendorTenderService } from './vendor.service';
import { ToastService } from '../../core/services/toast.service';
import { BidApiService } from '../../core/api/services-portal/bid-api.service';
import { TenderApiService } from '../../core/api/services-portal/tender-api.service';
import { BidDto, BidListDto, BidSummaryDto } from '../../core/api/services-portal/bid-api.models';
import { environment } from '../../../environments/environment';
import { BidFormData } from './vendor.model';

function summary(id: string, overrides: Partial<BidSummaryDto> = {}): BidSummaryDto {
  return {
    id,
    bidNumber: `BID-${id}`,
    tenderId: `t-${id}`,
    tenderNumber: `TND-${id}`,
    tenderTitle: 'Quarterly AC servicing',
    category: 'quick_service',
    status: 'submitted',
    bidAmount: 52000,
    tenderClosingDate: '2026-09-01T00:00:00Z',
    submittedAt: '2026-08-20T10:00:00Z',
    ...overrides,
  };
}

function page(items: BidSummaryDto[], totalCount = items.length): BidListDto<BidSummaryDto> {
  return { items, page: 1, pageSize: 100, totalCount };
}

function detailDto(overrides: Partial<BidDto> = {}): BidDto {
  return {
    id: 'b-1', bidNumber: 'BID-1', tenderId: 't-1', tenderNumber: 'TND-1',
    tenderTitle: 'Quarterly AC servicing', tenderClosingDate: null, vendorId: 'v-1',
    status: 'submitted', bidAmount: 52000,
    technicalProposal: {
      companyProfile: null, relevantExperience: null, technicalApproach: null,
      manpowerPlan: null, equipmentPlan: null, deliveryTimeline: null,
      deviations: null, similarWorkReferences: [],
    },
    commercialProposal: {
      totalPrice: 52000, taxesAndDuties: null, paymentTerms: null,
      validityPeriod: null, warrantyPricing: null, amcPricing: null, priceBreakdown: [],
    },
    rejectionReason: null, isEditableByVendor: true, isLive: true, canWithdraw: true,
    submittedAt: '2026-08-20T10:00:00Z', updatedAt: '2026-08-20T10:00:00Z', events: [],
    ...overrides,
  };
}

function httpError(status: number, body: unknown) {
  return new HttpErrorResponse({ status, error: body });
}

const EMPTY_FORM: BidFormData = {
  confirmEligibility: true,
  companyProfile: 'p', relevantExperience: 'e', similarWorkReferences: [],
  technicalApproach: 'a', manpowerPlan: '', equipmentPlan: '', deliveryTimeline: '3 days',
  deviations: '', totalPrice: 52000, priceBreakdown: [], taxesAndDuties: 'GST',
  paymentTerms: '50/50', validityPeriod: '60 days', warrantyPricing: '', amcPricing: '',
};

/** Real-API mode with a stubbed bid client; each call gets its own Subject so tests settle them out of order. */
function makeRealApiService(bidApiOverrides: Record<string, unknown> = {}) {
  const errors: string[] = [];
  const minePages: Subject<BidListDto<BidSummaryDto>>[] = [];
  const mineSpy = jasmine.createSpy('mine').and.callFake(() => {
    const subject = new Subject<BidListDto<BidSummaryDto>>();
    minePages.push(subject);
    return subject;
  });

  environment.useRealApi = true;
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: TenderApiService, useValue: { browse: () => new Subject() } },
      { provide: BidApiService, useValue: { mine: mineSpy, ...bidApiOverrides } },
      {
        provide: ToastService,
        useValue: { error: (m: string) => errors.push(m), success: () => undefined, info: () => undefined },
      },
    ],
  });

  return { service: TestBed.inject(VendorTenderService), errors, minePages };
}

describe('VendorTenderService bids — real API', () => {
  afterEach(() => {
    environment.useRealApi = false;
    localStorage.removeItem('heavenly_vendor_bids');
  });

  it('discards a stale response that resolves after a newer one', async () => {
    const { service, minePages } = makeRealApiService();

    const stale = service.refreshBidsAsync();
    const fresh = service.refreshBidsAsync();

    minePages[1].next(page([summary('new')]));
    minePages[1].complete();
    await fresh;

    minePages[0].next(page([summary('old')]));
    minePages[0].complete();
    await stale;

    expect(service.bids().map(b => b.bidId)).toEqual(['new']);
  });

  it('records a failure instead of rendering an empty bid list as fact', async () => {
    const { service, minePages } = makeRealApiService();

    const first = service.refreshBidsAsync();
    minePages[0].next(page([summary('a')]));
    minePages[0].complete();
    await first;

    const second = service.refreshBidsAsync();
    minePages[1].error(httpError(500, null));
    await second;

    // The rows are untouched; the error is what changed. Writing [] here would
    // render "You haven't submitted any bids" over a server that never said so.
    expect(service.bids().length).toBe(1);
    expect(service.bidsError()).toBeTruthy();
    expect(service.bidsLoading()).toBe(false);
  });

  it('reports truncation rather than truncating silently', async () => {
    const { service, minePages } = makeRealApiService();

    const load = service.refreshBidsAsync();
    minePages[0].next(page([summary('a'), summary('b')], 137));
    minePages[0].complete();
    await load;

    expect(service.bidsTruncated()).toEqual({ shown: 2, total: 137 });
  });

  it('treats a 404 from the draft endpoint as "no draft", not as an error', async () => {
    // The first visit to a bid form always 404s here. Surfacing that as a
    // failure would put an error banner on a blank form every single time.
    const { service } = makeRealApiService({
      getDraft: () => throwError(() => httpError(404, { detail: 'Bid draft not found.' })),
    });

    await expectAsync(service.getBidDraftAsync('t-1')).toBeResolvedTo(null);
  });

  it('turns a 403 into the list of things the vendor has to fix', async () => {
    const { service } = makeRealApiService({
      submit: () => throwError(() => httpError(403, {
        detail: 'You do not meet this tender\'s requirements: An insurance certificate is required on your profile.',
      })),
    });

    const result = await service.submitBidAsync(EMPTY_FORM, 't-1');

    expect(result.ok).toBe(false);
    if (!result.ok && result.kind === 'ineligible') {
      expect(result.reasons.join(' ')).toContain('insurance certificate');
    } else {
      fail(`expected an ineligible result, got ${JSON.stringify(result)}`);
    }
  });

  it('keeps the server’s own sentence on a 409 rather than a generic failure', async () => {
    const { service } = makeRealApiService({
      submit: () => throwError(() => httpError(409, {
        detail: 'You have already bid on tender TND-2026-00087. Revise the existing bid instead.',
      })),
    });

    const result = await service.submitBidAsync(EMPTY_FORM, 't-1');

    expect(result.ok).toBe(false);
    if (!result.ok && result.kind === 'conflict') {
      expect(result.message).toContain('TND-2026-00087');
    } else {
      fail(`expected a conflict result, got ${JSON.stringify(result)}`);
    }
  });

  it('re-reads the bid when a withdraw 409s, so the screen stops lying', async () => {
    // A 409 *is* the server saying our copy is stale. Slice 3 established that
    // the only honest response is a fresh read — see vendor-admin's decide().
    // Returning null instead would leave a Withdraw button that can never work.
    const getById = jasmine.createSpy('getById').and.returnValue(
      of(detailDto({ canWithdraw: false }))
    );
    const { service } = makeRealApiService({
      withdraw: () => throwError(() => httpError(409, { detail: 'Bidding has closed.' })),
      getById,
    });

    const bid = await service.withdrawBidAsync('b-1');

    expect(getById).toHaveBeenCalledWith('b-1');
    expect(bid?.canWithdraw).toBe(false);
  });
});

describe('VendorTenderService bids — mock mode is untouched', () => {
  afterEach(() => localStorage.removeItem('heavenly_vendor_bids'));

  it('still submits and withdraws entirely in localStorage', () => {
    environment.useRealApi = false;
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ToastService, useValue: { error: () => undefined, success: () => undefined, info: () => undefined } },
      ],
    });
    const service = TestBed.inject(VendorTenderService);

    const { bidId } = service.submitBid(EMPTY_FORM, 'TND-001');
    expect(service.bids().some(b => b.bidId === bidId)).toBe(true);

    expect(service.withdrawBid(bidId)).toBe(true);
    expect(service.bids().find(b => b.bidId === bidId)?.status).toBe('withdrawn');
  });
});
