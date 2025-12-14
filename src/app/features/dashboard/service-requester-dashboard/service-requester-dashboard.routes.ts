import { Routes } from '@angular/router';

export const SERVICE_REQUESTER_DASHBOARD_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./service-requester-dashboard.page').then(
        (m) => m.ServiceRequesterDashboardPageComponent
      ),
  },
];
