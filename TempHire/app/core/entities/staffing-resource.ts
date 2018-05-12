import { core } from 'breeze-client';

import { Address } from './address';
import { EntityBase } from './entity-base';
import { PhoneNumber } from './phone-number';
import { Rate } from './rate';
import { Skill } from './skill';
import { WorkExperienceItem } from './work-experience-item';

interface IChild {
    staffingResourceId: string;
}
/// </code-import>

export class StaffingResource extends EntityBase {

    /// <code> Place custom code between <code> tags
    constructor() {
        super();
        this.id = core.getUuid();
    }

    addAddress(typeId: string): Address {
        return this.entityAspect.entityManager.createEntity('Address', { addressTypeId: typeId, staffingResourceId: this.id }) as Address;
    }

    addPhoneNumber(typeId: string): PhoneNumber {
        return this.entityAspect.entityManager.createEntity('PhoneNumber', { phoneNumberTypeId: typeId, staffingResourceId: this.id }) as PhoneNumber;
    }

    deletePhoneNumber(phoneNumber: PhoneNumber) {
        this.ensureEntityType(phoneNumber, 'PhoneNumber');
        this.throwIfNotOwnerOf(phoneNumber);

        phoneNumber.entityAspect.setDeleted();
    }

    setPrimaryPhoneNumber(phoneNumber: PhoneNumber) {
        this.ensureEntityType(phoneNumber, 'PhoneNumber');
        this.throwIfNotOwnerOf(phoneNumber);

        this.phoneNumbers.forEach(x => x.primary = false);
        phoneNumber.primary = true;
    }

    deleteAddress(address: Address) {
        this.ensureEntityType(address, 'Address');
        this.throwIfNotOwnerOf(address);

        address.entityAspect.setDeleted();
    }

    setPrimaryAddress(address: Address) {
        this.ensureEntityType(address, 'Address');
        this.throwIfNotOwnerOf(address);

        this.addresses.forEach(x => x.primary = false);
        address.primary = true;
    }

    get fullName(): string {
        return ['firstName', 'middleName', 'lastName']
            .map(x => this[x])
            .filter(x => !!x)
            .reduce((prev, cur) => prev ? `${prev} ${cur}` : cur, '');
    }

    private throwIfNotOwnerOf(obj: any) {
        if (!obj.staffingResourceId || obj.staffingResourceId !== this.id) {
            throw new Error('Object is not associated with current StaffingResource');
        }
    }

    private ensureEntityType(obj: EntityBase, entityTypeName: string) {
        if (!obj.entityType || obj.entityType.shortName !== entityTypeName) {
            throw new Error('Object must be an entity of type ' + entityTypeName);
        }
    }

    delete() {
        const children = this.entityAspect.entityManager.getEntities().filter(entity => {
            const child = entity as any as IChild;
            return child.staffingResourceId && child.staffingResourceId === this.id;
        });

        children.forEach(entity => entity.entityAspect.setDeleted());
        this.entityAspect.setDeleted();
    }

    /// [Initializer]
    static initializer(entity: StaffingResource) { }
    /// </code>

    // Generated code. Do not place code below this line.
    id: string;
    firstName: string;
    middleName: string;
    lastName: string;
    summary: string;
    created: Date;
    createdUser: string;
    modified: Date;
    modifyUser: string;
    rowVersion: number;
    addresses: Address[];
    phoneNumbers: PhoneNumber[];
    rates: Rate[];
    skills: Skill[];
    workExperience: WorkExperienceItem[];
}
