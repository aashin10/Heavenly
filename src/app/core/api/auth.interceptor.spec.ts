import { TestBed } from '@angular/core/testing';
import {
  HttpClient,
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { authInterceptor } from './auth.interceptor';
import { TokenStore } from './token-store.service';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let tokenStore: TokenStore;
  let router: jasmine.SpyObj<Router>;

  const url = `${environment.apiBaseUrl}/vendors/me`;

  beforeEach(() => {
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: Router, useValue: router },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    tokenStore = TestBed.inject(TokenStore);
    tokenStore.set('stale-access', 'valid-refresh');
  });

  afterEach(() => {
    httpMock.verify();
    tokenStore.clear();
  });

  it('attaches the bearer token to API requests', () => {
    http.get(url).subscribe();

    const req = httpMock.expectOne(url);
    expect(req.request.headers.get('Authorization')).toBe('Bearer stale-access');
    req.flush({});
  });

  it('leaves non-API requests untouched', () => {
    http.get('/assets/config.json').subscribe();

    const req = httpMock.expectOne('/assets/config.json');
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({});
  });

  it('refreshes once and retries the original request with the new token', () => {
    let body: Record<string, unknown> | undefined;
    http.get<Record<string, unknown>>(url).subscribe((res) => (body = res));

    httpMock.expectOne(url).flush({}, { status: 401, statusText: 'Unauthorized' });

    httpMock
      .expectOne(`${environment.apiBaseUrl}/auth/refresh`)
      .flush({ accessToken: 'fresh-access', refreshToken: 'fresh-refresh' });

    const retried = httpMock.expectOne(url);
    expect(retried.request.headers.get('Authorization')).toBe('Bearer fresh-access');
    retried.flush({ businessName: 'Sharma Electricals' });

    expect(body).toEqual({ businessName: 'Sharma Electricals' });
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('propagates a non-401 failure on the retried request without ending the session', () => {
    let error: unknown;
    http.get(url).subscribe({ error: (err) => (error = err) });

    httpMock.expectOne(url).flush({}, { status: 401, statusText: 'Unauthorized' });

    httpMock
      .expectOne(`${environment.apiBaseUrl}/auth/refresh`)
      .flush({ accessToken: 'fresh-access', refreshToken: 'fresh-refresh' });

    httpMock.expectOne(url).flush({}, { status: 500, statusText: 'Internal Server Error' });

    expect((error as HttpErrorResponse).status).toBe(500);
    expect(router.navigate).not.toHaveBeenCalled();
    expect(tokenStore.accessToken).toBe('fresh-access');
    expect(tokenStore.refreshToken).toBe('fresh-refresh');
  });

  it('gives up after one retry when the retried request also 401s', () => {
    let errored = false;
    http.get(url).subscribe({ error: () => (errored = true) });

    httpMock.expectOne(url).flush({}, { status: 401, statusText: 'Unauthorized' });
    httpMock
      .expectOne(`${environment.apiBaseUrl}/auth/refresh`)
      .flush({ accessToken: 'fresh-access', refreshToken: 'fresh-refresh' });
    httpMock.expectOne(url).flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(errored).toBeTrue();
    expect(tokenStore.accessToken).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('clears the session and redirects when the refresh itself fails', () => {
    let errored = false;
    http.get(url).subscribe({ error: () => (errored = true) });

    httpMock.expectOne(url).flush({}, { status: 401, statusText: 'Unauthorized' });
    httpMock
      .expectOne(`${environment.apiBaseUrl}/auth/refresh`)
      .flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(errored).toBeTrue();
    expect(tokenStore.accessToken).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('does not intercept a 401 from the login endpoint', () => {
    let errored = false;
    http.post(`${environment.apiBaseUrl}/auth/login`, {}).subscribe({ error: () => (errored = true) });

    httpMock
      .expectOne(`${environment.apiBaseUrl}/auth/login`)
      .flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(errored).toBeTrue();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(tokenStore.accessToken).toBe('stale-access');
  });

  it('redirects without calling refresh when no refresh token is stored', () => {
    tokenStore.clear();
    http.get(url).subscribe({ error: () => undefined });

    httpMock.expectOne(url).flush({}, { status: 401, statusText: 'Unauthorized' });

    httpMock.expectNone(`${environment.apiBaseUrl}/auth/refresh`);
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });
});
