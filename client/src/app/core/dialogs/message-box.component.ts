import { Component, inject } from '@angular/core';
import { ButtonDirective } from '@openng/optimus-ui/button';
import { DynamicDialogConfig, DynamicDialogRef } from '@openng/optimus-ui/dynamicdialog';

export interface MessageBoxButton {
  label: string;
  value: string;
  severity?: 'primary' | 'secondary' | 'danger';
}

export interface MessageBoxData {
  message: string;
  buttons: MessageBoxButton[];
}

/**
 * The message box behind `AppDialogService.showMessage`.
 *
 * Punch's `IDialogManager.ShowMessageAsync` accepted an arbitrary set of `DialogButtons`
 * (Ok/OkCancel/YesNo/YesNoCancel), which Optimus UI's two-button `p-confirmDialog` cannot express -
 * TempHire genuinely needs the three-button "save / discard / cancel" prompt when closing a screen
 * with unsaved changes.  So the buttons are data here, just as they were in the original.
 */
@Component({
  selector: 'app-message-box',
  imports: [ButtonDirective],
  templateUrl: './message-box.component.html',
  styleUrl: './message-box.component.css',
})
export class MessageBoxComponent {
  private readonly ref = inject(DynamicDialogRef);
  readonly data: MessageBoxData = inject(DynamicDialogConfig).data;

  close(value: string): void {
    this.ref.close(value);
  }
}
