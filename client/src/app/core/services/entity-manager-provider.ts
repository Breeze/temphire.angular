import { HttpClient } from '@angular/common/http';
import { Injectable, Injector, inject } from '@angular/core';
import { DataService, EntityManager, EntityQuery, MetadataStore } from 'breeze-client';
import { ModelValidationMetadataMap, ValidationService } from 'ideablade-validation';
import { installBreezeValidators } from 'ideablade-validation/breeze';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { displayNameMetadata } from '../model-display-names';
import { registerModel } from '../model-registration';

/**
 * Creates and seeds EntityManagers.
 *
 * This is the direct replacement for three pieces of the WPF app:
 *
 *  - `TempHire/EntityManagerProviderFactory.cs` (Punch's `IEntityManagerProvider`),
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

  // Looked up when the metadata arrives rather than injected: the validation service's rule source
  // (`breezeRuleSource`, see app.config.ts) reads this provider's metadata store.
  private readonly injector = inject(Injector);

  /** The model's metadata, shared by every workspace: `ModelController` on the server. */
  private readonly modelService = new DataService({
    serviceName: environment.modelApiRoot,
    hasServerMetadata: true,
  });

  /**
   * The lookups, a cross-cutting concern loaded once at sign-in: `LookupsController`.  The master
   * manager queries it; each unit of work then talks to its own workspace's controller (see
   * `newManager`).  No server metadata of its own: the model's is loaded first.
   */
  private readonly lookupsService = this.workspaceService(environment.lookupsApiRoot);

  /**
   * A data service for a controller that queries and saves but serves no metadata of its own: the
   * model's is loaded first, from `modelService`.  Without `hasServerMetadata: false`, Breeze would
   * ask each controller for its own `/Metadata` before the first query.
   */
  private workspaceService(serviceName: string): DataService {
    return new DataService({ serviceName, hasServerMetadata: false });
  }

  /**
   * The one `MetadataStore`, kept until the page is reloaded.  Breeze binds each registered entity
   * class to a single store - registering `StaffingResource` with a second store throws - so the
   * store outlives `reset()`, and `loadBreezeMetadata` fills it only once, at the first sign-in
   * that succeeds.  The validation
   * service's rule source reads it too (`breezeRuleSource`, see app.config.ts).
   */
  readonly metadataStore = new MetadataStore();

  private masterManager?: EntityManager;
  private preparePromise?: Promise<void>;

  /**
   * The server's validation metadata, set once it has been added to the validation service and
   * installed into Breeze.  Like Breeze's metadata, it loads at the first sign-in that succeeds and
   * stays until the page is reloaded: adding it to the validation service again would duplicate
   * every rule.
   */
  private validationMetadata?: ModelValidationMetadataMap;

  /**
   * Downloads the metadata and the lookup bundle.  Must complete before any manager is created.
   *
   * Both endpoints require authentication (`[Authorize]` on `ModelController` and
   * `LookupsController`, matching DevForce's `[RequiresAuthentication]`), so this runs immediately
   * after a successful login - exactly where `LoginViewModel` called `IGlobalCache.LoadAsync()` in
   * the original.
   *
   * A failure is final until `reset()`: nothing retries.  The metadata and the lookups are what
   * every screen needs, so `restoreSession` signs the user out and the sign-in callback reports
   * the failure.  After a reset, `prepare()` loads the lookups again, and each kind of metadata
   * only if it didn't load before.
   */
  prepare(): Promise<void> {
    this.preparePromise ??= this.loadMasterManager();
    return this.preparePromise;
  }

  private async loadMasterManager(): Promise<void> {
    // Both kinds of metadata are fetched in parallel; the validation metadata waits for Breeze's.
    await this.loadValidationMetadata(this.loadBreezeMetadata());

    // One request for every lookup table - `LookupsController.AllTypes` on the server.
    const masterManager = new EntityManager({
      dataService: this.lookupsService,
      metadataStore: this.metadataStore,
    });
    await masterManager.executeQuery(EntityQuery.from('AllTypes'));
    this.masterManager = masterManager;
  }

  /**
   * Breeze's metadata, built from the EF Core model, with the entities' data annotations as
   * validators.  Fetched into the store and the model registered on it (`registerModel`) until
   * that has succeeded once; after that, until the page is reloaded, the store is returned as it
   * is.  Breeze fetches a service's metadata only once per store, and the classes can't be
   * registered with another store.
   */
  private async loadBreezeMetadata(): Promise<MetadataStore> {
    const metadataStore = this.metadataStore;
    if (!metadataStore.hasMetadataFor(this.modelService.serviceName)) {
      await metadataStore.fetchMetadata(this.modelService);
      registerModel(metadataStore);
    }

    return metadataStore;
  }

  /**
   * The validation metadata (`ValidationController`), with the rules the annotations cannot
   * express: an address has a state, a rate is not negative, a resource keeps an address and a
   * phone number.
   *
   * Fetched in parallel with Breeze's metadata (`breezeMetadata`), and both awaited together, so a
   * failure of either rejects here.  Once both have arrived, the rules are added to the validation
   * service with Breeze's display names (`displayNameMetadata`) and installed into Breeze
   * (`installBreezeValidators`), which both read the store.  Breeze then runs those rules next to
   * its own: a property's rules whenever it changes, and all of them on every save, so a save with
   * a broken rule never leaves the client.  The server checks the same metadata again when it saves.
   *
   * Like Breeze's, loaded only until it has succeeded once: see `validationMetadata`.
   */
  private async loadValidationMetadata(breezeMetadata: Promise<MetadataStore>): Promise<void> {
    if (!this.validationMetadata) {
      const [validationMetadata, metadataStore] = await Promise.all([
        firstValueFrom(
          this.http.get<ModelValidationMetadataMap>(`${environment.validationApiRoot}/Metadata`),
        ),
        breezeMetadata,
      ]);

      const validation = this.injector.get(ValidationService);
      validation.validationMetadata.addMetadata([
        validationMetadata,
        displayNameMetadata(metadataStore),
      ]);
      installBreezeValidators(metadataStore, validation);

      this.validationMetadata = validationMetadata;
    }
  }

  get isPrepared(): boolean {
    return !!this.masterManager;
  }

  /**
   * Forgets the master manager and its lookups, so the next sign-in loads them again.  The metadata
   * stays in the store and the validation service until the page is reloaded.
   */
  reset(): void {
    this.masterManager = undefined;
    this.preparePromise = undefined;
  }

  /**
   * Creates a fresh manager pre-seeded with the lookup entities, which queries and saves through the
   * server controller at `serviceName`: the controller of the workspace the unit of work belongs to,
   * such as `ResourceMgtController` (`environment.resourceMgtApiRoot`).
   *
   * How the manager is configured stays in here: the unit of work names the controller and nothing
   * else.  Should one ever need a different setting, add an options parameter after `serviceName`.
   */
  newManager(serviceName: string): EntityManager {
    if (!this.masterManager) {
      throw new Error('EntityManagerProvider.prepare() must complete before a manager is created.');
    }

    const manager = this.masterManager.createEmptyCopy();
    manager.setProperties({ dataService: this.workspaceService(serviceName) });
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
