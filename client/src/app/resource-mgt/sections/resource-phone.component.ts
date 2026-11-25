import { Component, computed, inject, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ValidationService } from 'ideablade-validation';
import { ValidationFormsDirectives } from 'ideablade-validation/angular';
import { ButtonDirective } from '@openng/optimus-ui/button';
import { InputTextModule } from '@openng/optimus-ui/inputtext';
import { RadioButtonModule } from '@openng/optimus-ui/radiobutton';

import { PhoneNumber, StaffingResource } from '../../core/model';
import { formatPhoneNumber } from '../../core/model/phone-number';
import { ResourceMgtUnitOfWork } from '../../core/services/resource-mgt-unit-of-work';
import { FieldErrorsDirective } from '../../core/validation/field-errors.directive';

/**
 * One phone number card: its type, the number, the primary flag and Delete.
 *
 * Port of `ViewModels/StaffingResource/StaffingResourcePhoneItemViewModel.cs` and its row in
 * `StaffingResourcePhoneListView.xaml`, the same shape as the address card (see
 * `ResourceAddressComponent`).  The original had the area code in a field of its own; here it is
 * part of the number, which is rewritten as `(206) 555-1234` when the user leaves the field
 * (`formatNumber`).
 */
@Component({
  selector: 'app-resource-phone',
  imports: [ValidationFormsDirectives, FieldErrorsDirective, FormsModule, ButtonDirective, InputTextModule, RadioButtonModule],
  templateUrl: './resource-phone.component.html',
  styleUrl: './resource-phone.component.css',
})
export class ResourcePhoneComponent {
  private readonly validation = inject(ValidationService);

  readonly phoneNumber = input.required<PhoneNumber>();
  readonly staffingResource = input.required<StaffingResource>();
  readonly readOnly = input.required<boolean>();
  readonly unitOfWork = input.required<ResourceMgtUnitOfWork>();

  /**
   * The phone number, read again whenever an entity in the unit of work changes, so the card
   * repaints for changes made outside it too; see `ResourceAddressComponent.entity`.
   */
  readonly entity = computed(
    () => {
      this.unitOfWork().changes();
      return this.phoneNumber();
    },
    { equal: () => false },
  );

  /**
   * Port of `StaffingResourcePhoneItemViewModel.CanDelete`, without its "not the primary one, not
   * the last one" condition, as for the addresses.
   */
  canDelete(): boolean {
    return !this.readOnly();
  }

  /** Port of `StaffingResourcePhoneItemViewModel.CanSetPrimary`. */
  canSetPrimary(): boolean {
    return !this.readOnly() && !this.phoneNumber().primary;
  }

  /** Port of `StaffingResourcePhoneListViewModel.SetPrimary`. */
  setPrimary(): void {
    this.staffingResource().setPrimaryPhoneNumber(this.phoneNumber());
  }

  /** Port of `StaffingResourcePhoneListViewModel.Delete`. */
  delete(): void {
    this.staffingResource().deletePhoneNumber(this.phoneNumber());
  }

  /**
   * Rewrites the number as `(206) 555-1234` when the user leaves the field, if it is valid: if the
   * field's own rules pass, checked now rather than read from the store's validation, which can be
   * a tick behind the last keystroke.  An invalid number stays as typed, for the user to correct.
   */
  formatNumber(): void {
    if (this.readOnly()) {
      return;
    }

    const phoneNumber = this.phoneNumber();
    const errors = this.validation.validateModelSync(phoneNumber, 'PhoneNumber', {
      predicate: (_validator, property) => property?.propertyName === 'number',
    });
    const formatted = errors.length ? undefined : formatPhoneNumber(phoneNumber.number);
    if (formatted && formatted !== phoneNumber.number) {
      phoneNumber.number = formatted;
    }
  }
}
