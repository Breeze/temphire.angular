import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { EntityManagerProvider } from './entity-manager-provider';
import { UnitOfWorkManager } from './unit-of-work-manager';

interface LoginResponse {
  username: string;
  /** The company the user works for: their tenant, from the email domain. */
  tenantName: string;
  token: string;
  expiresUtc: string;
}

const TOKEN_STORAGE_KEY = 'temphire.token';

/**
 * Port of `TempHire/Authentication/TempHireAuthenticationService.cs` (Punch's
 * `IAuthenticationService`) plus the `LoggedInMessage` / `LoggedOutMessage` events.
 *
 * DevForce logged in by handing credentials to the EntityServer, which then kept a session and
 * attached an `IPrincipal` to every subsequent query.  Here the server returns a JWT and
 * `authInterceptor` puts it on every request.  The two `Logged*Message` events that the WPF shell
 * subscribed to become a signal that templates can read directly.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly emProvider = inject(EntityManagerProvider);
  private readonly unitOfWorkManager = inject(UnitOfWorkManager);

  private readonly _token = signal<string | null>(sessionStorage.getItem(TOKEN_STORAGE_KEY));
  private readonly _username = signal<string | null>(null);
  private readonly _tenantName = signal<string | null>(null);

  /** Where to go once login succeeds - port of the shell's post-login navigation. */
  redirectUrl: string | null = null;

  readonly isLoggedIn = computed(() => !!this._token());
  readonly username = computed(() => this._username());

  /** The signed-in user's company (tenant), e.g. "Harbor Staffing". */
  readonly tenantName = this._tenantName.asReadonly();

  get token(): string | null {
    return this._token();
  }

  /**
   * Authenticates, then prepares the Breeze metadata and lookup cache.
   *
   * The order matters and mirrors `LoginViewModel.LoginAsync`, which called
   * `IAuthenticationService.LoginAsync` and only then `IGlobalCache.LoadAsync()`.  Both server
   * endpoints require a bearer token, so neither can run before login completes.
   */
  async login(username: string, password: string): Promise<void> {
    const response = await firstValueFrom(
      this.http.post<LoginResponse>(`${environment.accountApiRoot}/login`, { username, password }),
    );

    sessionStorage.setItem(TOKEN_STORAGE_KEY, response.token);
    this._token.set(response.token);
    this._username.set(response.username);
    this._tenantName.set(response.tenantName);

    try {
      await this.emProvider.prepare();
    } catch (error) {
      // Leave no half-logged-in state behind.
      this.clearSession();
      throw new Error('Failed to load the entity metadata and lookup cache. Please try again.');
    }
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.http.post(`${environment.accountApiRoot}/logout`, {}));
    } catch {
      // A stateless token cannot really be revoked, so a failure here is not interesting.
    } finally {
      this.clearSession();
    }
  }

  /**
   * Re-establishes the Breeze caches after a browser refresh, when the token is still in session
   * storage but the in-memory EntityManagers are gone.
   */
  async restoreSession(): Promise<boolean> {
    if (!this._token()) {
      return false;
    }

    if (this.emProvider.isPrepared) {
      return true;
    }

    try {
      const me = await firstValueFrom(
        this.http.get<{ username: string; tenantName: string }>(`${environment.accountApiRoot}/me`),
      );
      this._username.set(me.username);
      this._tenantName.set(me.tenantName);
      await this.emProvider.prepare();
      return true;
    } catch {
      this.clearSession();
      return false;
    }
  }

  private clearSession(): void {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    this._token.set(null);
    this._username.set(null);
    this._tenantName.set(null);
    this.unitOfWorkManager.clear();
    this.emProvider.reset();
  }
}
