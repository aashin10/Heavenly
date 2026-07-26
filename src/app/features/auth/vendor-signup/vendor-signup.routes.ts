import { Routes } from '@angular/router';

export const VENDOR_SIGNUP_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./vendor-signup.page').then(m => m.VendorSignupPageComponent),
    title: 'Vendor Registration',
    data: { description: 'Register as a vendor to receive tender opportunities and submit competitive bids.' }
  }
];
