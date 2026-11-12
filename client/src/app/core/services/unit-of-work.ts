import { Entity, EntityChangedEventArgs, EntityManager, SaveOptions } from 'breeze-client';
import { Observable, Subject } from 'rxjs';

import { EntityManagerProvider } from './entity-manager-provider';
import { IRepository, Repository } from './repository';

/** Port of Cocktail's `IFactory<T>`. */
export interface IEntityFactory<T> {
  create(config?: Record<string, unknown>): Promise<T>;
}

export class EntityFactory<T> implements IEntityFactory<T> {
  constructor(
    protected readonly entityTypeName: string,
    protected readonly manager: EntityManager,
  ) {}

  create(config?: Record<string, unknown>): Promise<T> {
    return Promise.resolve(this.manager.createEntity(this.entityTypeName, config) as unknown as T);
  }
}

/**
 * Port of Cocktail's `UnitOfWork` (`DomainServices/ResourceMgtUnitOfWork.cs` and its base).
 *
 * A unit of work owns exactly one Breeze `EntityManager`, which is where TempHire's "sandbox
 * editing" comes from: the search list and every read-only view share one unit of work, while each
 * resource being *edited* gets its own.  Cancelling an edit is then just
 * `manager.rejectChanges()` on that one sandbox, with no effect on anything else on screen.
 * That is exactly what `IUnitOfWorkManager<IResourceMgtUnitOfWork>.Get(key)` did in the WPF app,
 * keyed on `Guid.Empty` for the shared instance and on the resource id for a sandbox.
 */
export class UnitOfWork {
  /** Fires whenever any entity in *any* unit of work is saved - port of `SavedMessage`. */
  private static readonly committedSubject = new Subject<Entity[]>();

  /** Fires when pending changes are rolled back. */
  private static readonly rejectedSubject = new Subject<Entity[]>();

  private readonly entityChangedSubject = new Subject<EntityChangedEventArgs>();

  private _manager?: EntityManager;

  constructor(protected readonly emProvider: EntityManagerProvider) {}

  static get committed(): Observable<Entity[]> {
    return UnitOfWork.committedSubject.asObservable();
  }

  static get rejected(): Observable<Entity[]> {
    return UnitOfWork.rejectedSubject.asObservable();
  }

  /** Port of `EntityChangedMessage`, used by the toolbar to enable/disable Save and Cancel. */
  get entityChanged(): Observable<EntityChangedEventArgs> {
    return this.entityChangedSubject.asObservable();
  }

  protected get manager(): EntityManager {
    if (!this._manager) {
      this._manager = this.emProvider.newManager();
      this._manager.entityChanged.subscribe((args) => this.entityChangedSubject.next(args));
    }

    return this._manager;
  }

  hasChanges(): boolean {
    return this.manager.hasChanges();
  }

  getChanges(): Entity[] {
    return this.manager.getChanges();
  }

  /** True when the given entity lives in this unit of work - port of `IUnitOfWork.HasEntity`. */
  hasEntity(entity: Entity): boolean {
    return !!entity && entity.entityAspect?.entityManager === this._manager;
  }

  /** Port of `IUnitOfWork.CommitAsync`. */
  async commit(): Promise<Entity[]> {
    const saveOptions = new SaveOptions({ resourceName: 'SaveChanges' });
    const saveResult = await this.manager.saveChanges(null, saveOptions);

    UnitOfWork.committedSubject.next(saveResult.entities);

    return saveResult.entities;
  }

  /** Port of `IUnitOfWork.Rollback`. */
  rollback(): void {
    const pending = this.manager.getChanges();
    this.manager.rejectChanges();
    UnitOfWork.rejectedSubject.next(pending);
  }

  /** Port of `IUnitOfWork.Clear` - drops everything and re-seeds the lookup entities. */
  clear(): void {
    this.emProvider.clear(this.manager);
  }

  protected createRepository<T>(
    entityTypeName: string | null,
    resourceName: string,
    isCached = false,
  ): IRepository<T> {
    return new Repository<T>(this.manager, entityTypeName, resourceName, isCached);
  }

  protected createFactory<T>(entityTypeName: string): IEntityFactory<T> {
    return new EntityFactory<T>(entityTypeName, this.manager);
  }
}
