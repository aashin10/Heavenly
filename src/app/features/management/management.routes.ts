import { Routes } from '@angular/router';

export const MANAGEMENT_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./management.page').then(m => m.ManagementPageComponent),
    title: 'Management Dashboard | Heavenly'
  }
];
