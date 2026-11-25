import { Component, computed, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonDirective } from '@openng/optimus-ui/button';
import { DatePickerModule } from '@openng/optimus-ui/datepicker';
import { DividerModule } from '@openng/optimus-ui/divider';
import { InputTextModule } from '@openng/optimus-ui/inputtext';
import { TextareaModule } from '@openng/optimus-ui/textarea';

import { StaffingResource, WorkExperienceItem } from '../../core/model';
import { ResourceMgtUnitOfWork } from '../../core/services/resource-mgt-unit-of-work';
import { ValidationFormsDirectives } from 'ideablade-validation/angular';

import { FieldErrorsDirective } from '../../core/validation/field-errors.directive';

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
 *    in `StaffingResourceRepository.withId`, so there is nothing to wait for and the flag
 *    is dropped.  `IsEmpty` survives as the placeholder below.
 *  - The original also subscribed to `SavedMessage` to re-sort after a save.  Here
 *    `sortedWorkExperience` is a `computed` over the unit of work's `changes` signal, so it re-sorts
 *    whenever an item changes; no subscription is needed.
 */
@Component({
  selector: 'app-resource-work-experience',
  imports: [
    ValidationFormsDirectives,
    FieldErrorsDirective,
    FormsModule,
    ButtonDirective,
    DatePickerModule,
    DividerModule,
    InputTextModule,
    TextareaModule,
  ],
  templateUrl: './resource-work-experience.component.html',
  styleUrl: './resource-work-experience.component.css',
})
export class ResourceWorkExperienceComponent {
  readonly staffingResource = input.required<StaffingResource>();
  readonly readOnly = input.required<boolean>();
  readonly unitOfWork = input.required<ResourceMgtUnitOfWork>();

  /** The `WorkExperienceSorted` property, flipped to most-recent-first. */
  /**
   * The rows to show.  Breeze changes `staffingResource.workExperience` in place, which nothing reactive sees, and
   * an add finishes after the type dialog closes - outside any event in this component - so with
   * OnPush change detection the view would not re-render.  Reading the unit of work's `changes`
   * signal re-derives the rows, and re-renders the view, whenever an entity in it changes.
   */
  readonly sortedWorkExperience = computed<WorkExperienceItem[]>(() => {
    this.unitOfWork().changes();
    const items = this.staffingResource().workExperience ?? [];

    return [...items].sort((a, b) => this.timeOf(b.from) - this.timeOf(a.from));
  });

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
