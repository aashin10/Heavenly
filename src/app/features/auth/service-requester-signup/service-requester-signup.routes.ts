import { Routes } from '@angular/router';

export const SERVICE_REQUESTER_SIGNUP_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./service-requester-signup.page').then(m => m.ServiceRequesterSignupPageComponent),
    title: 'Create Account',
    data: { description: 'Create a service requester account to submit requests and hire verified vendors.' }
  }
];
