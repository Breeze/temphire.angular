import { EntityBase } from './entity-base';
import { StaffingResource } from './staffing-resource';

/// <code-import> Place custom imports between <code-import> tags

/// </code-import>

export class Skill extends EntityBase {

    /// <code> Place custom code between <code> tags
    /// [Initializer]
    static initializer(entity: Skill) { }
    /// </code>

    // Generated code. Do not place code below this line.
    id: string;
    description: string;
    staffingResourceId: string;
    created: Date;
    createdUser: string;
    modified: Date;
    modifyUser: string;
    rowVersion: number;
    staffingResource: StaffingResource;
}

