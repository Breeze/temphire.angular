import { core } from 'breeze-client';

import { AuditEntityBase } from './base-entity';
import { RateType } from './lookups';
import type { StaffingResource } from './staffing-resource';

/** Ported from `DomainModel/Rate.cs`. */
export class Rate extends AuditEntityBase {
  id!: string;
  amount!: number;

  staffingResourceId!: string;
  rateTypeId!: string;

  staffingResource!: StaffingResource;
  rateType!: RateType;

  constructor() {
    super();
    this.id = core.getUuid();
  }

  get root(): StaffingResource {
    return this.staffingResource;
  }

  static initializer(_entity: Rate) {}
}
