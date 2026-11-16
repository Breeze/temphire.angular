import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { MessageService } from '@openng/optimus-ui/api';

import { AuthService } from './auth.service';

/**
 * Keeps unauthenticated users out of the workspaces.
 *
 * The WPF shell did this by popping a modal login dialog from `ShellViewModel.OnViewLoaded` and
 * disabling the toolbar until `IsLoggedIn` was true; a router guard is the web equivalent.  A user
 * who isn't signed in is sent to the server's sign-in page, and comes back to the page they asked
 * for.  It also covers the browser-refresh case, where the tokens survive in session storage but
 * the Breeze caches do not - `restoreSession()` rebuilds them before the route activates.
 */
export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);

  if (await auth.restoreSession()) {
    return true;
  }

  await auth.signIn(state.url);
  return false;
};

/**
 * Keeps a workspace to users with one of `roles`, for example Resource Management to editors and
 * readers.  Signs the user in first, as `authGuard` does; a signed-in user without the role is sent
 * to the home page with a short message.
 *
 * This only decides what the client shows.  The server enforces the same roles on the data
 * itself, so a user who reaches the page some other way still gets nothing they may not see.
 */
export function roleGuard(...roles: string[]): CanActivateFn {
  return async (_route, state) => {
    const auth = inject(AuthService);
    const router = inject(Router);
    const messages = inject(MessageService);

    if (!(await auth.restoreSession())) {
      await auth.signIn(state.url);
      return false;
    }

    if (auth.hasAnyRole(roles)) {
      return true;
    }

    messages.add({
      severity: 'warn',
      summary: 'No access',
      detail: "Your account doesn't have access to that page.",
      life: 6000,
    });
    return router.createUrlTree(['/home']);
  };
}
