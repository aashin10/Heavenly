import { Routes } from '@angular/router';

export const MANAGEMENT_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./management.page').then(m => m.ManagementPageComponent),
    title: 'Management Dashboard | Heavenly'
  },
  {
    path: 'review/:id',
    loadComponent: () => import('./review/service-request-review.page').then(m => m.ServiceRequestReviewPageComponent),
    title: 'Review Service Request | Heavenly'
  },
  {
    path: 'publish/:id',
    loadComponent: () => import('./publish/tender-publish.page').then(m => m.TenderPublishPageComponent),
    title: 'Publish Tender | Heavenly'
  },
  {
    path: 'evaluation',
    loadChildren: () => import('./evaluation/evaluation.routes').then(m => m.evaluationRoutes),
    title: 'Bid Evaluation | Heavenly'
  }
];
