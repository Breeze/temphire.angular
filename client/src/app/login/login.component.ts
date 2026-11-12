import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

import { AuthService } from '../core/services/auth.service';
import { AppErrorHandler } from '../core/services/error-handler.service';

/**
 * Port of `ViewModels/Login/LoginViewModel.cs` + `Views/Login/LoginView.Wpf.xaml`.
 *
 * The WPF version was a modal dialog that the shell popped on load and again after logout, with a
 * `FailureMessage` shown inline and the OK button disabled until both fields had content.  All of
 * that is preserved; only the presentation changed from a Cocktail dialog to a route.
 *
 * The original pre-filled Admin/password under `#if DEBUG`, and the credentials are unchanged in the
 * seeded database, so they are shown as a hint rather than typed in for you.
 */
@Component({
  selector: 'app-login',
  imports: [
    FormsModule,
    ButtonModule,
    CardModule,
    InputTextModule,
    MessageModule,
    ProgressSpinnerModule,
  ],
  template: `
    <div class="login">
      <p-card header="Sign in to TempHire" styleClass="login__card">
        <form class="login__form" (ngSubmit)="submit()">
          <div class="login__field">
            <label for="login-username">Username</label>
            <input
              pInputText
              id="login-username"
              name="username"
              autocomplete="username"
              [(ngModel)]="username"
              [disabled]="busy()"
            />
          </div>

          <div class="login__field">
            <label for="login-password">Password</label>
            <input
              pInputText
              type="password"
              id="login-password"
              name="password"
              autocomplete="current-password"
              [(ngModel)]="password"
              [disabled]="busy()"
            />
          </div>

          @if (failureMessage()) {
            <p-message severity="error">{{ failureMessage() }}</p-message>
          }

          <div class="login__actions">
            <p-button
              type="submit"
              label="Login"
              [disabled]="!canLogin() || busy()"
              [loading]="busy()"
            />
          </div>

          <p class="login__hint">Sample credentials: <code>Admin</code> / <code>password</code></p>
        </form>
      </p-card>
    </div>
  `,
  styles: [
    `
      .login {
        display: flex;
        justify-content: center;
        padding: 4rem 1rem;
      }

      :host ::ng-deep .login__card {
        width: 24rem;
        max-width: 100%;
      }

      .login__form {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .login__field {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }

      .login__field input {
        width: 100%;
      }

      .login__actions {
        display: flex;
        justify-content: flex-end;
      }

      .login__hint {
        margin: 0;
        font-size: 0.8rem;
        color: #6b7280;
      }
    `,
  ],
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  username = '';
  password = '';

  readonly busy = signal(false);
  readonly failureMessage = signal<string | null>(null);

  /** Port of `LoginViewModel.CanLogin`. */
  canLogin(): boolean {
    return !!this.username.trim() && !!this.password.trim();
  }

  async submit(): Promise<void> {
    if (!this.canLogin() || this.busy()) {
      return;
    }

    this.busy.set(true);
    this.failureMessage.set(null);

    try {
      await this.auth.login(this.username.trim(), this.password);

      const target = this.auth.redirectUrl ?? '/home';
      this.auth.redirectUrl = null;
      await this.router.navigateByUrl(target);
    } catch (error) {
      // Same as the original: clear the password, keep the user on the form, show why it failed.
      this.password = '';
      this.failureMessage.set(AppErrorHandler.describe(error).detail);
    } finally {
      this.busy.set(false);
    }
  }
}
