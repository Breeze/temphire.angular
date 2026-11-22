import { Injectable, Type, inject } from '@angular/core';
import { DialogService, DynamicDialogConfig } from '@openng/optimus-ui/dynamicdialog';
import { firstValueFrom } from 'rxjs';

import { MessageBoxComponent, MessageBoxData } from '../dialogs/message-box.component';

/** The button a message box was closed with. Port of Punch's `DialogResult`. */
export type DialogResult = 'ok' | 'cancel' | 'yes' | 'no';

/**
 * Port of Punch's `IDialogManager`, on top of Optimus UI's DynamicDialog.
 *
 * Every dialog **returns** what the user chose. Cancelling is an answer, not an error: a message
 * box resolves with the cancel button's result, and a component dialog with `undefined`.
 * (The first port kept Punch's shape, which rejected the task with `TaskCanceledException`, as a
 * thrown `DialogCancelledError`. Every caller then needed a try/catch to tell "the user said no"
 * from a real failure, and real failures got reported by hand instead of reaching the global
 * `ErrorHandler`.)
 */
@Injectable({ providedIn: 'root' })
export class AppDialogService {
  private readonly dialogService = inject(DialogService);

  /**
   * Port of `ShowMessageAsync`. Resolves with the value of the button the user picked. Closing the
   * box without one (the X, Escape) counts as `dismissResult`: the box's cancel answer.
   */
  async showMessage(
    message: string,
    buttons: MessageBoxData['buttons'],
    options: { header?: string; dismissResult?: DialogResult } = {},
  ): Promise<DialogResult> {
    const dismissResult = options.dismissResult ?? 'cancel';
    const ref = this.dialogService.open(MessageBoxComponent, {
      header: options.header ?? 'TempHire',
      modal: true,
      width: '30rem',
      closable: true,
      data: { message, buttons } satisfies MessageBoxData,
    });

    // Optimus UI returns null if the dialog could not be opened (for example when the app is
    // shutting down): the user didn't get to choose, so that is the cancel answer too.
    if (!ref) {
      return dismissResult;
    }

    const result = (await firstValueFrom(ref.onClose)) as DialogResult | undefined;
    return result ?? dismissResult;
  }

  /** OK / Cancel: `'ok'` or `'cancel'`. */
  confirm(message: string, header = 'TempHire'): Promise<DialogResult> {
    return this.showMessage(
      message,
      [
        { label: 'OK', value: 'ok', severity: 'primary' },
        { label: 'Cancel', value: 'cancel', severity: 'secondary' },
      ],
      { header },
    );
  }

  /** Yes / No: `'yes'` or `'no'`. Closing the box counts as No. */
  confirmYesNo(message: string, header = 'TempHire'): Promise<DialogResult> {
    return this.showMessage(
      message,
      [
        { label: 'Yes', value: 'yes', severity: 'danger' },
        { label: 'No', value: 'no', severity: 'secondary' },
      ],
      { header, dismissResult: 'no' },
    );
  }

  /** Yes / No / Cancel, used when leaving a screen with unsaved changes. Closing the box counts as Cancel. */
  confirmYesNoCancel(message: string, header = 'TempHire'): Promise<DialogResult> {
    return this.showMessage(
      message,
      [
        { label: 'Yes', value: 'yes', severity: 'primary' },
        { label: 'No', value: 'no', severity: 'secondary' },
        { label: 'Cancel', value: 'cancel', severity: 'secondary' },
      ],
      { header },
    );
  }

  /**
   * Port of `ShowDialogAsync(viewModel, buttons)`: hosts a component in a modal. Resolves with what
   * the component closed with, or `undefined` when the user cancelled or closed it.
   */
  async open<TResult>(component: Type<unknown>, config: DynamicDialogConfig = {}): Promise<TResult | undefined> {
    const ref = this.dialogService.open(component, {
      modal: true,
      closable: true,
      width: '32rem',
      ...config,
    });

    if (!ref) {
      return undefined;
    }

    const result = (await firstValueFrom(ref.onClose)) as TResult | null | undefined;
    return result ?? undefined;
  }
}
