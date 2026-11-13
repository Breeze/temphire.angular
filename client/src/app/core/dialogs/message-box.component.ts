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
  template: `
    <p class="message-box__text">{{ data.message }}</p>
    <div class="message-box__buttons">
      @for (button of data.buttons; track button.value) {
        <button
          pButton
          type="button"
          [severity]="button.severity === 'primary' ? undefined : button.severity"
          [outlined]="button.severity === 'secondary'"
          (click)="close(button.value)"
        >
          {{ button.label }}
        </button>
      }
    </div>
  `,
  styles: [
    `
      .message-box__text {
        margin: 0 0 1.5rem;
        white-space: pre-line;
      }

      .message-box__buttons {
        display: flex;
        gap: 0.5rem;
        justify-content: flex-end;
      }
    `,
  ],
})
export class MessageBoxComponent {
  private readonly ref = inject(DynamicDialogRef);
  readonly data: MessageBoxData = inject(DynamicDialogConfig).data;

  close(value: string): void {
    this.ref.close(value);
  }
}
