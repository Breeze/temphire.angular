import { Component, input } from '@angular/core';

import { StaffingResource } from '../../core/model';
import { ResourceMgtUnitOfWork } from '../../core/services/resource-mgt-unit-of-work';
import { ResourceAddressListComponent } from './resource-address-list.component';
import { ResourcePhoneListComponent } from './resource-phone-list.component';

/**
 * Port of `ViewModels/StaffingResource/StaffingResourceContactInfoViewModel.cs` +
 * `Views/StaffingResource/StaffingResourceContactInfoView.xaml`.
 *
 * The first detail section (`Index` 0).  It is pure layout: a two column grid with the addresses on
 * the left and the phone numbers on the right, each under its heading.  The original was a
 * `Conductor<IScreen>.Collection.AllActive` that activated the two child view models and forwarded
 * `Start` / `Stop` to them; here the children are ordinary components and the resource, edit mode
 * and unit of work simply flow down as inputs, so there is no lifecycle to forward.
 *
 * The WPF grid used fixed `Auto` columns inside a horizontally scrolling `ScrollViewer`; the columns
 * stack on narrow screens instead of scrolling sideways.
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
        flex-wrap: wrap;
        align-items: flex-start;
        gap: 1.25rem 2rem;
      }

      .contact-info > section {
        flex: 1 1 22rem;
        min-width: 0;
      }
    `,
  ],
})
export class ResourceContactInfoComponent {
  readonly staffingResource = input.required<StaffingResource>();
  readonly readOnly = input.required<boolean>();
  readonly unitOfWork = input.required<ResourceMgtUnitOfWork>();
}
