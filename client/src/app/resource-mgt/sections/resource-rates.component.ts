import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonDirective } from '@openng/optimus-ui/button';
import { InputNumberModule } from '@openng/optimus-ui/inputnumber';

import { Rate, RateType, StaffingResource } from '../../core/model';
import { AppDialogService, DialogCancelledError } from '../../core/services/dialog.service';
import { ResourceMgtUnitOfWork } from '../../core/services/resource-mgt-unit-of-work';
import { ItemSelectorComponent, ItemSelectorData } from '../item-selector.component';
import { BreezeFieldDirective } from '../../core/validation/breeze-field.directive';

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
 *    Breeze has no lazy loading; `ResourceMgtUnitOfWork.loadStaffingResource` pulls the children in
 *    with `expand`, so by the time this component has a resource the rates are already there.  The
 *    flag has no equivalent and is dropped.  `IsEmpty` survives as the placeholder below.
 *  - `Add` fetched the rate types with `RateTypes.AllAsync(...)` before showing the selector.  The
 *    lookup repositories are cache-only (see `Repository.isCached`) and the cache is seeded at
 *    login, so the list is read synchronously with `allInCache`.
 */
@Component({
  selector: 'app-resource-rates',
  imports: [BreezeFieldDirective, FormsModule, CurrencyPipe, ButtonDirective, InputNumberModule],
  template: `
    <div class="rates">
      <div class="rates__header">
        <h3 class="temphire-section-heading">Rates:</h3>

        @if (!readOnly()) {
          <button pButton type="button" size="small" [outlined]="true" (click)="add()">
            <i class="pi pi-plus"></i>
            Add
          </button>
        }
      </div>

      @if (!sortedRates().length) {
        <p class="rates__empty">No rates found. Please add a rate by clicking the 'Add' button.</p>
      } @else {
        <div class="rates__list">
          @for (rate of sortedRates(); track rate.id) {
            <div class="rates__row">
              <span class="rates__type">{{ rate.rateType?.displayName }}</span>

              @if (readOnly()) {
                <span class="rates__amount rates__amount--text">
                  {{ rate.amount | currency: 'USD' : 'symbol' : '1.2-2' }}
                </span>
              } @else {
                <p-inputnumber
                  class="rates__amount"
                  [(ngModel)]="rate.amount"
                  [breezeField]="rate"
                  breezeProperty="amount"
                  #amountField="breezeField"
                  [invalid]="amountField.invalid()"
                  mode="currency"
                  currency="USD"
                  locale="en-US"
                  [minFractionDigits]="2"
                  [maxFractionDigits]="2"
                  inputStyleClass="rates__amount-input"
                />
              }

              <button
                pButton
                type="button"
                severity="danger"
                size="small"
                [text]="true"
                [disabled]="readOnly()"
                (click)="delete(rate)"
              >
                Delete
              </button>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      .rates {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .rates__header {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }

      .rates__header .temphire-section-heading {
        margin: 0;
      }

      .rates__empty {
        margin: 1rem 0;
        text-align: center;
        color: #666666;
      }

      /* The WrapPanel of the original: rows flow across the pane and wrap when they run out of room. */
      .rates__list {
        display: flex;
        flex-wrap: wrap;
        gap: 0.25rem 1.5rem;
      }

      .rates__row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .rates__type {
        min-width: 5rem;
        font-weight: 700;
      }

      .rates__amount {
        width: 8rem;
      }

      .rates__amount--text {
        display: inline-block;
        text-align: right;
      }

      :host ::ng-deep .rates__amount-input {
        width: 8rem;
        text-align: right;
      }
    `,
  ],
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

    try {
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

      this.staffingResource().addRate(rateType);
    } catch (error) {
      // Punch's dialog manager cancelled its task; ours throws - see `AppDialogService`.
      if (!(error instanceof DialogCancelledError)) {
        throw error;
      }
    }
  }

  /** Port of `StaffingResourceRatesViewModel.Delete`. */
  delete(rate: Rate): void {
    if (this.readOnly()) {
      return;
    }

    this.staffingResource().deleteRate(rate);
  }
}
