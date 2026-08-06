import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AuthService } from './auth.service';
import { AuthApiService } from '../api/auth-api.service';
import { ToastService } from './toast.service';
import { AuthResponse } from '../api/auth-api.models';
import { environment } from '../../../environments/environment';

function makeAuthResponse(overrides: Partial<AuthResponse> = {}): AuthResponse {
  return {
    userId: 'u1',
    email: 'admin@example.com',
    name: 'Platform Administrator',
    userType: 'employer',
    roles: [],
    company: null,
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    accessTokenExpiresAt: new Date(Date.now() + 3600_000).toISOString(),
    refreshTokenExpiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    ...overrides,
  };
}

/**
 * F16: adminGuard/isAdmin used to check only `userType === 'admin'`, which
 * refuses every ServiceAdmin granted onto a differently-typed account — the
 * exact account shape B11's grant endpoint produces (primary userType
 * untouched, ServiceAdmin added to roles[]). These specs exercise the real
 * login path end-to-end (not a hand-built User) so a regression in either the
 * mapping or the isAdmin check itself is caught.
 */
describe('AuthService.isAdmin', () => {
  let authApiStub: { login: jasmine.Spy };

  beforeEach(() => {
    authApiStub = { login: jasmine.createSpy('login') };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthApiService, useValue: authApiStub },
        { provide: ToastService, useValue: { success: () => undefined, error: () => undefined } },
      ],
    });
  });

  afterEach(() => {
    environment.useRealApi = false;
    localStorage.clear();
  });

  it('is false with no session', () => {
    const service = TestBed.inject(AuthService);
    expect(service.isAdmin()).toBe(false);
  });

  it('mock mode: true only for userType admin, roles are never consulted', () => {
    const service = TestBed.inject(AuthService);
    service.signup({
      email: 'e@example.com',
      name: 'E',
      userType: 'admin',
      acceptedTerms: true,
      password: 'x',
    });
    service.login('e@example.com', 'x');
    expect(service.isAdmin()).toBe(true);
  });

  it('mock mode: an employer is not admin', () => {
    const service = TestBed.inject(AuthService);
    service.signup({
      email: 'e2@example.com',
      name: 'E2',
      userType: 'employer',
      acceptedTerms: true,
      password: 'x',
    });
    service.login('e2@example.com', 'x');
    expect(service.isAdmin()).toBe(false);
  });

  it('real API: a ServiceAdmin granted onto an employer account is admin — the F16 case', async () => {
    environment.useRealApi = true;
    authApiStub.login.and.returnValue(
      of(makeAuthResponse({ userType: 'employer', roles: ['employer', 'service_admin'] }))
    );
    const service = TestBed.inject(AuthService);

    await service.loginAsync('e@example.com', 'x');

    expect(service.isAdmin()).toBe(true);
  });

  it('real API: the seeded platform Admin is admin via roles', async () => {
    environment.useRealApi = true;
    authApiStub.login.and.returnValue(
      of(makeAuthResponse({ userType: 'admin', roles: ['admin'] }))
    );
    const service = TestBed.inject(AuthService);

    await service.loginAsync('admin@example.com', 'x');

    expect(service.isAdmin()).toBe(true);
  });

  it('real API: an account with neither role is not admin', async () => {
    environment.useRealApi = true;
    authApiStub.login.and.returnValue(
      of(makeAuthResponse({ userType: 'employer', roles: ['employer'] }))
    );
    const service = TestBed.inject(AuthService);

    await service.loginAsync('e@example.com', 'x');

    expect(service.isAdmin()).toBe(false);
  });
});
