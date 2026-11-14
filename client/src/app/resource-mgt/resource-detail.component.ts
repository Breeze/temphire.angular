import { Component, input, signal } from '@angular/core';
import { TabsModule } from '@openng/optimus-ui/tabs';

import { StaffingResource } from '../core/model';
import { ResourceMgtUnitOfWork } from '../core/services/resource-mgt-unit-of-work';
import { ResourceContactInfoComponent } from './sections/resource-contact-info.component';
import { ResourceRatesComponent } from './sections/resource-rates.component';
import { ResourceSkillsComponent } from './sections/resource-skills.component';
import { ResourceWorkExperienceComponent } from './sections/resource-work-experience.component';
import { ResourceSummaryComponent } from './resource-summary.component';

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
  template: `
    <div class="detail">
      <app-resource-summary [staffingResource]="staffingResource()" [readOnly]="readOnly()" />

      <p-tabs [(value)]="activeTab" class="detail__tabs temphire-card">
        <p-tablist>
          <p-tab value="contact">Contact Information</p-tab>
          <p-tab value="rates">Rates</p-tab>
          <p-tab value="work">Work Experience</p-tab>
          <p-tab value="skills">Skills</p-tab>
        </p-tablist>

        <p-tabpanels>
          <p-tabpanel value="contact">
            <app-resource-contact-info
              [staffingResource]="staffingResource()"
              [readOnly]="readOnly()"
              [unitOfWork]="unitOfWork()"
            />
          </p-tabpanel>

          <!--
            The other three tabs are deferred: each is loaded, as its own chunk, the first time its
            tab is selected, and stays loaded after that.
          -->
          <p-tabpanel value="rates">
            @defer (when activeTab() === 'rates') {
              <app-resource-rates
                [staffingResource]="staffingResource()"
                [readOnly]="readOnly()"
                [unitOfWork]="unitOfWork()"
              />
            }
          </p-tabpanel>

          <p-tabpanel value="work">
            @defer (when activeTab() === 'work') {
              <app-resource-work-experience
                [staffingResource]="staffingResource()"
                [readOnly]="readOnly()"
                [unitOfWork]="unitOfWork()"
              />
            }
          </p-tabpanel>

          <p-tabpanel value="skills">
            @defer (when activeTab() === 'skills') {
              <app-resource-skills
                [staffingResource]="staffingResource()"
                [readOnly]="readOnly()"
                [unitOfWork]="unitOfWork()"
              />
            }
          </p-tabpanel>
        </p-tabpanels>
      </p-tabs>
    </div>
  `,
  styles: [
    `
      .detail {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
      }

      /* The tabs as pills on a tinted strip, the active one raised; the panel below in the card. */
      .detail__tabs {
        display: block;
        overflow: hidden;
      }

      :host ::ng-deep .detail__tabs .p-tablist {
        padding: 0.6rem 0.75rem 0;
        background: linear-gradient(180deg, #f1f6fb, #e8f0f8);
        border-bottom: 1px solid var(--temphire-border);
      }

      :host ::ng-deep .detail__tabs .p-tablist-tab-list {
        gap: 0.35rem;
        background: transparent;
        border: none;
      }

      :host ::ng-deep .detail__tabs .p-tablist-active-bar {
        display: none;
      }

      :host ::ng-deep .detail__tabs .p-tab {
        border: none;
        border-radius: 10px 10px 0 0;
        padding: 0.6rem 1.1rem;
        color: var(--temphire-muted);
        font-weight: 600;
        background: transparent;
        transition:
          background-color 0.15s ease,
          color 0.15s ease;
      }

      :host ::ng-deep .detail__tabs .p-tab:not(.p-tab-active):hover {
        color: var(--temphire-accent);
        background: rgba(255, 255, 255, 0.6);
      }

      :host ::ng-deep .detail__tabs .p-tab.p-tab-active {
        color: var(--temphire-accent);
        background: #ffffff;
        box-shadow: 0 -2px 8px rgba(15, 47, 77, 0.08);
      }

      :host ::ng-deep .detail__tabs .p-tabpanels {
        display: block;
        padding: 1.25rem 1.4rem 1.5rem;
        background: #ffffff;
      }
    `,
  ],
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
}
