import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthResponse } from '../auth-api.models';
import {
  RegisterServiceRequesterRequest,
  ServiceRequesterDto,
  UpdateServiceRequesterProfileRequest,
} from './requester-api.models';

/** Typed client for the .NET service-requester endpoints (backend B2.3). */
@Injectable({ providedIn: 'root' })
export class RequesterApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/service-requesters`;

  /** POST /api/service-requesters/register — account + role + profile in one call. */
  register(body: RegisterServiceRequesterRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.base}/register`, body);
  }

  /** GET /api/service-requesters/me */
  me(): Observable<ServiceRequesterDto> {
    return this.http.get<ServiceRequesterDto>(`${this.base}/me`);
  }

  /** PUT /api/service-requesters/me — whole-profile replace, type included. */
  updateProfile(body: UpdateServiceRequesterProfileRequest): Observable<ServiceRequesterDto> {
    return this.http.put<ServiceRequesterDto>(`${this.base}/me`, body);
  }
}
