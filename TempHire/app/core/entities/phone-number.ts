import { core } from 'breeze-client';

import { EntityBase } from './entity-base';
import { PhoneNumberType } from './phone-number-type';
import { StaffingResource } from './staffing-resource';
/// </code-import>

export class PhoneNumber extends EntityBase {

    /// <code> Place custom code between <code> tags
    constructor() {
        super();
        this.id = core.getUuid();
    }

    /// [Initializer]
    static initializer(entity: PhoneNumber) { }
    /// </code>

    // Generated code. Do not place code below this line.
    id: string;
    areaCode: string;
    number: string;
    phoneNumberTypeId: string;
    staffingResourceId: string;
    primary: boolean;
    created: Date;
    createdUser: string;
    modified: Date;
    modifyUser: string;
    rowVersion: number;
    phoneNumberType: PhoneNumberType;
    staffingResource: StaffingResource;
}
