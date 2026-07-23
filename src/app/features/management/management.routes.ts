import { Routes } from '@angular/router';

export const MANAGEMENT_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./management.page').then(m => m.ManagementPageComponent),
    title: 'Management Dashboard'
  },
  {
    path: 'review/:id',
    loadComponent: () => import('./review/service-request-review.page').then(m => m.ServiceRequestReviewPageComponent),
    title: 'Review Service Request'
  },
  {
    path: 'publish/:id',
    loadComponent: () => import('./publish/tender-publish.page').then(m => m.TenderPublishPageComponent),
    title: 'Publish Tender'
  },
  {
    path: 'vendors/:id',
    loadComponent: () => import('./vendors/vendor-review.page').then(m => m.VendorReviewPageComponent),
    title: 'Vendor Verification'
  },
  {
    path: 'evaluation',
    loadChildren: () => import('./evaluation/evaluation.routes').then(m => m.evaluationRoutes),
    title: 'Bid Evaluation'
  }
];
