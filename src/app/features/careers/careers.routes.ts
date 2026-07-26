import { Routes } from '@angular/router';

export const CAREERS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./careers.page').then(m => m.CareersPageComponent),
    title: 'Careers',
    data: { description: 'Build your career with Heavenly Corporation — openings across IT, hospitality, HR and the skilled trades, with a clear four-step hiring process.' }
  }
];
