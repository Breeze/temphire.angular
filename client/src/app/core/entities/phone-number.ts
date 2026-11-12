import { core } from 'breeze-client';

import { AuditEntityBase } from './base-entity';
import { PhoneNumberType } from './lookups';
import type { StaffingResource } from './staffing-resource';

/** Ported from `DomainModel/PhoneNumber.cs`. */
export class PhoneNumber extends AuditEntityBase {
  id!: string;
  areaCode!: string;
  number!: string;
  primary!: boolean;

  staffingResourceId!: string;
  phoneNumberTypeId!: string;

  staffingResource!: StaffingResource;
  phoneNumberType!: PhoneNumberType;

  constructor() {
    super();
    this.id = core.getUuid();
    this.primary = false;
  }

  get root(): StaffingResource {
    return this.staffingResource;
  }

  static initializer(_entity: PhoneNumber) {}
}
