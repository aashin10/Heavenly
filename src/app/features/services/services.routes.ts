import { Routes } from '@angular/router';

export const SERVICES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./services.page').then(m => m.ServicesPageComponent),
    title: 'Our Services',
    data: { description: 'Browse AC servicing, electrical, fabrication, CCTV & fire, interiors and more. Submit a request and receive competitive tenders from verified vendors.' }
  }
];
