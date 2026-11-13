import { Component, input } from '@angular/core';

import { StaffingResource } from '../../core/model';
import { ResourceMgtUnitOfWork } from '../../core/services/resource-mgt-unit-of-work';
import { ResourceAddressListComponent } from './resource-address-list.component';
import { ResourcePhoneListComponent } from './resource-phone-list.component';

/**
 * Port of `ViewModels/StaffingResource/StaffingResourceContactInfoViewModel.cs` +
 * `Views/StaffingResource/StaffingResourceContactInfoView.xaml`.
 *
 * The first detail section (`Index` 0).  It is pure layout: the addresses, then the phone numbers,
 * each under its heading.  The original was a
 * `Conductor<IScreen>.Collection.AllActive` that activated the two child view models and forwarded
 * `Start` / `Stop` to them; here the children are ordinary components and the resource, edit mode
 * and unit of work simply flow down as inputs, so there is no lifecycle to forward.
 *
 * The WPF view put the two lists side by side, in fixed `Auto` columns inside a horizontally
 * scrolling `ScrollViewer`.  Here they are stacked, and within each list the cards flow in a row
 * that wraps (see the two list components): a wide window shows them side by side without a gap
 * between the lists, and a narrow one wraps them instead of scrolling sideways.
 */
@Component({
  selector: 'app-resource-contact-info',
  imports: [ResourceAddressListComponent, ResourcePhoneListComponent],
  template: `
    <div class="contact-info">
      <section>
        <h3 class="temphire-section-heading">Addresses:</h3>
        <app-resource-address-list
          [staffingResource]="staffingResource()"
          [readOnly]="readOnly()"
          [unitOfWork]="unitOfWork()"
        />
      </section>

      <section>
        <h3 class="temphire-section-heading">Phone numbers:</h3>
        <app-resource-phone-list
          [staffingResource]="staffingResource()"
          [readOnly]="readOnly()"
          [unitOfWork]="unitOfWork()"
        />
      </section>
    </div>
  `,
  styles: [
    `
      .contact-info {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
      }
    `,
  ],
})
export class ResourceContactInfoComponent {
  readonly staffingResource = input.required<StaffingResource>();
  readonly readOnly = input.required<boolean>();
  readonly unitOfWork = input.required<ResourceMgtUnitOfWork>();
}
