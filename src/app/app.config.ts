import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { provideRouter, TitleStrategy } from '@angular/router';

import { routes } from './app.routes';
import { provideClientHydration } from '@angular/platform-browser';
import { LucideAngularModule } from 'lucide-angular';
import { APP_ICONS } from './shared/icons/app-icons';
import { SeoTitleStrategy } from './core/seo/seo-title.strategy';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideClientHydration(),
    importProvidersFrom(LucideAngularModule.pick(APP_ICONS)),
    { provide: TitleStrategy, useClass: SeoTitleStrategy }
  ]
};
