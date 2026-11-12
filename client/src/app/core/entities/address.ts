import { core } from 'breeze-client';

import { AuditEntityBase } from './base-entity';
import { AddressType, State } from './lookups';
import type { StaffingResource } from './staffing-resource';

/** Ported from `DomainModel/Address.cs`. */
export class Address extends AuditEntityBase {
  id!: string;
  address1!: string;
  address2?: string;
  city!: string;
  zipcode!: string;
  primary!: boolean;

  staffingResourceId!: string;
  addressTypeId!: string;
  stateId!: string;

  staffingResource!: StaffingResource;
  addressType!: AddressType;
  state!: State;

  constructor() {
    super();
    this.id = core.getUuid();
    this.primary = false;
  }

  /** Port of `IHasRoot.Root`. */
  get root(): StaffingResource {
    return this.staffingResource;
  }

  static initializer(_entity: Address) {}
}
