// @generated-by generate-entity-classes v1.1.0
// Properties of this type in the server metadata are written here and rewritten on
// every run. Everything else in this file is yours and is never touched.
// To keep one of those too, see the manual markers in ./README.md.
import { core } from 'breeze-client';

import { Address } from './address';
import { BaseEntity } from './base-entity';
import type { AddressType } from './address-type';
import type { PhoneNumberType } from './phone-number-type';
import type { RateType } from './rate-type';
import { PhoneNumber } from './phone-number';
import { Rate } from './rate';
import { Skill } from './skill';
import { WorkExperienceItem } from './work-experience-item';
import type { RelationArray } from 'breeze-client'; // @generated

/**
 * The aggregate root, ported from `DomainModel/StaffingResource.cs`.
 *
 * The WPF version put this behaviour on the *server* entity, because DevForce shipped the same
 * assembly to both tiers.  Breeze does not: the server holds a plain POCO and the client entity is
 * where the domain behaviour lives.  The methods below are one-for-one with the originals, with
 * `EntityFacts.EntityAspect.Delete()` becoming `entityAspect.setDeleted()`.
 */
export class StaffingResource extends BaseEntity {
  declare id: string;  // @generated
  declare firstName: string;  // @generated
  declare middleName: string;  // @generated
  declare lastName: string;  // @generated
  declare summary: string;  // @generated

  declare addresses: RelationArray<Address>;  // @generated
  declare phoneNumbers: RelationArray<PhoneNumber>;  // @generated
  declare rates: RelationArray<Rate>;  // @generated
  declare skills: RelationArray<Skill>;  // @generated
  declare workExperience: RelationArray<WorkExperienceItem>;  // @generated
  declare created: Date;  // @generated
  declare createdUser: string;  // @generated
  declare modified: Date;  // @generated
  declare modifyUser: string;  // @generated
  declare rowVersion: number;  // @generated

  constructor() {
    super();
    // DevForce used CombGuid.NewGuid() so that clustered indexes stayed happy; the server maps the
    // key with DatabaseGeneratedOption.None, so the client is still responsible for generating it.
    this.id = core.getUuid();
  }

  /** Port of the `FullName` calculated property. */
  get fullName(): string {
    return [this.firstName, this.middleName, this.lastName]
      .map((part) => (part ?? '').trim())
      .filter((part) => part.length > 0)
      .join(' ');
  }

  /** Port of the `PrimaryAddress` property getter. */
  get primaryAddress(): Address | undefined {
    return (this.addresses ?? []).find((a) => a.primary);
  }

  /** Port of the `PrimaryPhoneNumber` property getter. */
  get primaryPhoneNumber(): PhoneNumber | undefined {
    return (this.phoneNumbers ?? []).find((p) => p.primary);
  }

  addAddress(type: AddressType): Address {
    const address = this.entityAspect.entityManager!.createEntity(Address, {
      addressTypeId: type.id,
      staffingResourceId: this.id,
    });

    return address;
  }

  deleteAddress(address: Address): void {
    this.throwIfNotOwnerOf(address, 'Address');
    address.entityAspect.setDeleted();
  }

  /**
   * Port of the `PrimaryAddress` setter, which cleared the flag on every sibling before setting it.
   */
  setPrimaryAddress(address: Address): void {
    this.throwIfNotOwnerOf(address, 'Address');
    this.addresses.forEach((a) => (a.primary = false));
    address.primary = true;
  }

  addPhoneNumber(type: PhoneNumberType): PhoneNumber {
    return this.entityAspect.entityManager!.createEntity(PhoneNumber, {
      phoneNumberTypeId: type.id,
      staffingResourceId: this.id,
    });
  }

  deletePhoneNumber(phoneNumber: PhoneNumber): void {
    this.throwIfNotOwnerOf(phoneNumber, 'PhoneNumber');
    phoneNumber.entityAspect.setDeleted();
  }

  setPrimaryPhoneNumber(phoneNumber: PhoneNumber): void {
    this.throwIfNotOwnerOf(phoneNumber, 'PhoneNumber');
    this.phoneNumbers.forEach((p) => (p.primary = false));
    phoneNumber.primary = true;
  }

  addRate(type: RateType): Rate {
    return this.entityAspect.entityManager!.createEntity(Rate, {
      rateTypeId: type.id,
      staffingResourceId: this.id,
      amount: 0,
    });
  }

  deleteRate(rate: Rate): void {
    this.throwIfNotOwnerOf(rate, 'Rate');
    rate.entityAspect.setDeleted();
  }

  addWorkExperience(): WorkExperienceItem {
    const today = new Date();
    return this.entityAspect.entityManager!.createEntity(WorkExperienceItem, {
      staffingResourceId: this.id,
      from: today,
      to: today,
    });
  }

  deleteWorkExperience(item: WorkExperienceItem): void {
    this.throwIfNotOwnerOf(item, 'WorkExperienceItem');
    item.entityAspect.setDeleted();
  }

  addSkill(): Skill {
    return this.entityAspect.entityManager!.createEntity(Skill, {
      staffingResourceId: this.id,
    });
  }

  deleteSkill(skill: Skill): void {
    this.throwIfNotOwnerOf(skill, 'Skill');
    skill.entityAspect.setDeleted();
  }

  /**
   * Deletes the resource together with everything hanging off it.
   *
   * DevForce cascaded this on the server through the EF model; Breeze sends an explicit change set,
   * so the children have to be marked deleted here or the save would violate the foreign keys.
   */
  delete(): void {
    const manager = this.entityAspect.entityManager;
    if (!manager) {
      return;
    }

    // Passing the classes types the result as `(Address | PhoneNumber | ...)[]`, so
    // `staffingResourceId` is checked against every child type rather than reached through a cast.
    manager
      .getEntities([Address, PhoneNumber, Rate, Skill, WorkExperienceItem])
      .filter((entity) => entity.staffingResourceId === this.id)
      .forEach((entity) => {
        if (!entity.entityAspect.entityState.isDeleted()) {
          entity.entityAspect.setDeleted();
        }
      });

    this.entityAspect.setDeleted();
  }

  private throwIfNotOwnerOf(child: { staffingResourceId?: string }, typeName: string): void {
    if (!child || child.staffingResourceId !== this.id) {
      throw new Error(`${typeName} is not associated with this StaffingResource.`);
    }
  }
}
