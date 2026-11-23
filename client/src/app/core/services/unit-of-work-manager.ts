import { Injectable, Signal, inject, signal } from '@angular/core';

import { EntityManagerProvider } from './entity-manager-provider';
import { UnitOfWork } from './unit-of-work';

/** The key used for the single shared, view-only unit of work.  DevForce used `Guid.Empty`. */
export const SHARED_UNIT_OF_WORK_KEY = '00000000-0000-0000-0000-000000000000';

/**
 * Port of Punch's `IUnitOfWorkManager<T>` (`DomainServices/UnitOfWorkManager.cs`).  Each workspace
 * has a manager of its own, for its own kind of unit of work: `ResourceMgtUnitOfWorkManager` is
 * Resource Management's, as `ResourceMgtUnitOfWorkManager.cs` was in the original.  A subclass only
 * says how to create its unit of work (`newUnitOfWork`).
 *
 * This is the heart of TempHire's editing model and it survives the port unchanged in spirit:
 *
 *  - `get(SHARED_UNIT_OF_WORK_KEY)` returns the one long-lived unit of work that every *read-only*
 *    screen of the workspace shares.  The search list, the summary and all the detail tabs read from
 *    it, so they all see the same entity instances and stay in sync for free.
 *  - `get(resourceId)` returns a **sandbox** unit of work dedicated to editing that one resource.
 *    Because it owns a separate `EntityManager`, edits are completely isolated: `Cancel` is a
 *    `rejectChanges()` on the sandbox and the read-only views never flicker.
 *
 * **The cache holds its units of work weakly**, as Punch's did: `UnitOfWorkManager<T>` derived
 * from Cocktail's `ObjectManager`, which kept them in a `WeakRefDictionary`.  A unit of work stays
 * in the cache as long as something else - a screen showing it - holds it; once nothing does, the
 * garbage collector may take it, and the next `get` for its key creates a new one.  So a cancelled
 * or saved edit leaves nothing behind, with no code to release it.  Until the collector runs, `get`
 * can still return the old one, which is harmless: it holds the same entities, and a load refreshes
 * them.  A `FinalizationRegistry` removes the keys of collected units of work.
 *
 * What concerns every workspace's managers together - the saves, sign-out - is in
 * `UnitOfWorkManagers`, which each manager registers with.
 */
export abstract class UnitOfWorkManager<T extends UnitOfWork> {
  protected readonly emProvider = inject(EntityManagerProvider);
  private readonly managers = inject(UnitOfWorkManagers);
  private readonly cache = new Map<string, WeakRef<T>>();

  /** Removes a key once its unit of work is collected, unless the key has a newer one by then. */
  private readonly collected = new FinalizationRegistry<string>((key) => {
    if (!this.cache.get(key)?.deref()) {
      this.cache.delete(key);
    }
  });

  /**
   * Bumped after every successful save in any unit of work, of any workspace - port of Punch's
   * `SavedMessage`, which the search list handled (`IHandle<SavedMessage>`) to re-run its query.  As
   * a signal it needs no subscription: `ResourceSearchComponent` reads it in its `resource()`
   * params, so a save anywhere reloads the list.
   */
  readonly saves: Signal<number> = this.managers.saves;

  constructor() {
    this.managers.register(this);
  }

  /**
   * Creates the workspace's unit of work.
   *
   * @param onCommitted to be passed to the unit of work, which calls it after every successful save.
   */
  protected abstract newUnitOfWork(onCommitted: () => void): T;

  /** Returns the unit of work for `key`, creating it if there is none, or it has been collected. */
  get(key: string): T {
    let unitOfWork = this.find(key);

    if (!unitOfWork) {
      unitOfWork = this.create();
      this.add(key, unitOfWork);
    }

    return unitOfWork;
  }

  /**
   * Creates a unit of work without keeping it under a key - port of `IUnitOfWorkManager.Create`.
   * See `add`.
   */
  create(): T {
    return this.newUnitOfWork(() => this.managers.saved());
  }

  /**
   * Keeps a unit of work under a key.  Used when adding a resource: the sandbox has to be created
   * *before* the new resource has an id, then filed under that id once it does.
   */
  add(key: string, unitOfWork: T): void {
    this.cache.set(key, new WeakRef(unitOfWork));
    this.collected.register(unitOfWork, key);
  }

  /** Whether `key` has a unit of work that hasn't been collected. */
  has(key: string): boolean {
    return this.find(key) !== undefined;
  }

  /** Forgets a sandbox at once, such as one whose resource was deleted. */
  remove(key: string): void {
    if (key !== SHARED_UNIT_OF_WORK_KEY) {
      this.cache.delete(key);
    }
  }

  /**
   * Drops the shared unit of work's cache, unless there is none (yet, or any more) or it is `saved`,
   * the one just saved.  See `SaveHandler`.
   */
  dropSharedCache(saved: object): void {
    const shared = this.find(SHARED_UNIT_OF_WORK_KEY);
    if (shared && shared !== saved) {
      shared.clear();
    }
  }

  /** Forgets every unit of work - used on logout. */
  clear(): void {
    this.cache.clear();
  }

  /** The unit of work kept under `key`, if it hasn't been collected. */
  private find(key: string): T | undefined {
    return this.cache.get(key)?.deref();
  }
}

/**
 * Every workspace's unit-of-work manager, for what concerns them all: the count of saves (Punch's
 * `SavedMessage` was app-wide too), dropping every shared cache after a save, and forgetting every
 * unit of work at sign-out.  A manager registers itself when it is created.
 */
@Injectable({ providedIn: 'root' })
export class UnitOfWorkManagers {
  private readonly managers = new Set<UnitOfWorkManager<UnitOfWork>>();
  private readonly saveCount = signal(0);

  /** Bumped after every successful save, in any workspace.  See `UnitOfWorkManager.saves`. */
  readonly saves: Signal<number> = this.saveCount.asReadonly();

  register(manager: UnitOfWorkManager<UnitOfWork>): void {
    this.managers.add(manager);
  }

  /** Called by every unit of work after a successful save. */
  saved(): void {
    this.saveCount.update((count) => count + 1);
  }

  /**
   * After a save: drops every workspace's shared cache but `saved`'s, since a save can change what
   * any of them has loaded.
   */
  dropSharedCaches(saved: object): void {
    this.managers.forEach((manager) => manager.dropSharedCache(saved));
  }

  /** Forgets every unit of work of every workspace - used on logout. */
  clear(): void {
    this.managers.forEach((manager) => manager.clear());
  }
}
