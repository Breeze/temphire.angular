import { Injectable, computed, signal } from '@angular/core';

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
 * Port of `Common/Toolbar/IToolbarManager.cs` + `ToolbarManager.cs`.
 *
 * The shell renders whatever groups are currently registered; a screen adds its group when it
 * activates and removes it when it goes away, exactly as `ResourceMgtViewModel.OnActivate` /
 * `OnDeactivate` did.
 */
@Injectable({ providedIn: 'root' })
export class ToolbarService {
  private readonly groups = signal<ToolbarGroup[]>([]);

  /** All registered actions, ordered by group level - port of `ToolbarManager.Actions`. */
  readonly actions = computed(() =>
    [...this.groups()].sort((a, b) => a.level - b.level).flatMap((group) => group.actions),
  );

  addGroup(group: ToolbarGroup): void {
    this.groups.update((groups) => (groups.includes(group) ? groups : [...groups, group]));
  }

  removeGroup(group: ToolbarGroup): void {
    this.groups.update((groups) => groups.filter((g) => g !== group));
  }

  clear(): void {
    this.groups.set([]);
  }
}
