import { Routes } from '@angular/router';

export const ABOUT_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./about.page').then(m => m.AboutPageComponent),
    title: 'About Us',
    data: { description: 'One partner for manpower supply, transformer rewinding and technical services — owner-led, with a single point of accountability.' }
  }
];
