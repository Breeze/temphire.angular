import { Component, computed, effect, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DynamicDialogModule } from 'primeng/dynamicdialog';
import { ToastModule } from 'primeng/toast';

import { WORKSPACES } from './app.routes';
import { AuthService } from './core/services/auth.service';
import { ToolbarGroup, ToolbarService } from './core/services/toolbar.service';

/**
 * Port of `TempHire/Views/ShellView.Wpf.xaml` + `ViewModels/ShellViewModel.cs`.
 *
 * The WPF shell was a `Conductor<object>` holding an `ItemsControl` of toolbar actions over a
 * `ContentControl` bound to `ActiveItem`.  Here the router owns the active screen and the toolbar is
 * driven by `ToolbarService`, so the structure survives the port almost literally: a strip of
 * buttons across the top, the active workspace underneath.
 *
 * The original disabled the whole toolbar until `IsLoggedIn` was true and popped a modal login
 * dialog on load.  A route guard plus a dedicated `/login` route is the web idiom, so the toolbar is
 * simply hidden when logged out.
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ButtonModule, ToastModule, DynamicDialogModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toolbar = inject(ToolbarService);

  readonly isLoggedIn = this.auth.isLoggedIn;
  readonly username = this.auth.username;
  readonly actions = this.toolbar.actions;

  /** Port of `ShellViewModel.StartAsync`: one toolbar group for the workspaces, one for Logout. */
  private readonly workspaceGroup: ToolbarGroup = {
    level: 0,
    actions: [...WORKSPACES]
      .sort((a, b) => a.sequence - b.sequence)
      .map((workspace) => ({
        label: workspace.displayName,
        execute: () => void this.router.navigate([workspace.route]),
      })),
  };

  private readonly logoutGroup: ToolbarGroup = {
    level: 100,
    actions: [{ label: 'Logout', icon: 'pi pi-sign-out', execute: () => void this.logout() }],
  };

  constructor() {
    // Register and unregister the shell's own toolbar groups as the session comes and goes, the
    // way `ShellViewModel` handled `LoggedInMessage` / `LoggedOutMessage`.
    effect(() => {
      if (this.isLoggedIn()) {
        this.toolbar.addGroup(this.workspaceGroup);
        this.toolbar.addGroup(this.logoutGroup);
      } else {
        this.toolbar.clear();
      }
    });
  }

  /** Port of `ShellViewModel.Logout`, which returned to the default workspace before logging out. */
  async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigate(['/login']);
  }

  readonly isEnabled = computed(() => this.isLoggedIn());
}
