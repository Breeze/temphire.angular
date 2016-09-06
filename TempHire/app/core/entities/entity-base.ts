import { Entity, EntityAspect, EntityType } from 'breeze-client';

export class EntityBase implements Entity {
    entityAspect: EntityAspect;
    entityType: EntityType;

    get $typeName(): string {
        if (!this.entityAspect) return '';
        return this.entityAspect.getKey().entityType.shortName;
    }
}