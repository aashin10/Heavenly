/**
 * Wire types for the .NET service-requester API
 * (docs/backend/03-EXISTING-BACKEND-REVIEW.md, backend B2.3).
 */
import { RequesterType } from '../../models/service.model';

/**
 * The API's canonical requester shape — one type with a discriminator, not the
 * frontend's three-branch union. `address` is the single field the API uses
 * for what the frontend's union calls `address` / `businessAddress` /
 * `registeredAddress` depending on branch (frontend item F10); the mapper is
 * what does the narrowing.
 */
export interface ServiceRequesterDto {
  id: string;
  userId: string;
  requesterType: RequesterType;
  displayName: string;
  fullName: string | null;
  organizationName: string | null;
  gstNumber: string | null;
  authorizedPersonName: string | null;
  designation: string | null;
  department: string | null;
  address: string | null;
  city: string;
  email: string;
  phone: string | null;
  isEmailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

/** POST /api/service-requesters/register */
export interface RegisterServiceRequesterRequest {
  email: string;
  password: string;
  phone: string;
  requesterType: RequesterType;
  city: string;
  fullName?: string;
  organizationName?: string;
  gstNumber?: string;
  authorizedPersonName?: string;
  designation?: string;
  department?: string;
  address?: string;
  acceptedTerms: boolean;
}

/**
 * PUT /api/service-requesters/me — whole-profile replace, type included.
 *
 * `phone` is optional here (registration requires it, editing does not have to
 * touch it) — it lives on the account, not this profile, so omitting it leaves
 * the phone unchanged rather than blanking it out.
 */
export interface UpdateServiceRequesterProfileRequest {
  requesterType: RequesterType;
  city: string;
  phone?: string;
  fullName?: string;
  organizationName?: string;
  gstNumber?: string;
  authorizedPersonName?: string;
  designation?: string;
  department?: string;
  address?: string;
}
