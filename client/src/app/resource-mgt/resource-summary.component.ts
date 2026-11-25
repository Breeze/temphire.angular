import { Component, computed, inject, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ValidationError } from 'ideablade-validation';
import { DatePickerModule } from '@openng/optimus-ui/datepicker';
import { TextareaModule } from '@openng/optimus-ui/textarea';

import { StaffingResource } from '../core/model';
import { AppDialogService } from '../core/services/dialog.service';
import { ResourceMgtUnitOfWork } from '../core/services/resource-mgt-unit-of-work';
import { ResourceName, ResourceNameEditorComponent } from './resource-name-editor.component';
import { ValidationFormsDirectives, injectErrorVisibility } from 'ideablade-validation/angular';

import { FieldErrorsDirective } from '../core/validation/field-errors.directive';

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
  imports: [ValidationFormsDirectives, FieldErrorsDirective, FormsModule, DatePickerModule, TextareaModule],
  templateUrl: './resource-summary.component.html',
  styleUrl: './resource-summary.component.css',
})
export class ResourceSummaryComponent {
  private readonly dialogs = inject(AppDialogService);

  readonly staffingResource = input.required<StaffingResource>();
  readonly readOnly = input.required<boolean>();
  readonly unitOfWork = input.required<ResourceMgtUnitOfWork>();

  /**
   * The full name, as the name button shows it.  The names are Breeze entity properties, not
   * signals, and a new name is set after the name dialog closes - outside any event in this
   * component - so with OnPush change detection the view would not re-render.  Reading the unit of
   * work's `changes` signal re-derives the name, and re-renders the view, whenever an entity in it
   * changes; the detail sections derive their rows the same way.
   */
  protected readonly fullName = computed(() => {
    this.unitOfWork().changes();
    return this.staffingResource().fullName;
  });

  /** First and last initial, for the avatar; derived like `fullName`. */
  protected readonly initials = computed(() => {
    this.unitOfWork().changes();
    const resource = this.staffingResource();
    return `${resource.firstName?.charAt(0) ?? ''}${resource.lastName?.charAt(0) ?? ''}`.toUpperCase();
  });

  /**
   * The primary address and phone number in the header, derived like `fullName`: an address can be
   * added, deleted or made primary in the contact section, and the header follows at once.
   */
  protected readonly primaryAddress = computed(() => {
    this.unitOfWork().changes();
    return this.staffingResource().primaryAddress;
  });

  protected readonly primaryPhoneNumber = computed(() => {
    this.unitOfWork().changes();
    return this.staffingResource().primaryPhoneNumber;
  });

  /**
   * The messages about the two dates, once each: a rule comparing them (date of birth before hire
   * date, in the server's validation metadata) is about both, so both fields show it as invalid.
   */
  protected datesMessages(errors: readonly ValidationError[]): string[] {
    const about = errors.filter((e) => e.isFor('dateOfBirth') || e.isFor('hireDate'));
    // The same errors the date fields show: on a new resource, not until the user can see them.
    // `shown` makes the template follow the visibility; without one, it returns them all.
    const shown = this.visibility.shown(this.staffingResource(), about);
    return [...new Set(shown.map((e) => e.errorMessage))];
  }

  private readonly visibility = injectErrorVisibility();

  /** Port of `StaffingResourceSummaryViewModel.EditName`. */
  async editName(): Promise<void> {
    if (this.readOnly()) {
      return;
    }

    const resource = this.staffingResource();

    const name = await this.dialogs.open<ResourceName>(ResourceNameEditorComponent, {
      header: 'Edit name',
      width: '26rem',
      data: {
        firstName: resource.firstName ?? '',
        middleName: resource.middleName ?? '',
        lastName: resource.lastName ?? '',
      },
    });
    if (!name) {
      return; // cancelled
    }

    resource.firstName = name.firstName;
    resource.middleName = name.middleName;
    resource.lastName = name.lastName;
  }
}
