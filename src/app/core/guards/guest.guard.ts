import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ServiceAuthService } from '../services/service-auth.service';
import { ToastService } from '../services/toast.service';

export const guestGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const authService = inject(AuthService);
  const serviceAuthService = inject(ServiceAuthService);
  const toastService = inject(ToastService);
  const router = inject(Router);

  if (authService.isLoggedIn()) {
    // An explicit trip to signup (e.g. homepage "Hire Manpower" while signed in
    // as a job seeker) means "I want a different account": end the current
    // session and let them register or sign in with other credentials.
    if (route.queryParamMap.get('mode') === 'signup') {
      authService.logout();
      serviceAuthService.logout();
      toastService.info('You have been signed out. Create an account or sign in again.');
      return true;
    }

    router.navigate(['/dashboard']);
    return false;
  }

  return true;
};
