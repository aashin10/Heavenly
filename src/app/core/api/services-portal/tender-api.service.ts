import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  BrowseTendersParams,
  TenderClarificationDto,
  TenderListDto,
  TenderOpportunityDto,
  VendorTenderDto,
} from './tender-api.models';

/** Typed client for the .NET vendor-facing tender endpoints (backend B2.5). */
@Injectable({ providedIn: 'root' })
export class TenderApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/tenders`;

  /** GET /api/tenders — tenders matching the caller's capabilities and areas. */
  browse(params: BrowseTendersParams = {}): Observable<TenderListDto<TenderOpportunityDto>> {
    let httpParams = new HttpParams();
    if (params.category) httpParams = httpParams.set('category', params.category);
    if (params.city) httpParams = httpParams.set('city', params.city);
    if (params.search) httpParams = httpParams.set('search', params.search);
    if (params.closingSoon) httpParams = httpParams.set('closingSoon', 'true');
    if (params.includeUnmatched) httpParams = httpParams.set('includeUnmatched', 'true');
    if (params.page) httpParams = httpParams.set('page', params.page);
    if (params.pageSize) httpParams = httpParams.set('pageSize', params.pageSize);
    return this.http.get<TenderListDto<TenderOpportunityDto>>(this.base, { params: httpParams });
  }

  /** GET /api/tenders/{id} — one tender, with a per-vendor eligibility verdict. */
  getById(tenderId: string): Observable<VendorTenderDto> {
    return this.http.get<VendorTenderDto>(`${this.base}/${tenderId}`);
  }

  /** POST /api/tenders/{id}/clarifications — ask a question. */
  askClarification(tenderId: string, question: string): Observable<TenderClarificationDto> {
    return this.http.post<TenderClarificationDto>(`${this.base}/${tenderId}/clarifications`, { question });
  }
}
