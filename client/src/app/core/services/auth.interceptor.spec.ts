import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { authInterceptor } from './auth.interceptor';

/**
 * A 401 logs the user out only when it rejects a token the app sent.  Before this rule, a failed
 * login (a 401 with no token) called logout, whose own 401 called logout again, without end.
 */
describe('authInterceptor', () => {
  const unauthorized = { status: 401, statusText: 'Unauthorized' };
  const logoutUrl = `${environment.accountApiRoot}/logout`;

  function setUp(token: string | null) {
    sessionStorage.clear();
    if (token) {
      sessionStorage.setItem('temphire.token', token);
    }

    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'login', children: [] }]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });

    return { http: TestBed.inject(HttpClient), httpTesting: TestBed.inject(HttpTestingController) };
  }

  afterEach(() => sessionStorage.clear());

  it('does not log out when a login is rejected', async () => {
    const { http, httpTesting } = setUp(null);

    const login = firstValueFrom(http.post(`${environment.accountApiRoot}/login`, {}));
    httpTesting.expectOne(`${environment.accountApiRoot}/login`).flush(null, unauthorized);
    await expect(login).rejects.toMatchObject({ status: 401 });

    httpTesting.expectNone(logoutUrl);
    httpTesting.verify();
  });

  it('logs out once when the token is rejected', async () => {
    const { http, httpTesting } = setUp('expired-token');

    const query = firstValueFrom(http.get(`${environment.breezeApiRoot}/StaffingResources`));
    httpTesting
      .expectOne(`${environment.breezeApiRoot}/StaffingResources`)
      .flush(null, unauthorized);
    await expect(query).rejects.toMatchObject({ status: 401 });

    // The logout call is rejected too, because the token is no good; that must not start another.
    const logout = httpTesting.expectOne(logoutUrl);
    expect(logout.request.headers.get('Authorization')).toBe('Bearer expired-token');
    logout.flush(null, unauthorized);
    await new Promise((resolve) => setTimeout(resolve));

    httpTesting.expectNone(logoutUrl);
    httpTesting.verify();
  });
});
