import {
  Component,
  Injector,
  afterNextRender,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  output,
  resource,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { FormField, FormRoot, form } from '@angular/forms/signals';
import { ButtonDirective } from '@openng/optimus-ui/button';
import { IconField } from '@openng/optimus-ui/iconfield';
import { TimesIcon } from '@openng/optimus-ui/icons/times';
import { InputIcon } from '@openng/optimus-ui/inputicon';
import { InputTextModule } from '@openng/optimus-ui/inputtext';
import { ProgressSpinnerModule } from '@openng/optimus-ui/progressspinner';
import { TableModule } from '@openng/optimus-ui/table';

import { StaffingResourceListItem } from '../core/projections/staffing-resource-list-item';
import { AppErrorHandler } from '../core/services/error-handler.service';
import { EventAggregator } from '../core/services/event-aggregator';
import { ResourceMgtUnitOfWorkManager } from '../core/services/resource-mgt-unit-of-work-manager';
import { SHARED_UNIT_OF_WORK_KEY } from '../core/services/unit-of-work-manager';

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
 *    `IHandle<SavedMessage>` did.  `EventAggregator.lastSave` is the signal equivalent of that
 *    Caliburn.Micro event aggregator message.
 *
 * The list is a `resource()`: its params are the submitted search text and the latest save, so a
 * new search or a save anywhere reloads it, and its `isLoading` / `error` drive the spinner and the
 * error message.  The search box is a Signal Form.
 */
@Component({
  selector: 'app-resource-search',
  imports: [
    FormField,
    FormRoot,
    ButtonDirective,
    IconField,
    InputIcon,
    TimesIcon,
    InputTextModule,
    TableModule,
    ProgressSpinnerModule,
  ],
  template: `
    <div class="search">
      <form class="search__bar" [formRoot]="searchForm">
        <!-- The box draws its own X rather than the browser's, so it looks the same in every
             browser (Firefox draws none), as in the React client. -->
        <p-iconfield iconPosition="right" class="search__field">
          <input
            #box
            pInputText
            type="search"
            class="search__text"
            placeholder="Search staffing resources"
            aria-label="Search staffing resources"
            [formField]="searchForm.text"
            (input)="onInput($event)"
          />
          @if (searchForm.text().value()) {
            <p-inputicon>
              <button
                type="button"
                class="search__clear"
                aria-label="Clear search"
                (click)="clearBox()"
              >
                <svg data-p-icon="times"></svg>
              </button>
            </p-inputicon>
          }
        </p-iconfield>
        <button pButton type="submit">Search</button>
        @if (results.isLoading()) {
          <p-progress-spinner
            class="search__spinner"
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
        [selection]="tableSelection()"
        (selectionChange)="onSelect($event)"
        dataKey="id"
        class="p-datatable-sm search__table"
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

      .search__field {
        width: 18rem;
      }

      .search__text {
        width: 100%;
      }

      /* The browser's own X: the box has its own (search__clear). */
      .search__text::-webkit-search-cancel-button {
        appearance: none;
      }

      /* Optimus UI places an input icon for a bare 16px icon: a fixed -8px margin to centre it, and
         12px from the edge.  The X sits in a button with padding, so centre it by its own height,
         and move it closer to the edge so the X itself ends up about 10px in. */
      .search__field p-inputicon {
        margin-top: 0;
        transform: translateY(-50%);
        right: 0.375rem;
      }

      .search__clear {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0.25rem;
        border: 0;
        border-radius: 50%;
        background: transparent;
        color: var(--p-inputtext-placeholder-color, #64748b);
        cursor: pointer;
      }

      .search__clear:hover,
      .search__clear:focus-visible {
        background: var(--p-content-hover-background, #f1f5f9);
        color: var(--p-inputtext-color, #334155);
      }

      .search__error {
        margin: 0;
        color: var(--p-red-600, #dc2626);
      }

      /* The grid: a tinted header, rounded, a soft hover and a clear selected row. */
      :host ::ng-deep .search__table {
        border: 1px solid var(--temphire-border);
        border-radius: var(--temphire-radius);
        overflow: hidden;
      }

      :host ::ng-deep .search__table .p-datatable-thead > tr > th {
        background: linear-gradient(180deg, #f4f8fc, #e9f1f9);
        color: var(--temphire-accent);
        font-size: 0.75rem;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        border-color: var(--temphire-border);
      }

      :host ::ng-deep .search__table .p-datatable-tbody > tr {
        transition: background-color 0.15s ease;
      }

      :host ::ng-deep .search__table .p-datatable-tbody > tr > td {
        border-color: rgba(29, 83, 128, 0.06);
      }

      :host ::ng-deep .search__table .p-datatable-tbody > tr:not(.p-datatable-row-selected):hover {
        background: #f2f7fc;
      }

      :host ::ng-deep .search__table .p-datatable-tbody > tr.p-datatable-row-selected {
        background: linear-gradient(90deg, #dcebf8, #eef5fb);
        color: var(--temphire-accent-deep);
        font-weight: 600;
      }

      :host
        ::ng-deep
        .search__table
        .p-datatable-tbody
        > tr.p-datatable-row-selected
        > td:first-child {
        box-shadow: inset 4px 0 0 var(--temphire-accent);
      }

      :host ::ng-deep .search__spinner {
        width: 1.5rem;
        height: 1.5rem;
      }
    `,
  ],
})
export class ResourceSearchComponent {
  private readonly unitOfWorkManager = inject(ResourceMgtUnitOfWorkManager);
  private readonly events = inject(EventAggregator);

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
    params: () => ({ searchText: this.query(), lastSave: this.events.lastSave() }),
    loader: ({ params }) =>
      this.unitOfWorkManager.get(SHARED_UNIT_OF_WORK_KEY).search.simple(params.searchText),
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

