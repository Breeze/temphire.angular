import { Component, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonDirective } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { DividerModule } from 'primeng/divider';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';

import { StaffingResource, WorkExperienceItem } from '../../core/model';

/**
 * Port of `ViewModels/StaffingResource/StaffingResourceWorkExperienceViewModel.cs` +
 * `Views/StaffingResource/StaffingResourceWorkExperienceView.Wpf.xaml`.
 *
 * Section 20 of the detail screen.  The original repeated a five-column `Grid` per item - From / To
 * date pickers, Title, Location, then Company and a 100px multi-line Description underneath, with a
 * Delete button pinned to the right - which is what the block below reproduces.
 *
 * Differences from the original:
 *
 *  - `WorkExperienceSorted` ordered by `From` *ascending*; this lists most recent first, which is
 *    the conventional r&eacute;sum&eacute; order and was agreed for the conversion.
 *  - The view model's `IsPending` flag (and its "Loading..." panel) tracked DevForce's lazily
 *    faulted `RelatedEntityList<WorkExperienceItem>`.  Breeze eager-loads the children via `expand`
 *    in `ResourceMgtUnitOfWork.loadStaffingResource`, so there is nothing to wait for and the flag
 *    is dropped.  `IsEmpty` survives as the placeholder below.
 *  - The original also subscribed to `SavedMessage` to re-sort after a save.  Angular re-renders
 *    from `staffingResource()` on every change detection pass, so no subscription is needed.
 */
@Component({
  selector: 'app-resource-work-experience',
  imports: [
    FormsModule,
    ButtonDirective,
    DatePickerModule,
    DividerModule,
    InputTextModule,
    TextareaModule,
  ],
  template: `
    <div class="work">
      <div class="work__header">
        <h3 class="temphire-section-heading">Work Experience:</h3>

        @if (!readOnly()) {
          <button pButton type="button" size="small" [outlined]="true" (click)="add()">
            <i class="pi pi-plus"></i>
            Add
          </button>
        }
      </div>

      @if (!sortedWorkExperience().length) {
        <p class="work__empty">
          No work experience found. Please add work experience by clicking the 'Add' button.
        </p>
      } @else {
        @for (item of sortedWorkExperience(); track item.id; let last = $last) {
          <div class="work__item">
            <div class="work__row">
              <label class="work__field work__field--date">
                <span class="work__label">From:</span>
                <p-datepicker
                  [(ngModel)]="item.from"
                  [disabled]="readOnly()"
                  [showIcon]="true"
                  appendTo="body"
                  dateFormat="mm/dd/yy"
                  styleClass="work__control"
                />
              </label>

              <label class="work__field work__field--date">
                <span class="work__label">To:</span>
                <p-datepicker
                  [(ngModel)]="item.to"
                  [disabled]="readOnly()"
                  [showIcon]="true"
                  appendTo="body"
                  dateFormat="mm/dd/yy"
                  styleClass="work__control"
                />
              </label>

              <label class="work__field work__field--grow">
                <span class="work__label">Title:</span>
                <input
                  pInputText
                  type="text"
                  [(ngModel)]="item.positionTitle"
                  [readOnly]="readOnly()"
                />
              </label>

              <label class="work__field work__field--location">
                <span class="work__label">Location:</span>
                <input pInputText type="text" [(ngModel)]="item.location" [readOnly]="readOnly()" />
              </label>

              <div class="work__field work__field--action">
                <button
                  pButton
                  type="button"
                  severity="danger"
                  size="small"
                  [text]="true"
                  [disabled]="readOnly()"
                  (click)="delete(item)"
                >
                  Delete
                </button>
              </div>
            </div>

            <label class="work__field">
              <span class="work__label">Company:</span>
              <input pInputText type="text" [(ngModel)]="item.company" [readOnly]="readOnly()" />
            </label>

            <label class="work__field">
              <span class="work__label">Description:</span>
              <textarea
                pTextarea
                rows="4"
                [(ngModel)]="item.description"
                [readOnly]="readOnly()"
              ></textarea>
            </label>

            @if (!last) {
              <p-divider />
            }
          </div>
        }
      }
    </div>
  `,
  styles: [
    `
      .work {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .work__header {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }

      .work__header .temphire-section-heading {
        margin: 0;
      }

      .work__empty {
        margin: 1rem 0;
        text-align: center;
        color: #666666;
      }

      .work__item {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .work__row {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-end;
        gap: 0.5rem;
      }

      .work__field {
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
      }

      .work__field input,
      .work__field textarea {
        width: 100%;
      }

      .work__field--date {
        width: 11rem;
      }

      .work__field--grow {
        flex: 1 1 12rem;
        min-width: 12rem;
      }

      .work__field--location {
        width: 12rem;
      }

      .work__field--action {
        justify-content: flex-end;
      }

      .work__label {
        font-weight: 700;
      }

      :host ::ng-deep .work__control {
        width: 100%;
      }
    `,
  ],
})
export class ResourceWorkExperienceComponent {
  readonly staffingResource = input.required<StaffingResource>();
  readonly readOnly = input.required<boolean>();

  /** The `WorkExperienceSorted` property, flipped to most-recent-first. */
  sortedWorkExperience(): WorkExperienceItem[] {
    const items = this.staffingResource().workExperience ?? [];

    return [...items].sort((a, b) => this.timeOf(b.from) - this.timeOf(a.from));
  }

  /** Port of `StaffingResourceWorkExperienceViewModel.Add`. */
  add(): void {
    if (this.readOnly()) {
      return;
    }

    this.staffingResource().addWorkExperience();
  }

  /** Port of `StaffingResourceWorkExperienceViewModel.Delete`. */
  delete(item: WorkExperienceItem): void {
    if (this.readOnly()) {
      return;
    }

    this.staffingResource().deleteWorkExperience(item);
  }

  /** `from` is non-nullable in the model, but a half-filled new row can still hold nothing yet. */
  private timeOf(value: Date | null | undefined): number {
    return value ? new Date(value).getTime() : 0;
  }
}
