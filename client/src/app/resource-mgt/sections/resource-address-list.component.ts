import { Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ValidationService } from '@ideablade/validation';
import { ButtonDirective } from '@openng/optimus-ui/button';
import { InputTextModule } from '@openng/optimus-ui/inputtext';
import { MessageModule } from '@openng/optimus-ui/message';
import { RadioButtonModule } from '@openng/optimus-ui/radiobutton';
import { SelectModule } from '@openng/optimus-ui/select';

import { Address, AddressType, StaffingResource } from '../../core/model';
import { AppDialogService } from '../../core/services/dialog.service';
import { ResourceMgtUnitOfWork } from '../../core/services/resource-mgt-unit-of-work';
import { ItemSelectorComponent } from '../item-selector.component';
import { ValidationFormsDirectives, injectErrorVisibility } from '@ideablade/validation/angular';

import { FieldErrorsDirective } from '../../core/validation/field-errors.directive';

/**
 * Port of `ViewModels/StaffingResource/StaffingResourceAddressListViewModel.cs` +
 * `StaffingResourceAddressItemViewModel.cs` + `Views/StaffingResource/StaffingResourceAddressListView.xaml`.
 *
 * One editable block per address, with the address type as its heading, and an Add button above the
 * list.  Three things genuinely changed in the conversion:
 *
 *  - The per-row `StaffingResourceAddressItemViewModel` is gone.  It existed only to hold `EditMode`
 *    alongside the entity and to re-raise `CanDelete` / `CanSetPrimary` from an
 *    `EntityPropertyChanged` handler; here the template binds straight to the `Address` entity and
 *    `canDelete()` / `canSetPrimary()` below are the same two expressions, re-evaluated by change
 *    detection.  That also removes the `Dispose`/`ClearAddresses` bookkeeping the original needed to
 *    unhook those handlers.
 *  - The original's "Set Primary" button per row is a radio group here, which is what the mutually
 *    exclusive flag actually is.  It stays disabled on the row that is already primary, matching
 *    `CanSetPrimary`.
 *  - `LoadDataAsync` awaited `States.AllAsync(...)` before starting, so the ComboBox would not bind
 *    against an empty ItemsSource.  The states are preloaded into the EntityManager cache (see
 *    `EntityManagerProvider`), so they can be read synchronously from the cached repository.
 */
@Component({
  selector: 'app-resource-address-list',
  imports: [
    ValidationFormsDirectives,
    FieldErrorsDirective,
    FormsModule,
    ButtonDirective,
    InputTextModule,
    MessageModule,
    RadioButtonModule,
    SelectModule,
  ],
  template: `
    <div class="addresses">
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

      <div class="addresses__cards">
        @for (address of addresses(); track address.id) {
          <div class="address temphire-elevated">
            <div class="address__header">{{ address.addressType?.displayName }}</div>

            <div class="address__body">
              <div class="address__fields" ngForm [validationModel]="address">
                <label [for]="'address1-' + address.id">Address 1:</label>
                <input
                  pInputText
                  [id]="'address1-' + address.id"
                  name="address1"
                  [readOnly]="readOnly()"
                  [(ngModel)]="address.address1"
                  #address1="fieldErrors"
                  [invalid]="address1.invalid()"
                />

                <label [for]="'address2-' + address.id">Address 2:</label>
                <input
                  pInputText
                  [id]="'address2-' + address.id"
                  name="address2"
                  [readOnly]="readOnly()"
                  [(ngModel)]="address.address2"
                  #address2="fieldErrors"
                  [invalid]="address2.invalid()"
                />

                <label [for]="'city-' + address.id">City:</label>
                <input
                  pInputText
                  [id]="'city-' + address.id"
                  name="city"
                  [readOnly]="readOnly()"
                  [(ngModel)]="address.city"
                  #city="fieldErrors"
                  [invalid]="city.invalid()"
                />

                <label [for]="'state-' + address.id">State:</label>
                <p-select
                  [inputId]="'state-' + address.id"
                  [options]="states()"
                  optionValue="id"
                  optionLabel="name"
                  name="stateId"
                  [disabled]="readOnly()"
                  [(ngModel)]="address.stateId"
                  #stateId="fieldErrors"
                  [invalid]="stateId.invalid()"
                  appendTo="body"
                  styleClass="address__state"
                />

                <label [for]="'zipcode-' + address.id">Zipcode:</label>
                <input
                  pInputText
                  class="address__zipcode"
                  [id]="'zipcode-' + address.id"
                  name="zipcode"
                  [readOnly]="readOnly()"
                  [(ngModel)]="address.zipcode"
                  #zipcode="fieldErrors"
                  [invalid]="zipcode.invalid()"
                />
              </div>

              <div class="address__actions">
                <div class="address__primary">
                  <p-radiobutton
                    name="primary-address"
                    [inputId]="'primary-' + address.id"
                    [value]="address.id"
                    [ngModel]="staffingResource().primaryAddress?.id"
                    [disabled]="!canSetPrimary(address)"
                    (ngModelChange)="setPrimary(address)"
                  />
                  <label [for]="'primary-' + address.id">Primary</label>
                </div>

                <button
                  pButton
                  type="button"
                  severity="danger"
                  size="small"
                  [outlined]="true"
                  [disabled]="!canDelete(address)"
                  (click)="delete(address)"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .addresses {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 0.75rem;
      }

      /* The cards flow in a row and wrap when the row is full.  They all have the same content
         width (same labels, same field widths), so they line up as equals. */
      .addresses__cards {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
      }

      .address {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        padding: 0.75rem;
        border: 1px solid var(--p-content-border-color, #e5e7eb);
        border-radius: 4px;
      }

      .address__header {
        font-weight: 700;
      }

      /* The header is outside this wrapping row, so its length does not change the card's width. */
      .address__body {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem 1.5rem;
        align-items: flex-start;
      }

      .address__fields {
        display: grid;
        grid-template-columns: auto minmax(12rem, 18rem);
        align-items: center;
        gap: 0.35rem 0.75rem;
      }

      .address__fields input {
        width: 100%;
      }

      .address__zipcode {
        max-width: 8rem;
      }

      :host ::ng-deep .address__state {
        width: 100%;
      }

      .address__actions {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        align-items: flex-start;
        justify-content: center;
      }

      .address__primary {
        display: flex;
        align-items: center;
        gap: 0.4rem;
      }
    `,
  ],
})
export class ResourceAddressListComponent {
  private readonly dialogs = inject(AppDialogService);

