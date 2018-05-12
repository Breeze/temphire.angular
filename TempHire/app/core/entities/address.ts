import { core } from 'breeze-client';

import { AddressType } from './address-type';
import { EntityBase } from './entity-base';
import { StaffingResource } from './staffing-resource';
import { State } from './state';
/// </code-import>

export class Address extends EntityBase {

    /// <code> Place custom code between <code> tags
    constructor() {
        super();
        this.id = core.getUuid();
    }

    /// [Initializer]
    static initializer(entity: Address) { }
    /// </code>

    // Generated code. Do not place code below this line.
    id: string;
    address1: string;
    address2: string;
    city: string;
    staffingResourceId: string;
    addressTypeId: string;
    zipcode: string;
    primary: boolean;
    stateId: string;
    created: Date;
    createdUser: string;
    modified: Date;
    modifyUser: string;
    rowVersion: number;
    addressType: AddressType;
    staffingResource: StaffingResource;
    state: State;
}
