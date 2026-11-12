import { Component, computed, inject, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonDirective } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { RadioButtonModule } from 'primeng/radiobutton';
import { SelectModule } from 'primeng/select';

import { Address, AddressType, StaffingResource } from '../../core/model';
import { AppDialogService, DialogCancelledError } from '../../core/services/dialog.service';
import { ResourceMgtUnitOfWork } from '../../core/services/resource-mgt-unit-of-work';
import { ItemSelectorComponent } from '../item-selector.component';
import { BreezeFieldDirective } from '../../core/validation/breeze-field.directive';

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
    BreezeFieldDirective,
    FormsModule,
    ButtonDirective,
    InputTextModule,
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

      @for (address of addresses(); track address.id) {
        <div class="address temphire-elevated">
          <div class="address__header">{{ address.addressType?.displayName }}</div>

          <div class="address__fields">
            <label [for]="'address1-' + address.id">Address 1:</label>
            <input
              pInputText
              [id]="'address1-' + address.id"
              [readOnly]="readOnly()"
              [(ngModel)]="address.address1"
              [breezeField]="address"
              breezeProperty="address1"
              #address1Field="breezeField"
              [invalid]="address1Field.invalid()"
            />

            <label [for]="'address2-' + address.id">Address 2:</label>
            <input
              pInputText
              [id]="'address2-' + address.id"
              [readOnly]="readOnly()"
              [(ngModel)]="address.address2"
              [breezeField]="address"
              breezeProperty="address2"
              #address2Field="breezeField"
              [invalid]="address2Field.invalid()"
            />

            <label [for]="'city-' + address.id">City:</label>
            <input
              pInputText
              [id]="'city-' + address.id"
              [readOnly]="readOnly()"
              [(ngModel)]="address.city"
              [breezeField]="address"
              breezeProperty="city"
              #cityField="breezeField"
              [invalid]="cityField.invalid()"
            />

            <label [for]="'state-' + address.id">State:</label>
            <p-select
              [inputId]="'state-' + address.id"
              [options]="states()"
              optionValue="id"
              optionLabel="name"
              [disabled]="readOnly()"
              [(ngModel)]="address.stateId"
              [breezeField]="address"
              breezeProperty="stateId"
              #stateIdField="breezeField"
              [invalid]="stateIdField.invalid()"
              appendTo="body"
              styleClass="address__state"
            />

            <label [for]="'zipcode-' + address.id">Zipcode:</label>
            <input
              pInputText
              class="address__zipcode"
              [id]="'zipcode-' + address.id"
              [readOnly]="readOnly()"
              [(ngModel)]="address.zipcode"
              [breezeField]="address"
              breezeProperty="zipcode"
              #zipcodeField="breezeField"
              [invalid]="zipcodeField.invalid()"
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
      }
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

      .address {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem 1.5rem;
        align-items: flex-start;
        padding: 0.75rem;
        border: 1px solid var(--p-content-border-color, #e5e7eb);
        border-radius: 4px;
      }

      .address__header {
        flex-basis: 100%;
        font-weight: 700;
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

  /** Port of `StaffingResourceAddressItemViewModel.CanDelete`. */
  canDelete(address: Address): boolean {
    return !this.readOnly() && !address.primary && this.staffingResource().addresses.length > 1;
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
   * dialog here takes the already-cached entities.  Cancelling throws `DialogCancelledError` where
   * Punch's `ShowDialogAsync` threw `TaskCanceledException`, which is why the add is abandoned in
   * a catch rather than by testing a result.
   */
  async add(): Promise<void> {
    if (this.readOnly()) {
      return;
    }

    let addressType: AddressType;

    try {
      addressType = await this.dialogs.open<AddressType>(ItemSelectorComponent, {
        header: 'Add an address',
        width: '24rem',
        data: {
          prompt: 'Select type:',
          displayProperty: 'displayName',
          items: this.unitOfWork().addressTypes.allInCache('displayName'),
        },
      });
    } catch (error) {
      if (error instanceof DialogCancelledError) {
        return;
      }
      throw error;
    }

    this.staffingResource().addAddress(addressType);
  }
}
