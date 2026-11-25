import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonDirective } from '@openng/optimus-ui/button';
import { InputNumberModule } from '@openng/optimus-ui/inputnumber';

import { Rate, RateType, StaffingResource } from '../../core/model';
import { AppDialogService } from '../../core/services/dialog.service';
import { ResourceMgtUnitOfWork } from '../../core/services/resource-mgt-unit-of-work';
import { ItemSelectorComponent, ItemSelectorData } from '../item-selector.component';
import { ValidationFormsDirectives } from 'ideablade-validation/angular';

import { FieldErrorsDirective } from '../../core/validation/field-errors.directive';

/**
 * Port of `ViewModels/StaffingResource/StaffingResourceRatesViewModel.cs` +
 * `Views/StaffingResource/StaffingResourceRatesView.Wpf.xaml`.
 *
 * Section 10 of the detail screen: the resource's rate card, one row per rate type, laid out by the
 * original in a `WrapPanel` so the (short) list flowed across the pane.  The CSS grid below is the
 * same idea.
 *
 * Two things changed in the conversion:
 *
 *  - The original's `IsPending` flag - and the "Loading..." panel it drove - existed because
 *    DevForce faulted `StaffingResource.Rates` in lazily through a `RelatedEntityList<Rate>`.
 *    Breeze has no lazy loading; `StaffingResourceRepository.withId` pulls the children in
 *    with `expand`, so by the time this component has a resource the rates are already there.  The
 *    flag has no equivalent and is dropped.  `IsEmpty` survives as the placeholder below.
 *  - `Add` fetched the rate types with `RateTypes.AllAsync(...)` before showing the selector.  The
 *    lookup repositories are cache-only (see `Repository.isCached`) and the cache is seeded at
 *    login, so the list is read synchronously with `allInCache`.
 */
@Component({
  selector: 'app-resource-rates',
  imports: [
    ValidationFormsDirectives,
    FieldErrorsDirective,
    FormsModule,
    CurrencyPipe,
    ButtonDirective,
    InputNumberModule,
  ],
  templateUrl: './resource-rates.component.html',
  styleUrl: './resource-rates.component.css',
})
export class ResourceRatesComponent {
  private readonly dialogs = inject(AppDialogService);

  readonly staffingResource = input.required<StaffingResource>();
  readonly readOnly = input.required<boolean>();
  readonly unitOfWork = input.required<ResourceMgtUnitOfWork>();

  /**
   * Port of the `RatesSorted` property.  Breeze navigation collections come back in whatever order
   * the server sent them, so the sort has to happen here just as it did in the view model.
   */
  /**
   * The rows to show.  Breeze changes `staffingResource.rates` in place, which nothing reactive sees, and
   * an add finishes after the type dialog closes - outside any event in this component - so with
   * OnPush change detection the view would not re-render.  Reading the unit of work's `changes`
   * signal re-derives the rows, and re-renders the view, whenever an entity in it changes.
   */
  readonly sortedRates = computed<Rate[]>(() => {
    this.unitOfWork().changes();
    const rates = this.staffingResource().rates ?? [];

    return [...rates].sort((a, b) => (a.rateType?.sequence ?? 0) - (b.rateType?.sequence ?? 0));
  });

  /** Port of `StaffingResourceRatesViewModel.Add`. */
  async add(): Promise<void> {
    if (this.readOnly()) {
      return;
    }

    // Cache-only lookup, so no await: see the class comment.
    const items = this.unitOfWork().rateTypes.allInCache('displayName');

    const rateType = await this.dialogs.open<RateType>(ItemSelectorComponent, {
      header: 'Add a rate',
      width: '24rem',
      data: {
        prompt: 'Select type:',
        // camelCase on the client - Breeze is configured with NamingConvention.camelCase, so the
        // original's "DisplayName" is "displayName" here.
        displayProperty: 'displayName',
        items,
      } satisfies ItemSelectorData<RateType>,
    });
    if (!rateType) {
      return; // cancelled
    }

    this.staffingResource().addRate(rateType);
  }

  /** Port of `StaffingResourceRatesViewModel.Delete`. */
  delete(rate: Rate): void {
    if (this.readOnly()) {
      return;
    }

    this.staffingResource().deleteRate(rate);
  }
}
