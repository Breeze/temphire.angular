// @generated-by generate-entity-classes v1.1.0
// Properties of this type in the server metadata are written here and rewritten on
// every run. Everything else in this file is yours and is never touched.
// To keep one of those too, see the manual markers in ./README.md.
import { core } from 'breeze-client';

import { BaseEntity } from './base-entity';
import type { AddressType } from './address-type';
import type { State } from './state';
import type { StaffingResource } from './staffing-resource';

/** Ported from `DomainModel/Address.cs`. */
export class Address extends BaseEntity {
  declare id: string;  // @generated
  declare address1: string;  // @generated
  declare address2: string;  // @generated
  declare city: string;  // @generated
  declare zipcode: string;  // @generated
  declare primary: boolean;  // @generated

  declare staffingResourceId: string;  // @generated
  declare addressTypeId: string;  // @generated
  declare stateId: string;  // @generated

  declare staffingResource: StaffingResource;  // @generated
  declare addressType: AddressType;  // @generated
  declare state: State;  // @generated
  declare created: Date;  // @generated
  declare createdUser: string;  // @generated
  declare modified: Date;  // @generated
  declare modifyUser: string;  // @generated
  declare rowVersion: number;  // @generated

  constructor() {
    super();
    this.id = core.getUuid();
    this.primary = false;
  }

  /** Port of `IHasRoot.Root`. */
  get root(): StaffingResource {
    return this.staffingResource;
  }
}
