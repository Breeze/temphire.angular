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
  templateUrl: './auth-callback.component.html',
  styleUrl: './auth-callback.component.css',
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
