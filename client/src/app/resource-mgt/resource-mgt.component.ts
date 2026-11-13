import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';

import { CanComponentDeactivate } from '../app.routes';
import { StaffingResourceListItem } from '../core/projections/staffing-resource-list-item';
import { StaffingResource } from '../core/model';
import { BusyService } from '../core/services/busy.service';
import { AppDialogService, DialogCancelledError } from '../core/services/dialog.service';
import { AppErrorHandler } from '../core/services/error-handler.service';
import { ResourceMgtUnitOfWork } from '../core/services/resource-mgt-unit-of-work';
import { ToolbarGroup, registerToolbarGroup } from '../core/services/toolbar.service';
import { SHARED_UNIT_OF_WORK_KEY, UnitOfWorkManager } from '../core/services/unit-of-work-manager';
import { ResourceDetailComponent } from './resource-detail.component';
import { ResourceNameEditorComponent, ResourceName } from './resource-name-editor.component';
import { ResourceSearchComponent } from './resource-search.component';

import { ProgressSpinnerModule } from '@openng/optimus-ui/progressspinner';

type EditMode = 'view' | 'edit';

/**
 * Port of `ViewModels/StaffingResource/ResourceMgtViewModel.cs` +
 * `Views/StaffingResource/ResourceMgtView.xaml`.
 *
 * This is the workspace: a search pane across the top and the detail of the selected resource
 * underneath, with the Add / Delete / Edit / Save / Cancel / Refresh commands published to the
 * shell toolbar.  It also owns the *unit-of-work switching* that makes TempHire's editing model
 * work:
 *
 *  - browsing uses the shared, read-only unit of work (key `Guid.Empty` in the original);
 *  - `Edit` and `Add` switch to a **sandbox** unit of work keyed on the resource id, so the changes
 *    live in their own EntityManager and `Cancel` can throw them away without touching anything
 *    else on screen.
 *
 * That is `IUnitOfWorkManager<IResourceMgtUnitOfWork>.Get(key)` from the WPF app, unchanged in
 * substance - see `UnitOfWorkManager`.
 *
 * `/resourcemgt?resource=<id>` opens that staffing resource and searches for them by last name;
 * the people Quinn mentions link there.
 */
@Component({
  selector: 'app-resource-mgt',
  imports: [ResourceSearchComponent, ResourceDetailComponent, ProgressSpinnerModule],
  providers: [BusyService],
  templateUrl: './resource-mgt.component.html',
  styleUrl: './resource-mgt.component.css',
})
export class ResourceMgtComponent implements CanComponentDeactivate {
  private readonly unitOfWorkManager = inject(UnitOfWorkManager);
  private readonly dialogs = inject(AppDialogService);
  private readonly errorHandler = inject(AppErrorHandler);
  private readonly router = inject(Router);

  protected readonly busy = inject(BusyService);

  readonly staffingResource = signal<StaffingResource | null>(null);
  readonly staffingResourceId = signal<string | null>(null);
  readonly editMode = signal<EditMode>('view');
  readonly unitOfWork = signal<ResourceMgtUnitOfWork | null>(null);
  readonly selectedId = signal<string | null>(null);

  /**
   * The `resource` query parameter: a staffing resource to open, from a link in Quinn's answers.
   * Bound by the router (`withComponentInputBinding`).
   */
  readonly resource = input<string | undefined>();

  private readonly search = viewChild.required(ResourceSearchComponent);

  readonly isReadOnly = computed(() => this.editMode() === 'view');
  readonly hasResource = computed(() => !!this.staffingResource());

  // ------------------------------------------------------------------------------------------
  // Command availability - one-for-one with the `CanXxx` properties on ResourceMgtViewModel.
  // ------------------------------------------------------------------------------------------

  readonly canAdd = computed(() => !this.hasResource() || this.isReadOnly());
  readonly canDelete = computed(() => this.hasResource() && this.isReadOnly());
  readonly canEdit = computed(() => this.hasResource() && this.isReadOnly());
  readonly canCancel = computed(() => this.hasResource() && !this.isReadOnly());

