import { Component, computed, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ValidationService } from 'ideablade-validation';
import { injectErrorVisibility } from 'ideablade-validation/angular';
import { TabsModule } from '@openng/optimus-ui/tabs';

import { StaffingResource } from '../core/model';
import { ResourceMgtUnitOfWork } from '../core/services/resource-mgt-unit-of-work';
import { ResourceContactInfoComponent } from './sections/resource-contact-info.component';
import { ResourceRatesComponent } from './sections/resource-rates.component';
import { ResourceSkillsComponent } from './sections/resource-skills.component';
import { ResourceWorkExperienceComponent } from './sections/resource-work-experience.component';
import { ResourceSummaryComponent } from './resource-summary.component';
import { RESOURCE_TABS, countByTab } from './resource-tabs';

/**
 * Port of `ViewModels/StaffingResource/StaffingResourceDetailViewModel.cs` +
 * `Views/StaffingResource/StaffingResourceDetailView.Wpf.xaml`.
 *
 * The summary header sits above a tab control whose pages are the detail sections.  In the WPF app
 * those sections were discovered through MEF - every `[Export(typeof(IStaffingResourceDetailSection))]`
 * view model was imported with `[ImportMany]` and ordered by its `Index` property, which is why
 * adding a section required no change to the detail screen.  Angular has no equivalent ambient
 * discovery, so the sections are listed here explicitly, in the same order their `Index` values
 * gave them: Contact Information (0), Rates (10), Work Experience (20), Skills (30).
 *
 * The loading and unit-of-work switching that this view model also did now lives one level up in
 * `ResourceMgtComponent`, because that is where the toolbar commands are.
 */
@Component({
  selector: 'app-resource-detail',
  imports: [
    TabsModule,
    ResourceSummaryComponent,
    ResourceContactInfoComponent,
    ResourceRatesComponent,
    ResourceWorkExperienceComponent,
    ResourceSkillsComponent,
  ],
  templateUrl: './resource-detail.component.html',
  styleUrl: './resource-detail.component.css',
})
export class ResourceDetailComponent {
  /**
   * Port of `StaffingResourceDetailViewModel.ActiveSectionIndex`.
   *
   * The WPF conductor kept the selected tab across a `Start(...)` reload, so switching between view
   * and edit mode left you on the section you were looking at.  Holding the tab key in a signal on
   * this component - which is not re-created when the parent reloads the resource - reproduces that.
   */
  readonly activeTab = signal<string>('contact');

  readonly staffingResource = input.required<StaffingResource>();
  readonly readOnly = input.required<boolean>();
  readonly unitOfWork = input.required<ResourceMgtUnitOfWork>();

  readonly tabs = RESOURCE_TABS;

  /**
   * How many errors each tab has to show, so a tab with a problem is marked before the user opens
   * it.  They come from the continuous validation of the route's unit of work, which the Save
   * button and the address and phone lists use too, not from the fields: the deferred tabs have
   * none until they are opened.  Only the errors the screen shows count (`ErrorVisibility`), so
   * a new resource's tabs are not marked until the user breaks a rule or tries to save.
   */
  readonly errorCounts = computed(() => {
    const errors = this.validationResult()?.validationErrors ?? [];
    return countByTab(errors.filter((error) => this.visibility.isShown(error.model, error)));
  });

  private readonly visibility = injectErrorVisibility();
  private readonly validationResult = toSignal(inject(ValidationService).validateEntityStore());
}
