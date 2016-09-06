import { MetadataStore } from 'breeze-client';

import { Address } from './address';
import { AddressType } from './address-type';
import { StaffingResource } from './staffing-resource';
import { PhoneNumber } from './phone-number';
import { PhoneNumberType } from './phone-number-type';
import { Rate } from './rate';
import { RateType } from './rate-type';
import { Skill } from './skill';
import { WorkExperienceItem } from './work-experience-item';
import { State } from './state';

export class RegistrationHelper {

    static register(metadataStore: MetadataStore) {
        metadataStore.registerEntityTypeCtor('Address', Address, Address.initializer);
        metadataStore.registerEntityTypeCtor('AddressType', AddressType, AddressType.initializer);
        metadataStore.registerEntityTypeCtor('StaffingResource', StaffingResource, StaffingResource.initializer);
        metadataStore.registerEntityTypeCtor('PhoneNumber', PhoneNumber, PhoneNumber.initializer);
        metadataStore.registerEntityTypeCtor('PhoneNumberType', PhoneNumberType, PhoneNumberType.initializer);
        metadataStore.registerEntityTypeCtor('Rate', Rate, Rate.initializer);
        metadataStore.registerEntityTypeCtor('RateType', RateType, RateType.initializer);
        metadataStore.registerEntityTypeCtor('Skill', Skill, Skill.initializer);
        metadataStore.registerEntityTypeCtor('WorkExperienceItem', WorkExperienceItem, WorkExperienceItem.initializer);
        metadataStore.registerEntityTypeCtor('State', State, State.initializer);
    }
}
