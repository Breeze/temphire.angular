import { Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ValidationService } from 'ideablade-validation';
import { ButtonDirective } from '@openng/optimus-ui/button';
import { InputTextModule } from '@openng/optimus-ui/inputtext';
import { MessageModule } from '@openng/optimus-ui/message';
import { RadioButtonModule } from '@openng/optimus-ui/radiobutton';

import { PhoneNumber, PhoneNumberType, StaffingResource } from '../../core/model';
import { AppDialogService } from '../../core/services/dialog.service';
import { ResourceMgtUnitOfWork } from '../../core/services/resource-mgt-unit-of-work';
import { ItemSelectorComponent } from '../item-selector.component';
import { ValidationFormsDirectives, injectErrorVisibility } from 'ideablade-validation/angular';

import { FieldErrorsDirective } from '../../core/validation/field-errors.directive';

/**
 * Port of `ViewModels/StaffingResource/StaffingResourcePhoneListViewModel.cs` +
 * `StaffingResourcePhoneItemViewModel.cs` + `Views/StaffingResource/StaffingResourcePhoneListView.xaml`.
 *
 * The same shape as the address list, one card per phone number: type, area code, number, and the
 * primary / delete actions.  As with the addresses, the per-row
 * `StaffingResourcePhoneItemViewModel` has no counterpart here - it only carried `EditMode` next to
 * the entity and re-raised `CanDelete` / `CanSetPrimary` when `Primary` changed, both of which fall
 * out of binding the entity directly - and the original's "Set Primary" button per row is a radio
 * group, which is what the mutually exclusive flag really is.
 */
@Component({
  selector: 'app-resource-phone-list',
  imports: [
    ValidationFormsDirectives,
    FieldErrorsDirective,
    FormsModule,
    ButtonDirective,
    InputTextModule,
    MessageModule,
    RadioButtonModule,
  ],
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

      @for (error of ruleErrors(); track error.key) {
        <p-message severity="error" size="small">{{ error.errorMessage }}</p-message>
      }

      <div class="phones__cards">
        @for (phoneNumber of phoneNumbers(); track phoneNumber.id) {
          <div class="phone temphire-elevated" ngForm [validationModel]="phoneNumber">
            <span class="phone__type">{{ phoneNumber.phoneNumberType?.name }}</span>

            <input
              pInputText
              class="phone__area-code"
              aria-label="Area code"
              name="areaCode"
              [readOnly]="readOnly()"
              [(ngModel)]="phoneNumber.areaCode"
              #areaCode="fieldErrors"
              [invalid]="areaCode.invalid()"
            />

            <input
              pInputText
              class="phone__number"
              aria-label="Number"
              name="number"
              [readOnly]="readOnly()"
              [(ngModel)]="phoneNumber.number"
              #number="fieldErrors"
              [invalid]="number.invalid()"
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

      /* Like the address cards: a row that wraps when it is full. */
      .phones__cards {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem 0.75rem;
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

  /**
   * The resource's "at least one phone number" rule, when it is broken; see the address list.
   */
  readonly ruleErrors = computed(() => {
    const resource = this.staffingResource();
    const errors = (this.validationResult()?.validationErrors ?? []).filter(
      (error) => error.model === resource && error.id === 'PHONE_NUMBER_REQUIRED',
    );
    // On a new resource, the rule is broken from the start: it shows once the user breaks it again
    // (deletes the last one) or tries to save.  See `ErrorVisibility`.
    // `shown` follows the visibility (a save attempt, say); without one, it returns them all.
    return this.visibility.shown(resource, errors);
  });

  private readonly visibility = injectErrorVisibility();

  private readonly validationResult = toSignal(inject(ValidationService).validateEntityStore());

  /**
   * Port of `StaffingResourcePhoneItemViewModel.CanDelete`, without its "not the primary one, not
   * the last one" condition, as in the address list.
   */
  canDelete(_phoneNumber: PhoneNumber): boolean {
    return !this.readOnly();
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

    const phoneNumberType = await this.dialogs.open<PhoneNumberType>(ItemSelectorComponent, {
      header: 'Add a phone number',
      width: '24rem',
      data: {
        prompt: 'Select type:',
        displayProperty: 'name',
        items: this.unitOfWork().phoneNumberTypes.allInCache('name'),
      },
    });
    if (!phoneNumberType) {
      return; // cancelled
    }

    this.staffingResource().addPhoneNumber(phoneNumberType);
  }
}
