import { EntityBase } from './entity-base';
import { StaffingResource } from './staffing-resource';
import { PhoneNumberType } from './phone-number-type';

/// <code-import> Place custom imports between <code-import> tags
import { core } from 'breeze-client';
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

