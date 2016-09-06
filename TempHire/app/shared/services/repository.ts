import { Entity, FetchStrategySymbol, EntityManager, FetchStrategy, EntityType, EntityQuery, Predicate } from 'breeze-client';

export interface IRepository<T> {
    withId(key: any): Promise<T>;
    where(predicate: Predicate): Promise<T[]>;
    whereInCache(predicate: Predicate): T[];
    all(): Promise<T[]>;
}

export class Repository<T> implements IRepository<T> {

    private _resourceNameSet: boolean;
    protected _defaultFetchStrategy: FetchStrategySymbol;

    constructor(private _manager: EntityManager,
        protected _entityTypeName: string,
        protected _resourceName: string,
        protected _isCachedBundle: boolean = false) {

        this._defaultFetchStrategy = _isCachedBundle ? FetchStrategy.FromLocalCache : FetchStrategy.FromServer;
    }

    protected get manager(): EntityManager {
        if (this._resourceNameSet) return this._manager;
        let metadataStore = this._manager.metadataStore;
        
        let entityType = <EntityType>metadataStore.getEntityType(this._entityTypeName || '', true);
        if (entityType) {
            entityType.setProperties({ defaultResourceName: this.localResourceName });
            metadataStore.setEntityTypeForResourceName(this.localResourceName, entityType);
        }

        return this._manager;
    }
    
    protected get localResourceName() {
        return this._isCachedBundle ? this._entityTypeName : this._resourceName;
    }

    withId(key: any): Promise<T> {
        if (!this._entityTypeName)
            throw new Error("Repository must be created with an entity type specified");

        return this.manager.fetchEntityByKey(this._entityTypeName, key, true)
            .then(function (data) {
                return <T><any>data.entity;
            }).catch(e => {
                if (e.status == 404) {
                    return null;
                }

                // Something else happened
                throw e;
            });
    };

    where(predicate: Predicate): Promise<T[]> {
        let query = this.baseQuery().where(predicate);

        return this.executeQuery(query);
    };

    whereInCache(predicate: Predicate): T[] {
        let query = this.baseQuery().where(predicate);

        return <any[]>this.executeCacheQuery(query);
    };

    all(): Promise<T[]> {
        let query = this.baseQuery();

        return this.executeQuery(query);
    };

    protected baseQuery() : EntityQuery {
        return EntityQuery.from(this.localResourceName);
    }

    protected executeQuery(query: EntityQuery, fetchStrategy?: FetchStrategySymbol): Promise<T[]> {
        let q = query.using(fetchStrategy || this._defaultFetchStrategy);
        return this.manager.executeQuery(q).then(data => {
            return data.results;
        }).catch(e => {
            if (e.status == 404) {
                return [];
            }

            // Something else happend, rethrow the exception
            throw e;
        });
    }

    protected executeCacheQuery(query: EntityQuery): Entity[] {
        return this.manager.executeQueryLocally(query);
    }
}
