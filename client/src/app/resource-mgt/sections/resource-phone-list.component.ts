import { Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ValidationService } from 'ideablade-validation';
import { injectErrorVisibility } from 'ideablade-validation/angular';
import { ButtonDirective } from '@openng/optimus-ui/button';
import { MessageModule } from '@openng/optimus-ui/message';

import { PhoneNumberType, StaffingResource } from '../../core/model';
import { AppDialogService } from '../../core/services/dialog.service';
import { ResourceMgtUnitOfWork } from '../../core/services/resource-mgt-unit-of-work';
import { ItemSelectorComponent } from '../item-selector.component';
import { ResourcePhoneComponent } from './resource-phone.component';

/**
 * Port of `ViewModels/StaffingResource/StaffingResourcePhoneListViewModel.cs` +
 * `Views/StaffingResource/StaffingResourcePhoneListView.xaml`.
 *
 * The same shape as the address list: the resource's phone numbers, one card each
 * (`ResourcePhoneComponent`, the port of `StaffingResourcePhoneItemViewModel`), with an Add button
 * above them and the resource's "at least one phone number" rule when it is broken.
 */
@Component({
  selector: 'app-resource-phone-list',
  imports: [ButtonDirective, MessageModule, ResourcePhoneComponent],
  templateUrl: './resource-phone-list.component.html',
  styleUrl: './resource-phone-list.component.css',
})
export class ResourcePhoneListComponent {
  private readonly dialogs = inject(AppDialogService);

  readonly staffingResource = input.required<StaffingResource>();
  readonly readOnly = input.required<boolean>();
  readonly unitOfWork = input.required<ResourceMgtUnitOfWork>();

  /**
   * The cards to show.  Breeze changes `staffingResource.phoneNumbers` in place, which nothing
   * reactive sees, and an add finishes after the type dialog closes - outside any event in this
   * component - so with OnPush change detection the list would not re-render.  Reading the unit of
   * work's `changes` signal re-derives the rows, and re-renders the list, whenever an entity in it
   * changes.
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