  /**
   * What the table shows as selected: the open resource (`selectedItem`), except for the moment
   * after a click, see `onSelect`.
   *
   * The highlight follows the resource the workspace has open, not the last click.  Optimus UI's
   * table moves its own selection on a click, and unselects a row that is clicked again.  Bound
   * straight to `selectedItem()`, the table kept the clicked row highlighted when the workspace
   * refused the change (Cancel in the unsaved-changes prompt): `selectedId` didn't change, so
   * nothing told the table.  Clicking that row again "unselected" it without asking, and clicking
   * the open resource's own row cleared its highlight.
   */
  readonly tableSelection = linkedSignal(() => this.selectedItem());

  private readonly injector = inject(Injector);

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

  private readonly box = viewChild.required<ElementRef<HTMLInputElement>>('box');

  /**
   * The user changed the text.  Emptying the box - Escape, or deleting the text - while a search
   * is filtering the list shows the full list again.
   */
  protected onInput(event: Event): void {
    if (!(event.target as HTMLInputElement).value) {
      this.emptied();
    }
  }

  /** The X in the box: empties it, and keeps the focus there for the next search. */
  protected clearBox(): void {
    this.emptied();
    this.box().nativeElement.focus();
  }

  /**
   * The box was emptied.  If a search was filtering the list, show the full list again.
   *
   * This replaces the original's Clear button.  Its `CanSearch` / `CanClear` both required text in
   * the box, so once the user emptied it after a search, both buttons were disabled and the full
   * list could only come back by typing something and clicking Clear.  Search is now always
   * enabled: an empty search lists everyone.
   */
  private emptied(): void {
    this.searchForm.text().value.set('');
    if (this.query()) {
      this.search();
    }
  }

  /**
   * A click.  The table has already moved its selection: record that (the table ignores the next
   * change of its `selection` input after a click, expecting it to echo the click), then put the
   * open resource back after that render.  If the workspace accepts the change, `selectedId`
   * moves and the highlight with it; if it refuses, nothing more is needed.  A click on the
   * selected row unselects it in the table (`null`): there is nothing to ask the workspace.
   */
  onSelect(item: StaffingResourceListItem | null): void {
    this.tableSelection.set(item);
    afterNextRender(() => this.tableSelection.set(this.selectedItem()), {
      injector: this.injector,
    });
    if (item) {
      this.selectionChange.emit(item);
    }
  }

  protected describe(error: unknown): string {
    return AppErrorHandler.describe(error).detail;
  }
}
