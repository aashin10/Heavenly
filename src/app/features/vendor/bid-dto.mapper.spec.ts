import { BidDto, BidSummaryDto } from '../../core/api/services-portal/bid-api.models';
import { mapBidDto, mapBidSummaryDto, toSubmitBidRequest } from './bid-dto.mapper';
import { BidFormData } from './vendor.model';

function bidDto(overrides: Partial<BidDto> = {}): BidDto {
  return {
    id: 'b-1',
    bidNumber: 'BID-2026-00231',
    tenderId: 't-1',
    tenderNumber: 'TND-2026-00087',
    tenderTitle: 'Quarterly AC servicing',
    tenderClosingDate: '2026-09-01T00:00:00Z',
    vendorId: 'v-1',
    status: 'submitted',
    bidAmount: 52000,
    technicalProposal: {
      companyProfile: '20 years in HVAC.',
      relevantExperience: null,
      technicalApproach: 'Two technicians per floor.',
      manpowerPlan: null,
      equipmentPlan: null,
      deliveryTimeline: '3 days',
      deviations: null,
      similarWorkReferences: [
        { id: 'r-1', clientName: 'Acme', projectType: 'AC servicing', contactPerson: null, phone: null },
      ],
    },
    commercialProposal: {
      totalPrice: 52000,
      taxesAndDuties: 'GST 18% extra',
      paymentTerms: null,
      validityPeriod: null,
      warrantyPricing: null,
      amcPricing: null,
      priceBreakdown: [{ id: 'p-1', description: 'Labour', amount: 30000, sortOrder: 0 }],
    },
    rejectionReason: null,
    isEditableByVendor: true,
    isLive: true,
    canWithdraw: true,
    submittedAt: '2026-08-20T10:00:00Z',
    updatedAt: '2026-08-20T10:00:00Z',
    events: [{ fromStatus: null, toStatus: 'submitted', note: 'Submitted', occurredAt: '2026-08-20T10:00:00Z' }],
    ...overrides,
  };
}

describe('bid-dto.mapper', () => {
  it('keeps the opaque id and the human reference apart', () => {
    // `bidId` is the route key; `bidNumber` is what a vendor reads out loud.
    // Conflating them worked while the mock generated both from Date.now().
    const bid = mapBidDto(bidDto());

    expect(bid.bidId).toBe('b-1');
    expect(bid.bidNumber).toBe('BID-2026-00231');
  });

  it('takes canWithdraw from the server, not from the status', () => {
    // An admin can close a tender early: status stays `submitted` while the
    // window is shut, so deriving this locally would offer a control that 409s.
    const bid = mapBidDto(bidDto({ status: 'submitted', canWithdraw: false }));

    expect(bid.canWithdraw).toBe(false);
  });

  it('turns nullable wire fields into the empty strings the templates render', () => {
    const bid = mapBidDto(bidDto());

    expect(bid.technicalProposal.relevantExperience).toBe('');
    expect(bid.commercialProposal.paymentTerms).toBe('');
    expect(bid.technicalProposal.similarWorkReferences[0].phone).toBe('');
  });

  it('maps a list row without inventing a proposal', () => {
    const summary: BidSummaryDto = {
      id: 'b-2',
      bidNumber: 'BID-2026-00232',
      tenderId: 't-2',
      tenderNumber: 'TND-2026-00088',
      tenderTitle: 'Office rewiring',
      category: 'technical',
      status: 'under_review',
      bidAmount: 90000,
      tenderClosingDate: null,
      submittedAt: '2026-08-21T10:00:00Z',
    };

    const row = mapBidSummaryDto(summary);

    expect(row.bidId).toBe('b-2');
    expect(row.category).toBe('technical');
    // A null closing date becomes '' — the template's date pipe renders nothing
    // rather than "Invalid Date".
    expect(row.tenderClosingDate).toBe('');
    // And there is no proposal on the type at all: `BidSummary` has no such
    // field, so nothing downstream can read a blank one as real.
    expect('technicalProposal' in row).toBe(false);
  });

  it('drops empty repeatable rows on the way out', () => {
    // The wizard seeds one blank reference and one blank price line. Sending
    // them makes the server reject the whole bid on NotEmpty rules.
    const form: BidFormData = {
      confirmEligibility: true,
      companyProfile: 'x',
      relevantExperience: 'y',
      similarWorkReferences: [
        { clientName: 'Acme', projectType: 'AC', contactPerson: '', phone: '' },
        { clientName: '', projectType: '', contactPerson: '', phone: '' },
      ],
      technicalApproach: 'z',
      manpowerPlan: '',
      equipmentPlan: '',
      deliveryTimeline: '3 days',
      deviations: '',
      totalPrice: 52000,
      priceBreakdown: [
        { description: 'Labour', amount: 30000 },
        { description: '', amount: 0 },
      ],
      taxesAndDuties: 'GST',
      paymentTerms: '50/50',
      validityPeriod: '60 days',
      warrantyPricing: '',
      amcPricing: '',
    };

    const request = toSubmitBidRequest(form);

    expect(request.similarWorkReferences.length).toBe(1);
    expect(request.priceBreakdown.length).toBe(1);
    expect(request.confirmEligibility).toBe(true);
    // Optional blanks go as undefined, not '': the server's MaximumLength rules
    // pass either way, but '' would persist an empty string as though answered.
    expect(request.manpowerPlan).toBeUndefined();
  });
});
