import { Routes } from '@angular/router';

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
    path: 'login',
    loadChildren: () => import('./features/auth/login/login.routes').then(m => m.LOGIN_ROUTES)
  },
  {
    path: 'management',
    loadChildren: () => import('./features/management/management.routes').then(m => m.MANAGEMENT_ROUTES)
  },
  {
    path: '**',
    redirectTo: ''
  }
];
