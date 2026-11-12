import { Component, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';

import { Skill } from '../../core/entities/skill';
import { StaffingResource } from '../../core/entities/staffing-resource';

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
 *    with the resource via `expand` in `ResourceMgtUnitOfWork.loadStaffingResource` - so the flag
 *    has no equivalent and is dropped.  `IsEmpty` survives as the placeholder below.
 *  - The view model handled `SavedMessage` purely to re-raise `SkillsSorted` after a save.  Angular
 *    re-evaluates `sortedSkills()` on every change detection pass, so nothing to subscribe to.
 */
@Component({
  selector: 'app-resource-skills',
  imports: [FormsModule, ButtonModule, InputTextModule],
  template: `
    <div class="skills">
      <div class="skills__header">
        <h3 class="temphire-section-heading">Skills:</h3>

        @if (!readOnly()) {
          <p-button
            label="Add"
            icon="pi pi-plus"
            size="small"
            [outlined]="true"
            (onClick)="add()"
          />
        }
      </div>

      @if (!sortedSkills().length) {
        <p class="skills__empty">
          No skills found. Please add a skill by clicking the 'Add' button.
        </p>
      } @else {
        <div class="skills__list">
          @for (skill of sortedSkills(); track skill.id) {
            <div class="skills__row">
              <input
                pInputText
                type="text"
                class="skills__input"
                [(ngModel)]="skill.description"
                [readOnly]="readOnly()"
              />

              <p-button
                label="Delete"
                severity="danger"
                size="small"
                [text]="true"
                [disabled]="readOnly()"
                (onClick)="delete(skill)"
              />
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      .skills {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .skills__header {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }

      .skills__header .temphire-section-heading {
        margin: 0;
      }

      .skills__empty {
        margin: 1rem 0;
        text-align: center;
        color: #666666;
      }

      /* The WrapPanel of the original: rows flow across the pane and wrap when they run out of room. */
      .skills__list {
        display: flex;
        flex-wrap: wrap;
        gap: 0.25rem 1.5rem;
      }

      .skills__row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .skills__input {
        width: 14rem;
      }
    `,
  ],
})
export class ResourceSkillsComponent {
  readonly staffingResource = input.required<StaffingResource>();
  readonly readOnly = input.required<boolean>();

  /**
   * Port of the `SkillsSorted` property.  A skill added by `Add` starts with no description, so the
   * comparison has to tolerate an undefined value - `OrderBy` on a null string was happy to.
   */
  sortedSkills(): Skill[] {
    const skills = this.staffingResource().skills ?? [];

    return [...skills].sort((a, b) => (a.description ?? '').localeCompare(b.description ?? ''));
  }

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
