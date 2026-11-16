import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { EntityManagerProvider } from './entity-manager-provider';
import { challengeFor, randomString } from './pkce';
import { Roles } from './roles';
import { UnitOfWorkManager } from './unit-of-work-manager';

/** `GET api/account/me`: who the access token belongs to. */
interface UserInfo {
  username: string;
  /** The company the user works for: their tenant, from the email domain. */
  tenantName: string;
  /** The user's roles: `Editor`, `Reader`, or none. */
  roles: string[];
}

/** The token endpoint's answer (RFC 6749, section 5.1). */
interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  /** Seconds. */
  expires_in: number;
}

/** The tokens, kept in session storage: per tab, and gone when the tab closes. */
interface StoredTokens {
  accessToken: string;
  refreshToken: string | null;
  /** Epoch milliseconds. */
  expiresAt: number;
}

/** What a sign-in started, kept until the browser comes back with the code. */
interface PendingSignIn {
  state: string;
  verifier: string;
  returnUrl: string;
}

const TOKENS_KEY = 'temphire.tokens';
const PENDING_SIGN_IN_KEY = 'temphire.signIn';

/** Renew the access token when it has less than this left, rather than send one about to expire. */
const RENEW_BEFORE_MS = 60_000;

/** The client id the server registers for this app - see `OAuthSettings.SpaClientId`. */
const CLIENT_ID = 'temphire-spa';

/** The scopes the app asks for: the staffing data, and a refresh token to stay signed in. */
const SCOPES = 'staffing offline_access';

/** The authorization server: TempHire's own server (`environment.authority`, or this origin). */
const authority = (): string => environment.authority || window.location.origin;

