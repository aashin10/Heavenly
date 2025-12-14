import { Routes } from '@angular/router';

export const VENDOR_ROUTES: Routes = [
  {
    path: '',
    redirectTo: 'tenders',
    pathMatch: 'full'
  },
  {
    path: 'tenders',
    loadComponent: () => import('./tender-browse/tender-browse.page')
      .then(m => m.TenderBrowsePageComponent),
    title: 'Browse Tenders'
  },
  {
    path: 'tenders/:id',
    loadComponent: () => import('./tender-detail/tender-detail.page')
      .then(m => m.TenderDetailPageComponent),
    title: 'Tender Details'
  },
  {
    path: 'tenders/:id/bid',
    loadComponent: () => import('./bid-submission/bid-submission.page')
      .then(m => m.BidSubmissionPageComponent),
    title: 'Submit Bid'
  },
  {
    path: 'bids',
    loadComponent: () => import('./my-bids/my-bids.page')
      .then(m => m.MyBidsPageComponent),
    title: 'My Bids'
  },
  {
    path: 'bids/:id',
    loadComponent: () => import('./bid-detail/bid-detail.page')
      .then(m => m.BidDetailPageComponent),
    title: 'Bid Details'
  }
];
