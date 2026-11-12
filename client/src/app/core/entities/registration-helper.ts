import { MetadataStore, Validator } from 'breeze-client';

import { Address } from './address';
import { AddressType, PhoneNumberType, RateType, State } from './lookups';
import { PhoneNumber } from './phone-number';
import { Rate } from './rate';
import { Skill } from './skill';
import { StaffingResource } from './staffing-resource';
import { WorkExperienceItem } from './work-experience-item';

/**
 * Binds the TypeScript classes above to the entity types in the server metadata, and adds the few
 * validation rules that cannot be inferred from the model.
 *
 * In the DevForce app there was nothing to do here: client and server shared the same assembly, so
 * the behaviour and the `[Required]` / `[StringLength]` annotations came along for free.  Breeze
 * splits that in two:
 *
 *  - the annotations *are* still shared, because Breeze reads them off the EF Core model and ships
 *    them in the metadata as validators, so `[Required]` on `Address.City` still lights up the
 *    client-side validation;
 *  - the *behaviour* is not, so the classes are registered here to give each entity type its
 *    constructor and its methods.
 */
export class RegistrationHelper {
  static register(metadataStore: MetadataStore): void {
    metadataStore.registerEntityTypeCtor(
      'StaffingResource',
      StaffingResource,
      StaffingResource.initializer,
    );
    metadataStore.registerEntityTypeCtor('Address', Address, Address.initializer);
    metadataStore.registerEntityTypeCtor('AddressType', AddressType, AddressType.initializer);
    metadataStore.registerEntityTypeCtor('PhoneNumber', PhoneNumber, PhoneNumber.initializer);
    metadataStore.registerEntityTypeCtor(
      'PhoneNumberType',
      PhoneNumberType,
      PhoneNumberType.initializer,
    );
    metadataStore.registerEntityTypeCtor('Rate', Rate, Rate.initializer);
    metadataStore.registerEntityTypeCtor('RateType', RateType, RateType.initializer);
    metadataStore.registerEntityTypeCtor('Skill', Skill, Skill.initializer);
    metadataStore.registerEntityTypeCtor('State', State, State.initializer);
    metadataStore.registerEntityTypeCtor(
      'WorkExperienceItem',
      WorkExperienceItem,
      WorkExperienceItem.initializer,
    );

    RegistrationHelper.addValidators(metadataStore);
  }

  private static addValidators(metadataStore: MetadataStore): void {
    // `Address.Validate` on the server rejects a missing state.  The server-side FK is a non-null
    // Guid so Breeze cannot infer "must not be the empty guid" from the metadata; add it explicitly
    // so the user finds out while typing rather than on save.
    const emptyGuid = '00000000-0000-0000-0000-000000000000';
    const stateRequired = new Validator(
      'stateRequired',
      (value: unknown) => !!value && value !== emptyGuid,
      { messageTemplate: 'The State field is required' },
    );

    const addressType = metadataStore.getEntityType('Address', true);
    if (addressType) {
      addressType.getProperty('stateId')?.validators.push(stateRequired);
    }

    // `Rate.Amount` is a non-negative currency value.  DevForce enforced this in the WPF view with a
    // masked numeric editor; Breeze can express it as a real rule on the model.
    const nonNegative = new Validator(
      'nonNegativeNumber',
      (value: unknown) =>
        value === null || value === undefined || (typeof value === 'number' && value >= 0),
      { messageTemplate: '%displayName% must not be negative' },
    );

    const rateType = metadataStore.getEntityType('Rate', true);
    if (rateType) {
      rateType.getProperty('amount')?.validators.push(nonNegative);
    }
  }
}
