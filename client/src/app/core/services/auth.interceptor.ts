import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { AuthService } from './auth.service';

/**
 * Attaches the bearer token to every request and bounces the user back to the login screen when the
 * server rejects it.
 *
 * DevForce needed nothing like this: the login token rode along inside the EntityManager's own
 * connection.  With Breeze, the transport is ordinary `HttpClient`, so the token is attached here -
 * which also means it covers the plain REST calls (`/api/account/me`) as well as Breeze traffic.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const token = auth.token;
  const request = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(request).pipe(
    catchError((error: unknown) => {
      // Only 401 means "your token is no good". 403 must NOT be treated as an auth failure:
      // Breeze's `EntityErrorsException` defaults to 403, so every save that fails server-side
      // validation arrives here as a 403 with an `EntityErrors` payload.  Logging out on that
      // would throw away the user's pending edits instead of showing them what to fix.
      //
      // Sniffing the body to tell the two apart is not an option either - Breeze's
      // `httpClientFetch` issues its requests with `responseType: 'text'`, so
      // `HttpErrorResponse.error` is an unparsed string rather than the object it looks like.
      if (error instanceof HttpErrorResponse && error.status === 401) {
        auth.logout().finally(() => router.navigate(['/login']));
      }

      return throwError(() => error);
    }),
  );
};
