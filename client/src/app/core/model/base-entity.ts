import { EntityBase } from 'breeze-client';

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
 *
 * Every generated entity class extends this one: `npm run model:generate` passes
 * `--base BaseEntity`.  Unlike the generated classes, this file is never rewritten.  The audit
 * columns (`created`, `modifyUser`, ...) that the server's `AuditEntityBase` contributes are not
 * declared here; the generator writes them onto each entity that has them.
 */
export class BaseEntity extends EntityBase {
  // `EntityBase` declares the members Breeze installs: `entityAspect`, `entityType`,
  // `getProperty` and `setProperty`.

  /** Convenience mirror of DevForce's `EntityFacts.IsNullOrPendingEntity`. */
  get isDetached(): boolean {
    return !this.entityAspect || this.entityAspect.entityState.isDetached();
  }
}
