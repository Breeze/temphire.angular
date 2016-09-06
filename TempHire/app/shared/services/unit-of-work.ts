import { Injectable } from '@angular/core';
import { EntityManager, Entity, EntityQuery, FetchStrategy, SaveOptions, core } from 'breeze-client';

import { EntityManagerProvider } from '../../core/services/common';
import { IRepository, Repository} from './repository';

export interface IEntityFactory<T extends Entity> {
    create(...params: any[]): T;
}

@Injectable()
export class EntityFactory<T extends Entity> implements IEntityFactory<T> {

    constructor(private _type: { new (): T; }, private _manager: EntityManager) {
    }

    create(config?: any): T {
        let entityTypeName: string = (<any>this._type).name;
        let inst = <T>this._manager.createEntity(entityTypeName, config);
        // OLD version - did not allow config.
        // let inst = new this.type();
        // this.entityManagerProvider.manager().addEntity(inst);
        return inst;
    }
}

export class SavedOrRejectedEventArgs {
    entities: Entity[];
}

export class SavedOrRejectedEvent extends core.Event {
    subscribe(callback?: (data: SavedOrRejectedEventArgs) => void): number {
        return super.subscribe(callback);
    }
}

@Injectable()
export class UnitOfWork {

    private _manager: EntityManager;
    private static shelveSets = {};

    static savedOrRejected: SavedOrRejectedEvent = new SavedOrRejectedEvent('savedOrEjected', {});

    protected get manager(): EntityManager {
        return this._manager || (this._manager = this._emProvider.newManager());
    }

    get entityChanged() {
        return this.manager.entityChanged;
    }

    constructor(private _emProvider: EntityManagerProvider) { }

    hasChanges(): boolean {
        return this.manager.hasChanges();
    }

    getChanges(): Entity[] {
        return this.manager.getChanges();
    }

    commit(): Promise<any> {
        let saveOptions = new SaveOptions({ resourceName: 'savechanges' });

        return this.manager.saveChanges(null, saveOptions)
            .then((saveResult) => {
                UnitOfWork.savedOrRejected.publish({
                    entities: saveResult.entities
                });

                return saveResult.entities;
            });
    }

    rollback(): void {
        let pendingChanges = this.manager.getChanges();
        this.manager.rejectChanges();
        UnitOfWork.savedOrRejected.publish({
            entities: pendingChanges
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

    protected createFactory<T extends Entity>(type: { new (): T; }) {
        return new EntityFactory<T>(type, this.manager);
    }
}

