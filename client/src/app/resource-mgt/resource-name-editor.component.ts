import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { InputTextModule } from 'primeng/inputtext';

export interface ResourceName {
  firstName: string;
  middleName: string;
  lastName: string;
}

/**
 * Port of `ViewModels/StaffingResource/StaffingResourceNameEditorViewModel.cs` +
 * `Views/StaffingResource/StaffingResourceNameEditorView.xaml`.
 *
 * Used in two places, exactly as in the original: to collect the name when adding a resource, and to
 * rename an existing one from the summary header.
 */
@Component({
  selector: 'app-resource-name-editor',
  imports: [FormsModule, ButtonModule, InputTextModule],
  template: `
    <div class="name-editor">
      <div class="name-editor__field">
        <label for="name-editor-first">First name</label>
        <input
          pInputText
          id="name-editor-first"
          name="firstName"
          [(ngModel)]="name.firstName"
          autofocus
        />
      </div>

      <div class="name-editor__field">
        <label for="name-editor-middle">Middle name</label>
        <input pInputText id="name-editor-middle" name="middleName" [(ngModel)]="name.middleName" />
      </div>

      <div class="name-editor__field">
        <label for="name-editor-last">Last name</label>
        <input pInputText id="name-editor-last" name="lastName" [(ngModel)]="name.lastName" />
      </div>

      <div class="name-editor__buttons">
        <p-button label="OK" [disabled]="!canAccept" (onClick)="accept()" />
        <p-button label="Cancel" severity="secondary" [outlined]="true" (onClick)="cancel()" />
      </div>
    </div>
  `,
  styles: [
    `
      .name-editor {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }

      .name-editor__field {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }

      .name-editor__field input {
        width: 100%;
      }

      .name-editor__buttons {
        display: flex;
        gap: 0.5rem;
        justify-content: flex-end;
        margin-top: 0.5rem;
      }
    `,
  ],
})
export class ResourceNameEditorComponent {
  private readonly ref = inject(DynamicDialogRef);

  readonly name: ResourceName = {
    firstName: '',
    middleName: '',
    lastName: '',
    ...(inject(DynamicDialogConfig).data as Partial<ResourceName> | undefined),
  };

  /** Same rule as the original's `CanOk`: first and last name are mandatory. */
  get canAccept(): boolean {
    return !!this.name.firstName?.trim() && !!this.name.lastName?.trim();
  }

  accept(): void {
    if (!this.canAccept) {
      return;
    }

    this.ref.close({
      firstName: this.name.firstName.trim(),
      middleName: this.name.middleName?.trim() ?? '',
      lastName: this.name.lastName.trim(),
    } satisfies ResourceName);
  }

  cancel(): void {
    this.ref.close(undefined);
  }
}
