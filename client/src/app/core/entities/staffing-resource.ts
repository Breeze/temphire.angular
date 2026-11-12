import { core } from 'breeze-client';

import { Address } from './address';
import { AuditEntityBase } from './base-entity';
import { AddressType, PhoneNumberType, RateType } from './lookups';
import { PhoneNumber } from './phone-number';
import { Rate } from './rate';
import { Skill } from './skill';
import { WorkExperienceItem } from './work-experience-item';

/**
 * The aggregate root, ported from `DomainModel/StaffingResource.cs`.
 *
 * The WPF version put this behaviour on the *server* entity, because DevForce shipped the same
 * assembly to both tiers.  Breeze does not: the server holds a plain POCO and the client entity is
 * where the domain behaviour lives.  The methods below are one-for-one with the originals, with
 * `EntityFacts.EntityAspect.Delete()` becoming `entityAspect.setDeleted()`.
 */
export class StaffingResource extends AuditEntityBase {
  id!: string;
  firstName!: string;
  middleName?: string;
  lastName!: string;
  summary!: string;

  addresses!: Address[];
  phoneNumbers!: PhoneNumber[];
  rates!: Rate[];
  skills!: Skill[];
  workExperience!: WorkExperienceItem[];

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
    const address = this.entityAspect.entityManager!.createEntity('Address', {
      addressTypeId: type.id,
      staffingResourceId: this.id,
    }) as Address;

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
    return this.entityAspect.entityManager!.createEntity('PhoneNumber', {
      phoneNumberTypeId: type.id,
      staffingResourceId: this.id,
    }) as PhoneNumber;
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
    return this.entityAspect.entityManager!.createEntity('Rate', {
      rateTypeId: type.id,
      staffingResourceId: this.id,
      amount: 0,
    }) as Rate;
  }

  deleteRate(rate: Rate): void {
    this.throwIfNotOwnerOf(rate, 'Rate');
    rate.entityAspect.setDeleted();
  }

  addWorkExperience(): WorkExperienceItem {
    const today = new Date();
    return this.entityAspect.entityManager!.createEntity('WorkExperienceItem', {
      staffingResourceId: this.id,
      from: today,
      to: today,
    }) as WorkExperienceItem;
  }

  deleteWorkExperience(item: WorkExperienceItem): void {
    this.throwIfNotOwnerOf(item, 'WorkExperienceItem');
    item.entityAspect.setDeleted();
  }

  addSkill(): Skill {
    return this.entityAspect.entityManager!.createEntity('Skill', {
      staffingResourceId: this.id,
    }) as Skill;
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

    manager
      .getEntities()
      .filter(
        (entity) =>
          (entity as unknown as { staffingResourceId?: string }).staffingResourceId === this.id,
      )
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

  static initializer(_entity: StaffingResource) {}
}
