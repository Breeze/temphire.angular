import { Injectable } from '@angular/core';
import { Entity, EntityChangedEventArgs, EntityManager, EntityQuery, FetchStrategy, SaveOptions } from 'breeze-client';
import { Subject } from 'rxjs';

import { EntityManagerProvider } from './entity-manager-provider';
import { IRepository, Repository } from './repository';

export interface IEntityFactory<T extends Entity> {
    create(...params: any[]): Promise<T>;
}

export class EntityFactory<T extends Entity> implements IEntityFactory<T> {

    constructor(private entityTypeName: string, private manager: EntityManager) {
    }

    create(config?: any): Promise<T> {
        const inst = this.manager.createEntity(this.entityTypeName, config) as T;
        return Promise.resolve(inst);
    }
}

export class SavedOrRejectedArgs {
    entities: Entity[];
    rejected: boolean;
}

@Injectable()
export class UnitOfWork {

    private _manager: EntityManager;
    private static shelveSets = {};

    private entityChangedSubject: Subject<EntityChangedEventArgs>;
    private static committedSubject = new Subject<Entity[]>();
    private static rejectedSubject = new Subject<Entity[]>();

    protected get manager(): EntityManager {
        if (!this._manager) {
            this._manager = this._emProvider.newManager();

            this._manager.entityChanged.subscribe(args => {
                this.entityChangedSubject.next(args);
            });
        }
        return this._manager;
    }

    get entityChanged() {
        return this.entityChangedSubject.asObservable();
    }

    static get committed() {
        return UnitOfWork.committedSubject.asObservable();
    }

    static get rejected() {
        return UnitOfWork.rejectedSubject.asObservable();
    }

    constructor(private _emProvider: EntityManagerProvider) {
        this.entityChangedSubject = new Subject<EntityChangedEventArgs>();
    }

    hasChanges(): boolean {
        return this.manager.hasChanges();
    }

    getChanges(): Entity[] {
        return this.manager.getChanges();
    }

    commit(): Promise<Entity[]> {
        const saveOptions = new SaveOptions({ resourceName: 'savechanges' });

        return this.manager.saveChanges(null, saveOptions)
            .then(saveResult => {
                UnitOfWork.committedSubject.next(saveResult.entities);

                return saveResult.entities;
            });
    }

    rollback(): void {
        const pendingChanges = this.manager.getChanges();
        this.manager.rejectChanges();
        UnitOfWork.rejectedSubject.next(pendingChanges);
    }

    clear(): void {
        this._emProvider.reset(this.manager);
    }

    shelve(key: string, clear: boolean = false): void {
        const data = this.manager.exportEntities(null, { asString: false, includeMetadata: false });
        UnitOfWork.shelveSets[key] = data;
        if (clear) {
            this._emProvider.reset(this.manager);
        }
    }

    unshelve(key: string, clear: boolean = true): boolean {
        const data = UnitOfWork.shelveSets[key];
        if (!data) {
            return false;
        }

        if (clear) {
            // Clear the entity manager and don't bother importing lookup data from masterManager.
            this.manager.clear();
        }
        this.manager.importEntities(data);

        // Delete the shelveSet
        delete UnitOfWork.shelveSets[key];
        return true;
    }

    static deleteShelveSet(key: string): void {
        delete UnitOfWork.shelveSets[key];
    }

    protected createRepository<T>(entityTypeName: string, resourceName: string, isCached: boolean = false) {
        return new Repository<T>(this.manager, entityTypeName, resourceName, isCached);
    }

    protected createFactory<T extends Entity>(entityTypeName: string) {
        return new EntityFactory<T>(entityTypeName, this.manager);
    }
}
