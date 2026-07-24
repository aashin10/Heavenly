import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { provideRouter, TitleStrategy } from '@angular/router';

import { routes } from './app.routes';
import { provideClientHydration } from '@angular/platform-browser';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { LucideAngularModule } from 'lucide-angular';
import { APP_ICONS } from './shared/icons/app-icons';
import { SeoTitleStrategy } from './core/seo/seo-title.strategy';
import { authInterceptor } from './core/api/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideClientHydration(),
    // withFetch keeps HttpClient working under SSR; the interceptor attaches
    // the bearer token to API calls and handles 401s.
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    importProvidersFrom(LucideAngularModule.pick(APP_ICONS)),
    { provide: TitleStrategy, useClass: SeoTitleStrategy }
  ]
};
