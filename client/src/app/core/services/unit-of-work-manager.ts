import { effect, inject, untracked } from '@angular/core';

import { EntityManagerProvider } from './entity-manager-provider';
import { EventAggregator } from './event-aggregator';
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
 * **Saves and sign-out come as events** (`EventAggregator`), as `SavedMessage` and
 * `LoggedOutMessage` did in Punch.  A unit of work announces its saves there, and every manager -
 * every workspace's - reacts itself: after a save it drops its shared cache, and at sign-out it
 * forgets every unit of work.  Nobody calls a manager for either.
 */
export abstract class UnitOfWorkManager<T extends UnitOfWork> {
  protected readonly emProvider = inject(EntityManagerProvider);
  private readonly events = inject(EventAggregator);
  private readonly cache = new Map<string, WeakRef<T>>();

  /** Removes a key once its unit of work is collected, unless the key has a newer one by then. */
  private readonly collected = new FinalizationRegistry<string>((key) => {
    if (!this.cache.get(key)?.deref()) {
      this.cache.delete(key);
    }
  });

  constructor() {
    // Only events from now on concern this manager: it holds nothing from before.
    const earlierSave = untracked(this.events.lastSave);
    const earlierLogout = untracked(this.events.lastLogout);

    // `IHandle<SavedMessage>`.  The effect runs at the next change detection: before any reload that
    // follows the save has had the server's answer to merge into the cache.
    effect(() => {
      const save = this.events.lastSave();
      if (save && save !== earlierSave) {
        untracked(() => this.dropSharedCache(save.unitOfWork?.deref()));
      }
    });

    // `IHandle<LoggedOutMessage>`.
    effect(() => {
      const logout = this.events.lastLogout();
      if (logout && logout !== earlierLogout) {
        untracked(() => this.forgetAll());
      }
    });
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
   * See `add`.  Its saves are announced as events.
   */
  create(): T {
    const unitOfWork = this.newUnitOfWork(() => this.events.saved(unitOfWork));
    return unitOfWork;
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
   * After a save: drops the shared unit of work's cache, unless there is none (yet, or any more) or
   * it is `saved`, the one just saved.  Any workspace's save can change what this one has loaded,
   * and it happened in a sandbox, so the shared unit of work still holds whatever it last loaded,
   * including children the save just deleted.  A Breeze query merge never detaches cached entities
   * the server omitted, so re-querying would not remove them; the cache has to be dropped and
   * re-seeded.  DevForce's shared EntityManager was refreshed for the same reason.
   */
  protected dropSharedCache(saved: object | undefined): void {
    const shared = this.find(SHARED_UNIT_OF_WORK_KEY);
    if (shared && shared !== saved) {
      shared.clear();
    }
  }

  /** At sign-out: forgets every unit of work. */
  protected forgetAll(): void {
    this.cache.clear();
  }

  /** The unit of work kept under `key`, if it hasn't been collected. */
  private find(key: string): T | undefined {
    return this.cache.get(key)?.deref();
  }
}
