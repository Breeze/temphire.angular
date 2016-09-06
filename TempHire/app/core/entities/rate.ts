import { EntityBase } from './entity-base';
import { StaffingResource } from './staffing-resource';
import { RateType } from './rate-type';

/// <code-import> Place custom imports between <code-import> tags

/// </code-import>

export class Rate extends EntityBase {

    /// <code> Place custom code between <code> tags
    /// [Initializer]
    static initializer(entity: Rate) { }
    /// </code>

    // Generated code. Do not place code below this line.
    id: string;
    amount: number;
    rateTypeId: string;
    staffingResourceId: string;
    created: Date;
    createdUser: string;
    modified: Date;
    modifyUser: string;
    rowVersion: number;
    rateType: RateType;
    staffingResource: StaffingResource;
}

