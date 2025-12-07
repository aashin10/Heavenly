import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';

export const PROFILE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./profile.page').then(m => m.ProfilePageComponent),
    canActivate: [authGuard],
    title: 'My Profile | Heavenly'
  }
];
