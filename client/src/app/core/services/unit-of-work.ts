import { Signal, computed, signal } from '@angular/core';
import { Entity, EntityManager, InitialValues, SaveOptions } from 'breeze-client';

import { EntityManagerProvider } from './entity-manager-provider';
import { EntityCtor, IRepository, Repository } from './repository';

/** Port of Cocktail's `IFactory<T>`. */
export interface IEntityFactory<T extends Entity> {
  create(config?: InitialValues<T>): Promise<T>;
}

/**
 * Creates entities from a generated class.  `createEntity(ctor, values)` returns a `T` and checks
 * `values` against the class, so a misspelt property is a compile error rather than a value Breeze
 * silently ignores.
 */
export class EntityFactory<T extends Entity> implements IEntityFactory<T> {
  constructor(
    protected readonly entityCtor: EntityCtor<T>,
    protected readonly manager: EntityManager,
  ) {}

  create(config?: InitialValues<T>): Promise<T> {
    return Promise.resolve(this.manager.createEntity(this.entityCtor, config));
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
 *
 * **Signals and Breeze entities.**  Breeze entities are plain mutable objects, not signals, so
 * nothing reactive notices when `address.city` changes.  The unit of work bridges the two: it
 * listens to its manager's `entityChanged` and `hasChangesChanged` events and bumps a counter
 * signal, `changes`.  Anything derived from entity state - `hasChanges` below, the toolbar's
 * `canSave` - reads that counter inside a `computed`, and so re-evaluates whenever an entity in this
 * unit of work changes.  The WPF original got the same effect from `EntityChangedMessage`.
 */
export class UnitOfWork {
  protected readonly manager: EntityManager;

  private readonly changeCount = signal(0);

  /**
   * Bumped on every change to an entity in this unit of work: a property edit, a state change,
   * attach and detach, accept and reject, and `clear()`.  Read it in a `computed` to make
   * entity-derived state reactive.
   */
  readonly changes: Signal<number> = this.changeCount.asReadonly();

  /** Whether anything is waiting to be saved - port of `IUnitOfWork.HasChanges`. */
  readonly hasChanges: Signal<boolean> = computed(() => {
    this.changeCount();
    return this.manager.hasChanges();
  });

  /**
   * @param onCommitted called after every successful save, so the owner can publish it.  This is
   *   the replacement for Cocktail's `SavedMessage`; see `UnitOfWorkManager.saves`.
   */
  constructor(
    protected readonly emProvider: EntityManagerProvider,
    private readonly onCommitted: () => void = () => {},
  ) {
    this.manager = emProvider.newManager();

    const bump = () => this.changeCount.update((count) => count + 1);
    this.manager.entityChanged.subscribe(bump);
    this.manager.hasChangesChanged.subscribe(bump);
  }

  getChanges(): Entity[] {
    return this.manager.getChanges();
  }

  /** True when the given entity lives in this unit of work - port of `IUnitOfWork.HasEntity`. */
  hasEntity(entity: Entity): boolean {
    return !!entity && entity.entityAspect?.entityManager === this.manager;
  }

  /** Port of `IUnitOfWork.CommitAsync`. */
  async commit(): Promise<Entity[]> {
    const saveOptions = new SaveOptions({ resourceName: 'SaveChanges' });
    const saveResult = await this.manager.saveChanges(null, saveOptions);

    this.onCommitted();

    return saveResult.entities;
  }

  /** Port of `IUnitOfWork.Rollback`. */
  rollback(): void {
    this.manager.rejectChanges();
  }

  /** Port of `IUnitOfWork.Clear` - drops everything and re-seeds the lookup entities. */
  clear(): void {
    this.emProvider.clear(this.manager);
  }

  protected createRepository<T extends Entity>(
    entityCtor: EntityCtor<T>,
    isCached = false,
  ): IRepository<T> {
    return new Repository(this.manager, entityCtor, isCached);
  }

  protected createFactory<T extends Entity>(entityCtor: EntityCtor<T>): IEntityFactory<T> {
    return new EntityFactory(entityCtor, this.manager);
  }
}