/**
 * Port of `TempHire/Authentication/TempHireAuthenticationService.cs` (Punch's
 * `IAuthenticationService`), now an OAuth 2.1 client.
 *
 * DevForce logged in by handing credentials to the EntityServer, which then kept a session.  This
 * app never sees the password: it sends the browser to the server's sign-in page with the
 * Authorization Code flow and PKCE (`signIn`), gets a code back at `/auth/callback`, and redeems it
 * for an access token and a refresh token (`completeSignIn`).  `authInterceptor` puts the access
 * token on every request, and `accessToken()` renews it with the refresh token shortly before it
 * expires.
 *
 * The `Logged*Message` events the WPF shell subscribed to became signals that templates read
 * directly.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly emProvider = inject(EntityManagerProvider);
  private readonly unitOfWorkManager = inject(UnitOfWorkManager);

  private readonly _tokens = signal<StoredTokens | null>(readJson<StoredTokens>(TOKENS_KEY));
  private readonly _username = signal<string | null>(null);
  private readonly _tenantName = signal<string | null>(null);
  private readonly _roles = signal<readonly string[]>([]);

  /** A refresh in progress, shared by every request that needs a token meanwhile. */
  private renewing: Promise<string | null> | null = null;

  readonly isLoggedIn = computed(() => !!this._tokens());
  readonly username = computed(() => this._username());

  /** The signed-in user's company (tenant), e.g. "Harbor Staffing". */
  readonly tenantName = this._tenantName.asReadonly();

  /**
   * The signed-in user's roles, from the server.  They decide what the client shows; the server
   * enforces them on every request, from the roles signed into the token.
   */
  readonly roles = this._roles.asReadonly();

  /** May see the company's staffing resources: an editor or a reader. */
  readonly canReadStaffing = computed(() => this.hasAnyRole([Roles.Editor, Roles.Reader]));

  /** May add, change and delete staffing resources: an editor. */
  readonly canEditStaffing = computed(() => this.hasAnyRole([Roles.Editor]));

  hasAnyRole(roles: readonly string[]): boolean {
    return roles.some((role) => this._roles().includes(role));
  }

  /** True for requests to the authorization server itself, which carry no access token. */
  isAuthorizationServerRequest(url: string): boolean {
    return url.startsWith(`${authority()}/connect/`);
  }

  /**
   * Sends the browser to the server's sign-in page.  Comes back to `/auth/callback`, and from there
   * to `returnUrl`.  If the user is still signed in on the server (its own cookie), the server sends
   * the browser straight back without showing the page.
   */
  async signIn(returnUrl = '/home'): Promise<void> {
    const pending: PendingSignIn = { state: randomString(), verifier: randomString(), returnUrl };
    sessionStorage.setItem(PENDING_SIGN_IN_KEY, JSON.stringify(pending));

    const params = new HttpParams({
      fromObject: {
        response_type: 'code',
        client_id: CLIENT_ID,
        redirect_uri: redirectUri(),
        scope: SCOPES,
        state: pending.state,
        code_challenge: await challengeFor(pending.verifier),
        code_challenge_method: 'S256',
      },
    });

    window.location.assign(`${authority()}/connect/authorize?${params.toString()}`);
  }

  /**
   * The second half of `signIn`: checks the answer from the authorization server, redeems the code
   * for tokens, then prepares the Breeze metadata and lookup cache.  Returns where to go next.
   *
   * The order mirrors `LoginViewModel.LoginAsync`, which called `IAuthenticationService.LoginAsync`
   * and only then `IGlobalCache.LoadAsync()`: the Breeze endpoints need the token.
   */
  async completeSignIn(query: URLSearchParams): Promise<string> {
    const pending = readJson<PendingSignIn>(PENDING_SIGN_IN_KEY);
    sessionStorage.removeItem(PENDING_SIGN_IN_KEY);

    const error = query.get('error');
    if (error) {
      throw new Error(query.get('error_description') ?? `Sign-in failed (${error}).`);
    }

    // The state must be the one this tab sent: otherwise the code is someone else's, slipped in.
    const code = query.get('code');
    if (!pending || !code || query.get('state') !== pending.state) {
      throw new Error('The sign-in could not be completed. Please sign in again.');
    }

    await this.requestTokens({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri(),
      client_id: CLIENT_ID,
      code_verifier: pending.verifier,
    });

    if (!(await this.restoreSession())) {
      throw new Error('Failed to load the entity metadata and lookup cache. Please try again.');
    }

    return pending.returnUrl;
  }

  /**
   * The access token for a request, renewed first if it is about to expire.  Null when signed out,
   * or when the refresh token is no longer accepted (the user then has to sign in again).
   */
  accessToken(): Promise<string | null> {
    const tokens = this._tokens();
    if (!tokens) {
      return Promise.resolve(null);
    }

    if (tokens.expiresAt - Date.now() > RENEW_BEFORE_MS || !tokens.refreshToken) {
      return Promise.resolve(tokens.accessToken);
    }

    this.renewing ??= this.requestTokens({
      grant_type: 'refresh_token',
      refresh_token: tokens.refreshToken,
      client_id: CLIENT_ID,
    })
      .then((renewed) => renewed.accessToken)
      .catch(() => {
        this.clearSession();
        return null;
      })
      .finally(() => (this.renewing = null));

    return this.renewing;
  }

  /**
   * Signs out of the app and of the server: forgets the tokens, then sends the browser to the
   * server's end-session endpoint, which ends its sign-in cookie and sends the browser back here.
   */
  logout(): void {
    this.clearSession();

    const params = new HttpParams({
      fromObject: { client_id: CLIENT_ID, post_logout_redirect_uri: `${window.location.origin}/` },
    });
    window.location.assign(`${authority()}/connect/logout?${params.toString()}`);
  }

  /**
   * Makes sure the app is ready for a signed-in user: after `completeSignIn`, and after a browser
   * refresh, when the tokens are still in session storage but the in-memory EntityManagers are gone.
   */
  async restoreSession(): Promise<boolean> {
    if (!this._tokens()) {
      return false;
    }

    if (this.emProvider.isPrepared) {
      return true;
    }

    try {
      const me = await firstValueFrom(this.http.get<UserInfo>(`${environment.accountApiRoot}/me`));
      this._username.set(me.username);
      this._tenantName.set(me.tenantName);
      this._roles.set(me.roles ?? []);
      await this.emProvider.prepare();
      return true;
    } catch {
      this.clearSession();
      return false;
    }
  }

  /** Forgets the tokens and everything loaded with them, without leaving the page. */
  clearSession(): void {
    sessionStorage.removeItem(TOKENS_KEY);
    this._tokens.set(null);
    this._username.set(null);
    this._tenantName.set(null);
    this._roles.set([]);
    this.unitOfWorkManager.clear();
    this.emProvider.reset();
  }

  /** Calls the token endpoint and keeps the tokens it returns. */
  private async requestTokens(grant: Record<string, string>): Promise<StoredTokens> {
    const response = await firstValueFrom(
      this.http.post<TokenResponse>(`${authority()}/connect/token`, new HttpParams({ fromObject: grant }), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }),
    );

    const tokens: StoredTokens = {
      accessToken: response.access_token,
      // The server rotates the refresh token at each use: always keep the newest.
      refreshToken: response.refresh_token ?? this._tokens()?.refreshToken ?? null,
      expiresAt: Date.now() + response.expires_in * 1000,
    };

    sessionStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
    this._tokens.set(tokens);
    return tokens;
  }
}

/** Where the authorization server sends the browser back to; registered for this client. */
function redirectUri(): string {
  return `${window.location.origin}/auth/callback`;
}

function readJson<T>(key: string): T | null {
  try {
    const value = sessionStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : null;
  } catch {
    return null;
  }
}
