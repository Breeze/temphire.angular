import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from './auth.service';

/**
 * Keeps unauthenticated users out of the workspaces.
 *
 * The WPF shell did this by popping a modal login dialog from `ShellViewModel.OnViewLoaded` and
 * disabling the toolbar until `IsLoggedIn` was true; a router guard is the web equivalent.  It also
 * covers the browser-refresh case, where a token survives in session storage but the Breeze caches
 * do not - `restoreSession()` rebuilds them before the route activates.
 */
export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (await auth.restoreSession()) {
    return true;
  }

  auth.redirectUrl = state.url;

  return router.createUrlTree(['/login']);
};
