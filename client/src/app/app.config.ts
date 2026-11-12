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
import { NamingConvention } from 'breeze-client';
import { AjaxHttpClientAdapter } from 'breeze-client/adapter-ajax-httpclient';
import { DataServiceWebApiAdapter } from 'breeze-client/adapter-data-service-webapi';
import { ModelLibraryBackingStoreAdapter } from 'breeze-client/adapter-model-library-backing-store';
import { UriBuilderJsonAdapter } from 'breeze-client/adapter-uri-builder-json';
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
     * Breeze adapter registration.
     *
     * This is the counterpart of `TempHire/AppBootstrapper.cs`, which configured Cocktail and
     * DevForce before the shell was shown.  Order matters: `AjaxHttpClientAdapter` must be
     * registered before `DataServiceWebApiAdapter`, because the data service adapter resolves the
     * ajax adapter when it initialises.
     *
     *  - `ModelLibraryBackingStoreAdapter` - stores entity property values in a backing store so
     *    that plain property access works in Angular templates.
     *  - `UriBuilderJsonAdapter`           - encodes Breeze queries as JSON in the query string,
     *    which is what `[BreezeQueryFilter]` on the server expects.
     *  - `AjaxHttpClientAdapter`           - routes Breeze traffic through Angular's HttpClient, so
     *    it picks up `authInterceptor` and the bearer token.
     *  - `DataServiceWebApiAdapter`        - materialises server responses into entities.
     *  - `NamingConvention.camelCase`      - the server sends PascalCase (see `Program.cs`, where
     *    the Json.NET naming strategy is cleared); this converts to idiomatic camelCase on the
     *    client, so `FirstName` on the wire is `firstName` in TypeScript.
     */
    provideAppInitializer(() => {
      const http = inject(HttpClient);

      ModelLibraryBackingStoreAdapter.register();
      UriBuilderJsonAdapter.register();
      AjaxHttpClientAdapter.register(http);
      DataServiceWebApiAdapter.register();
      NamingConvention.camelCase.setAsDefault();
    }),
  ],
};
