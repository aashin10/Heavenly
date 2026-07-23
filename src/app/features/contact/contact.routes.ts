import { Routes } from '@angular/router';

export const CONTACT_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./contact.page').then(m => m.ContactPageComponent),
    title: 'Contact Us',
    data: { description: 'Get in touch with Heavenly Corporation — New Delhi office, phone, WhatsApp and email.' }
  }
];