  // `hasChanges`, `hasValidationErrors` and `changes` are signals on the unit of work (see
  // `UnitOfWork`), so these re-evaluate whenever an entity in the active unit of work changes - an
  // edit, a save, a delete, a new validation error.
  readonly canSave = computed(() => {
    const resource = this.staffingResource();
    const unitOfWork = this.unitOfWork();
    if (!resource || !unitOfWork) {
      return false;
    }

    unitOfWork.changes();
    return (
      unitOfWork.hasChanges() &&
      // The fields with errors are highlighted; Save waits until they are fixed.
      !unitOfWork.hasValidationErrors() &&
      !resource.entityAspect.entityState.isDeleted()
    );
  });

  readonly canRefresh = computed(() => {
    const resource = this.staffingResource();
    this.unitOfWork()?.changes();
    return !!resource && !resource.entityAspect.entityState.isAdded();
  });

  /** Port of the `ToolbarGroup(10)` built in `ResourceMgtViewModel.OnActivate`. */
  private readonly toolbarGroup: ToolbarGroup = {
    level: 10,
    actions: [
      {
        label: 'Add',
        icon: 'pi pi-plus',
        execute: () => void this.add(),
        canExecute: () => this.canAdd(),
      },
      {
        label: 'Delete',
        icon: 'pi pi-trash',
        execute: () => void this.delete(),
        canExecute: () => this.canDelete(),
      },
      {
        label: 'Edit',
        icon: 'pi pi-pencil',
        execute: () => void this.edit(),
        canExecute: () => this.canEdit(),
      },
      {
        label: 'Save',
        icon: 'pi pi-save',
        execute: () => void this.save(),
        canExecute: () => this.canSave(),
      },
      {
        label: 'Cancel',
        icon: 'pi pi-times',
        execute: () => void this.cancel(),
        canExecute: () => this.canCancel(),
      },
      {
        label: 'Refresh',
        icon: 'pi pi-refresh',
        execute: () => void this.refresh(),
        canExecute: () => this.canRefresh(),
      },
    ],
  };

  constructor() {
    // `ResourceMgtViewModel.OnActivate` added its toolbar group and `OnDeactivate` removed it;
    // `registerToolbarGroup` does both, tying the group to this component's lifetime.
    registerToolbarGroup(this.toolbarGroup);

    // Open the resource named in the URL: on arrival, and again whenever a link changes it while
    // this workspace is already open.  An effect, because it starts a load and a navigation rather
    // than deriving state.
    effect(() => {
      const id = this.resource();
      if (id) {
        untracked(() => void this.openFromLink(id));
      }
    });

    // Don't leave an empty sandbox behind in the root-scoped manager.
    inject(DestroyRef).onDestroy(() => {
      const id = this.staffingResourceId();
      if (id) {
        this.unitOfWorkManager.releaseIfClean(id);
      }
    });
  }

  /**
   * Port of `StaffingResourceDetailViewModel.CanClose` + `ResourceMgtViewModel.OnNavigatingFrom`.
   *
   * The WPF app asked before letting you leave a screen with pending edits; wired up through
   * `pendingChangesGuard` on the route so the same prompt appears when the toolbar navigates to
   * another workspace.  Returning false keeps the user where they are.
   */
  async canDeactivate(): Promise<boolean> {
    try {
      await this.confirmDiscardPendingChanges();
      return true;
    } catch (error) {
      if (error instanceof DialogCancelledError) {
        return false;
      }

      this.errorHandler.show(error);
      return false;
    }
  }

  // ------------------------------------------------------------------------------------------
  // Selection
  // ------------------------------------------------------------------------------------------

  /**
   * Port of `OnSelectionChangeElapsed`.  The original debounced the grid's selection with a 200 ms
   * `DispatcherTimer`; Optimus UI raises selection once per click, so the debounce is unnecessary.
   */
  async onSelectionChange(item: StaffingResourceListItem | null): Promise<void> {
    if (!item) {
      return;
    }

    if (this.staffingResourceId() === item.id && this.isReadOnly()) {
      return;
    }

    try {
      await this.confirmDiscardPendingChanges();
    } catch (error) {
      if (error instanceof DialogCancelledError) {
        // Put the grid selection back where it was - `SearchPane.CurrentStaffingResource = null`
        // in the original, which then reselected the active resource.
        this.selectedId.set(this.staffingResourceId());
        return;
      }
      throw error;
    }

    this.selectedId.set(item.id);
    await this.loadDetail(item.id, 'view');
  }

