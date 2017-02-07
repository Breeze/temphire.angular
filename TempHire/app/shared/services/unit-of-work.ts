import { Injectable } from '@angular/core';
import { EntityManager, Entity, EntityQuery, FetchStrategy, SaveOptions, EntityChangedEventArgs } from 'breeze-client';
import { Subject } from 'rxjs/Subject';

import { EntityManagerProvider } from '../../core/services/common';
import { IRepository, Repository} from './repository';

export interface IEntityFactory<T extends Entity> {
    create(...params: any[]): Promise<T>;
}

@Injectable()
export class EntityFactory<T extends Entity> implements IEntityFactory<T> {

    constructor(private entityTypeName: string, private manager: EntityManager) {
    }

    create(config?: any): Promise<T> {
        let inst = <T>this.manager.createEntity(this.entityTypeName, config);
        // OLD version - did not allow config.
        // let inst = new this.type();
        // this.entityManagerProvider.manager().addEntity(inst);
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
    private static savedOrRejectedSubject = new Subject<SavedOrRejectedArgs>();

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

    static get savedOrRejected() {
        return UnitOfWork.savedOrRejectedSubject.asObservable();
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

    commit(): Promise<any> {
        let saveOptions = new SaveOptions({ resourceName: 'savechanges' });

        return <any>this.manager.saveChanges(null, saveOptions)
            .then((saveResult) => {
                UnitOfWork.savedOrRejectedSubject.next({
                    entities: saveResult.entities,
                    rejected: false
                });

                return saveResult.entities;
            });
    }

    rollback(): void {
        let pendingChanges = this.manager.getChanges();
        this.manager.rejectChanges();
        UnitOfWork.savedOrRejectedSubject.next({
            entities: pendingChanges,
            rejected: true
        });
    }

    clear(): void {
        this._emProvider.reset(this.manager);
    }

    shelve(key: string, clear: boolean = false): void {
        let data = this.manager.exportEntities(null, { asString: false, includeMetadata: false });
        UnitOfWork.shelveSets[key] = data;
        if (clear) {
            this._emProvider.reset(this.manager);
        }
    }

    unshelve(key: string, clear: boolean = true): boolean {
        let data = UnitOfWork.shelveSets[key];
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

