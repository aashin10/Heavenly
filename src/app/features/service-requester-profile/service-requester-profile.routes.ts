import { Routes } from '@angular/router';
import { serviceRequesterGuard } from '../../core/guards/service-auth.guard';

export const SERVICE_REQUESTER_PROFILE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./service-requester-profile.page').then(m => m.ServiceRequesterProfilePageComponent),
    canActivate: [serviceRequesterGuard],
    title: 'My Profile',
    data: {
      description:
        'Manage your Heavenly Corporation account — contact details and organization information.',
    },
  },
];
