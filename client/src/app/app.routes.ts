import { CanDeactivateFn, Routes } from '@angular/router';

import { authGuard } from './core/services/auth.guard';

/**
 * Port of `IScreen.CanClose` / `INavigationTarget.OnNavigatingFrom`.
 *
 * Caliburn.Micro asked the active screen whether it could close before navigating away; the router
 * equivalent is a `canDeactivate` guard. `ResourceMgtComponent.canDeactivate` prompts to save,
 * discard, or stay put when there are unsaved edits.
 */
export interface CanComponentDeactivate {
  canDeactivate(): Promise<boolean> | boolean;
}

export const pendingChangesGuard: CanDeactivateFn<CanComponentDeactivate> = (component) =>
  component.canDeactivate();

/**
 * Port of Punch's workspace navigation.
 *
 * The WPF shell discovered `IWorkspace` exports through MEF and rendered one toolbar button per
 * workspace, then used Punch's `INavigator` to swap the active view model
 * (`ShellViewModel.NavigateToWorkspace`).  The router does both jobs here: the `WORKSPACES` list
 * below is the direct replacement for the MEF `[ImportMany] IEnumerable<IWorkspace>`.
 */
export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'home',
    canActivate: [authGuard],
    loadComponent: () => import('./home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'resourcemgt',
    canActivate: [authGuard],
    canDeactivate: [pendingChangesGuard],
    loadComponent: () =>
      import('./resource-mgt/resource-mgt.component').then((m) => m.ResourceMgtComponent),
  },
  { path: '', pathMatch: 'full', redirectTo: 'home' },
  { path: '**', redirectTo: 'home' },
];

/** Port of `Common/Workspace/IWorkspace.cs` - what the shell toolbar is built from. */
export interface Workspace {
  displayName: string;
  route: string;
  sequence: number;
  isDefault: boolean;
  /** A PrimeIcons-style class for the toolbar button. */
  icon?: string;
}

export const WORKSPACES: Workspace[] = [
  { displayName: 'Home', route: '/home', sequence: 10, isDefault: true, icon: 'pi pi-home' },
  {
    displayName: 'Resource Management',
    route: '/resourcemgt',
    sequence: 20,
    isDefault: false,
    icon: 'pi pi-users',
  },
];
