import { Injectable, inject } from '@angular/core';

import { EntityManagerProvider } from './entity-manager-provider';
import { ResourceMgtUnitOfWork } from './resource-mgt-unit-of-work';

/** The key used for the single shared, view-only unit of work.  DevForce used `Guid.Empty`. */
export const SHARED_UNIT_OF_WORK_KEY = '00000000-0000-0000-0000-000000000000';

/**
 * Port of Cocktail's `IUnitOfWorkManager<T>` (`DomainServices/UnitOfWorkManager.cs`).
 *
 * This is the heart of TempHire's editing model and it survives the port unchanged in spirit:
 *
 *  - `get(SHARED_UNIT_OF_WORK_KEY)` returns the one long-lived unit of work that every *read-only*
 *    screen shares.  The search list, the summary and all the detail tabs read from it, so they all
 *    see the same entity instances and stay in sync for free.
 *  - `get(resourceId)` returns a **sandbox** unit of work dedicated to editing that one resource.
 *    Because it owns a separate `EntityManager`, edits are completely isolated: `Cancel` is a
 *    `rejectChanges()` on the sandbox and the read-only views never flicker.
 *
 * Cocktail also evicted a unit of work once it had no pending changes, so that a cancelled or saved
 * edit did not leak its manager for the life of the session.  `releaseIfClean` does the same job.
 */
@Injectable({ providedIn: 'root' })
export class UnitOfWorkManager {
  private readonly emProvider = inject(EntityManagerProvider);
  private readonly cache = new Map<string, ResourceMgtUnitOfWork>();

  /** Returns the cached unit of work for `key`, creating it on first use. */
  get(key: string): ResourceMgtUnitOfWork {
    let unitOfWork = this.cache.get(key);

    if (!unitOfWork) {
      unitOfWork = this.create();
      this.cache.set(key, unitOfWork);
    }

    return unitOfWork;
  }

  /** Creates an unregistered unit of work - port of `IUnitOfWorkManager.Create`. */
  create(): ResourceMgtUnitOfWork {
    return new ResourceMgtUnitOfWork(this.emProvider);
  }

  /**
   * Registers a unit of work under a key.  Used when adding a resource: the sandbox has to be
   * created *before* the new resource has an id, then filed under that id once it does.
   */
  add(key: string, unitOfWork: ResourceMgtUnitOfWork): void {
    this.cache.set(key, unitOfWork);
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  remove(key: string): void {
    if (key !== SHARED_UNIT_OF_WORK_KEY) {
      this.cache.delete(key);
    }
  }

  /** Drops a sandbox once it has nothing left to save - port of Cocktail's automatic eviction. */
  releaseIfClean(key: string): void {
    if (key === SHARED_UNIT_OF_WORK_KEY) {
      return;
    }

    const unitOfWork = this.cache.get(key);
    if (unitOfWork && !unitOfWork.hasChanges()) {
      this.cache.delete(key);
    }
  }

  /** Forgets every unit of work - used on logout. */
  clear(): void {
    this.cache.clear();
  }
}
