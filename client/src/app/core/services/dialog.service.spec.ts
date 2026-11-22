import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DialogService } from '@openng/optimus-ui/dynamicdialog';
import { of } from 'rxjs';

import { AppDialogService } from './dialog.service';

/**
 * Cancelling a dialog is an answer, not an error: every dialog resolves with what the user chose.
 * (The first port threw `DialogCancelledError`, so every caller needed a try/catch.)
 */
describe('AppDialogService', () => {
  /** Optimus UI's DialogService, closing every dialog with `closedWith`; `null` when it can't open one. */
  function setUp(closedWith: unknown, opens = true) {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: DialogService, useValue: { open: () => (opens ? { onClose: of(closedWith) } : null) } },
      ],
    });
    return TestBed.inject(AppDialogService);
  }

  it('resolves a message box with the button the user picked', async () => {
    expect(await setUp('ok').confirm('Discard?')).toBe('ok');
    TestBed.resetTestingModule();
    expect(await setUp('cancel').confirm('Discard?')).toBe('cancel');
    TestBed.resetTestingModule();
    expect(await setUp('no').confirmYesNoCancel('Save?')).toBe('no');
  });

  it("counts closing a message box as its cancel answer: Cancel, or No for Yes/No", async () => {
    expect(await setUp(undefined).confirm('Discard?')).toBe('cancel');
    TestBed.resetTestingModule();
    expect(await setUp(undefined).confirmYesNoCancel('Save?')).toBe('cancel');
    TestBed.resetTestingModule();
    expect(await setUp(undefined).confirmYesNo('Delete?')).toBe('no');
  });

  it('resolves a component dialog with its result, or undefined when cancelled', async () => {
    expect(await setUp({ name: 'Ann' }).open<{ name: string }>(class {})).toEqual({ name: 'Ann' });
    TestBed.resetTestingModule();
    expect(await setUp(undefined).open(class {})).toBeUndefined();
    TestBed.resetTestingModule();
    expect(await setUp(null).open(class {})).toBeUndefined();
  });

  it("answers Cancel when a dialog can't be opened at all", async () => {
    expect(await setUp('ok', false).confirm('Discard?')).toBe('cancel');
    TestBed.resetTestingModule();
    expect(await setUp('ok', false).open(class {})).toBeUndefined();
  });
});
