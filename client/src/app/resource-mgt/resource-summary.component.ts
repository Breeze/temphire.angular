import { Component, inject, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TextareaModule } from '@openng/optimus-ui/textarea';

import { StaffingResource } from '../core/model';
import { AppDialogService, DialogCancelledError } from '../core/services/dialog.service';
import { ResourceName, ResourceNameEditorComponent } from './resource-name-editor.component';
import { BreezeFieldDirective } from '../core/validation/breeze-field.directive';

/**
 * Port of `ViewModels/StaffingResource/StaffingResourceSummaryViewModel.cs` +
 * `Views/StaffingResource/StaffingResourceSummaryView.xaml`.
 *
 * The resource's full name rendered large (48pt Verdana in the original, in #73A9D8), acting as a
 * hyperlink button that opens the name editor while in edit mode, over a free-text summary box.
 * Here it heads a card, next to an initials avatar and the primary city and phone number.
 */
@Component({
  selector: 'app-resource-summary',
  imports: [BreezeFieldDirective, FormsModule, TextareaModule],
  template: `
    <div class="summary temphire-card">
      <div class="summary__header">
        <span class="summary__avatar temphire-orb" aria-hidden="true">{{ initials() }}</span>

        <div class="summary__identity">
          <button
            type="button"
            class="summary__name"
            [class.summary__name--editable]="!readOnly()"
            [disabled]="readOnly()"
            [title]="readOnly() ? '' : 'Edit the name'"
            (click)="editName()"
          >
            {{ staffingResource().fullName }}
            @if (!readOnly()) {
              <i class="pi pi-pencil summary__edit" aria-hidden="true"></i>
            }
          </button>

          <div class="summary__facts">
            @if (staffingResource().primaryAddress; as address) {
              <span class="summary__fact">
                <i class="pi pi-map-marker" aria-hidden="true"></i>
                {{ address.city
                }}{{ address.state?.shortName ? ', ' + address.state.shortName : '' }}
              </span>
            }
            @if (staffingResource().primaryPhoneNumber; as phone) {
              <span class="summary__fact">
                <i class="pi pi-phone" aria-hidden="true"></i>
                ({{ phone.areaCode }}) {{ phone.number }}
              </span>
            }
          </div>
        </div>
      </div>

      <textarea
        pTextarea
        class="summary__text"
        rows="3"
        [readOnly]="readOnly()"
        [(ngModel)]="staffingResource().summary"
        [breezeField]="staffingResource()"
        breezeProperty="summary"
        #summaryField="breezeField"
        [invalid]="summaryField.invalid()"
        placeholder="Summary"
      ></textarea>
    </div>
  `,
  styles: [
    `
      .summary {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        padding: 1.25rem 1.4rem 1.4rem;
        background:
          radial-gradient(700px 160px at 0% 0%, rgba(115, 169, 216, 0.16), transparent 70%), #ffffff;
      }

      .summary__header {
        display: flex;
        align-items: center;
        gap: 1.1rem;
      }

      .summary__avatar {
        width: 4rem;
        height: 4rem;
        font-size: 1.45rem;
        letter-spacing: 0.02em;
      }

      .summary__identity {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
        min-width: 0;
      }

      .summary__name {
        align-self: flex-start;
        display: inline-flex;
        align-items: center;
        gap: 0.6rem;
        background: none;
        border: none;
        padding: 0;
        font: inherit;
        font-size: 2.1rem;
        font-weight: 700;
        line-height: 1.1;
        letter-spacing: -0.01em;
        color: var(--temphire-accent);
        text-align: left;
        cursor: default;
      }

      .summary__name--editable {
        cursor: pointer;
      }

      .summary__name--editable:hover {
        color: #2c72b3;
      }

      .summary__edit {
        font-size: 1rem;
        color: var(--temphire-accent-light);
      }

      .summary__facts {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
      }

      .summary__fact {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.2rem 0.65rem;
        border-radius: 999px;
        font-size: 0.8rem;
        color: var(--temphire-accent);
        background: #eaf2fa;
        border: 1px solid var(--temphire-border);
      }

      .summary__text {
        width: 100%;
        resize: vertical;
        background: #f8fbfe;
        box-shadow: inset 0 1px 3px rgba(15, 47, 77, 0.06);
      }
    `,
  ],
})
export class ResourceSummaryComponent {
  private readonly dialogs = inject(AppDialogService);

  readonly staffingResource = input.required<StaffingResource>();
  readonly readOnly = input.required<boolean>();

  /**
   * First and last initial, for the avatar.  A method rather than a `computed`: the names are
   * Breeze entity properties, not signals, so they are read again on every render.
   */
  protected initials(): string {
    const resource = this.staffingResource();
    return `${resource.firstName?.charAt(0) ?? ''}${resource.lastName?.charAt(0) ?? ''}`.toUpperCase();
  }

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
