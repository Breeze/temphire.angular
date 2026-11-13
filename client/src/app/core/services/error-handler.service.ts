import { HttpErrorResponse } from '@angular/common/http';
import { ErrorHandler, Injectable, inject } from '@angular/core';
import { MessageService } from '@openng/optimus-ui/api';

/** Shape of the payload Breeze's `GlobalExceptionFilter` sends for an `EntityErrorsException`. */
interface BreezeEntityErrors {
  EntityErrors?: { ErrorMessage?: string; PropertyName?: string; EntityTypeName?: string }[];
  /**
   * Two spellings genuinely occur.  Breeze's `GlobalExceptionFilter` writes `Message`, because
   * `Program.cs` clears the camel-case naming strategy for Breeze's benefit.  `AccountController`'s
   * `ErrorResult` opts back in to camelCase and writes `message`.  Read both.
   */
  Message?: string;
  message?: string;
}

/**
 * Port of `Common/Errors/ErrorHandler.cs` and `Common/Validation/ValidationErrorHandler.cs`.
 *
 * The WPF app funnelled unhandled exceptions into a dialog, and pulled DevForce
 * `VerifierResult` messages out of `EntityServerException` to show them separately.  The same two
 * cases show up here: a save that fails validation comes back as HTTP 403 carrying an
 * `EntityErrors` array (thrown by `TempHirePersistenceManager.ValidateSave`), and anything else is
 * an unexpected error.
 */
@Injectable({ providedIn: 'root' })
export class AppErrorHandler implements ErrorHandler {
  private readonly messageService = inject(MessageService);

  handleError(error: unknown): void {
    const { summary, detail } = AppErrorHandler.describe(error);

    this.messageService.add({
      severity: 'error',
      summary,
      detail,
      life: 10000,
    });

    console.error(error);
  }

  /** Shows an error without routing it through Angular's global handler. */
  show(error: unknown): void {
    this.handleError(error);
  }

  static describe(error: unknown): { summary: string; detail: string } {
    const unwrapped = (error as { rejection?: unknown })?.rejection ?? error;

    if (unwrapped instanceof HttpErrorResponse) {
      const body = unwrapped.error as BreezeEntityErrors | string | null;

      if (
        body &&
        typeof body === 'object' &&
        Array.isArray(body.EntityErrors) &&
        body.EntityErrors.length
      ) {
        const messages = body.EntityErrors.map((e) => e.ErrorMessage).filter(
          (m): m is string => !!m,
        );

        return {
          summary: 'The changes could not be saved',
          detail: [...new Set(messages)].join('\n'),
        };
      }

      if (body && typeof body === 'object' && (body.Message || body.message)) {
        return { summary: 'Server error', detail: (body.Message ?? body.message)! };
      }

      if (typeof body === 'string' && body.trim()) {
        // Breeze requests come back with `responseType: 'text'`, so a JSON error body arrives here
        // as an unparsed string.  Parse it so the server's message survives.
        try {
          const parsed = JSON.parse(body) as BreezeEntityErrors;

          if (Array.isArray(parsed.EntityErrors) && parsed.EntityErrors.length) {
            const messages = parsed.EntityErrors.map((e) => e.ErrorMessage).filter(
              (m): m is string => !!m,
            );

            return {
              summary: 'The changes could not be saved',
              detail: [...new Set(messages)].join('\n'),
            };
          }

          if (parsed.Message || parsed.message) {
            return { summary: 'Server error', detail: (parsed.Message ?? parsed.message)! };
          }
        } catch {
          // Not JSON - fall through and show it as-is.
        }

        return { summary: 'Server error', detail: body };
      }

      return {
        summary: 'Server error',
        detail: unwrapped.message || `Request failed with status ${unwrapped.status}.`,
      };
    }

    // Breeze wraps save failures in an error object carrying the server's entityErrors.
    const breezeErrors = (unwrapped as { entityErrors?: { errorMessage?: string }[] })
      ?.entityErrors;
    if (Array.isArray(breezeErrors) && breezeErrors.length) {
      const messages = breezeErrors.map((e) => e.errorMessage).filter((m): m is string => !!m);
      return {
        summary: 'The changes could not be saved',
        detail: [...new Set(messages)].join('\n'),
      };
    }

    if (unwrapped instanceof Error) {
      return { summary: 'Something went wrong', detail: unwrapped.message };
    }

    return { summary: 'Something went wrong', detail: String(unwrapped) };
  }
}
