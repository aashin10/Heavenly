import { Routes } from '@angular/router';
import { adminGuard } from './core/guards/admin.guard';
import { guestGuard } from './core/guards/guest.guard';
import {
  serviceRequesterGuard,
  vendorGuard,
  vendorVerifiedGuard,
  serviceGuestGuard
} from './core/guards/service-auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadChildren: () => import('./features/home/home.routes').then(m => m.HOME_ROUTES)
  },
  {
    path: 'about',
    loadChildren: () => import('./features/about/about.routes').then(m => m.ABOUT_ROUTES)
  },
  {
    path: 'contact',
    loadChildren: () => import('./features/contact/contact.routes').then(m => m.CONTACT_ROUTES)
  },
  {
    path: 'careers',
    loadChildren: () => import('./features/careers/careers.routes').then(m => m.CAREERS_ROUTES)
  },
  {
    path: 'login',
    loadChildren: () => import('./features/auth/login/login.routes').then(m => m.LOGIN_ROUTES),
    canActivate: [guestGuard]
  },
  {
    path: 'dashboard',
    loadChildren: () => import('./features/dashboard/dashboard.routes').then(m => m.DASHBOARD_ROUTES)
  },
  {
    path: 'management',
    loadChildren: () => import('./features/management/management.routes').then(m => m.MANAGEMENT_ROUTES),
    canActivate: [adminGuard]
  },
  {
    path: 'profile',
    loadChildren: () => import('./features/profile/profile.routes').then(m => m.PROFILE_ROUTES)
  },
  // Service-related routes
  {
    path: 'services',
    loadChildren: () => import('./features/services/services.routes').then(m => m.SERVICES_ROUTES)
  },
  {
    path: 'service-request',
    loadChildren: () => import('./features/service-request/service-request.routes').then(m => m.SERVICE_REQUEST_ROUTES)
  },
  {
    path: 'service-requester-signup',
    loadChildren: () => import('./features/auth/service-requester-signup/service-requester-signup.routes').then(m => m.SERVICE_REQUESTER_SIGNUP_ROUTES),
    canActivate: [serviceGuestGuard]
  },
  {
    path: 'vendor-signup',
    loadChildren: () => import('./features/auth/vendor-signup/vendor-signup.routes').then(m => m.VENDOR_SIGNUP_ROUTES),
    canActivate: [serviceGuestGuard]
  },
  {
    path: 'service-requester-dashboard',
    loadChildren: () => import('./features/dashboard/service-requester-dashboard/service-requester-dashboard.routes').then(m => m.SERVICE_REQUESTER_DASHBOARD_ROUTES),
    canActivate: [serviceRequesterGuard]
  },
  {
    path: 'service-requester-profile',
    loadChildren: () => import('./features/service-requester-profile/service-requester-profile.routes').then(m => m.SERVICE_REQUESTER_PROFILE_ROUTES),
    canActivate: [serviceRequesterGuard]
  },
  {
    path: 'my-requests',
    loadChildren: () => import('./features/my-requests/my-requests.routes').then(m => m.MY_REQUESTS_ROUTES),
    canActivate: [serviceRequesterGuard]
  },
  {
    path: 'vendor-dashboard',
    loadChildren: () => import('./features/dashboard/vendor-dashboard/vendor-dashboard.routes').then(m => m.VENDOR_DASHBOARD_ROUTES),
    canActivate: [vendorVerifiedGuard]
  },
  {
    // vendorGuard, deliberately not vendorVerifiedGuard: a *pending* vendor
    // completing this profile is how they get verified.
    path: 'vendor-profile',
    loadChildren: () => import('./features/vendor-profile/vendor-profile.routes').then(m => m.VENDOR_PROFILE_ROUTES),
    canActivate: [vendorGuard]
  },
  // Vendor tender and bid routes
  {
    path: 'vendor',
    loadChildren: () => import('./features/vendor/vendor.routes').then(m => m.VENDOR_ROUTES),
    canActivate: [vendorVerifiedGuard]
  },
  {
    path: 'verification-pending',
    loadChildren: () => import('./features/auth/verification-pending/verification-pending.routes').then(m => m.VERIFICATION_PENDING_ROUTES)
  },
  {
    // Real 404 — the old silent redirect to '' let fourteen dead links ship
    // undetected (docs/UI_ISSUES.md §1). A missing page must fail loudly.
    path: '**',
    loadComponent: () => import('./features/not-found/not-found.page').then(m => m.NotFoundPageComponent),
    title: 'Page Not Found'
  }
];
