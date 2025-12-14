import { Routes } from '@angular/router';

export const VERIFICATION_PENDING_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./verification-pending.page').then(
        (m) => m.VerificationPendingPageComponent
      ),
  },
];
