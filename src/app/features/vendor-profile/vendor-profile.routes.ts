import { Routes } from '@angular/router';

export const VENDOR_PROFILE_ROUTES: Routes = [
  {
    path: '',
    redirectTo: 'basic',
    pathMatch: 'full',
  },
  {
    path: ':section',
    loadComponent: () =>
      import('./vendor-profile.page').then(m => m.VendorProfilePageComponent),
    title: 'Business Profile',
    data: {
      description:
        'Manage your Heavenly Corporation vendor profile — business details, documents, services, portfolio and bank information.',
    },
  },
];
