import { Routes } from '@angular/router';
import { serviceRequesterGuard } from '../../core/guards/service-auth.guard';

export const SERVICE_REQUEST_ROUTES: Routes = [
  {
    path: '',
    redirectTo: '/services',
    pathMatch: 'full'
  },
  {
    path: 'new',
    loadComponent: () => import('./new/service-request-form.page').then(m => m.ServiceRequestFormPageComponent),
    canActivate: [serviceRequesterGuard],
    title: 'New Service Request',
    data: { description: 'Tell us what you need and receive competitive tenders from verified vendors.' }
  },
  {
    path: 'preview',
    loadComponent: () => import('./preview/service-request-preview.page').then(m => m.ServiceRequestPreviewPage),
    canActivate: [serviceRequesterGuard],
    title: 'Review Request',
    data: { description: 'Review your service request before submitting it for approval.' }
  }
];
