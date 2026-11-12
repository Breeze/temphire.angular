// @generated-by generate-entity-classes v1.1.0
// Properties of this type in the server metadata are written here and rewritten on
// every run. Everything else in this file is yours and is never touched.
// To keep one of those too, see the manual markers in ./README.md.

import { BaseEntity } from './base-entity';
import type { StaffingResource } from './staffing-resource';

/** Ported from `DomainModel/Skill.cs`. */
export class Skill extends BaseEntity {
  declare id: string;  // @generated
  declare description: string;  // @generated

  declare staffingResourceId: string;  // @generated
  declare staffingResource: StaffingResource;  // @generated
  declare created: Date;  // @generated
  declare createdUser: string;  // @generated
  declare modified: Date;  // @generated
  declare modifyUser: string;  // @generated
  declare rowVersion: number;  // @generated

  constructor() {
    super();
    this.id = crypto.randomUUID();
  }

  get root(): StaffingResource {
    return this.staffingResource;
  }
}
