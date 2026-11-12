import { BaseEntity } from './base-entity';

/** Lookup entity - read-only to the client (the server refuses to save it). */
export class AddressType extends BaseEntity {
  id!: string;
  name!: string;
  displayName!: string;
  default!: boolean;
  rowVersion!: number;

  static initializer(_entity: AddressType) {}
}

export class PhoneNumberType extends BaseEntity {
  id!: string;
  name!: string;
  default!: boolean;
  rowVersion!: number;

  static initializer(_entity: PhoneNumberType) {}
}

export class RateType extends BaseEntity {
  id!: string;
  name!: string;
  displayName!: string;
  sequence!: number;
  rowVersion!: number;

  static initializer(_entity: RateType) {}
}

export class State extends BaseEntity {
  id!: string;
  shortName!: string;
  name!: string;
  rowVersion!: number;

  static initializer(_entity: State) {}
}
