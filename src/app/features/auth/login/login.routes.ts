import { Routes } from '@angular/router';

export const LOGIN_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./login.page').then(m => m.LoginPageComponent),
    title: 'Login',
    data: { description: 'Sign in to the Heavenly Corporation jobs or services portal.' }
  }
];
