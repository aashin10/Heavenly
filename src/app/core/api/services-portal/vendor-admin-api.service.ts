import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { VendorDto } from './vendor-api.models';
import { VendorQueueDto, VendorQueueParams } from './vendor-admin-api.models';

/**
 * Typed client for the admin vendor endpoints (docs/backend/02).
 *
 * Every route here is role-gated to ServiceAdmin/Admin — a caller without one
 * gets 403, which is why Slice 1 (admin bootstrap) had to land first.
 */
@Injectable({ providedIn: 'root' })
export class VendorAdminApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/service-admin/vendors`;

  /** GET /api/service-admin/vendors — filtered, paged, with per-status counts. */
  queue(params: VendorQueueParams = {}): Observable<VendorQueueDto> {
    let httpParams = new HttpParams();
    // `status` binds via TypeConverter, not the JSON snake_case policy — but
    // every VendorStatus member is a single word, so the lowercase wire value
    // parses case-insensitively. No manual conversion needed.
    if (params.status) httpParams = httpParams.set('status', params.status);
    if (params.search) httpParams = httpParams.set('search', params.search);
    if (params.page) httpParams = httpParams.set('page', params.page);
    if (params.pageSize) httpParams = httpParams.set('pageSize', params.pageSize);

    return this.http.get<VendorQueueDto>(this.base, { params: httpParams });
  }

  /** GET /api/service-admin/vendors/{id} — full profile + named timeline. */
  getById(vendorId: string): Observable<VendorDto> {
    return this.http.get<VendorDto>(`${this.base}/${vendorId}`);
  }

  /** Legal from pending or rejected. */
  approve(vendorId: string, reason?: string): Observable<VendorDto> {
    return this.http.post<VendorDto>(`${this.base}/${vendorId}/approve`, { reason: reason ?? null });
  }

  /** Legal from pending only. The reason is shown to the vendor. */
  reject(vendorId: string, reason: string): Observable<VendorDto> {
    return this.http.post<VendorDto>(`${this.base}/${vendorId}/reject`, { reason });
  }

  /** Legal from verified only. */
  suspend(vendorId: string, reason: string): Observable<VendorDto> {
    return this.http.post<VendorDto>(`${this.base}/${vendorId}/suspend`, { reason });
  }

  /** Legal from suspended only — and returns the vendor to *verified*. */
  reinstate(vendorId: string, reason?: string): Observable<VendorDto> {
    return this.http.post<VendorDto>(`${this.base}/${vendorId}/reinstate`, { reason: reason ?? null });
  }
}
