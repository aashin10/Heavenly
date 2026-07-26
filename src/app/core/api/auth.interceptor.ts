import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TokenStore } from './token-store.service';

/**
 * Attaches the bearer token to API requests and reacts to auth failures.
 *
 * - Only touches requests to `apiBaseUrl` (leaves asset/third-party calls alone).
 * - On 401, clears tokens and sends the user to /login. Token *refresh* is left
 *   to an explicit AuthApiService.refresh() call for now — a silent
 *   refresh-and-retry can be layered here once the /refresh endpoint is live and
 *   testable end-to-end.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.apiBaseUrl)) {
    return next(req);
  }

  const tokenStore = inject(TokenStore);
  const router = inject(Router);

  const accessToken = tokenStore.accessToken;
  const authReq = accessToken
    ? req.clone({ setHeaders: { Authorization: `Bearer ${accessToken}` } })
    : req;

  return next(authReq).pipe(
    catchError((error: unknown) => {
      const status = (error as { status?: number })?.status;
      // Don't hijack the login/refresh calls themselves — a 401 there is a
      // normal "bad credentials", handled by the caller.
      const isAuthEndpoint = req.url.includes('/auth/login') || req.url.includes('/auth/refresh');
      if (status === 401 && !isAuthEndpoint) {
        tokenStore.clear();
        router.navigate(['/login']);
      }
      return throwError(() => error);
    })
  );
};
