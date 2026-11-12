import { Entity, EntityManager, EntityQuery, FetchStrategy, Predicate } from 'breeze-client';

/** An entity class: one of the generated classes in `core/model`. */
export type EntityCtor<T extends Entity> = new () => T;

/**
 * Port of Punch's `IRepository<T>` (`DomainServices/Repositories/...`).
 *
 * The DevForce version wrapped an `EntityQuery<T>` and a `QueryStrategy`; this wraps a Breeze
 * `EntityQuery<T>` and a `FetchStrategy`.  `isCached` is the analogue of
 * `GlobalCacheRepository`'s `DefaultQueryStrategy = QueryStrategy.CacheOnly`: lookup repositories
 * are answered from the manager's cache, which was seeded by `EntityManagerProvider`, so they never
 * hit the network.
 */
export interface IRepository<T extends Entity> {
  withId(key: string): Promise<T | null>;
  where(predicate: Predicate): Promise<T[]>;
  whereInCache(predicate: Predicate): T[];
  all(orderBy?: string): Promise<T[]>;
  allInCache(orderBy?: string): T[];
}

/**
 * A repository is keyed on a generated entity class rather than on a type name and a resource
 * name.  Passing the class to `EntityQuery.from` and `fetchEntityByKey` is what makes them typed -
 * `EntityQuery<StaffingResource>`, `QueryResult<StaffingResource>` - and the resource to query
 * ("StaffingResources") comes from the entity type's `defaultResourceName` in the metadata, which
 * matches the action names on `BreezeController`.
 */
export class Repository<T extends Entity> implements IRepository<T> {
  protected readonly defaultFetchStrategy: FetchStrategy;

  constructor(
    protected readonly manager: EntityManager,
    protected readonly entityCtor: EntityCtor<T>,
    protected readonly isCached = false,
  ) {
    this.defaultFetchStrategy = isCached ? FetchStrategy.FromLocalCache : FetchStrategy.FromServer;
  }

  async withId(key: string): Promise<T | null> {
    try {
      const data = await this.manager.fetchEntityByKey(this.entityCtor, key, true);
      return data.entity;
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

  protected baseQuery(): EntityQuery<T> {
    return EntityQuery.from(this.entityCtor);
  }

  protected async executeQuery(query: EntityQuery<T>, fetchStrategy?: FetchStrategy): Promise<T[]> {
    const q = query.using(fetchStrategy ?? this.defaultFetchStrategy);

    try {
      const data = await this.manager.executeQuery(q);
      return data.results;
    } catch (error) {
      if ((error as { status?: number }).status === 404) {
        return [];
      }
      throw error;
    }
  }

  protected executeCacheQuery(query: EntityQuery<T>): T[] {
    return this.manager.executeQueryLocally(query);
  }
}
