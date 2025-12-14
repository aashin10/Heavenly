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
    canActivate: [serviceRequesterGuard]
  },
  {
    path: 'preview',
    loadComponent: () => import('./preview/service-request-preview.page').then(m => m.ServiceRequestPreviewPage),
    canActivate: [serviceRequesterGuard]
  }
];
