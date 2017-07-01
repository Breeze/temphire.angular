import { Component, Input, OnInit } from '@angular/core';
import sortBy from 'lodash-es/sortBy';

import { StaffingResource, State, PhoneNumber, Address, AddressType, PhoneNumberType } from '../core/entities/entity-model';
import { ResourceMgtUnitOfWork } from './resource-mgt-unit-of-work';

@Component({
    selector: 'resource-contacts',
    templateUrl: './resource-contacts.html'
})
export class ResourceContactsComponent implements OnInit {

    @Input() model: StaffingResource;

    states: State[];
    addressTypes: AddressType[];
    phoneNumberTypes: PhoneNumberType[];

    constructor(private unitOfWork: ResourceMgtUnitOfWork) { }

    ngOnInit() {
        this.unitOfWork.states.all().then(data => {
            this.states = sortBy(data, x => x.name);
        });

        this.unitOfWork.addressTypes.all().then(data => {
            this.addressTypes = sortBy(data, x => x.displayName);
        });

        this.unitOfWork.phoneNumberTypes.all().then(data => {
            this.phoneNumberTypes = sortBy(data, x => x.name);
        });
    }

    addPhoneNumber(type: PhoneNumberType) {
        this.model.addPhoneNumber(type.id);
    }

    deletePhoneNumber(phoneNumber: PhoneNumber) {
        if (phoneNumber.primary || this.model.phoneNumbers.length === 1) return;

        this.model.deletePhoneNumber(phoneNumber);
    }

    setPrimaryPhoneNumber(phoneNumber: PhoneNumber) {
        if (phoneNumber.primary) return;

        this.model.setPrimaryPhoneNumber(phoneNumber);
    }

    addAddress(type: AddressType) {
        this.model.addAddress(type.id);
    }

    deleteAddress(address: Address) {
        if (address.primary || this.model.addresses.length === 1) return;

        this.model.deleteAddress(address);
    }

    setPrimaryAddress(address: Address) {
        if (address.primary) return;

        this.model.setPrimaryAddress(address);
    }
}