import { Component, inject, signal } from '@angular/core';
import {
  FieldTree,
  FormField,
  FormRoot,
  ValidationError,
  form,
  required,
} from '@angular/forms/signals';
import { Router } from '@angular/router';
import { ButtonDirective } from '@openng/optimus-ui/button';
import { CardModule } from '@openng/optimus-ui/card';
import { InputTextModule } from '@openng/optimus-ui/inputtext';
import { MessageModule } from '@openng/optimus-ui/message';
import { ProgressSpinnerModule } from '@openng/optimus-ui/progressspinner';

import { AuthService } from '../core/services/auth.service';
import { AppErrorHandler } from '../core/services/error-handler.service';

/**
 * Port of `ViewModels/Login/LoginViewModel.cs` + `Views/Login/LoginView.Wpf.xaml`.
 *
 * The WPF version was a modal dialog that the shell popped on load and again after logout, with a
 * `FailureMessage` shown inline and the OK button disabled until both fields had content.  All of
 * that is preserved; the presentation changed from a Punch dialog to a route, and the form is a
 * Signal Form.
 *
 * The original pre-filled Admin/password under `#if DEBUG`.  The seeded users are now one per
 * company and sign in with an email address, so they are listed as a hint rather than typed in.
 */
@Component({
  selector: 'app-login',
  imports: [
    FormField,
    FormRoot,
    ButtonDirective,
    CardModule,
    InputTextModule,
    MessageModule,
    ProgressSpinnerModule,
  ],
  template: `
    <div class="login">
      <p-card header="Sign in to TempHire" styleClass="login__card">
        <form class="login__form" [formRoot]="loginForm">
          <fieldset class="login__fields" [disabled]="loginForm().submitting()">
            <div class="login__field">
              <label for="login-username">Email</label>
              <input
                pInputText
                id="login-username"
                autocomplete="username"
                [formField]="loginForm.username"
              />
            </div>

            <div class="login__field">
              <label for="login-password">Password</label>
              <input
                pInputText
                type="password"
                id="login-password"
                autocomplete="current-password"
                [formField]="loginForm.password"
              />
            </div>
          </fieldset>

          @for (error of loginForm().errors(); track error.kind) {
            <p-message severity="error">{{ error.message }}</p-message>
          }

          <div class="login__actions">
            <button
              pButton
              type="submit"
              [disabled]="loginForm().invalid() || loginForm().submitting()"
            >
              @if (loginForm().submitting()) {
                <i class="pi pi-spin pi-spinner"></i>
              }
              Login
            </button>
          </div>

          <div class="login__hint">
            Sample users, password <code>password</code>:
            <ul>
              <li>
                <code>anna&#64;harbor.test</code>, <code>ben&#64;harbor.test</code>: Harbor Staffing
              </li>
              <li>
                <code>carla&#64;summit.test</code>, <code>david&#64;summit.test</code>: Summit
                Talent
              </li>
            </ul>
          </div>
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

      .login__fields {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        margin: 0;
        padding: 0;
        border: 0;
        min-width: 0;
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

      .login__hint ul {
        margin: 0.25rem 0 0;
        padding-left: 1.1rem;
      }
    `,
  ],
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /**
   * The login form, a Signal Form over a plain credentials signal.
   *
   *  - `required` on both fields is the port of `LoginViewModel.CanLogin`: the form is invalid, and
   *    Login disabled, until both have content.
   *  - Submitting runs `login` through the form's `submission` action, so `submitting()` replaces
   *    the old `busy` flag, and a failed login comes back as a form-level error rather than a
   *    separate `failureMessage` signal.
   */
  readonly loginForm = form(
    signal({ username: '', password: '' }),
    (credentials) => {
      required(credentials.username);
      required(credentials.password);
    },
    { submission: { action: (field) => this.login(field) } },
  );

  private async login(
    field: FieldTree<{ username: string; password: string }>,
  ): Promise<ValidationError | undefined> {
    const { username, password } = field().value();

    try {
      await this.auth.login(username.trim(), password);

      const target = this.auth.redirectUrl ?? '/home';
      this.auth.redirectUrl = null;
      await this.router.navigateByUrl(target);
      return undefined;
    } catch (error) {
      // Same as the original: clear the password, keep the user on the form, show why it failed.
      field.password().value.set('');
      return { kind: 'loginFailed', message: AppErrorHandler.describe(error).detail };
    }
  }
}
