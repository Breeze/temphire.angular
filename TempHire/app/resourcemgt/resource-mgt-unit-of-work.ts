import { Injectable } from '@angular/core';
import { Entity, EntityManager, FilterQueryOp, Predicate } from 'breeze-client';

import { EntityFactory, EntityManagerProvider, IEntityFactory, IRepository, UnitOfWork } from '../core/services/common';

import { AddressType, PhoneNumberType, StaffingResource, State } from '../core/entities/entity-model';

export interface StaffingResourceListItem {
    id: string;
    firstName: string;
    middleName: string;
    lastName: string;
    fullName: string;
    address1: string;
    address2: string;
    city: string;
    state: string;
    zipcode: string;
    areaCode: string;
    number: string;
    phoneNumber: string;
}

export class StaffingResourceFactory extends EntityFactory<StaffingResource> {

    constructor(manager: EntityManager, private addressTypes: IRepository<AddressType>, private phoneNumberTypes: IRepository<PhoneNumberType>) {
        super('StaffingResource', manager);
    }

    create(config: { firstName: string, middleName: string, lastName: string }): Promise<StaffingResource> {
        return super.create(config).then(staffingResource => {
            const predicate = new Predicate('default', FilterQueryOp.Equals, true);
            return Promise.all([
                this.addressTypes.where(predicate),
                this.phoneNumberTypes.where(predicate)
            ]).then(result => {
                const addressTypeId = result[0][0].id;
                const phoneNumberTypeId = result[1][0].id;

                staffingResource.addAddress(addressTypeId).primary = true;
                staffingResource.addPhoneNumber(phoneNumberTypeId).primary = true;

                return staffingResource;
            });
        });
    }
}

@Injectable()
export class ResourceMgtUnitOfWork extends UnitOfWork {

    staffingResourceListItems: IRepository<StaffingResourceListItem>;
    staffingResources: IRepository<StaffingResource>;
    addressTypes: IRepository<AddressType>;
    phoneNumberTypes: IRepository<PhoneNumberType>;

    states: IRepository<State>;

    staffingResourceFactory: StaffingResourceFactory;

    constructor(emProvider: EntityManagerProvider) {
        super(emProvider);
        this.staffingResourceListItems = this.createRepository<StaffingResourceListItem>(null, 'resourcemgt/staffingresourcelistitems');
        this.staffingResources = this.createRepository<StaffingResource>('StaffingResource', 'resourcemgt/staffingresources');
        this.addressTypes = this.createRepository<AddressType>('AddressType', 'resourcemgt/addresstypes', true);
        this.phoneNumberTypes = this.createRepository<PhoneNumberType>('PhoneNumberType', 'resourcemgt/phonenumbertypes', true);

        this.states = this.createRepository<State>('State', 'resourcemgt/states', true);

        this.staffingResourceFactory = new StaffingResourceFactory(this.manager, this.addressTypes, this.phoneNumberTypes);
    }
}
