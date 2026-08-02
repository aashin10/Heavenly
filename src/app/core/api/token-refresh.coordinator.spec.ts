import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../../environments/environment';
import { TokenRefreshCoordinator } from './token-refresh.coordinator';
import { TokenStore } from './token-store.service';

describe('TokenRefreshCoordinator', () => {
  let coordinator: TokenRefreshCoordinator;
  let httpMock: HttpTestingController;
  let tokenStore: TokenStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    coordinator = TestBed.inject(TokenRefreshCoordinator);
    httpMock = TestBed.inject(HttpTestingController);
    tokenStore = TestBed.inject(TokenStore);
    tokenStore.set('stale-access', 'valid-refresh');
  });

  afterEach(() => {
    httpMock.verify();
    tokenStore.clear();
  });

  it('exchanges the refresh token and stores the new pair', () => {
    let emitted: string | undefined;
    coordinator.refresh().subscribe((token) => (emitted = token));

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/auth/refresh`);
    expect(req.request.body).toEqual({ refreshToken: 'valid-refresh' });
    req.flush({ accessToken: 'fresh-access', refreshToken: 'fresh-refresh' });

    expect(emitted).toBe('fresh-access');
    expect(tokenStore.accessToken).toBe('fresh-access');
    expect(tokenStore.refreshToken).toBe('fresh-refresh');
  });

  it('shares one HTTP call across concurrent callers', () => {
    const emitted: string[] = [];
    coordinator.refresh().subscribe((t) => emitted.push(t));
    coordinator.refresh().subscribe((t) => emitted.push(t));
    coordinator.refresh().subscribe((t) => emitted.push(t));

    // expectOne fails the test if more than one matching request was made,
    // which is exactly the regression this guards: three parallel 401s must
    // not fire three refreshes and rotate the token out from under each other.
    const req = httpMock.expectOne(`${environment.apiBaseUrl}/auth/refresh`);
    req.flush({ accessToken: 'fresh-access', refreshToken: 'fresh-refresh' });

    expect(emitted).toEqual(['fresh-access', 'fresh-access', 'fresh-access']);
  });

  it('starts a new call once the previous one has settled', () => {
    coordinator.refresh().subscribe();
    httpMock
      .expectOne(`${environment.apiBaseUrl}/auth/refresh`)
      .flush({ accessToken: 'first', refreshToken: 'first-refresh' });

    coordinator.refresh().subscribe();
    httpMock
      .expectOne(`${environment.apiBaseUrl}/auth/refresh`)
      .flush({ accessToken: 'second', refreshToken: 'second-refresh' });

    expect(tokenStore.accessToken).toBe('second');
  });

  it('errors without calling the API when there is no refresh token', () => {
    tokenStore.clear();
    let errored = false;
    coordinator.refresh().subscribe({ error: () => (errored = true) });

    httpMock.expectNone(`${environment.apiBaseUrl}/auth/refresh`);
    expect(errored).toBeTrue();
  });

  it('clears the session when the refresh itself is rejected', () => {
    let errored = false;
    coordinator.refresh().subscribe({ error: () => (errored = true) });

    httpMock
      .expectOne(`${environment.apiBaseUrl}/auth/refresh`)
      .flush({ title: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    expect(errored).toBeTrue();
    expect(tokenStore.accessToken).toBeNull();
    expect(tokenStore.refreshToken).toBeNull();
  });
});
