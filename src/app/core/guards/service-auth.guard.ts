import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { ServiceAuthService } from '../services/service-auth.service';
import { Vendor } from '../models/service.model';

/**
 * Guard that protects routes for authenticated service users (both requesters and vendors)
 */
export const serviceAuthGuard: CanActivateFn = () => {
  const serviceAuthService = inject(ServiceAuthService);
  const router = inject(Router);

  const session = serviceAuthService.getCurrentUserSession();

  if (!session) {
    // Redirect to login if not authenticated
    router.navigate(['/login']);
    return false;
  }

  return true;
};

/**
 * Guard that protects routes specifically for service requesters
 */
export const serviceRequesterGuard: CanActivateFn = () => {
  const serviceAuthService = inject(ServiceAuthService);
  const router = inject(Router);

  const session = serviceAuthService.getCurrentUserSession();

  if (!session) {
    router.navigate(['/login']);
    return false;
  }

  if (session.userType !== 'service_requester') {
    // Redirect vendors to their dashboard
    router.navigate(['/vendor-dashboard']);
    return false;
  }

  return true;
};

/**
 * Guard that protects routes specifically for vendors
 */
export const vendorGuard: CanActivateFn = () => {
  const serviceAuthService = inject(ServiceAuthService);
  const router = inject(Router);

  const session = serviceAuthService.getCurrentUserSession();

  if (!session) {
    router.navigate(['/login']);
    return false;
  }

  if (session.userType !== 'vendor') {
    // Redirect requesters to their dashboard
    router.navigate(['/service-requester-dashboard']);
    return false;
  }

  return true;
};

/**
 * Guard that protects routes for verified vendors only
 */
export const vendorVerifiedGuard: CanActivateFn = () => {
  const serviceAuthService = inject(ServiceAuthService);
  const router = inject(Router);

  const session = serviceAuthService.getCurrentUserSession();

  if (!session) {
    router.navigate(['/login']);
    return false;
  }

  if (session.userType !== 'vendor') {
    router.navigate(['/service-requester-dashboard']);
    return false;
  }

  // Check if vendor is verified
  const vendor = serviceAuthService.getCurrentUser() as Vendor;
  if (vendor?.verificationStatus === 'pending') {
    router.navigate(['/verification-pending']);
    return false;
  }

  if (vendor?.verificationStatus === 'rejected') {
    // Could redirect to a rejection page or back to login
    router.navigate(['/login']);
    return false;
  }

  return true;
};

/**
 * Guard that allows only guests (non-authenticated service users)
 */
export const serviceGuestGuard: CanActivateFn = () => {
  const serviceAuthService = inject(ServiceAuthService);
  const router = inject(Router);

  const session = serviceAuthService.getCurrentUserSession();

  if (session) {
    // Redirect to appropriate dashboard based on user type
    if (session.userType === 'vendor') {
      if (session.vendorStatus === 'pending') {
        router.navigate(['/verification-pending']);
      } else {
        router.navigate(['/vendor-dashboard']);
      }
    } else {
      router.navigate(['/service-requester-dashboard']);
    }
    return false;
  }

  return true;
};
