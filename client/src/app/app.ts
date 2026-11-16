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
 * dialog on load.  Here a route guard sends the user to the server's sign-in page (OAuth), so the
 * toolbar is simply hidden when logged out.
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

  /** The first letter of the user's name, for the avatar in the toolbar. */
  readonly initial = computed(() => (this.username() ?? '?').charAt(0).toUpperCase());

  /**
   * Port of `ShellViewModel.StartAsync`: one toolbar group for the workspaces, one for Logout.  Only
   * the workspaces the user's roles allow are listed; the routes' guards enforce the same rule.
   */
  private readonly workspaceGroup = computed<ToolbarGroup>(() => ({
    level: 0,
    actions: [...WORKSPACES]
      .filter((workspace) => !workspace.roles || this.auth.hasAnyRole(workspace.roles))
      .sort((a, b) => a.sequence - b.sequence)
      .map((workspace) => ({
        label: workspace.displayName,
        icon: workspace.icon,
        execute: () => void this.router.navigate([workspace.route]),
      })),
  }));

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
      ? toolbarActions([this.workspaceGroup(), this.logoutGroup, ...this.toolbar.groups()])
      : [],
  );

  /**
   * Port of `ShellViewModel.Logout`, which returned to the default workspace before logging out.
   * Doing the same here gives the active screen its say first: Resource Management asks what to do
   * with unsaved edits, and the user can stay.  Signing out then leaves the app for the server's
   * end-session endpoint, which comes back to the sign-in page.
   */
  async logout(): Promise<void> {
    if (await this.router.navigate(['/home'])) {
      this.auth.logout();
    }
  }
}
