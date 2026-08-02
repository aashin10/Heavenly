import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TokenRefreshCoordinator } from './token-refresh.coordinator';
import { TokenStore } from './token-store.service';

/**
 * Attaches the bearer token to API requests and keeps the session alive.
 *
 * On a 401 the request is not abandoned: the token is refreshed once and the
 * original request replayed with the new one. Only if that refresh fails — a
 * revoked, rotated or genuinely expired refresh token — is the session cleared
 * and the user sent to /login.
 *
 * Retry is deliberately once, not a loop. The replay runs inside switchMap, so
 * its own failures land in the inner catchError rather than re-entering this
 * one; a second 401 ends the session instead of refreshing forever.
 *
 * Concurrency is handled by TokenRefreshCoordinator, not here — six parallel
 * requests hitting an expired token share one refresh.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.apiBaseUrl)) {
    return next(req);
  }

  const tokenStore = inject(TokenStore);
  const coordinator = inject(TokenRefreshCoordinator);
  const router = inject(Router);

  const withAuth = (token: string | null) =>
    token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  const endSession = (error: unknown) => {
    tokenStore.clear();
    router.navigate(['/login']);
    return throwError(() => error);
  };

  return next(withAuth(tokenStore.accessToken)).pipe(
    catchError((error: unknown) => {
      const status = (error as HttpErrorResponse)?.status;

      // A 401 on login or refresh is a normal "bad credentials" / "session
      // over" answer that the caller handles; hijacking it would turn a failed
      // login into a redirect loop.
      const isAuthEndpoint =
        req.url.includes('/auth/login') || req.url.includes('/auth/refresh');

      if (status !== 401 || isAuthEndpoint) {
        return throwError(() => error);
      }

      if (!tokenStore.refreshToken) {
        return endSession(error);
      }

      return coordinator.refresh().pipe(
        switchMap((accessToken) => next(withAuth(accessToken))),
        catchError((retryError: unknown) => endSession(retryError))
      );
    })
  );
};
