import { ApplicationRef, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { ButtonDirective } from '@openng/optimus-ui/button';
import { MenuItem } from '@openng/optimus-ui/api';
import { DynamicDialogModule } from '@openng/optimus-ui/dynamicdialog';
import { MenuModule } from '@openng/optimus-ui/menu';
import { ToastModule } from '@openng/optimus-ui/toast';

import { WORKSPACES } from './app.routes';
import { AuthService } from './core/services/auth.service';
import { ToolbarAction, ToolbarGroup, ToolbarService, executeAction, toolbarActions } from './core/services/toolbar.service';
import { FrameworkMarkComponent } from './core/framework-mark.component';
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
  imports: [
    RouterOutlet,
    ButtonDirective,
    MenuModule,
    ToastModule,
    DynamicDialogModule,
    QuinnComponent,
    FrameworkMarkComponent,
  ],
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
   * Port of `ShellViewModel.StartAsync`: the toolbar group for the workspaces.  Only the workspaces
   * the user's roles allow are listed; the routes' guards enforce the same rule.  (The original's
   * Logout group is in the user menu now.)
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

  /**
   * The user menu, opened from the signed-in user in the top right corner: things about the user
   * rather than the workspace they are in.
   */
  protected readonly userMenuItems: MenuItem[] = [
    {
      label: 'Usage',
      icon: 'pi pi-chart-bar',
      command: () => void this.router.navigate(['/usage']),
    },
    { separator: true },
    { label: 'Logout', icon: 'pi pi-sign-out', command: () => void this.logout() },
  ];

  /** Whether the user menu is open, for the button's `aria-expanded`. */
  protected readonly userMenuOpen = signal(false);

  /**
   * The toolbar: the shell's own groups plus whatever the active screen contributed, and nothing
   * while logged out.  `ShellViewModel` added and removed its groups in response to
   * `LoggedInMessage` / `LoggedOutMessage`; here the toolbar is simply *derived* from the session,
   * so there is nothing to keep in step.
   */
  readonly actions = computed(() =>
    this.isLoggedIn() ? toolbarActions([this.workspaceGroup(), ...this.toolbar.groups()]) : [],
  );

  private readonly appRef = inject(ApplicationRef);

  /** Runs a toolbar action with the screen up to date first: see `executeAction`. */
  execute(action: ToolbarAction): void {
    executeAction(action, this.appRef);
  }

  /**
   * Port of `ShellViewModel.Logout`, which returned to the default workspace before logging out.
   * Doing the same here gives the active screen its say first: Resource Management asks what to do
   * with unsaved edits, and the user can stay.  Signing out then leaves the app for the server's
   * end-session endpoint, which comes back to the sign-in page.
   */
  async logout(): Promise<void> {
    // On Home there is nothing to leave.  Navigating there would be skipped, as it is already the
    // current URL, and resolve `false` - just as when a page keeps the user for unsaved edits - so
    // Logout would do nothing.
    const onHome = this.router.url.split(/[?#]/)[0] === '/home';
    if (onHome || (await this.router.navigate(['/home']))) {
      this.auth.logout();
    }
  }
}
