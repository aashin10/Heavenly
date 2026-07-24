import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

const ACCESS_TOKEN_KEY = 'heavenly_access_token';
const REFRESH_TOKEN_KEY = 'heavenly_refresh_token';

/**
 * Holds the API access + refresh tokens. localStorage-backed and SSR-safe.
 *
 * Access tokens in localStorage are XSS-readable; that is an accepted trade-off
 * for this SPA. If the threat model tightens, move the refresh token to an
 * httpOnly cookie set by the API and keep only the access token here.
 */
@Injectable({ providedIn: 'root' })
export class TokenStore {
  private readonly platformId = inject(PLATFORM_ID);

  get accessToken(): string | null {
    return this.read(ACCESS_TOKEN_KEY);
  }

  get refreshToken(): string | null {
    return this.read(REFRESH_TOKEN_KEY);
  }

  set(accessToken: string, refreshToken: string): void {
    if (!isPlatformBrowser(this.platformId)) return;
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }

  clear(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }

  private read(key: string): string | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    return localStorage.getItem(key);
  }
}
