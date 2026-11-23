import { Signal, computed, signal } from '@angular/core';
import { NotifyingEntityStore } from '@ideablade/validation';
import { breezeEntityStore } from '@ideablade/validation/breeze';
import { Entity, EntityManager, InitialValues, SaveOptions } from 'breeze-client';

import { EntityManagerProvider } from './entity-manager-provider';
import { EntityCtor, IRepository, Repository } from './repository';

/** Port of Punch's `IFactory<T>`. */
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
 * Port of Punch's `UnitOfWork` (`DomainServices/ResourceMgtUnitOfWork.cs` and its base).
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
 * listens to its manager's `entityChanged`, `hasChangesChanged` and `validationErrorsChanged` events
 * and bumps a counter signal, `changes`.  Anything derived from entity state - `hasChanges` below,
 * the toolbar's `canSave` - reads that counter inside a `computed`, and so re-evaluates whenever
 * an entity in this unit of work changes.  The WPF original got the same effect from
 * `EntityChangedMessage`.
 */
export class UnitOfWork {
  protected readonly manager: EntityManager;

  /**
   * The live entities of this unit of work, as a validation entity store: what `store(type)` sees
   * in the validation rules, and what tells the forms that something changed.  The route's
   * validation service uses it for the unit of work it shows, and validates it continuously: the
   * errors that hold up a save (`ResourceMgtComponent`).
   */
  readonly entityStore: NotifyingEntityStore;

  private readonly changeCount = signal(0);

  /**
   * Bumped on every change to an entity in this unit of work: a property edit, a state change,
   * attach and detach, accept and reject, `clear()`, and a change to its validation errors.  Read it
   * in a `computed` to make entity-derived state reactive.
   */
  readonly changes: Signal<number> = this.changeCount.asReadonly();

  /** Whether anything is waiting to be saved - port of `IUnitOfWork.HasChanges`. */
  readonly hasChanges: Signal<boolean> = computed(() => {
    this.changeCount();
    return this.manager.hasChanges();
  });

  /**
   * @param serviceName the URL root of the server controller of the workspace this unit of work
   *   belongs to: its queries and its saves go there, and nowhere else.
   * @param onCommitted called after every successful save, so the owner can publish it.  This is
   *   where Punch published `SavedMessage`: the manager announces it (`EventAggregator.saved`).
   */
  constructor(
    protected readonly emProvider: EntityManagerProvider,
    serviceName: string,
    private readonly onCommitted: () => void = () => {},
  ) {
    this.manager = emProvider.newManager(serviceName);
    this.entityStore = breezeEntityStore(this.manager);

    const bump = () => this.changeCount.update((count) => count + 1);
    this.manager.entityChanged.subscribe(bump);
    this.manager.hasChangesChanged.subscribe(bump);
    this.manager.validationErrorsChanged.subscribe(bump);
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
