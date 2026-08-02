import { Injectable, inject } from '@angular/core';
import { Observable, finalize, map, shareReplay, tap, throwError } from 'rxjs';
import { AuthApiService } from './auth-api.service';
import { TokenStore } from './token-store.service';

/**
 * Owns the single in-flight access-token refresh.
 *
 * The interceptor is a pure function and has nowhere to keep state, but
 * single-flight *is* state: without it, a dashboard that fires six parallel
 * requests against an expired token fires six refreshes. Because /auth/refresh
 * rotates the refresh token, the second through sixth would present a token the
 * first had already consumed — and the user would be logged out by the very
 * mechanism meant to keep them signed in.
 *
 * `shareReplay({ refCount: false })` keeps the result available to subscribers
 * that arrive after the response lands, and `finalize` clears the slot so the
 * next genuine expiry starts a fresh exchange.
 */
@Injectable({ providedIn: 'root' })
export class TokenRefreshCoordinator {
  private readonly authApi = inject(AuthApiService);
  private readonly tokenStore = inject(TokenStore);

  private inFlight: Observable<string> | null = null;

  /** Emits the new access token, or errors if the session cannot be renewed. */
  refresh(): Observable<string> {
    if (this.inFlight) return this.inFlight;

    const refreshToken = this.tokenStore.refreshToken;
    if (!refreshToken) {
      return throwError(() => new Error('No refresh token is stored.'));
    }

    this.inFlight = this.authApi.refresh({ refreshToken }).pipe(
      tap((response) => this.tokenStore.set(response.accessToken, response.refreshToken)),
      map((response) => response.accessToken),
      tap({
        // A rejected refresh means the session is genuinely over — the token
        // was revoked, expired past its 7 days, or already rotated. Clearing
        // here keeps the interceptor's job to navigation alone.
        error: () => this.tokenStore.clear(),
      }),
      finalize(() => (this.inFlight = null)),
      shareReplay({ bufferSize: 1, refCount: false })
    );

    return this.inFlight;
  }
}
