import { ApplicationRef, DestroyRef, Injectable, Signal, computed, inject, signal } from '@angular/core';

/**
 * Port of `Common/Toolbar/ToolbarAction.cs`.
 *
 * DevForce/Caliburn.Micro derived `CanExecute` by reflecting for a `Can<MethodName>` property on
 * the owning view model and listening to `INotifyPropertyChanged`.  Signals make that explicit and
 * type-safe: an action supplies a `canExecute` thunk that reads whatever signals it depends on, and
 * the template re-renders when those change.
 */
export interface ToolbarAction {
  label: string;
  icon?: string;
  execute: () => void;
  canExecute?: () => boolean;
}

/** Port of `Common/Toolbar/ToolbarGroup`.  `level` controls left-to-right ordering. */
export interface ToolbarGroup {
  level: number;
  actions: ToolbarAction[];
}

/**
 * Runs a toolbar action, after bringing the screen up to date.
 *
 * A command can put an entity back to a value the screen has already shown: Cancel rolls the
 * edits back, Refresh reloads.  Angular writes a value to a field only when its binding has
 * changed since the last change detection.  So when the user typed and clicked within one frame,
 * before change detection had seen the typed value, the rolled-back value looked unchanged to the
 * binding, and the field kept the text that had just been discarded.  Running change detection
 * first records what the fields show, so whatever the command changes is written back.
 */
export function executeAction(action: ToolbarAction, appRef: ApplicationRef): void {
  appRef.tick();
  action.execute();
}

/** Flattens groups into one action list, ordered by group level. */
export function toolbarActions(groups: readonly ToolbarGroup[]): ToolbarAction[] {
  return [...groups].sort((a, b) => a.level - b.level).flatMap((group) => group.actions);
}

/**
 * Port of `Common/Toolbar/IToolbarManager.cs` + `ToolbarManager.cs`.
 *
 * Holds the groups contributed by the active screen.  A screen contributes with
 * `registerToolbarGroup`, which also removes the group when the screen is destroyed, exactly as
 * `ResourceMgtViewModel.OnActivate` / `OnDeactivate` did.  The shell combines these with its own
 * groups (see `App.actions`).
 */
@Injectable({ providedIn: 'root' })
export class ToolbarService {
  private readonly registered = signal<readonly ToolbarGroup[]>([]);

  /** The groups currently contributed by screens. */
  readonly groups: Signal<readonly ToolbarGroup[]> = this.registered.asReadonly();

  /** All screen-contributed actions, ordered by group level - port of `ToolbarManager.Actions`. */
  readonly actions = computed(() => toolbarActions(this.groups()));

  addGroup(group: ToolbarGroup): void {
    this.registered.update((groups) => (groups.includes(group) ? groups : [...groups, group]));
  }

  removeGroup(group: ToolbarGroup): void {
    this.registered.update((groups) => groups.filter((g) => g !== group));
  }
}

/**
 * Adds a toolbar group for as long as the calling component lives.
 *
 * An injection function: call it from a component's field initializer or constructor.  It takes
 * the place of an `addGroup` in the constructor paired with a `removeGroup` in `ngOnDestroy`.
 */
export function registerToolbarGroup(group: ToolbarGroup): void {
  const toolbar = inject(ToolbarService);
  toolbar.addGroup(group);
  inject(DestroyRef).onDestroy(() => toolbar.removeGroup(group));
}
