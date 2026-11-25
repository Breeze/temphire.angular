import { Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ValidationService } from 'ideablade-validation';
import { injectErrorVisibility } from 'ideablade-validation/angular';
import { ButtonDirective } from '@openng/optimus-ui/button';
import { MessageModule } from '@openng/optimus-ui/message';

import { AddressType, StaffingResource } from '../../core/model';
import { AppDialogService } from '../../core/services/dialog.service';
import { ResourceMgtUnitOfWork } from '../../core/services/resource-mgt-unit-of-work';
import { ItemSelectorComponent } from '../item-selector.component';
import { ResourceAddressComponent } from './resource-address.component';

/**
 * Port of `ViewModels/StaffingResource/StaffingResourceAddressListViewModel.cs` +
 * `Views/StaffingResource/StaffingResourceAddressListView.xaml`.
 *
 * The resource's addresses, one card each (`ResourceAddressComponent`, the port of the original's
 * per-row `StaffingResourceAddressItemViewModel`), with an Add button above them and the resource's
 * "at least one address" rule when it is broken.
 *
 * `LoadDataAsync` awaited `States.AllAsync(...)` before starting, so the ComboBox would not bind
 * against an empty ItemsSource.  The states are preloaded into the EntityManager cache (see
 * `EntityManagerProvider`), so the cards read them synchronously from the cached repository.
 */
@Component({
  selector: 'app-resource-address-list',
  imports: [ButtonDirective, MessageModule, ResourceAddressComponent],
  templateUrl: './resource-address-list.component.html',
  styleUrl: './resource-address-list.component.css',
})
export class ResourceAddressListComponent {
  private readonly dialogs = inject(AppDialogService);

  readonly staffingResource = input.required<StaffingResource>();
  readonly readOnly = input.required<boolean>();
  readonly unitOfWork = input.required<ResourceMgtUnitOfWork>();

  /**
   * The cards to show.  Breeze changes `staffingResource.addresses` in place, which nothing reactive
   * sees, and an add finishes after the type dialog closes - outside any event in this component -
   * so with OnPush change detection the list would not re-render.  Reading the unit of work's
   * `changes` signal re-derives the rows, and re-renders the list, whenever an entity in it changes.
   */
  readonly addresses = computed(() => {
    this.unitOfWork().changes();
    return [...this.staffingResource().addresses];
  });

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
