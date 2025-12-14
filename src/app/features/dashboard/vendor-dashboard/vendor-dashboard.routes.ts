import { Routes } from '@angular/router';

export const VENDOR_DASHBOARD_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./vendor-dashboard.page').then((m) => m.VendorDashboardPageComponent),
  },
];
