import { HttpErrorResponse } from '@angular/common/http';
import { ErrorHandler, Injectable, inject } from '@angular/core';
import { MessageService } from '@openng/optimus-ui/api';
import { isConcurrencyError } from 'breeze-client';

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
 *
 * A third case is a save that ran into someone else's: a concurrency conflict (see
 * `CONCURRENCY_CONFLICT`).
 */
@Injectable({ providedIn: 'root' })
export class AppErrorHandler implements ErrorHandler {
  private readonly messageService = inject(MessageService);

  handleError(error: unknown): void {
    if (AppErrorHandler.isHarmless(error)) {
      return;
    }

    const { summary, detail } = AppErrorHandler.describe(error);

    this.messageService.add({
      severity: 'error',
      summary,
      detail,
      life: 10000,
    });

    console.error(error);
  }

  /**
   * Browser notices that arrive as errors but mean nothing is wrong, so the user is not shown them.
   *
   * "ResizeObserver loop completed with undelivered notifications" is the one that occurs: a
   * ResizeObserver callback (the tabs and other Optimus UI components use them) changed the layout,
   * so the browser postponed the remaining notifications to the next frame.  Nothing is lost.
   * `provideBrowserGlobalErrorListeners` passes such window `error` events on to this handler,
   * wrapped in an `Error` whose `cause` is the `ErrorEvent`.
   */
  static isHarmless(error: unknown): boolean {
    const harmless =
      /^ResizeObserver loop (completed with undelivered notifications|limit exceeded)/;
    const messages = [error, (error as { cause?: unknown })?.cause].map(
      (e) => (e as { message?: unknown })?.message,
    );
    return messages.some((message) => typeof message === 'string' && harmless.test(message));
  }

  static describe(error: unknown): { summary: string; detail: string } {
    const unwrapped = (error as { rejection?: unknown })?.rejection ?? error;

    if (isConcurrencyError(unwrapped)) {
      return CONCURRENCY_CONFLICT;
    }

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

/**
 * What the user is told when a save conflicts with someone else's: another user changed or deleted
 * a record the save changes or deletes after it was loaded (optimistic concurrency, see
 * `AuditEntityBase.RowVersion` on the server).  Nothing was saved.  Refresh discards the unsaved
 * changes and loads the latest data, on which the user can make their changes again.
 *
 * Recognized by the problem type the Breeze server sends for a conflict (`isConcurrencyError`), not
 * by the status code or the message: 409 is also a duplicate key, and the message is EF Core's.
 */
export const CONCURRENCY_CONFLICT = {
  summary: 'Someone else changed this data',
  detail:
    'Another user changed or deleted some of this data after you loaded it, so your changes were not ' +
    'saved. Click Refresh to load the latest data, then make your changes again and save.',
};
