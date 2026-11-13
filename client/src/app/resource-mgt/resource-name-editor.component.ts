import { Component, inject, signal } from '@angular/core';
import { FormField, FormRoot, form } from '@angular/forms/signals';
import { ButtonDirective } from '@openng/optimus-ui/button';
import { DynamicDialogConfig, DynamicDialogRef } from '@openng/optimus-ui/dynamicdialog';
import { InputTextModule } from '@openng/optimus-ui/inputtext';

import { StaffingResource } from '../core/model';
import { EntityManagerProvider } from '../core/services/entity-manager-provider';
import { validateWithBreeze } from '../core/validation/breeze-validators';

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
  imports: [FormField, FormRoot, ButtonDirective, InputTextModule],
  template: `
    <form class="name-editor" [formRoot]="nameForm">
      <div class="name-editor__field">
        <label for="name-editor-first">First name</label>
        <input pInputText id="name-editor-first" [formField]="nameForm.firstName" autofocus />
        @if (nameForm.firstName().touched()) {
          @for (error of nameForm.firstName().errors(); track error.kind) {
            <small class="temphire-field-error">{{ error.message }}</small>
          }
        }
      </div>

      <div class="name-editor__field">
        <label for="name-editor-middle">Middle name</label>
        <input pInputText id="name-editor-middle" [formField]="nameForm.middleName" />
        @if (nameForm.middleName().touched()) {
          @for (error of nameForm.middleName().errors(); track error.kind) {
            <small class="temphire-field-error">{{ error.message }}</small>
          }
        }
      </div>

      <div class="name-editor__field">
        <label for="name-editor-last">Last name</label>
        <input pInputText id="name-editor-last" [formField]="nameForm.lastName" />
        @if (nameForm.lastName().touched()) {
          @for (error of nameForm.lastName().errors(); track error.kind) {
            <small class="temphire-field-error">{{ error.message }}</small>
          }
        }
      </div>

      <div class="name-editor__buttons">
        <button pButton type="submit" [disabled]="nameForm().invalid()">OK</button>
        <button pButton type="button" severity="secondary" [outlined]="true" (click)="cancel()">
          Cancel
        </button>
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

  /** The metadata for the entity these names are for. */
  private readonly staffingResourceType =
    inject(EntityManagerProvider).metadataStore.getAsEntityType(StaffingResource);

  /**
   * A Signal Form over the name being edited, seeded from the dialog's data when renaming.  OK (or
   * Enter) submits.
   *
   * There are no Angular validators here.  The names end up on a `StaffingResource`, so the form
   * applies `StaffingResource`'s own Breeze validators: first and last name required, and at most
   * 100 characters each, from `[Required]` / `[StringLength]` on the server's model.  That is the
   * original's `CanOk` rule, taken from the model instead of restated here.
   */
  readonly nameForm = form(
    signal<ResourceName>({
      firstName: '',
      middleName: '',
      lastName: '',
      ...(inject(DynamicDialogConfig).data as Partial<ResourceName> | undefined),
    }),
    (name) => {
      validateWithBreeze(name.firstName, this.staffingResourceType.getDataProperty('firstName'));
      validateWithBreeze(name.middleName, this.staffingResourceType.getDataProperty('middleName'));
      validateWithBreeze(name.lastName, this.staffingResourceType.getDataProperty('lastName'));
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
