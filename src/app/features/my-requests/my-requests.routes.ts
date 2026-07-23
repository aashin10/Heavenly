import { Routes } from '@angular/router';
import { serviceRequesterGuard } from '../../core/guards/service-auth.guard';

export const MY_REQUESTS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./my-requests-list.page').then(m => m.MyRequestsListPageComponent),
    canActivate: [serviceRequesterGuard],
    title: 'My Requests',
    data: {
      description:
        'Track your Heavenly Corporation service requests, review tender activity, and continue saved drafts.',
    },
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./my-request-detail.page').then(m => m.MyRequestDetailPageComponent),
    canActivate: [serviceRequesterGuard],
    title: 'Request Details',
    data: {
      description: 'View the status, timeline and details of your service request.',
    },
  },
];
