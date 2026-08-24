import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { importProvidersFrom, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { APP_ICONS } from '../../../shared/icons/app-icons';
import { MyBidsPageComponent } from './my-bids.page';
import { VendorTenderService } from '../vendor.service';
import { BidSummary } from '../vendor.model';

function row(id: string, status: BidSummary['status'] = 'submitted'): BidSummary {
  return {
    bidId: id,
    bidNumber: `BID-${id}`,
    tenderId: `t-${id}`,
    tenderNumber: `TND-${id}`,
    tenderTitle: 'Quarterly AC servicing',
    status,
    bidAmount: 52000,
    tenderClosingDate: '2026-09-01T00:00:00Z',
    submittedAt: '2026-08-20T10:00:00Z',
  };
}

function makeComponent(state: {
  bids?: BidSummary[];
  loading?: boolean;
  error?: string | null;
  truncated?: { shown: number; total: number } | null;
}) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [MyBidsPageComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      importProvidersFrom(LucideAngularModule.pick(APP_ICONS)),
      {
        provide: VendorTenderService,
        useValue: {
          bids: signal(state.bids ?? []),
          bidsLoading: signal(state.loading ?? false),
          bidsError: signal(state.error ?? null),
          bidsTruncated: signal(state.truncated ?? null),
          noConfirmedBids: signal(false),
          refreshBidsAsync: () => Promise.resolve(),
        },
      },
    ],
  });

  const fixture = TestBed.createComponent(MyBidsPageComponent);
  fixture.detectChanges();
  return fixture;
}

describe('MyBidsPageComponent', () => {
  it('does not claim there are no bids when the load failed', () => {
    // "You haven't submitted any bids" is an assertion about the vendor's
    // bids. A 500 is no evidence for it.
    const html = makeComponent({ error: 'Could not load your bids.' }).nativeElement.textContent;

    expect(html).toContain('Could not load your bids.');
    expect(html).not.toContain("haven't submitted any bids");
  });

  it('says it is loading rather than showing an empty state first', () => {
    const html = makeComponent({ loading: true }).nativeElement.textContent;

    expect(html).toContain('Loading');
    expect(html).not.toContain("haven't submitted any bids");
  });

  it('says so when it is only showing part of the list', () => {
    // F18 exists because the vendor queue truncates at 100 silently, beside a
    // total that contradicts it. Not repeating that here.
    const html = makeComponent({
      bids: [row('a'), row('b')],
      truncated: { shown: 2, total: 137 },
    }).nativeElement.textContent;

    expect(html).toContain('137');
  });
});
