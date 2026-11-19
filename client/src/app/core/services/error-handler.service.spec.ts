import { TestBed } from '@angular/core/testing';
import { MessageService } from '@openng/optimus-ui/api';
import { ProblemTypes } from 'breeze-client';
import { vi } from 'vitest';

import { AppErrorHandler, CONCURRENCY_CONFLICT } from './error-handler.service';

describe('AppErrorHandler', () => {
  let handler: AppErrorHandler;
  let messages: MessageService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [MessageService] });
    handler = TestBed.inject(AppErrorHandler);
    messages = TestBed.inject(MessageService);
    vi.spyOn(messages, 'add');
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => vi.restoreAllMocks());

  it('shows an unexpected error', () => {
    handler.handleError(new Error('Something broke'));

    expect(messages.add).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error', detail: 'Something broke' }),
    );
  });

  // A save that conflicted with someone else's, as the Breeze client reports it: a save error whose
  // `problemType` is the one the Breeze server sends for a concurrency conflict, carrying the
  // server's technical message.
  it('tells the user to refresh after a concurrency conflict, not what the server said', () => {
    const conflict = Object.assign(
      new Error('The save failed because 1 record was changed or deleted by another user after it was read.'),
      { status: 409, problemType: ProblemTypes.concurrencyConflict, entityErrors: [] },
    );

    handler.handleError(conflict);

    expect(messages.add).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error', ...CONCURRENCY_CONFLICT }),
    );
    expect(CONCURRENCY_CONFLICT.detail).toContain('Click Refresh');
  });

  it('does not mistake another 409 for a concurrency conflict', () => {
    const duplicate = Object.assign(new Error('Cannot insert duplicate key.'), {
      status: 409,
      problemType: 'https://example.test/problems/duplicate-key',
    });

    expect(AppErrorHandler.describe(duplicate)).not.toEqual(CONCURRENCY_CONFLICT);
  });

  // What provideBrowserGlobalErrorListeners passes on for the browser's ResizeObserver notice.
  it('ignores the ResizeObserver loop notice', () => {
    const notice = new ErrorEvent('error', {
      message: 'ResizeObserver loop completed with undelivered notifications.',
    });
    const wrapped = new Error('An ErrorEvent with no error occurred. See Error.cause for details', {
      cause: notice,
    });

    handler.handleError(wrapped);

    expect(messages.add).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });
});
