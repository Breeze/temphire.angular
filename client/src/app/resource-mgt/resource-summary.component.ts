import { Component, inject, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TextareaModule } from 'primeng/textarea';

import { StaffingResource } from '../core/model';
import { AppDialogService, DialogCancelledError } from '../core/services/dialog.service';
import { ResourceName, ResourceNameEditorComponent } from './resource-name-editor.component';

/**
 * Port of `ViewModels/StaffingResource/StaffingResourceSummaryViewModel.cs` +
 * `Views/StaffingResource/StaffingResourceSummaryView.xaml`.
 *
 * The resource's full name rendered large (48pt Verdana in the original, in #73A9D8), acting as a
 * hyperlink button that opens the name editor while in edit mode, over a free-text summary box.
 */
@Component({
  selector: 'app-resource-summary',
  imports: [FormsModule, TextareaModule],
  template: `
    <div class="summary">
      <button
        type="button"
        class="summary__name"
        [class.summary__name--editable]="!readOnly()"
        [disabled]="readOnly()"
        (click)="editName()"
      >
        {{ staffingResource().fullName }}
      </button>

      <textarea
        pTextarea
        class="summary__text temphire-elevated"
        rows="4"
        [readOnly]="readOnly()"
        [(ngModel)]="staffingResource().summary"
        placeholder="Summary"
      ></textarea>
    </div>
  `,
  styles: [
    `
      .summary {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .summary__name {
        align-self: flex-start;
        background: none;
        border: none;
        padding: 0;
        font-family: Verdana, sans-serif;
        font-size: 2.5rem;
        line-height: 1.1;
        color: var(--temphire-accent-light);
        text-align: left;
        cursor: default;
      }

      .summary__name--editable {
        cursor: pointer;
        text-decoration: underline;
        text-decoration-style: dotted;
        text-underline-offset: 0.2em;
      }

      .summary__text {
        width: 100%;
        resize: vertical;
      }
    `,
  ],
})
export class ResourceSummaryComponent {
  private readonly dialogs = inject(AppDialogService);

  readonly staffingResource = input.required<StaffingResource>();
  readonly readOnly = input.required<boolean>();

  /** Port of `StaffingResourceSummaryViewModel.EditName`. */
  async editName(): Promise<void> {
    if (this.readOnly()) {
      return;
    }

    const resource = this.staffingResource();

    try {
      const name = await this.dialogs.open<ResourceName>(ResourceNameEditorComponent, {
        header: 'Edit name',
        width: '26rem',
        data: {
          firstName: resource.firstName ?? '',
          middleName: resource.middleName ?? '',
          lastName: resource.lastName ?? '',
        },
      });

      resource.firstName = name.firstName;
      resource.middleName = name.middleName;
      resource.lastName = name.lastName;
    } catch (error) {
      if (!(error instanceof DialogCancelledError)) {
        throw error;
      }
    }
  }
}
