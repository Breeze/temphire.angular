import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ValidationFormsDirectives } from 'ideablade-validation/angular';
import { AutoCompleteModule } from '@openng/optimus-ui/autocomplete';
import { ButtonDirective } from '@openng/optimus-ui/button';
import { InputTextModule } from '@openng/optimus-ui/inputtext';
import { RadioButtonModule } from '@openng/optimus-ui/radiobutton';
import { SelectModule } from '@openng/optimus-ui/select';

import { Address, StaffingResource } from '../../core/model';
import { AddressSuggestion, AddressSuggestionService } from '../../core/services/address-suggestion.service';
import { ResourceMgtUnitOfWork } from '../../core/services/resource-mgt-unit-of-work';
import { FieldErrorsDirective } from '../../core/validation/field-errors.directive';

/** No state: the empty Guid a new address starts with, which the `STATE_REQUIRED` rule refuses. */
const NO_STATE = '00000000-0000-0000-0000-000000000000';

/**
 * One address card: its type as the heading, the address fields, the primary flag and Delete.
 *
 * Port of `ViewModels/StaffingResource/StaffingResourceAddressItemViewModel.cs` and its row in
 * `StaffingResourceAddressListView.xaml`.  The item view model held `EditMode` next to the entity
 * and re-raised `CanDelete` / `CanSetPrimary` from an `EntityPropertyChanged` handler; here the
 * template binds straight to the `Address` entity, `canDelete()` / `canSetPrimary()` are the same two
 * expressions, and the `Dispose` bookkeeping that unhooked the handler is gone.  The original's "Set
 * Primary" button is a radio group across the cards, which is what the mutually exclusive flag is;
 * it stays disabled on the card that is already primary, matching `CanSetPrimary`.
 *
 * New here: Address 1 suggests U.S. addresses as the user types, and picking one fills the card
 * (`suggest`, `fill`).  The original had nothing like it.
 */
@Component({
  selector: 'app-resource-address',
  imports: [
    ValidationFormsDirectives,
    FieldErrorsDirective,
    FormsModule,
    AutoCompleteModule,
    ButtonDirective,
    InputTextModule,
    RadioButtonModule,
    SelectModule,
  ],
  templateUrl: './resource-address.component.html',
  styleUrl: './resource-address.component.css',
})
export class ResourceAddressComponent {
  private readonly addressSuggestions = inject(AddressSuggestionService);

  readonly address = input.required<Address>();
  readonly staffingResource = input.required<StaffingResource>();
  readonly readOnly = input.required<boolean>();
  readonly unitOfWork = input.required<ResourceMgtUnitOfWork>();

  /**
   * The address, read again whenever an entity in the unit of work changes.  The card shows changes
   * made outside it too - another card made primary, Cancel putting the fields back - and with
   * OnPush change detection it repaints only for a signal it reads, so the template reads the
   * address through this.  Never equal: the entity is the same object, changed in place.
   */
  readonly entity = computed(
    () => {
      this.unitOfWork().changes();
      return this.address();
    },
    { equal: () => false },
  );

  /**
   * The states the dropdown offers, ordered by name as `LoadDataAsync` ordered them.  The states
   * were loaded at sign-in (see `EntityManagerProvider`), so they are read from the cache.
   */
  readonly states = computed(() => this.unitOfWork().states.allInCache('name'));

  /** The addresses suggested for what the user typed last into Address 1. */
  readonly suggestions = signal<AddressSuggestion[]>([]);

  /** The credit the suggestions' data asks for, shown under them. */
  readonly attribution = signal('');

  /**
   * Port of `StaffingResourceAddressItemViewModel.CanDelete`, without its "not the primary one, not
   * the last one" condition.  The last address may go too: the user then sees the resource's rule
   * broken, and cannot save until they add one.
   */
  canDelete(): boolean {
    return !this.readOnly();
  }

  /** Port of `StaffingResourceAddressItemViewModel.CanSetPrimary`. */
  canSetPrimary(): boolean {
    return !this.readOnly() && !this.address().primary;
  }

  /** Port of `StaffingResourceAddressListViewModel.SetPrimary`. */
  setPrimary(): void {
    this.staffingResource().setPrimaryAddress(this.address());
  }

  /** Port of `StaffingResourceAddressListViewModel.Delete`. */
  delete(): void {
    this.staffingResource().deleteAddress(this.address());
  }

  /**
   * Asks for addresses that start with `text`.  The autocomplete calls it once the user has typed
   * three characters and paused for 300 ms; the server asks Photon (see `AddressSuggestionService`).
   */
  async suggest(text: string): Promise<void> {
    if (this.readOnly()) {
      return;
    }

    const found = await this.addressSuggestions.suggest(text);
    this.attribution.set(found.attribution);
    this.suggestions.set(found.suggestions);
  }

  /**
   * What the user typed into Address 1.  Picking a suggestion reports the suggestion itself here
   * too, before `fill`: that one is left to `fill`, which writes its first line instead.
   */
  address1Changed(value: string | AddressSuggestion | null): void {
    if (typeof value === 'string' || value === null) {
      this.address().address1 = value ?? '';
    }
  }

  /**
   * Fills the address with the suggestion the user picked: Address 1, City, State and Zipcode, and
   * clears any of them the suggestion doesn't know, rather than keep a value from the address that
   * was there before.  The address rules then show what is missing.  Address 2 (a unit, say) stays.
   */
  fill(suggestion: AddressSuggestion): void {
    const address = this.address();
    address.address1 = suggestion.address1;
    address.city = suggestion.city ?? '';
    address.stateId = this.states().some((s) => s.id === suggestion.stateId) ? suggestion.stateId! : NO_STATE;
    address.zipcode = suggestion.zipcode ?? '';
  }
}
