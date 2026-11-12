import { core } from 'breeze-client';

import { AuditEntityBase } from './base-entity';
import type { StaffingResource } from './staffing-resource';

/** Ported from `DomainModel/WorkExperienceItem.cs`. */
export class WorkExperienceItem extends AuditEntityBase {
  id!: string;
  from!: Date;
  to!: Date;
  positionTitle!: string;
  company!: string;
  location!: string;
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

  static initializer(_entity: WorkExperienceItem) {}
}
