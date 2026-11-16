import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonDirective } from '@openng/optimus-ui/button';
import { MessageModule } from '@openng/optimus-ui/message';
import { ProgressSpinnerModule } from '@openng/optimus-ui/progressspinner';

import { AuthService } from '../core/services/auth.service';

/**
 * Where the server's sign-in page sends the browser back to, with a code (`/auth/callback`).
 *
 * The app's own login page used to be the port of `LoginViewModel`.  With OAuth the user signs in
 * on the server, so all that is left here is to redeem the code (`AuthService.completeSignIn`) and
 * go on to the page the user asked for - or, if that fails, say why and offer to try again.
 */
@Component({
  selector: 'app-auth-callback',
  imports: [ButtonDirective, MessageModule, ProgressSpinnerModule],
  template: `
    <div class="callback">
      @if (error(); as message) {
        <div class="callback__card">
          <p-message severity="error">{{ message }}</p-message>
          <button pButton type="button" (click)="signInAgain()">Sign in again</button>
        </div>
      } @else {
        <p-progressSpinner ariaLabel="Signing in" />
        <span class="callback__text">Signing in...</span>
      }
    </div>
  `,
  styles: [
    `
      .callback {
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 1rem;
        background: linear-gradient(150deg, #2c72b3 0%, var(--temphire-accent) 45%, var(--temphire-accent-deep) 100%);
      }

      .callback__text {
        color: #ffffff;
      }

      .callback__card {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 1rem;
        width: 24rem;
        max-width: 100%;
        padding: 1.5rem;
        border-radius: 18px;
        background: #ffffff;
        box-shadow: 0 24px 60px rgba(0, 0, 0, 0.3);
      }
    `,
  ],
})
export class AuthCallbackComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly error = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    try {
      const returnUrl = await this.auth.completeSignIn(new URLSearchParams(window.location.search));
      // Replace the callback in the history, so Back never goes to a used code.
      await this.router.navigateByUrl(returnUrl, { replaceUrl: true });
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'The sign-in failed.');
    }
  }

  protected signInAgain(): void {
    void this.auth.signIn();
  }
}
