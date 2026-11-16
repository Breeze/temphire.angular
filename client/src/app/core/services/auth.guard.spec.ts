import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  provideRouter,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { MessageService } from '@openng/optimus-ui/api';
import { vi } from 'vitest';

import { roleGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { Roles } from './roles';

describe('roleGuard', () => {
  const signedIn = { value: true };
  const roles = { value: [] as string[] };
  const auth = {
    restoreSession: async () => signedIn.value,
    hasAnyRole: (wanted: readonly string[]) => wanted.some((role) => roles.value.includes(role)),
    signIn: vi.fn(async (_returnUrl?: string) => undefined),
  };
  const messages = { add: vi.fn() };

  beforeEach(() => {
    signedIn.value = true;
    roles.value = [];
    auth.signIn.mockClear();
    messages.add.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: MessageService, useValue: messages },
      ],
    });
  });

  const run = (...allowed: string[]) =>
    TestBed.runInInjectionContext(() =>
      roleGuard(...allowed)(
        {} as ActivatedRouteSnapshot,
        {
          url: '/resourcemgt',
        } as RouterStateSnapshot,
      ),
    ) as Promise<boolean | UrlTree>;

  const url = (result: boolean | UrlTree) =>
    result instanceof UrlTree ? TestBed.inject(Router).serializeUrl(result) : result;

  it('lets a user with one of the roles in', async () => {
    roles.value = [Roles.Reader];

    expect(await run(Roles.Editor, Roles.Reader)).toBe(true);
  });

  it('sends a signed-in user without the role to the home page, with a message', async () => {
    roles.value = [];

    expect(url(await run(Roles.Editor, Roles.Reader))).toBe('/home');
    expect(messages.add).toHaveBeenCalledWith(expect.objectContaining({ severity: 'warn' }));
  });

  it('sends a user who is not signed in to sign in, coming back to where they were going', async () => {
    signedIn.value = false;

    expect(await run(Roles.Editor)).toBe(false);
    expect(auth.signIn).toHaveBeenCalledWith('/resourcemgt');
  });
});
