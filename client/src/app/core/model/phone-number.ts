// @generated-by generate-entity-classes v1.1.0
// Properties of this type in the server metadata are written here and rewritten on
// every run. Everything else in this file is yours and is never touched.
// To keep one of those too, see the manual markers in ./README.md.

import { BaseEntity } from './base-entity';
import type { PhoneNumberType } from './phone-number-type';
import type { StaffingResource } from './staffing-resource';

/** Ported from `DomainModel/PhoneNumber.cs`. */
export class PhoneNumber extends BaseEntity {
  declare id: string;  // @generated
  declare number: string;  // @generated
  declare primary: boolean;  // @generated

  declare staffingResourceId: string;  // @generated
  declare phoneNumberTypeId: string;  // @generated

  declare staffingResource: StaffingResource;  // @generated
  declare phoneNumberType: PhoneNumberType;  // @generated
  declare created: Date;  // @generated
  declare createdUser: string;  // @generated
  declare modified: Date;  // @generated
  declare modifyUser: string;  // @generated
  declare rowVersion: number;  // @generated

  constructor() {
    super();
    this.id = crypto.randomUUID();
    this.primary = false;
  }

  get root(): StaffingResource {
    return this.staffingResource;
  }
}

/**
 * A U.S. phone number written the preferred way, `(206) 555-1234`: its ten digits, after a country
 * code 1 in front if there is one.  Undefined when the value doesn't have ten digits that way.
 *
 * It only rearranges digits; whether the value was a phone number to begin with is the
 * `PHONE_NUMBER_FORMAT` rule's to say, so check that first (the phone card does, on blur).
 */
export function formatPhoneNumber(value: string | null | undefined): string | undefined {
  let digits = (value ?? '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    digits = digits.slice(1);
  }
  return digits.length === 10 ? `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}` : undefined;
}