  readonly staffingResource = input.required<StaffingResource>();
  readonly readOnly = input.required<boolean>();
  readonly unitOfWork = input.required<ResourceMgtUnitOfWork>();

  /**
   * The states the dropdown offers, ordered by name as `LoadDataAsync` ordered them.  Computed so
   * the cache query runs once per unit of work rather than on every change detection pass.
   */
  /**
   * The rows to show.  Breeze changes `staffingResource.addresses` in place, which nothing reactive sees, and
   * an add finishes after the type dialog closes - outside any event in this component - so with
   * OnPush change detection the view would not re-render.  Reading the unit of work's `changes`
   * signal re-derives the rows, and re-renders the view, whenever an entity in it changes.
   */
  readonly addresses = computed(() => {
    this.unitOfWork().changes();
    return [...this.staffingResource().addresses];
  });

  readonly states = computed(() => this.unitOfWork().states.allInCache('name'));

  /**
   * The resource's "at least one address" rule, when it is broken.  It is a rule of the validation
   * metadata about the whole resource, so no field shows it.  It comes from the continuous
   * validation of the route's unit of work, which the Save button reacts to too
   * (`ResourceMgtComponent`): the route's validation service shares it.
   */
  readonly ruleErrors = computed(() => {
    const resource = this.staffingResource();
    const errors = (this.validationResult()?.validationErrors ?? []).filter(
      (error) => error.model === resource && error.id === 'ADDRESS_REQUIRED',
    );
    // On a new resource, the rule is broken from the start: it shows once the user breaks it again
    // (deletes the last one) or tries to save.  See `ErrorVisibility`.
    // `shown` follows the visibility (a save attempt, say); without one, it returns them all.
    return this.visibility.shown(resource, errors);
  });

  private readonly visibility = injectErrorVisibility();

  private readonly validationResult = toSignal(inject(ValidationService).validateEntityStore());

  /**
   * Port of `StaffingResourceAddressItemViewModel.CanDelete`, without its "not the primary one, not
   * the last one" condition.  The last address may go too: the user then sees the resource's rule
   * broken, and cannot save until they add one.
   */
  canDelete(_address: Address): boolean {
    return !this.readOnly();
  }

  /** Port of `StaffingResourceAddressItemViewModel.CanSetPrimary`. */
  canSetPrimary(address: Address): boolean {
    return !this.readOnly() && !address.primary;
  }

  /** Port of `StaffingResourceAddressListViewModel.SetPrimary`. */
  setPrimary(address: Address): void {
    this.staffingResource().setPrimaryAddress(address);
  }

  /** Port of `StaffingResourceAddressListViewModel.Delete`. */
  delete(address: Address): void {
    this.staffingResource().deleteAddress(address);
  }

  /**
   * Port of `StaffingResourceAddressListViewModel.Add`: pick a type, then create the address.
   *
   * The original passed the address types to `ItemSelectorViewModel.Start` as a query callback; the
   * dialog here takes the already-cached entities.  Cancelling returns no type, and the add is
   * abandoned.
   */
  async add(): Promise<void> {
    if (this.readOnly()) {
      return;
    }

    const addressType = await this.dialogs.open<AddressType>(ItemSelectorComponent, {
      header: 'Add an address',
      width: '24rem',
      data: {
        prompt: 'Select type:',
        displayProperty: 'displayName',
        items: this.unitOfWork().addressTypes.allInCache('displayName'),
      },
    });
    if (!addressType) {
      return; // cancelled
    }

    this.staffingResource().addAddress(addressType);
  }
}
