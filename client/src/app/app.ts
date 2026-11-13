import { Component, computed, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { ButtonDirective } from '@openng/optimus-ui/button';
import { DynamicDialogModule } from '@openng/optimus-ui/dynamicdialog';
import { ToastModule } from '@openng/optimus-ui/toast';

import { WORKSPACES } from './app.routes';
import { AuthService } from './core/services/auth.service';
import { ToolbarGroup, ToolbarService, toolbarActions } from './core/services/toolbar.service';
import { QuinnComponent } from './quinn/quinn.component';

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
  imports: [RouterOutlet, ButtonDirective, ToastModule, DynamicDialogModule, QuinnComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toolbar = inject(ToolbarService);

  readonly isLoggedIn = this.auth.isLoggedIn;
  readonly username = this.auth.username;
  readonly tenantName = this.auth.tenantName;

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

  /**
   * The toolbar: the shell's own groups plus whatever the active screen contributed, and nothing
   * while logged out.  `ShellViewModel` added and removed its groups in response to
   * `LoggedInMessage` / `LoggedOutMessage`; here the toolbar is simply *derived* from the session,
   * so there is nothing to keep in step.
   */
  readonly actions = computed(() =>
    this.isLoggedIn()
      ? toolbarActions([this.workspaceGroup, this.logoutGroup, ...this.toolbar.groups()])
      : [],
  );

  /** Port of `ShellViewModel.Logout`, which returned to the default workspace before logging out. */
  async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigate(['/login']);
  }
}
