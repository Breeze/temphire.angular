import { EntityBase } from './entity-base';
import { Address } from './address';
import { PhoneNumber } from './phone-number';
import { Rate } from './rate';
import { Skill } from './skill';
import { WorkExperienceItem } from './work-experience-item';

/// <code-import> Place custom imports between <code-import> tags
import { core } from 'breeze-client';
/// </code-import>

export class StaffingResource extends EntityBase {

    /// <code> Place custom code between <code> tags
    constructor() {
        super();
        this.id = core.getUuid();
    }

    addAddress(typeId: string): Address {
        return <Address>this.entityAspect.entityManager.createEntity('Address', { addressTypeId: typeId, staffingResourceId: this.id });
    }

    addPhoneNumber(typeId: string): PhoneNumber {
        return <PhoneNumber>this.entityAspect.entityManager.createEntity('PhoneNumber', { phoneNumberTypeId: typeId, staffingResourceId: this.id });
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

