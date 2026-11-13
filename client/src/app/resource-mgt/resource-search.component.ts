import {
  Component,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  output,
  resource,
  signal,
  untracked,
} from '@angular/core';
import { FormField, FormRoot, form } from '@angular/forms/signals';
import { ButtonDirective } from '@openng/optimus-ui/button';
import { InputTextModule } from '@openng/optimus-ui/inputtext';
import { ProgressSpinnerModule } from '@openng/optimus-ui/progressspinner';
import { TableModule } from '@openng/optimus-ui/table';

import { StaffingResourceListItem } from '../core/projections/staffing-resource-list-item';
import { AppErrorHandler } from '../core/services/error-handler.service';
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
 *    `IHandle<SavedMessage>` did.  `UnitOfWorkManager.saves` is the signal equivalent of that
 *    Caliburn.Micro event aggregator message.
 *
 * The list is a `resource()`: its params are the submitted search text and the save counter, so a
 * new search or a save anywhere reloads it, and its `isLoading` / `error` drive the spinner and the
 * error message.  The search box is a Signal Form.
 */
@Component({
  selector: 'app-resource-search',
  imports: [
    FormField,
    FormRoot,
    ButtonDirective,
    InputTextModule,
    TableModule,
    ProgressSpinnerModule,
  ],
  template: `
    <div class="search">
      <form class="search__bar" [formRoot]="searchForm">
        <input
          pInputText
          type="search"
          class="search__text"
          placeholder="Search staffing resources"
          aria-label="Search staffing resources"
          [formField]="searchForm.text"
        />
        <button pButton type="submit" [disabled]="!canSearch()">Search</button>
        <button
          pButton
          type="button"
          severity="secondary"
          [outlined]="true"
          [disabled]="!canClear()"
          (click)="clear()"
        >
          Clear
        </button>
        @if (results.isLoading()) {
          <p-progress-spinner
            styleClass="search__spinner"
            strokeWidth="4"
            ariaLabel="Please wait"
          />
        }
      </form>

      @if (results.error(); as error) {
        <p class="search__error" role="alert">{{ describe(error) }}</p>
      }

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

      .search__error {
        margin: 0;
        color: var(--p-red-600, #dc2626);
      }

      :host ::ng-deep .search__spinner {
        width: 1.5rem;
        height: 1.5rem;
      }
    `,
  ],
})
export class ResourceSearchComponent {
  private readonly unitOfWorkManager = inject(UnitOfWorkManager);

  /** Keeps the grid highlight in step with the resource the workspace has open. */
  readonly selectedId = input<string | null>(null);

  readonly selectionChange = output<StaffingResourceListItem | null>();

  /** The search box.  Submitting it (Enter, or the Search button) runs the search. */
  readonly searchForm = form(signal({ text: '' }), {
    submission: { action: async () => this.search() },
  });

  /** The text of the last search run - the resource's param, as opposed to what is being typed. */
  private readonly query = signal('');

  /**
   * The search results.  Reloads when a search is run and after every save anywhere - port of
   * `IHandle<SavedMessage>` - because both are read in `params`.
   */
  readonly results = resource({
    params: () => ({ searchText: this.query(), saves: this.unitOfWorkManager.saves() }),
    loader: ({ params }) =>
      this.unitOfWorkManager.get(SHARED_UNIT_OF_WORK_KEY).search(params.searchText),
  });

  /**
   * The rows on screen.  A `resource` has no value while it loads new params, so the grid would
   * blank out on every search; `linkedSignal` keeps the previous rows until the new ones arrive.
   */
  readonly items = linkedSignal<StaffingResourceListItem[] | undefined, StaffingResourceListItem[]>(
    {
      source: () => (this.results.hasValue() ? this.results.value() : undefined),
      computation: (rows, previous) => rows ?? previous?.value ?? [],
    },
  );

  readonly selectedItem = computed(() => {
    const id = this.selectedId();
    return id ? (this.items().find((item) => item.id === id) ?? null) : null;
  });

  /** Port of `CanSearch` / `CanClear`. */
  readonly canSearch = computed(() => !!this.searchForm.text().value().trim());
  readonly canClear = this.canSearch;

  constructor() {
    // Port of the last line of `Search(Guid selection)`:
    // `CurrentStaffingResource = Items.FirstOrDefault(r => r.Id == selection) ?? Items.FirstOrDefault()`.
    //
    // When new results arrive and the workspace's resource is not among them, select the first
    // row.  That is what opens the workspace on the first resource, and what moves the selection on
    // after a delete.  If the open resource is in the results, the selection is left alone, so a
    // save - which reloads this list - does not trigger a second detail load.
    //
    // An effect, because this tells the *parent* something (an `output`) in response to data
    // arriving; it does not derive state, so `computed` does not fit.
    effect(() => {
      if (!this.results.hasValue()) {
        return;
      }

      const rows = this.results.value();
      untracked(() => {
        const selectedId = this.selectedId();
        if (!rows.some((row) => row.id === selectedId)) {
          this.selectionChange.emit(rows[0] ?? null);
        }
      });
    });
  }

  /** Runs the search for the text in the box. */
  search(): void {
    const text = this.searchForm.text().value().trim();
    if (text === this.query()) {
      this.results.reload();
    } else {
      this.query.set(text);
    }
  }

  /** Puts `text` in the search box and runs the search, as if the user had typed it. */
  searchFor(text: string): void {
    this.searchForm.text().value.set(text);
    this.search();
  }

  /** Port of `StaffingResourceSearchViewModel.Clear`. */
  clear(): void {
    this.searchForm.text().value.set('');
    this.search();
  }

  onSelect(item: StaffingResourceListItem | null): void {
    this.selectionChange.emit(item);
  }

  protected describe(error: unknown): string {
    return AppErrorHandler.describe(error).detail;
  }
}
