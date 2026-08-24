import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  BidDraftDto,
  BidDto,
  BidListDto,
  BidSummaryDto,
  MyBidsParams,
  SaveBidDraftRequest,
  SubmitBidRequest,
  VendorBidStatsDto,
} from './bid-api.models';

/**
 * Typed client for the .NET vendor-facing bid endpoints (backend B2.6).
 *
 * Every route is scoped server-side to the caller's own vendor profile — no
 * method here takes a vendor id, because none of the routes accept one. That
 * is what makes the bidding sealed, and it is a property of the route table
 * rather than of this client remembering to filter.
 *
 * Only exercised when `environment.useRealApi` is true; the interceptor adds
 * the bearer token and handles 401s.
 */
@Injectable({ providedIn: 'root' })
export class BidApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/bids`;

  /** GET /api/bids/drafts/{tenderId} — **404 when no draft exists**, which is the normal first visit. */
  getDraft(tenderId: string): Observable<BidDraftDto> {
    return this.http.get<BidDraftDto>(`${this.base}/drafts/${tenderId}`);
  }

  /** PUT /api/bids/drafts/{tenderId} — creates or overwrites. 409 once the tender stops accepting bids. */
  saveDraft(tenderId: string, body: SaveBidDraftRequest): Observable<BidDraftDto> {
    return this.http.put<BidDraftDto>(`${this.base}/drafts/${tenderId}`, body);
  }

  /**
   * POST /api/bids/tenders/{tenderId} — 201 on success.
   * 400 validation · 403 eligibility · 409 duplicate or closed window.
   * Submitting deletes the draft server-side; do not follow this with a delete.
   */
  submit(tenderId: string, body: SubmitBidRequest): Observable<BidDto> {
    return this.http.post<BidDto>(`${this.base}/tenders/${tenderId}`, body);
  }

  /** GET /api/bids/mine — paged; the server clamps pageSize to 1..100. */
  mine(params: MyBidsParams = {}): Observable<BidListDto<BidSummaryDto>> {
    let httpParams = new HttpParams();
    if (params.status) httpParams = httpParams.set('status', params.status);
    if (params.page) httpParams = httpParams.set('page', params.page);
    if (params.pageSize) httpParams = httpParams.set('pageSize', params.pageSize);
    return this.http.get<BidListDto<BidSummaryDto>>(`${this.base}/mine`, { params: httpParams });
  }

  /** GET /api/bids/mine/stats */
  myStats(): Observable<VendorBidStatsDto> {
    return this.http.get<VendorBidStatsDto>(`${this.base}/mine/stats`);
  }

  /** GET /api/bids/{bidId} — another vendor's bid is 404, never 403. */
  getById(bidId: string): Observable<BidDto> {
    return this.http.get<BidDto>(`${this.base}/${bidId}`);
  }

  /** POST /api/bids/{bidId}/withdraw — 409 once the bid window is shut. */
  withdraw(bidId: string, reason?: string): Observable<BidDto> {
    return this.http.post<BidDto>(`${this.base}/${bidId}/withdraw`, { reason: reason ?? null });
  }
}
