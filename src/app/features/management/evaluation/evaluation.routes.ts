import { Routes } from '@angular/router';

export const evaluationRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./live-tenders-dashboard/live-tenders-dashboard.page')
      .then(m => m.LiveTendersDashboardPage),
    title: 'Bid Evaluation Dashboard'
  },
  {
    path: ':id',
    loadComponent: () => import('./bid-evaluation/bid-evaluation.page')
      .then(m => m.BidEvaluationPage),
    title: 'Bid Evaluation'
  },
  {
    path: ':id/technical/:bidId',
    loadComponent: () => import('./technical-bid-review/technical-bid-review.page')
      .then(m => m.TechnicalBidReviewPage),
    title: 'Technical Proposal Review'
  },
  {
    path: ':id/commercial/:bidId',
    loadComponent: () => import('./commercial-bid-detail/commercial-bid-detail.page')
      .then(m => m.CommercialBidDetailPage),
    title: 'Commercial Proposal Detail'
  }
];
