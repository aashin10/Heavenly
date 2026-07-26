import { Routes } from '@angular/router';

export const HOME_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./home.page').then(m => m.HomePageComponent),
    title: 'Manpower, Industrial & Technical Services',
    data: { description: 'Heavenly Corporation supplies skilled manpower, delivers transformer rewinding contracts, and connects you with verified vendors for technical services across India.' }
  }
];
