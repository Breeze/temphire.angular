import { Entity, EntityAspect, EntityType } from 'breeze-client';

/**
 * Client-side root of the domain model.
 *
 * This is the Breeze counterpart of the WPF app's `DomainModel/EntityBase.cs`.  In DevForce the
 * entity carried an `EntityFacts` wrapper around an `EntityAspect`, injected at build time by the
 * `[ProvideEntityAspect]` post-compiler.  Breeze does the same job at runtime: when an entity type
 * is registered with the `MetadataStore`, Breeze attaches an `entityAspect` to every instance.
 *
 * So `entity.EntityFacts.EntityState.IsAdded()` in the old code becomes
 * `entity.entityAspect.entityState.isAdded()` here.
 */
export class BaseEntity implements Entity {
  // Assigned by Breeze when the entity is attached to an EntityManager.
  entityAspect!: EntityAspect;
  entityType!: EntityType;

  /** Convenience mirror of DevForce's `EntityFacts.IsNullOrPendingEntity`. */
  get isDetached(): boolean {
    return !this.entityAspect || this.entityAspect.entityState.isDetached();
  }
}

/**
 * Base for the auditable entities.  Mirrors `AuditEntityBase` on the server: the four audit columns
 * are stamped server-side by `TempHirePersistenceManager`, so the client only ever reads them.
 */
export class AuditEntityBase extends BaseEntity {
  created!: Date;
  createdUser!: string;
  modified!: Date;
  modifyUser!: string;
  rowVersion!: number;
}
