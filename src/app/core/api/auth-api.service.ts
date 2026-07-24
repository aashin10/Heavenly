import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AuthResponse,
  LoginRequest,
  MeResponse,
  RefreshRequest,
  RegisterRequest,
} from './auth-api.models';

/**
 * Typed client for the .NET auth endpoints (docs/backend/01-API-AUTH.md).
 *
 * This is the real-HTTP counterpart to the localStorage `AuthService`. It is
 * only exercised when `environment.useRealApi` is true; the interceptor adds the
 * bearer token and handles 401s.
 */
@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/auth`;

  /** POST /api/auth/login — exists on the backend today. */
  login(body: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.base}/login`, body);
  }

  /** POST /api/auth/register — returns 201 + { userId } today; see runbook. */
  register(body: RegisterRequest): Observable<{ userId: string }> {
    return this.http.post<{ userId: string }>(`${this.base}/register`, body);
  }

  /** GET /api/auth/me — session rehydration (new endpoint, this stage). */
  me(): Observable<MeResponse> {
    return this.http.get<MeResponse>(`${this.base}/me`);
  }

  /** POST /api/auth/refresh — exchange a refresh token for a fresh pair. */
  refresh(body: RefreshRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.base}/refresh`, body);
  }

  /** POST /api/auth/logout — invalidate the current session server-side. */
  logout(): Observable<void> {
    return this.http.post<void>(`${this.base}/logout`, {});
  }
}
