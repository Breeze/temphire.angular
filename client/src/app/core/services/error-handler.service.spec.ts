import { TestBed } from '@angular/core/testing';
import { MessageService } from '@openng/optimus-ui/api';
import { vi } from 'vitest';

import { AppErrorHandler } from './error-handler.service';

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
