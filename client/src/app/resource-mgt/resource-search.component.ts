import {
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TableModule } from 'primeng/table';

import { StaffingResourceListItem } from '../core/projections/staffing-resource-list-item';
import { BusyService } from '../core/services/busy.service';
import { AppErrorHandler } from '../core/services/error-handler.service';
import { UnitOfWork } from '../core/services/unit-of-work';
import { SHARED_UNIT_OF_WORK_KEY, UnitOfWorkManager } from '../core/services/unit-of-work-manager';

/**
 * Port of `ViewModels/StaffingResource/StaffingResourceSearchViewModel.cs` +
 * `Views/StaffingResource/StaffingResourceSearchView.Wpf.xaml`.
 *
 * A search box over a grid of `StaffingResourceListItem` projections.  Two details carried over
 * from the original:
 *
 *  - it queries through the **shared** unit of work (`Guid.Empty`), so it never sees a sandbox's
 *    uncommitted edits;
 *  - it re-runs the search whenever anything is saved anywhere, which is what
 *    `IHandle<SavedMessage>` did.  `UnitOfWork.committed` is the Breeze equivalent of that
 *    Caliburn.Micro event aggregator message.
 */
@Component({
  selector: 'app-resource-search',
  imports: [FormsModule, ButtonModule, InputTextModule, TableModule, ProgressSpinnerModule],
  providers: [BusyService],
  template: `
    <div class="search">
      <div class="search__bar">
        <input
          pInputText
          type="search"
          class="search__text"
          placeholder="Search staffing resources"
          [(ngModel)]="searchText"
          (keydown.enter)="search()"
        />
        <p-button label="Search" [disabled]="!canSearch()" (onClick)="search()" />
        <p-button
          label="Clear"
          severity="secondary"
          [outlined]="true"
          [disabled]="!canClear()"
          (onClick)="clear()"
        />
        @if (busy.isBusy()) {
          <p-progress-spinner
            styleClass="search__spinner"
            strokeWidth="4"
            ariaLabel="Please wait"
          />
        }
      </div>

      <p-table
        [value]="items()"
        [scrollable]="true"
        scrollHeight="14rem"
        selectionMode="single"
        [selection]="selectedItem()"
        (selectionChange)="onSelect($event)"
        dataKey="id"
        styleClass="p-datatable-sm temphire-elevated"
      >
        <ng-template #header>
          <tr>
            <th>Name</th>
            <th>Address 1</th>
            <th>City</th>
            <th>State</th>
            <th>Zipcode</th>
            <th>Phone</th>
          </tr>
        </ng-template>

        <ng-template #body let-item>
          <tr [pSelectableRow]="item">
            <td>{{ item.fullName }}</td>
            <td>{{ item.address1 }}</td>
            <td>{{ item.city }}</td>
            <td>{{ item.state }}</td>
            <td>{{ item.zipcode }}</td>
            <td>{{ item.phoneNumber }}</td>
          </tr>
        </ng-template>

        <ng-template #emptymessage>
          <tr>
            <td colspan="6">No staffing resources matched.</td>
          </tr>
        </ng-template>
      </p-table>
    </div>
  `,
  styles: [
    `
      .search {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .search__bar {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .search__text {
        width: 18rem;
      }

      :host ::ng-deep .search__spinner {
        width: 1.5rem;
        height: 1.5rem;
      }
    `,
  ],
})
export class ResourceSearchComponent implements OnInit, OnDestroy {
  private readonly unitOfWorkManager = inject(UnitOfWorkManager);
  private readonly errorHandler = inject(AppErrorHandler);

  protected readonly busy = inject(BusyService);

  /** Keeps the grid highlight in step with the resource the workspace has open. */
  readonly selectedId = input<string | null>(null);

  readonly selectionChange = output<StaffingResourceListItem | null>();

  readonly items = signal<StaffingResourceListItem[]>([]);

  searchText = '';

  readonly selectedItem = computed(() => {
    const id = this.selectedId();
    return id ? (this.items().find((item) => item.id === id) ?? null) : null;
  });

  private savedSubscription?: Subscription;

  /** Port of `CanSearch` / `CanClear`. */
  canSearch(): boolean {
    return !!this.searchText.trim();
  }

  canClear(): boolean {
    return !!this.searchText.trim();
  }

  ngOnInit(): void {
    // Port of `IHandle<SavedMessage>`: keep the list current no matter who saved.
    // `emitSelection: false` - a save triggered from the workspace re-selects the row itself,
    // and emitting here as well would kick off a second, redundant detail load.
    this.savedSubscription = UnitOfWork.committed.subscribe(
      () => void this.refresh(this.selectedId() ?? undefined, false),
    );

    void this.refresh();
  }

  ngOnDestroy(): void {
    this.savedSubscription?.unsubscribe();
  }

  search(): void {
    void this.refresh();
  }

  /** Port of `StaffingResourceSearchViewModel.Clear`. */
  clear(): void {
    this.searchText = '';
    void this.refresh();
  }

  onSelect(item: StaffingResourceListItem | null): void {
    this.selectionChange.emit(item);
  }

  /**
   * Port of `Search(Guid selection)`, whose last line was
   * `CurrentStaffingResource = Items.FirstOrDefault(r => r.Id == selection) ?? Items.FirstOrDefault();`
   *
   * That fallback matters: it is what makes the workspace open with the first resource already
   * showing, and what re-selects the right row after a save or a delete.  So the selection is
   * always emitted - the requested row if it survived the search, otherwise the first row,
   * otherwise nothing.
   */
  async refresh(selectId?: string, emitSelection = true): Promise<void> {
    try {
      const unitOfWork = this.unitOfWorkManager.get(SHARED_UNIT_OF_WORK_KEY);
      const results = await this.busy.run(unitOfWork.search(this.searchText));

      this.items.set(results);

      if (emitSelection) {
        const target =
          (selectId ? results.find((item) => item.id === selectId) : undefined) ??
          results[0] ??
          null;
        this.selectionChange.emit(target);
      }
    } catch (error) {
      this.errorHandler.show(error);
    }
  }
}
