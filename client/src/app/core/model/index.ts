// @generated-by generate-entity-classes v1.1.0
// This whole file is generated. Put hand-written code in a separate module.
//
// registerModelClasses attaches these classes to one MetadataStore. Breeze binds a class to a
// single store - registering the same class in a second store throws - so call it once, on the
// store the managers under test share.
import type { MetadataStore } from 'breeze-client';
export { ComplexObjectBase, EntityBase } from 'breeze-client';
export { BaseEntity } from './base-entity';
import { Address } from './address';
import { AddressType } from './address-type';
import { PhoneNumber } from './phone-number';
import { PhoneNumberType } from './phone-number-type';
import { Rate } from './rate';
import { RateType } from './rate-type';
import { Skill } from './skill';
import { StaffingResource } from './staffing-resource';
import { State } from './state';
import { WorkExperienceItem } from './work-experience-item';

export {
  Address,
  AddressType,
  PhoneNumber,
  PhoneNumberType,
  Rate,
  RateType,
  Skill,
  StaffingResource,
  State,
  WorkExperienceItem,
};

/** Every generated class, by the short name Breeze knows it as. */
export const modelClasses = {
  Address,
  AddressType,
  PhoneNumber,
  PhoneNumberType,
  Rate,
  RateType,
  Skill,
  StaffingResource,
  State,
  WorkExperienceItem,
};

/** Register all of them with `metadataStore`. Safe to call twice with the same store. */
export function registerModelClasses(metadataStore: MetadataStore) {
  for (const [name, ctor] of Object.entries(modelClasses)) {
    metadataStore.registerEntityTypeCtor(name, ctor);
  }
}
