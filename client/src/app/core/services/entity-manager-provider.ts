import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { DataService, EntityManager, EntityQuery, MetadataStore } from 'breeze-client';

import { environment } from '../../../environments/environment';
import { registerModel } from '../model-registration';

/**
 * Creates and seeds EntityManagers.
 *
 * This is the direct replacement for three pieces of the WPF app:
 *
 *  - `TempHire/EntityManagerProviderFactory.cs` (Cocktail's `IEntityManagerProvider`),
 *  - `TempHire/GlobalCache.cs`, and
 *  - `DomainServices/Repositories/GlobalCacheRepository.cs`.
 *
 * The pattern is the same in both worlds.  A single long-lived "master" manager holds the metadata
 * and every lookup entity; each unit of work then gets its own manager created as an empty copy of
 * the master and seeded from it.  In DevForce that seeding happened in
 * `GlobalCacheRepository.OnManagerCreated` via `ImportEntities`; here it is
 * `masterManager.exportEntities(...)` into `manager.importEntities(...)`, which is the same
 * operation under a different name.
 *
 * Why bother?  Because the lookup tables (states, address types, phone types, rate types) never
 * change during a session, and every sandbox manager needs them in cache in order to resolve the
 * `Address.state` / `Address.addressType` navigation properties without a server round trip.
 */
@Injectable({ providedIn: 'root' })
export class EntityManagerProvider {
  private readonly http = inject(HttpClient);

  private readonly dataService = new DataService({
    serviceName: environment.breezeApiRoot,
    hasServerMetadata: true,
  });

  /**
   * The one `MetadataStore` for the life of the page.  Breeze binds each registered entity class to
   * a single store - registering `StaffingResource` with a second store throws - so the store has to
   * outlive a logout, or the next login could not register the classes again.  The metadata is the
   * same for every user, so nothing is lost by keeping it.
   */
  private readonly metadataStore = new MetadataStore();
  private metadataPromise?: Promise<void>;

  private masterManager?: EntityManager;
  private preparePromise?: Promise<void>;

  /**
   * Downloads the metadata (on the first login only) and the lookup bundle.  Must complete before
   * any manager is created.
   *
   * Both endpoints require authentication (`[Authorize]` on `BreezeController`, matching DevForce's
   * `[RequiresAuthentication]`), so this runs immediately after a successful login - exactly where
   * `LoginViewModel` called `IGlobalCache.LoadAsync()` in the original.
   */
  prepare(): Promise<void> {
    if (!this.preparePromise) {
      const masterManager = new EntityManager({
        dataService: this.dataService,
        metadataStore: this.metadataStore,
      });

      this.preparePromise = this.loadMetadata(masterManager)
        // One request for every lookup table - the `Lookups` action on the server.
        .then(() => masterManager.executeQuery(EntityQuery.from('Lookups')))
        .then(() => {
          this.masterManager = masterManager;
        })
        .catch((error) => {
          // Let the next attempt start over rather than caching the failure forever.
          this.preparePromise = undefined;
          throw error;
        });
    }

    return this.preparePromise;
  }

  /** Fetches the metadata and registers the model on the shared store, once per page. */
  private loadMetadata(manager: EntityManager): Promise<void> {
    this.metadataPromise ??= manager
      .fetchMetadata()
      .then(() => registerModel(this.metadataStore))
      .catch((error) => {
        this.metadataPromise = undefined;
        throw error;
      });

    return this.metadataPromise;
  }

  get isPrepared(): boolean {
    return !!this.masterManager;
  }

  /**
   * Forgets the master manager so the next login starts from a clean cache.  The metadata store is
   * kept; see `metadataStore`.
   */
  reset(): void {
    this.masterManager = undefined;
    this.preparePromise = undefined;
  }

  /** Creates a fresh manager pre-seeded with the lookup entities. */
  newManager(): EntityManager {
    if (!this.masterManager) {
      throw new Error('EntityManagerProvider.prepare() must complete before a manager is created.');
    }

    const manager = this.masterManager.createEmptyCopy();
    this.seed(manager);

    return manager;
  }

  /**
   * Empties a manager and re-seeds it - the equivalent of DevForce's
   * `EntityManager.Clear()` followed by `GlobalCacheRepository.OnCleared`.
   */
  clear(manager: EntityManager): void {
    manager.clear();
    this.seed(manager);
  }

  private seed(manager: EntityManager): void {
    const data = this.masterManager!.exportEntities(undefined, {
      asString: false,
      includeMetadata: false,
    });

    manager.importEntities(data);
  }
}
