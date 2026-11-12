import { Component, computed, inject, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonDirective } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { RadioButtonModule } from 'primeng/radiobutton';

import { PhoneNumber, PhoneNumberType, StaffingResource } from '../../core/model';
import { AppDialogService, DialogCancelledError } from '../../core/services/dialog.service';
import { ResourceMgtUnitOfWork } from '../../core/services/resource-mgt-unit-of-work';
import { ItemSelectorComponent } from '../item-selector.component';
import { BreezeFieldDirective } from '../../core/validation/breeze-field.directive';

/**
 * Port of `ViewModels/StaffingResource/StaffingResourcePhoneListViewModel.cs` +
 * `StaffingResourcePhoneItemViewModel.cs` + `Views/StaffingResource/StaffingResourcePhoneListView.xaml`.
 *
 * The same shape as the address list, one row per phone number: type, area code, number, and the
 * primary / delete actions.  As with the addresses, the per-row
 * `StaffingResourcePhoneItemViewModel` has no counterpart here - it only carried `EditMode` next to
 * the entity and re-raised `CanDelete` / `CanSetPrimary` when `Primary` changed, both of which fall
 * out of binding the entity directly - and the original's "Set Primary" button per row is a radio
 * group, which is what the mutually exclusive flag really is.
 */
@Component({
  selector: 'app-resource-phone-list',
  imports: [BreezeFieldDirective, FormsModule, ButtonDirective, InputTextModule, RadioButtonModule],
  template: `
    <div class="phones">
      <button
        pButton
        type="button"
        size="small"
        [outlined]="true"
        [disabled]="readOnly()"
        (click)="add()"
      >
        <i class="pi pi-plus"></i>
        Add
      </button>

      @for (phoneNumber of phoneNumbers(); track phoneNumber.id) {
        <div class="phone temphire-elevated">
          <span class="phone__type">{{ phoneNumber.phoneNumberType?.name }}</span>

          <input
            pInputText
            class="phone__area-code"
            aria-label="Area code"
            [readOnly]="readOnly()"
            [(ngModel)]="phoneNumber.areaCode"
            [breezeField]="phoneNumber"
            breezeProperty="areaCode"
            #areaCodeField="breezeField"
            [invalid]="areaCodeField.invalid()"
          />

          <input
            pInputText
            class="phone__number"
            aria-label="Number"
            [readOnly]="readOnly()"
            [(ngModel)]="phoneNumber.number"
            [breezeField]="phoneNumber"
            breezeProperty="number"
            #numberField="breezeField"
            [invalid]="numberField.invalid()"
          />

          <div class="phone__primary">
            <p-radiobutton
              name="primary-phone-number"
              [inputId]="'primary-phone-' + phoneNumber.id"
              [value]="phoneNumber.id"
              [ngModel]="staffingResource().primaryPhoneNumber?.id"
              [disabled]="!canSetPrimary(phoneNumber)"
              (ngModelChange)="setPrimary(phoneNumber)"
            />
            <label [for]="'primary-phone-' + phoneNumber.id">Primary</label>
          </div>

          <button
            pButton
            type="button"
            severity="danger"
            size="small"
            [outlined]="true"
            [disabled]="!canDelete(phoneNumber)"
            (click)="delete(phoneNumber)"
          >
            Delete
          </button>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .phones {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 0.5rem;
      }

      .phone {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 0.75rem;
        border: 1px solid var(--p-content-border-color, #e5e7eb);
        border-radius: 4px;
      }

      .phone__type {
        min-width: 4rem;
        font-weight: 700;
      }

      .phone__area-code {
        width: 4rem;
      }

      .phone__number {
        width: 7rem;
      }

      .phone__primary {
        display: flex;
        align-items: center;
        gap: 0.4rem;
      }
    `,
  ],
})
export class ResourcePhoneListComponent {
  private readonly dialogs = inject(AppDialogService);

  readonly staffingResource = input.required<StaffingResource>();
  readonly readOnly = input.required<boolean>();
  readonly unitOfWork = input.required<ResourceMgtUnitOfWork>();

  /**
   * The rows to show.  Breeze changes `staffingResource.phoneNumbers` in place, which nothing reactive sees, and
   * an add finishes after the type dialog closes - outside any event in this component - so with
   * OnPush change detection the view would not re-render.  Reading the unit of work's `changes`
   * signal re-derives the rows, and re-renders the view, whenever an entity in it changes.
   */
  readonly phoneNumbers = computed(() => {
    this.unitOfWork().changes();
    return [...this.staffingResource().phoneNumbers];
  });

  /** Port of `StaffingResourcePhoneItemViewModel.CanDelete`. */
  canDelete(phoneNumber: PhoneNumber): boolean {
    return (
      !this.readOnly() && !phoneNumber.primary && this.staffingResource().phoneNumbers.length > 1
    );
  }

  /** Port of `StaffingResourcePhoneItemViewModel.CanSetPrimary`. */
  canSetPrimary(phoneNumber: PhoneNumber): boolean {
    return !this.readOnly() && !phoneNumber.primary;
  }

  /** Port of `StaffingResourcePhoneListViewModel.SetPrimary`. */
  setPrimary(phoneNumber: PhoneNumber): void {
    this.staffingResource().setPrimaryPhoneNumber(phoneNumber);
  }

  /** Port of `StaffingResourcePhoneListViewModel.Delete`. */
  delete(phoneNumber: PhoneNumber): void {
    this.staffingResource().deletePhoneNumber(phoneNumber);
  }

  /**
   * Port of `StaffingResourcePhoneListViewModel.Add`.
   *
   * Note the display property: phone number types have no `DisplayName`, so the original selected on
   * `"Name"` here where the address list used `"DisplayName"`.  Breeze's camelCase naming convention
   * turns that into `name` on the client.
   */
  async add(): Promise<void> {
    if (this.readOnly()) {
      return;
    }

    let phoneNumberType: PhoneNumberType;

    try {
      phoneNumberType = await this.dialogs.open<PhoneNumberType>(ItemSelectorComponent, {
        header: 'Add a phone number',
        width: '24rem',
        data: {
          prompt: 'Select type:',
          displayProperty: 'name',
          items: this.unitOfWork().phoneNumberTypes.allInCache('name'),
        },
      });
    } catch (error) {
      if (error instanceof DialogCancelledError) {
        return;
      }
      throw error;
    }

    this.staffingResource().addPhoneNumber(phoneNumberType);
  }
}
