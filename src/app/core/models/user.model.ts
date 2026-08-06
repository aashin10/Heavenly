export type UserType = 'employer' | 'applicant' | 'admin';

export interface User {
  id: string;
  email: string;
  name: string;
  userType: UserType;
  /**
   * The account's full role set (backend B1), lowercase snake_case — absent
   * for mock-mode users, which have no concept of a granted role beyond
   * `userType`. When present, this is authoritative for admin-gating: a
   * `ServiceAdmin` role can be granted onto an account whose primary
   * `userType` is something else entirely (e.g. `employer`), matching the
   * backend's `[Authorize(Roles = "ServiceAdmin,Admin")]` — checking
   * `userType` alone misses that account.
   */
  roles?: string[];
  phone?: string;
  company?: string;
  location?: string;
  bio?: string;
  skills?: string[];
  experience?: string;
  acceptedTerms: boolean;
  createdAt: string;
}