  /**
   * Opens the staffing resource a link points to, and searches for them by last name so the grid
   * shows them selected.  Unsaved edits get the usual save / discard / stay prompt first.
   */
  private async openFromLink(id: string): Promise<void> {
    // Take the parameter off the URL, so that following the same link again later is a new
    // navigation that sets it again.
    void this.router.navigate([], {
      queryParams: { resource: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });

    if (this.staffingResourceId() !== id || !this.isReadOnly()) {
      try {
        await this.confirmDiscardPendingChanges();
      } catch (error) {
        if (!(error instanceof DialogCancelledError)) {
          this.errorHandler.show(error);
        }
        return;
      }

      this.selectedId.set(id);
      await this.loadDetail(id, 'view');
    }

    const resource = this.staffingResource();
    if (resource?.id === id) {
      this.search().searchFor(resource.lastName);
    }
  }

  // ------------------------------------------------------------------------------------------
  // Commands
  // ------------------------------------------------------------------------------------------

  /** Port of `ResourceMgtViewModel.Add`. */
  async add(): Promise<void> {
    let name: ResourceName;

    try {
      name = await this.dialogs.open<ResourceName>(ResourceNameEditorComponent, {
        header: 'Add a staffing resource',
        width: '26rem',
      });
    } catch (error) {
      if (error instanceof DialogCancelledError) {
        return;
      }
      throw error;
    }

    await this.run(async () => {
      // A brand new resource gets its own sandbox from the start, registered under its id once the
      // factory has generated one - exactly what `StaffingResourceDetailViewModel.LoadDataAsync`
      // did with `_unitOfWorkManager.Create()` followed by `Add(staffingResource.Id, ...)`.
      const unitOfWork = this.unitOfWorkManager.create();
      const resource = await unitOfWork.staffingResourceFactory.create({
        firstName: name.firstName,
        middleName: name.middleName,
        lastName: name.lastName,
        summary: '',
      });

      this.unitOfWorkManager.add(resource.id, unitOfWork);
      this.attach(unitOfWork, resource, 'edit');
      this.selectedId.set(null);
    });
  }

  /** Port of `ResourceMgtViewModel.Edit`. */
  async edit(): Promise<void> {
    const id = this.staffingResourceId();
    if (!id) {
      return;
    }

    await this.loadDetail(id, 'edit');
  }

  /** Port of `ResourceMgtViewModel.Save`. */
  async save(): Promise<void> {
    const id = this.staffingResourceId();
    const unitOfWork = this.unitOfWork();
    if (!id || !unitOfWork) {
      return;
    }

    await this.run(async () => {
      // Select the row before saving.  The save reloads the search list (it watches
      // `UnitOfWorkManager.saves`), and the list keeps the selected row selected if it is there -
      // which, for a newly added resource, it only is from this save on.
      this.selectedId.set(id);

      await unitOfWork.commit();
      this.unitOfWorkManager.releaseIfClean(id);

      // The save happened in the *sandbox* manager, so the shared manager still holds whatever it
      // last loaded - including children that were just deleted.  A Breeze query merge never
      // detaches cached entities the server omitted, so re-querying would not remove them; the
      // shared cache has to be dropped and re-seeded.  DevForce's shared EntityManager was
      // refreshed for the same reason.
      this.unitOfWorkManager.get(SHARED_UNIT_OF_WORK_KEY).clear();

      await this.loadDetail(id, 'view');
    });
  }

  /** Port of `ResourceMgtViewModel.Cancel`. */
  async cancel(): Promise<void> {
    const id = this.staffingResourceId();
    const resource = this.staffingResource();
    const unitOfWork = this.unitOfWork();
    if (!id || !resource || !unitOfWork) {
      return;
    }

    // A cancelled *add* has nothing to fall back to, so the screen closes instead.
    const wasAdded = resource.entityAspect.entityState.isAdded();

    unitOfWork.rollback();
    this.unitOfWorkManager.remove(id);

    if (wasAdded) {
      this.clearDetail();
      return;
    }

    await this.loadDetail(id, 'view');
  }

  /** Port of `ResourceMgtViewModel.Delete`. */
  async delete(): Promise<void> {
    const resource = this.staffingResource();
    const unitOfWork = this.unitOfWork();
    const id = this.staffingResourceId();
    if (!resource || !unitOfWork || !id) {
      return;
    }

    try {
      const answer = await this.dialogs.confirmYesNo(
        `Are you sure you want to delete ${resource.fullName}?`,
      );

      if (answer !== 'yes') {
        return;
      }
    } catch (error) {
      if (error instanceof DialogCancelledError) {
        return;
      }
      throw error;
    }

    await this.run(async () => {
      try {
        resource.delete();
        await unitOfWork.commit();
      } catch (error) {
        unitOfWork.rollback();
        throw error;
      }

      this.unitOfWorkManager.remove(id);
      // Same reasoning as in `save()`: drop the shared cache so the deleted graph goes with it.
      this.unitOfWorkManager.get(SHARED_UNIT_OF_WORK_KEY).clear();
      // The save reloads the search list; with nothing selected, it selects the first row.
      this.clearDetail();
    });
  }

  /** Port of `StaffingResourceDetailViewModel.RefreshData`. */
  async refresh(): Promise<void> {
    const id = this.staffingResourceId();
    const unitOfWork = this.unitOfWork();
    if (!id || !unitOfWork) {
      return;
    }

    if (unitOfWork.hasChanges()) {
      try {
        await this.dialogs.confirm(
          'There are unsaved changes. Refreshing the data will discard all unsaved changes.',
        );
      } catch (error) {
        if (error instanceof DialogCancelledError) {
          return;
        }
        throw error;
      }
    }

    await this.run(async () => {
      unitOfWork.clear();
      await this.loadDetail(id, this.editMode());
    });
  }

  // ------------------------------------------------------------------------------------------
  // Internals
  // ------------------------------------------------------------------------------------------

  /**
   * Port of `StaffingResourceDetailViewModel.Start(id, editMode)`.
   *
   * The unit of work is chosen by edit mode - the shared one for viewing, a sandbox keyed on the
   * resource id for editing.
   */
  private async loadDetail(id: string, editMode: EditMode): Promise<void> {
    await this.run(async () => {
      const key = editMode === 'view' ? SHARED_UNIT_OF_WORK_KEY : id;
      const unitOfWork = this.unitOfWorkManager.get(key);
      const resource = await unitOfWork.loadStaffingResource(id);

      if (!resource) {
        this.clearDetail();
        return;
      }

      this.attach(unitOfWork, resource, editMode);
    });
  }

  private attach(
    unitOfWork: ResourceMgtUnitOfWork,
    resource: StaffingResource,
    editMode: EditMode,
  ): void {
    this.unitOfWork.set(unitOfWork);
    this.staffingResource.set(resource);
    this.staffingResourceId.set(resource.id);
    this.editMode.set(editMode);
  }

  private clearDetail(): void {
    this.staffingResource.set(null);
    this.staffingResourceId.set(null);
    this.unitOfWork.set(null);
    this.editMode.set('view');
    this.selectedId.set(null);
  }

  /**
   * Port of `StaffingResourceDetailViewModel.CanClose`: offer to save, discard or stay put when
   * navigating away from a resource with pending edits.
   */
  private async confirmDiscardPendingChanges(): Promise<void> {
    const unitOfWork = this.unitOfWork();
    const id = this.staffingResourceId();

    if (!unitOfWork || !id || !unitOfWork.hasChanges()) {
      return;
    }

    const answer = await this.dialogs.confirmYesNoCancel(
      'There are unsaved changes. Would you like to save your changes?',
    );

    if (answer === 'yes') {
      try {
        await this.busy.run(unitOfWork.commit());
        // The search list reloads itself off `UnitOfWorkManager.saves`; only the shared cache needs
        // dropping so the next view-mode load re-reads the saved graph.
        this.unitOfWorkManager.get(SHARED_UNIT_OF_WORK_KEY).clear();
      } catch (error) {
        // The save failed (most likely validation).  Show why, and keep the user on this resource
        // with their edits intact rather than letting them navigate away and lose them.
        this.errorHandler.show(error);
        throw new DialogCancelledError();
      }
    } else {
      unitOfWork.rollback();
    }

    this.unitOfWorkManager.releaseIfClean(id);
  }

  /** Runs an operation with the busy indicator up, reporting failures through the toast handler. */
  private async run(operation: () => Promise<void>): Promise<void> {
    try {
      await this.busy.run(operation());
    } catch (error) {
      if (!(error instanceof DialogCancelledError)) {
        this.errorHandler.show(error);
      }
    }
  }
}
