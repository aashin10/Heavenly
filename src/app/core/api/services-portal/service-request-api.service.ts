import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  CancelServiceRequestRequest,
  SaveDraftRequest,
  ServiceRequestDraftDto,
  ServiceRequestDto,
  ServiceRequestSummaryDto,
  SubmitServiceRequestRequest,
} from './service-request-api.models';

/** Typed client for the .NET service-request endpoints (backend B2.4). */
@Injectable({ providedIn: 'root' })
export class ServiceRequestApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/service-requests`;

  /** GET /api/service-requests/drafts — every unexpired draft belonging to the caller. */
  getDrafts(): Observable<ServiceRequestDraftDto[]> {
    return this.http.get<ServiceRequestDraftDto[]>(`${this.base}/drafts`);
  }

  /** GET /api/service-requests/drafts/{serviceId} — resume lookup. */
  getDraft(serviceId: string): Observable<ServiceRequestDraftDto> {
    return this.http.get<ServiceRequestDraftDto>(`${this.base}/drafts/${serviceId}`);
  }

  /** PUT /api/service-requests/drafts/{serviceId} — create-or-update, keyed by service. */
  saveDraft(serviceId: string, body: SaveDraftRequest): Observable<ServiceRequestDraftDto> {
    return this.http.put<ServiceRequestDraftDto>(`${this.base}/drafts/${serviceId}`, body);
  }

  /** DELETE /api/service-requests/drafts/{serviceId} — "start fresh". */
  deleteDraft(serviceId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/drafts/${serviceId}`);
  }

  /** POST /api/service-requests — submit, or resubmit when the body names a request. */
  submit(body: SubmitServiceRequestRequest): Observable<ServiceRequestDto> {
    return this.http.post<ServiceRequestDto>(this.base, body);
  }

  /** GET /api/service-requests/mine — the caller's own requests, newest first. */
  getMine(): Observable<ServiceRequestSummaryDto[]> {
    return this.http.get<ServiceRequestSummaryDto[]>(`${this.base}/mine`);
  }

  /** GET /api/service-requests/{requestId} — one of the caller's own requests, in full. */
  getOne(requestId: string): Observable<ServiceRequestDto> {
    return this.http.get<ServiceRequestDto>(`${this.base}/${requestId}`);
  }

  /** POST /api/service-requests/{requestId}/cancel */
  cancel(requestId: string, body?: CancelServiceRequestRequest): Observable<ServiceRequestDto> {
    return this.http.post<ServiceRequestDto>(`${this.base}/${requestId}/cancel`, body ?? {});
  }
}
