import { Component, inject, signal } from '@angular/core';
import { FormField, FormRoot, form, required } from '@angular/forms/signals';
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
  imports: [FormField, FormRoot, ButtonModule, InputTextModule],
  template: `
    <form class="name-editor" [formRoot]="nameForm">
      <div class="name-editor__field">
        <label for="name-editor-first">First name</label>
        <input pInputText id="name-editor-first" [formField]="nameForm.firstName" autofocus />
      </div>

      <div class="name-editor__field">
        <label for="name-editor-middle">Middle name</label>
        <input pInputText id="name-editor-middle" [formField]="nameForm.middleName" />
      </div>

      <div class="name-editor__field">
        <label for="name-editor-last">Last name</label>
        <input pInputText id="name-editor-last" [formField]="nameForm.lastName" />
      </div>

      <div class="name-editor__buttons">
        <p-button type="submit" label="OK" [disabled]="nameForm().invalid()" />
        <p-button label="Cancel" severity="secondary" [outlined]="true" (onClick)="cancel()" />
      </div>
    </form>
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

  /**
   * A Signal Form over the name being edited, seeded from the dialog's data when renaming.
   * `required` on first and last name is the original's `CanOk` rule; OK (or Enter) submits.
   */
  readonly nameForm = form(
    signal<ResourceName>({
      firstName: '',
      middleName: '',
      lastName: '',
      ...(inject(DynamicDialogConfig).data as Partial<ResourceName> | undefined),
    }),
    (name) => {
      required(name.firstName);
      required(name.lastName);
    },
    { submission: { action: async (field) => this.accept(field().value()) } },
  );

  private accept(name: ResourceName): void {
    this.ref.close({
      firstName: name.firstName.trim(),
      middleName: name.middleName?.trim() ?? '',
      lastName: name.lastName.trim(),
    } satisfies ResourceName);
  }

  cancel(): void {
    this.ref.close(undefined);
  }
}
