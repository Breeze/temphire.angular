import { Injectable } from '@angular/core';

import { EntityManagerProvider } from '../core/services/entity-manager-provider';
import { UnitOfWork, IRepository } from '../shared/services/common';

import { StaffingResource, State, AddressType, PhoneNumberType } from '../core/entities/entity-model';

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

@Injectable()
export class ResourceMgtUnitOfWork extends UnitOfWork {

    staffingResourceListItems: IRepository<StaffingResourceListItem>;
    staffingResources: IRepository<StaffingResource>;
    addressTypes: IRepository<AddressType>;
    phoneNumberTypes: IRepository<PhoneNumberType>;

    states: IRepository<State>;

    constructor(emProvider: EntityManagerProvider) {
        super(emProvider);
        this.staffingResourceListItems = this.createRepository<StaffingResourceListItem>(null, 'resourcemgt/staffingresourcelistitems');
        this.staffingResources = this.createRepository<StaffingResource>('StaffingResource', 'resourcemgt/staffingresources');
        this.addressTypes = this.createRepository<AddressType>('AddressType', 'resourcemgt/addresstypes', true);
        this.phoneNumberTypes = this.createRepository<PhoneNumberType>('PhoneNumberType', 'resourcemgt/phonenumbertypes', true);

        this.states = this.createRepository<State>('State', 'resourcemgt/states', true);
    }
}