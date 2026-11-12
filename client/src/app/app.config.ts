import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  ErrorHandler,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import Aura from '@primeuix/themes/aura';
import { configureBreeze } from 'breeze-client';
import { httpClientFetch } from 'breeze-client/adapter-angular-httpclient';
import { ConfirmationService, MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';
import { DialogService } from 'primeng/dynamicdialog';
import { HttpClient } from '@angular/common/http';

import { routes } from './app.routes';
import { authInterceptor } from './core/services/auth.interceptor';
import { AppErrorHandler } from './core/services/error-handler.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor])),

    // PrimeNG replaces the WPF resource dictionary in `TempHire/Styles/Styles.xaml`.
    providePrimeNG({ theme: { preset: Aura, options: { darkModeSelector: '.app-dark' } } }),
    MessageService,
    ConfirmationService,
    DialogService,

    // Port of `Common/Errors/ErrorHandler.cs`, which Cocktail installed as the global handler.
    { provide: ErrorHandler, useClass: AppErrorHandler },

    /**
     * Breeze configuration.
     *
     * This is the counterpart of `TempHire/AppBootstrapper.cs`, which configured Cocktail and
     * DevForce before the shell was shown.  Breeze 3's defaults already match this server:
     *
     *  - the backing-store model library, so plain property access works in Angular templates;
     *  - the JSON URI builder, which is what `[BreezeQueryFilter]` on the server expects;
     *  - the Web API data service adapter, which materialises server responses into entities;
     *  - `NamingConvention.camelCase` - the server sends PascalCase (see `Program.cs`, where the
     *    Json.NET naming strategy is cleared), so `FirstName` on the wire is `firstName` here.
     *
     * The one thing left to configure is transport.  Breeze 3 makes its requests with `fetch`,
     * which Angular's interceptors never see; `httpClientFetch` routes them through `HttpClient`
     * instead, so they pick up `authInterceptor` and the bearer token.
     */
    provideAppInitializer(() => {
      configureBreeze({ fetch: httpClientFetch(inject(HttpClient)) });
    }),
  ],
};
