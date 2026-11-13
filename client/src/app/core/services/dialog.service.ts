import { Injectable, Type, inject } from '@angular/core';
import { DialogService, DynamicDialogConfig } from '@openng/optimus-ui/dynamicdialog';
import { firstValueFrom } from 'rxjs';

import { MessageBoxComponent, MessageBoxData } from '../dialogs/message-box.component';

/** Port of Punch's `DialogResult`. */
export type DialogResult = 'ok' | 'cancel' | 'yes' | 'no';

/**
 * Raised instead of returning when the user dismisses a dialog.
 *
 * Punch's `IDialogManager` rejected its task with `TaskCanceledException`, and the WPF view
 * models were written around that - `ResourceMgtViewModel.Add` catches `TaskCanceledException` to
 * abandon the add.  Keeping the same shape means the ported control flow reads the same.
 */
export class DialogCancelledError extends Error {
  constructor() {
    super('The dialog was cancelled.');
    this.name = 'DialogCancelledError';
  }
}

/**
 * Port of Punch's `IDialogManager`, on top of Optimus UI's DynamicDialog.
 */
@Injectable({ providedIn: 'root' })
export class AppDialogService {
  private readonly dialogService = inject(DialogService);

  /**
   * Port of `ShowMessageAsync`.  Resolves with the chosen value; **throws**
   * `DialogCancelledError` if the user picks the cancel button or dismisses the dialog.
   */
  async showMessage(
    message: string,
    buttons: MessageBoxData['buttons'],
    options: { header?: string; cancelValue?: DialogResult | null } = {},
  ): Promise<DialogResult> {
    const ref = this.dialogService.open(MessageBoxComponent, {
      header: options.header ?? 'TempHire',
      modal: true,
      width: '30rem',
      closable: true,
      data: { message, buttons } satisfies MessageBoxData,
    });

    // Optimus UI returns null if the dialog could not be opened (for example when the app is
    // shutting down); treat that as a cancellation rather than crashing the caller.
    if (!ref) {
      throw new DialogCancelledError();
    }

    const result = (await firstValueFrom(ref.onClose)) as DialogResult | undefined;
    const cancelValue = options.cancelValue === undefined ? 'cancel' : options.cancelValue;

    if (result === undefined || (cancelValue !== null && result === cancelValue)) {
      throw new DialogCancelledError();
    }

    return result;
  }

  /** Convenience wrapper for the OK/Cancel case. */
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

  /** Convenience wrapper for the Yes/No case, where "No" is an answer rather than a cancellation. */
  confirmYesNo(message: string, header = 'TempHire'): Promise<DialogResult> {
    return this.showMessage(
      message,
      [
        { label: 'Yes', value: 'yes', severity: 'danger' },
        { label: 'No', value: 'no', severity: 'secondary' },
      ],
      { header, cancelValue: 'no' },
    );
  }

  /**
   * Yes / No / Cancel - used when leaving a screen with unsaved changes.
   * Throws `DialogCancelledError` for Cancel, matching `StaffingResourceDetailViewModel.CanClose`.
   */
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
   * Port of `ShowDialogAsync(viewModel, buttons)` - hosts a component in a modal.
   * Throws `DialogCancelledError` when the user closes without a result.
   */
  async open<TResult>(
    component: Type<unknown>,
    config: DynamicDialogConfig = {},
  ): Promise<TResult> {
    const ref = this.dialogService.open(component, {
      modal: true,
      closable: true,
      width: '32rem',
      ...config,
    });

    if (!ref) {
      throw new DialogCancelledError();
    }

    const result = (await firstValueFrom(ref.onClose)) as TResult | undefined;

    if (result === undefined || result === null) {
      throw new DialogCancelledError();
    }

    return result;
  }
}
