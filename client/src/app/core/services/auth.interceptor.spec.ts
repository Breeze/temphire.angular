import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { vi } from 'vitest';

import { environment } from '../../../environments/environment';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';

describe('authInterceptor', () => {
  const unauthorized = { status: 401, statusText: 'Unauthorized' };
  const resourcesUrl = `${environment.breezeApiRoot}/StaffingResources`;
  const tokenUrl = `${environment.authority || window.location.origin}/connect/token`;

  /** Signs in with stored tokens whose access token expires in `expiresInMs`. */
  function setUp(expiresInMs: number | null) {
    sessionStorage.clear();
    if (expiresInMs !== null) {
      sessionStorage.setItem(
        'temphire.tokens',
        JSON.stringify({ accessToken: 'access-1', refreshToken: 'refresh-1', expiresAt: Date.now() + expiresInMs }),
      );
    }

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });

    const auth = TestBed.inject(AuthService);
    const signIn = vi.spyOn(auth, 'signIn').mockResolvedValue();
    return { http: TestBed.inject(HttpClient), httpTesting: TestBed.inject(HttpTestingController), signIn };
  }

  /** Lets the interceptor's token lookup (a promise) run before the request goes out. */
  const settle = () => new Promise((resolve) => setTimeout(resolve));

  afterEach(() => sessionStorage.clear());

  it('attaches the access token', async () => {
    const { http, httpTesting } = setUp(30 * 60_000);

    const query = firstValueFrom(http.get(resourcesUrl));
    await settle();
    const request = httpTesting.expectOne(resourcesUrl);
    expect(request.request.headers.get('Authorization')).toBe('Bearer access-1');
    request.flush([]);
    await query;
    httpTesting.verify();
  });

  it('renews an access token about to expire, once for requests made together', async () => {
    const { http, httpTesting } = setUp(10_000);

    const first = firstValueFrom(http.get(resourcesUrl));
    const second = firstValueFrom(http.get(`${resourcesUrl}?second`));
    await settle();

    // One refresh, without a bearer token: it goes to the authorization server.
    const refresh = httpTesting.expectOne(tokenUrl);
    expect(refresh.request.headers.has('Authorization')).toBe(false);
    expect(refresh.request.body.toString()).toContain('grant_type=refresh_token');
    expect(refresh.request.body.toString()).toContain('refresh_token=refresh-1');
    refresh.flush({ access_token: 'access-2', refresh_token: 'refresh-2', expires_in: 1800 });
    await settle();

    for (const request of httpTesting.match((r) => r.url.startsWith(resourcesUrl))) {
      expect(request.request.headers.get('Authorization')).toBe('Bearer access-2');
      request.flush([]);
    }
    await Promise.all([first, second]);

    // The server rotated the refresh token; the next renewal must use the new one.
    expect(JSON.parse(sessionStorage.getItem('temphire.tokens')!).refreshToken).toBe('refresh-2');
    httpTesting.verify();
  });

  it('signs in again when the server rejects the token', async () => {
    const { http, httpTesting, signIn } = setUp(30 * 60_000);

    const query = firstValueFrom(http.get(resourcesUrl));
    await settle();
    httpTesting.expectOne(resourcesUrl).flush(null, unauthorized);
    await expect(query).rejects.toMatchObject({ status: 401 });

    expect(signIn).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem('temphire.tokens')).toBeNull();
    httpTesting.verify();
  });

  it('does not start a sign-in for a 401 to a request that carried no token', async () => {
    const { http, httpTesting, signIn } = setUp(null);

    const query = firstValueFrom(http.get(resourcesUrl));
    await settle();
    const request = httpTesting.expectOne(resourcesUrl);
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush(null, unauthorized);
    await expect(query).rejects.toMatchObject({ status: 401 });

    expect(signIn).not.toHaveBeenCalled();
    httpTesting.verify();
  });
});
