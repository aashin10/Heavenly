import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthResponse } from '../auth-api.models';
import {
  AddVendorPortfolioEntryRequest,
  RegisterVendorRequest,
  UpdateVendorBankDetailsRequest,
  UpdateVendorBasicInfoRequest,
  UpdateVendorServicesRequest,
  UpsertVendorDocumentRequest,
  VendorDto,
  VendorProfileCompletionDto,
} from './vendor-api.models';

/**
 * Typed client for the .NET vendor endpoints (docs/backend/02-API-VENDOR-DASHBOARD.md).
 * Only exercised when `environment.useRealApi` is true; the interceptor adds
 * the bearer token and handles 401s.
 */
@Injectable({ providedIn: 'root' })
export class VendorApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/vendors`;

  /** POST /api/vendors/register — account + role + profile in one call, returns tokens. */
  register(body: RegisterVendorRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.base}/register`, body);
  }

  /** GET /api/vendors/me */
  me(): Observable<VendorDto> {
    return this.http.get<VendorDto>(`${this.base}/me`);
  }

  /** GET /api/vendors/me/profile-completion */
  profileCompletion(): Observable<VendorProfileCompletionDto> {
    return this.http.get<VendorProfileCompletionDto>(`${this.base}/me/profile-completion`);
  }

  updateBasicInfo(body: UpdateVendorBasicInfoRequest): Observable<VendorDto> {
    return this.http.put<VendorDto>(`${this.base}/me/basic`, body);
  }

  updateServices(body: UpdateVendorServicesRequest): Observable<VendorDto> {
    return this.http.put<VendorDto>(`${this.base}/me/services`, body);
  }

  updateBankDetails(body: UpdateVendorBankDetailsRequest): Observable<VendorDto> {
    return this.http.put<VendorDto>(`${this.base}/me/bank`, body);
  }

  upsertDocument(body: UpsertVendorDocumentRequest): Observable<VendorDto> {
    return this.http.put<VendorDto>(`${this.base}/me/documents`, body);
  }

  addPortfolioEntry(body: AddVendorPortfolioEntryRequest): Observable<VendorDto> {
    return this.http.post<VendorDto>(`${this.base}/me/portfolio`, body);
  }

  removePortfolioEntry(entryId: string): Observable<VendorDto> {
    return this.http.delete<VendorDto>(`${this.base}/me/portfolio/${entryId}`);
  }
}
