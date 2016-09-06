import { EntityBase } from './entity-base';
import { StaffingResource } from './staffing-resource';

/// <code-import> Place custom imports between <code-import> tags

/// </code-import>

export class WorkExperienceItem extends EntityBase {

    /// <code> Place custom code between <code> tags
    /// [Initializer]
    static initializer(entity: WorkExperienceItem) { }
    /// </code>

    // Generated code. Do not place code below this line.
    id: string;
    from: Date;
    to: Date;
    positionTitle: string;
    company: string;
    location: string;
    description: string;
    staffingResourceId: string;
    created: Date;
    createdUser: string;
    modified: Date;
    modifyUser: string;
    rowVersion: number;
    staffingResource: StaffingResource;
}

