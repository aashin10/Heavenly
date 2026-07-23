import { Routes } from '@angular/router';

export const VERIFICATION_PENDING_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./verification-pending.page').then(
        (m) => m.VerificationPendingPageComponent
      ),
    title: 'Verification Pending',
    data: { description: 'Your vendor account is being verified by the Heavenly Corporation team.' },
  },
];
