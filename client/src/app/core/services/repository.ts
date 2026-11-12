import { EntityManager, EntityQuery, EntityType, FetchStrategy, Predicate } from 'breeze-client';

/**
 * Port of Cocktail's `IRepository<T>` (`DomainServices/Repositories/...`).
 *
 * The DevForce version wrapped an `EntityQuery<T>` and a `QueryStrategy`; this wraps a Breeze
 * `EntityQuery` and a `FetchStrategy`.  `isCached` is the analogue of
 * `GlobalCacheRepository`'s `DefaultQueryStrategy = QueryStrategy.CacheOnly`: lookup repositories
 * are answered from the manager's cache, which was seeded by `EntityManagerProvider`, so they never
 * hit the network.
 */
export interface IRepository<T> {
  withId(key: unknown): Promise<T | null>;
  where(predicate: Predicate): Promise<T[]>;
  whereInCache(predicate: Predicate): T[];
  all(orderBy?: string): Promise<T[]>;
  allInCache(orderBy?: string): T[];
}

export class Repository<T> implements IRepository<T> {
  protected readonly defaultFetchStrategy: FetchStrategy;
  private resourceNameSet = false;

  constructor(
    private readonly _manager: EntityManager,
    protected readonly entityTypeName: string | null,
    protected readonly resourceName: string,
    protected readonly isCached = false,
  ) {
    this.defaultFetchStrategy = isCached ? FetchStrategy.FromLocalCache : FetchStrategy.FromServer;
  }

  /**
   * Teaches the MetadataStore which entity type a resource name maps to.  Breeze needs this because
   * the controller action names ("StaffingResources") are not necessarily the entity set names in
   * the metadata; DevForce had no equivalent step because queries were typed end to end.
   */
  protected get manager(): EntityManager {
    if (this.resourceNameSet || !this.entityTypeName) {
      return this._manager;
    }

    const metadataStore = this._manager.metadataStore;
    const entityType = metadataStore.getEntityType(this.entityTypeName, true) as EntityType | null;

    if (entityType) {
      metadataStore.setEntityTypeForResourceName(this.resourceName, entityType);
    }

    this.resourceNameSet = true;

    return this._manager;
  }

  async withId(key: unknown): Promise<T | null> {
    if (!this.entityTypeName) {
      throw new Error('Repository must be created with an entity type in order to query by key.');
    }

    try {
      const data = await this.manager.fetchEntityByKey(this.entityTypeName, key, true);
      return (data.entity as unknown as T) ?? null;
    } catch (error) {
      if ((error as { status?: number }).status === 404) {
        return null;
      }
      throw error;
    }
  }

  where(predicate: Predicate): Promise<T[]> {
    return this.executeQuery(this.baseQuery().where(predicate));
  }

  whereInCache(predicate: Predicate): T[] {
    return this.executeCacheQuery(this.baseQuery().where(predicate));
  }

  all(orderBy?: string): Promise<T[]> {
    const query = orderBy ? this.baseQuery().orderBy(orderBy) : this.baseQuery();
    return this.executeQuery(query);
  }

  allInCache(orderBy?: string): T[] {
    const query = orderBy ? this.baseQuery().orderBy(orderBy) : this.baseQuery();
    return this.executeCacheQuery(query);
  }

  protected baseQuery(): EntityQuery {
    return EntityQuery.from(this.resourceName);
  }

  protected async executeQuery(query: EntityQuery, fetchStrategy?: FetchStrategy): Promise<T[]> {
    const q = query.using(fetchStrategy ?? this.defaultFetchStrategy);

    try {
      const data = await this.manager.executeQuery(q);
      return data.results as unknown as T[];
    } catch (error) {
      if ((error as { status?: number }).status === 404) {
        return [];
      }
      throw error;
    }
  }

  protected executeCacheQuery(query: EntityQuery): T[] {
    return this.manager.executeQueryLocally(query) as unknown as T[];
  }
}
