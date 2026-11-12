import { core } from 'breeze-client';

import { AuditEntityBase } from './base-entity';
import type { StaffingResource } from './staffing-resource';

/** Ported from `DomainModel/Skill.cs`. */
export class Skill extends AuditEntityBase {
  id!: string;
  description!: string;

  staffingResourceId!: string;
  staffingResource!: StaffingResource;

  constructor() {
    super();
    this.id = core.getUuid();
  }

  get root(): StaffingResource {
    return this.staffingResource;
  }

  static initializer(_entity: Skill) {}
}
