import { Component, computed, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonDirective } from '@openng/optimus-ui/button';
import { InputTextModule } from '@openng/optimus-ui/inputtext';

import { Skill, StaffingResource } from '../../core/model';
import { ResourceMgtUnitOfWork } from '../../core/services/resource-mgt-unit-of-work';
import { ValidationFormsDirectives } from 'ideablade-validation/angular';

import { FieldErrorsDirective } from '../../core/validation/field-errors.directive';

/**
 * Port of `ViewModels/StaffingResource/StaffingResourceSkillsViewModel.cs` +
 * `Views/StaffingResource/StaffingResourceSkillsView.Wpf.xaml`.
 *
 * Section 30 of the detail screen: a flat list of free-text skills, each row a text box plus a
 * Delete button, flowed across the pane by a `WrapPanel` in the original.
 *
 * Differences from the original:
 *
 *  - `IsPending` and its "Loading..." panel reflected DevForce faulting `StaffingResource.Skills`
 *    lazily through a `RelatedEntityList<Skill>`.  Breeze has no lazy loading - the skills arrive
 *    with the resource via `expand` in `StaffingResourceRepository.withId` - so the flag
 *    has no equivalent and is dropped.  `IsEmpty` survives as the placeholder below.
 *  - The view model handled `SavedMessage` purely to re-raise `SkillsSorted` after a save.  Here
 *    `sortedSkills` is a `computed` over the unit of work's `changes` signal, so it re-sorts
 *    whenever a skill changes; there is nothing to subscribe to.
 */
@Component({
  selector: 'app-resource-skills',
  imports: [
    ValidationFormsDirectives,
    FieldErrorsDirective,
    FormsModule,
    ButtonDirective,
    InputTextModule,
  ],
  templateUrl: './resource-skills.component.html',
  styleUrl: './resource-skills.component.css',
})
export class ResourceSkillsComponent {
  readonly staffingResource = input.required<StaffingResource>();
  readonly readOnly = input.required<boolean>();
  readonly unitOfWork = input.required<ResourceMgtUnitOfWork>();

  /**
   * Port of the `SkillsSorted` property.  A skill added by `Add` starts with no description, so the
   * comparison has to tolerate an undefined value - `OrderBy` on a null string was happy to.
   */
  /**
   * The rows to show.  Breeze changes `staffingResource.skills` in place, which nothing reactive sees, and
   * an add finishes after the type dialog closes - outside any event in this component - so with
   * OnPush change detection the view would not re-render.  Reading the unit of work's `changes`
   * signal re-derives the rows, and re-renders the view, whenever an entity in it changes.
   */
  readonly sortedSkills = computed<Skill[]>(() => {
    this.unitOfWork().changes();
    const skills = this.staffingResource().skills ?? [];

    return [...skills].sort((a, b) => (a.description ?? '').localeCompare(b.description ?? ''));
  });

  /** Port of `StaffingResourceSkillsViewModel.Add`. */
  add(): void {
    if (this.readOnly()) {
      return;
    }

    this.staffingResource().addSkill();
  }

  /** Port of `StaffingResourceSkillsViewModel.Delete`. */
  delete(skill: Skill): void {
    if (this.readOnly()) {
      return;
    }

    this.staffingResource().deleteSkill(skill);
  }
}
