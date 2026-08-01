/**
 * Wire types for the .NET auth API. These mirror `AuthResponse` and the request
 * shapes documented in docs/backend/01-API-AUTH.md. Kept separate from the
 * domain `User` model so the mapping between them is explicit.
 */

/** Response from POST /api/auth/login, /register (jobs — {userId} only today; vendors/requesters get this directly), /refresh. */
export interface AuthResponse {
  userId: string;
  email: string;
  name: string;
  /** Lowercase snake_case, e.g. 'employer' | 'applicant' | 'admin' | 'vendor' | 'service_requester'. */
  userType: string;
  /**
   * The account's full role set (backend B1), lowercase snake_case. A vendor
   * who is also a service requester holds both — check membership here, not
   * `userType` alone, when deciding whether an account may act in a portal.
   */
  roles: string[];
  company: string | null;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
}

/** Response from GET /api/auth/me — the AuthResponse minus the token fields. */
export interface MeResponse {
  userId: string;
  email: string;
  name: string;
  userType: string;
  roles: string[];
  company: string | null;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  fullName: string;
  email: string;
  phone: string;
  location?: string;
  password: string;
  companyName?: string;
  /** PascalCase enum name the current API expects, e.g. 'Employer' | 'Applicant'. */
  userType: string;
}

export interface RefreshRequest {
  refreshToken: string;
}
