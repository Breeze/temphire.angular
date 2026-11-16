import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, from, switchMap, throwError } from 'rxjs';

import { AuthService } from './auth.service';

/**
 * Attaches the access token to every request, renewing it first when it is about to expire, and
 * sends the user to sign in again when the server rejects it.
 *
 * DevForce needed nothing like this: the login token rode along inside the EntityManager's own
 * connection.  With Breeze, the transport is ordinary `HttpClient`, so the token is attached here -
 * which also covers the plain REST calls (`/api/account/me`, Quinn) as well as Breeze traffic.
 *
 * Requests to the authorization server itself (`/connect/token`) go out without a token: they are
 * how the app gets one.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthorizationServerRequest(req.url)) {
    return next(req);
  }

  return from(auth.accessToken()).pipe(
    switchMap((token) => {
      const request = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

      return next(request).pipe(
        catchError((error: unknown) => {
          // Only 401 means "your token is no good".  403 must NOT be treated as an auth failure:
          // Breeze's `EntityErrorsException` defaults to 403, so every save that fails server-side
          // validation arrives here as a 403 with an `EntityErrors` payload.  Signing out on that
          // would throw away the user's pending edits instead of showing them what to fix.
          //
          // Sniffing the body to tell the two apart is not an option either - Breeze's
          // `httpClientFetch` issues its requests with `responseType: 'text'`, so
          // `HttpErrorResponse.error` is an unparsed string rather than the object it looks like.
          //
          // A 401 for a request that carried a token means the token was revoked or the server's
          // keys changed.  Sign in again; if the user is still signed in on the server, that is a
          // quick round trip that doesn't show the sign-in page.
          if (error instanceof HttpErrorResponse && error.status === 401 && token) {
            auth.clearSession();
            void auth.signIn(router.url);
          }

          return throwError(() => error);
        }),
      );
    }),
  );
};
