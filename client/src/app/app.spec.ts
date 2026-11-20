import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { MessageService } from '@openng/optimus-ui/api';
import { vi } from 'vitest';

import { App } from './app';
import { routes } from './app.routes';
import { AuthService } from './core/services/auth.service';

/**
 * Smoke test for the shell.  There is no session, so the toolbar should stay hidden - the web
 * equivalent of the WPF shell disabling its toolbar until `IsLoggedIn` became true.
 */
describe('App', () => {
  beforeEach(async () => {
    sessionStorage.clear();

    await TestBed.configureTestingModule({
      imports: [App],
      // MessageService is needed by the shell's <p-toast>.
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
        MessageService,
      ],
    }).compileComponents();
  });

  it('creates the shell', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('hides the toolbar while logged out', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.app-toolbar')).toBeNull();
  });
});

/**
 * Logout goes to Home first, so the active screen can ask about unsaved edits, and signs out unless
 * the user stays.  Regression: on Home itself, the navigation to Home is skipped (it is already the
 * current URL) and resolves `null` rather than `true`, so Logout did nothing there.
 */
describe('App.logout', () => {
  const leave = { allowed: true };

  beforeEach(async () => {
    sessionStorage.clear();
    leave.allowed = true;

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        // Stand-ins for the workspaces, without their guards; "edits" can refuse to be left.
        provideRouter([
          { path: 'home', children: [] },
          { path: 'edits', children: [], canDeactivate: [() => leave.allowed] },
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
        MessageService,
      ],
    }).compileComponents();
  });

  async function onPage(url: string) {
    const fixture = TestBed.createComponent(App);
    await TestBed.inject(Router).navigateByUrl(url);
    // Signing out leaves the app for the server; here it is only recorded.
    const signOut = vi.spyOn(TestBed.inject(AuthService), 'logout').mockImplementation(() => {});
    return { app: fixture.componentInstance, signOut, router: TestBed.inject(Router) };
  }

  it('signs out from Home', async () => {
    const { app, signOut } = await onPage('/home');

    await app.logout();

    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('goes to Home, then signs out, from another page', async () => {
    const { app, signOut, router } = await onPage('/edits');

    await app.logout();

    expect(router.url).toBe('/home');
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('stays signed in when the page keeps the user, for unsaved edits', async () => {
    const { app, signOut, router } = await onPage('/edits');
    leave.allowed = false;

    await app.logout();

    expect(router.url).toBe('/edits');
    expect(signOut).not.toHaveBeenCalled();
  });
});
