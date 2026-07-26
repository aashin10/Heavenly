import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { ServiceAuthService } from '../services/service-auth.service';
import { ToastService } from '../services/toast.service';
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

  // Any non-verified vendor goes to the status-aware verification screen, which
  // shows the right content (in progress / rejected + reason / suspended) rather
  // than dumping rejected vendors at /login with no explanation.
  const vendor = serviceAuthService.getCurrentUser() as Vendor;
  if (vendor && vendor.verificationStatus !== 'verified') {
    router.navigate(['/verification-pending']);
    return false;
  }

  return true;
};

/**
 * Guard for the signup pages (/vendor-signup, /service-requester-signup).
 *
 * These routes are only ever reached deliberately — e.g. a signed-in requester
 * clicking "Become a Vendor" on the homepage. Bouncing them to their own
 * dashboard (the old behaviour) made those CTAs silently do nothing, so an
 * arrival while signed in is treated as "I want a different account": end the
 * session and let them register.
 */
export const serviceGuestGuard: CanActivateFn = () => {
  const serviceAuthService = inject(ServiceAuthService);
  const toastService = inject(ToastService);

  if (serviceAuthService.getCurrentUserSession()) {
    serviceAuthService.logout();
    toastService.info('You have been signed out. Create an account or sign in again.');
  }

  return true;
};
