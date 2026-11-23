import {
  Component,
  ErrorHandler,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { ErrorVisibility, ValidationService } from '@ideablade/validation';
import { provideErrorVisibility, provideValidationScope } from '@ideablade/validation/angular';
import { breezeIsNew } from '@ideablade/validation/breeze';

import { CanComponentDeactivate } from '../app.routes';
import { StaffingResourceListItem } from '../core/projections/staffing-resource-list-item';
import { StaffingResource } from '../core/model';
import { BusyService } from '../core/services/busy.service';
import { AuthService } from '../core/services/auth.service';
import { AppDialogService } from '../core/services/dialog.service';
import { ResourceMgtUnitOfWork } from '../core/services/resource-mgt-unit-of-work';
import { SaveHandler, type SaveOptions } from '../core/services/save-handler';
import { ToolbarGroup, registerToolbarGroup } from '../core/services/toolbar.service';
import { ResourceMgtUnitOfWorkManager } from '../core/services/resource-mgt-unit-of-work-manager';
import { SHARED_UNIT_OF_WORK_KEY } from '../core/services/unit-of-work-manager';
import { ResourceDetailComponent } from './resource-detail.component';
import { ResourceNameEditorComponent, ResourceName } from './resource-name-editor.component';
import { ResourceSearchComponent } from './resource-search.component';
import { describeProblems } from './resource-tabs';

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
 * substance - see `UnitOfWorkManager` and `ResourceMgtUnitOfWorkManager`.
 *
 * `/resourcemgt?resource=<id>` opens that staffing resource and searches for them by last name;
 * the people Quinn mentions link there.
 */
@Component({
  selector: 'app-resource-mgt',
  imports: [ResourceSearchComponent, ResourceDetailComponent, ProgressSpinnerModule],
  // The route's own validation service, for the scope of its unit of work: see the constructor.
  // `ErrorVisibility`: which errors the screen shows, so a new resource is not all red at once.  Only
  // added entities count as new; it also follows the continuous validation of the unit of work, so
  // the resource's own rules (at least one address, one phone number) have a baseline too.
  providers: [
    BusyService,
    provideValidationScope(),
    provideErrorVisibility({ isNew: breezeIsNew, watchEntityStore: true }),
  ],
  templateUrl: './resource-mgt.component.html',
  styleUrl: './resource-mgt.component.css',
})
export class ResourceMgtComponent implements CanComponentDeactivate {
  private readonly unitOfWorkManager = inject(ResourceMgtUnitOfWorkManager);
  private readonly dialogs = inject(AppDialogService);
  /** The app's global handler (`AppErrorHandler`), for the one failure this screen catches: see `confirmDiscardPendingChanges`. */
  private readonly errorHandler = inject(ErrorHandler);
  private readonly router = inject(Router);

  /** Only editors may add, change or delete; readers see the same screens read-only. */
  readonly mayEdit = inject(AuthService).canEditStaffing;

  protected readonly busy = inject(BusyService);

  readonly staffingResource = signal<StaffingResource | null>(null);
  readonly staffingResourceId = signal<string | null>(null);
  readonly editMode = signal<EditMode>('view');
  readonly unitOfWork = signal<ResourceMgtUnitOfWork | null>(null);
  readonly selectedId = signal<string | null>(null);

  /**
   * The route's validation service.  Its entity store is the unit of work being shown, so the
   * forms in the detail sections validate in it: `store(type)` sees that unit of work's entities
   * (the "a resource keeps an address" rule reads them), and the fields re-validate whenever an
   * entity in it changes - in another section, or in code.
   */
  private readonly validation = inject(ValidationService);

  /**
   * The continuous validation of that unit of work: every live entity in it, against every rule -
   * the validation metadata's, sync and async, and Breeze's own (the `breeze` validator) - again
   * whenever an entity in it changes.  It follows the unit of work when the route moves on to
   * another one.  The address and phone lists show the resource's rules from the same validation.
   *
   * Validating the whole unit of work is what keeps a rule about related entities current: "a
   * resource keeps an address" is re-checked when an address is deleted, which Breeze, validating
   * entity by entity, would only do when the resource itself was saved.
   *
   * It runs while subscribed, so the subscription lasts as long as the screen; the screen itself
   * doesn't read the result (Save doesn't wait for it: see `canSave`).
   */
  private readonly continuousValidation = toSignal(this.validation.validateEntityStore());

  /** Which errors the screen shows: see `ErrorVisibility`. */
  private readonly errorVisibility = inject(ErrorVisibility);

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

  readonly canAdd = computed(() => this.mayEdit() && (!this.hasResource() || this.isReadOnly()));
  readonly canDelete = computed(() => this.mayEdit() && this.hasResource() && this.isReadOnly());
  readonly canEdit = computed(() => this.mayEdit() && this.hasResource() && this.isReadOnly());
  readonly canCancel = computed(() => this.hasResource() && !this.isReadOnly());

  // `hasChanges` and `changes` are signals on the unit of work (see `UnitOfWork`), so these
  // re-evaluate whenever an entity in the active unit of work changes - an edit, a save, a delete -
  // and `canSave` whenever its validation has a new result.
  readonly canSave = computed(() => {
    const resource = this.staffingResource();
    const unitOfWork = this.unitOfWork();
    if (!resource || !unitOfWork) {
      return false;
    }

    unitOfWork.changes();
    // Save stays enabled while there are errors, and while the continuous validation is still
    // running after an edit: clicking it validates the data as it is then, async rules included,
    // and shows every error instead of saving (`save()`).  A disabled Save would give no reason
    // for a new resource's errors, which are hidden until the user has seen the field, and waiting
    // for the validation would swallow a click made right after typing.
    return unitOfWork.hasChanges() && !resource.entityAspect.entityState.isDeleted();
  });

  readonly canRefresh = computed(() => {
    const resource = this.staffingResource();
    this.unitOfWork()?.changes();
    return !!resource && !resource.entityAspect.entityState.isAdded();
  });

  /**
   * Port of the `ToolbarGroup(10)` built in `ResourceMgtViewModel.OnActivate`.  A reader gets only
   * Refresh: the editing commands are left out rather than shown disabled, since a reader can never
   * use them.  The roles cannot change while the workspace is open (they come with the sign-in), so
   * the group is built once.
   */
  private readonly toolbarGroup: ToolbarGroup = {
    level: 10,
    actions: [
      ...(this.mayEdit() ? this.editActions() : []),
      {
        label: 'Refresh',
        icon: 'pi pi-refresh',
        execute: () => void this.refresh(),
        canExecute: () => this.canRefresh(),
      },
    ],
  };

  private editActions(): ToolbarGroup['actions'] {
    return [
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
    ];
  }

  constructor() {
    effect(() => this.validation.setEntityStore(this.unitOfWork()?.entityStore));

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
  }

  /**
   * Port of `StaffingResourceDetailViewModel.CanClose` + `ResourceMgtViewModel.OnNavigatingFrom`.
   *
   * The WPF app asked before letting you leave a screen with pending edits; wired up through
   * `pendingChangesGuard` on the route so the same prompt appears when the toolbar navigates to
   * another workspace.  Returning false keeps the user where they are.
   */
  canDeactivate(): Promise<boolean> {
    return this.confirmDiscardPendingChanges();
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

    if (!(await this.confirmDiscardPendingChanges())) {
      // Stay.  The grid keeps its highlight on `selectedId`, which hasn't changed, so it is already
      // back on this resource (`SearchPane.CurrentStaffingResource = null` in the original).
      return;
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
      if (!(await this.confirmDiscardPendingChanges())) {
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
    const name = await this.dialogs.open<ResourceName>(ResourceNameEditorComponent, {
      header: 'Add a staffing resource',
      width: '26rem',
    });
    if (!name) {
      return; // cancelled
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

  /**
   * How this screen saves (`SaveHandler`): with its validation scope, showing every error through
   * its error visibility, and saying which tabs to look on, since the tabs are marked but the user
   * is on one of them.
   */
  private readonly saveHandler = inject(SaveHandler);
  private saveOptions(beforeCommit?: () => void): SaveOptions {
    return { visibility: this.errorVisibility, describe: describeProblems, beforeCommit };
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
      const saved = await this.saveHandler.save(unitOfWork, this.validation, this.saveOptions(() => this.selectedId.set(id)));
      if (!saved) {
        // Rules are broken: the handler has shown them and said why nothing was saved.
        return;
      }
      // The handler has dropped the shared cache, so the view-mode load below re-reads the saved graph.
      // The sandbox needs no releasing: once the screen moves on, nothing holds it.
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

    const answer = await this.dialogs.confirmYesNo(`Are you sure you want to delete ${resource.fullName}?`);
    if (answer !== 'yes') {
      return;
    }

    await this.run(async () => {
      try {
        resource.delete();
        // Not validated: a record that breaks a rule can still be deleted.  The handler drops the
        // shared cache, so the deleted graph goes with it.
        await this.saveHandler.commit(unitOfWork);
      } catch (error) {
        unitOfWork.rollback();
        throw error;
      }

      this.unitOfWorkManager.remove(id);
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

    if (
      unitOfWork.hasChanges() &&
      (await this.dialogs.confirm('There are unsaved changes. Refreshing the data will discard all unsaved changes.')) !== 'ok'
    ) {
      return;
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
      const resource = await unitOfWork.staffingResources.withId(id);

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
    // Another resource, or the same one reloaded after a save or in another mode: start over.
    this.errorVisibility.reset();
    this.unitOfWork.set(unitOfWork);
    this.staffingResource.set(resource);
    this.staffingResourceId.set(resource.id);
    this.editMode.set(editMode);
  }

  private clearDetail(): void {
    this.errorVisibility.reset();
    this.staffingResource.set(null);
    this.staffingResourceId.set(null);
    this.unitOfWork.set(null);
    this.editMode.set('view');
    this.selectedId.set(null);
  }

  /**
   * Port of `StaffingResourceDetailViewModel.CanClose`: offer to save, discard or stay put when
   * navigating away from a resource with pending edits.
   *
   * @returns true when the user may leave: nothing to save, saved, or discarded. False to stay:
   * Cancel, or a save that didn't happen.
   */
  private async confirmDiscardPendingChanges(): Promise<boolean> {
    const unitOfWork = this.unitOfWork();
    const id = this.staffingResourceId();

    if (!unitOfWork || !id || !unitOfWork.hasChanges()) {
      return true;
    }

    const answer = await this.dialogs.confirmYesNoCancel(
      'There are unsaved changes. Would you like to save your changes?',
    );

    if (answer === 'cancel') {
      return false;
    }

    if (answer === 'yes') {
      let saved: boolean;
      try {
        saved = await this.busy.run(this.saveHandler.save(unitOfWork, this.validation, this.saveOptions()));
      } catch (error) {
        // The one failure this screen catches, because it acts on it: the user stays on this
        // resource with their edits instead of leaving and losing them.  Reporting it is still the
        // global handler's job.
        this.errorHandler.handleError(error);
        return false;
      }
      if (!saved) {
        // As with Save: the handler has shown every error; keep the user here, with their edits.
        return false;
      }
      // The search list reloads itself off `UnitOfWorkManager.saves`, and the handler has dropped
      // the shared cache, so the next view-mode load re-reads the saved graph.
    } else {
      unitOfWork.rollback();
    }

    return true;
  }

  /**
   * Runs an operation with the busy indicator up.  A failure propagates: the command is called
   * from a click, so it reaches the global `ErrorHandler` (`AppErrorHandler`), which reports it.
   * This screen can't do anything about it.
   */
  private run(operation: () => Promise<void>): Promise<void> {
    return this.busy.run(operation());
  }
}
