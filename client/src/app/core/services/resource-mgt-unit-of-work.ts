import { EntityManager, EntityQuery, FilterQueryOp, Predicate } from 'breeze-client';

import { Address } from '../entities/address';
import { AddressType, PhoneNumberType, RateType, State } from '../entities/lookups';
import { PhoneNumber } from '../entities/phone-number';
import { Rate } from '../entities/rate';
import { Skill } from '../entities/skill';
import { StaffingResourceListItem } from '../entities/staffing-resource-list-item';
import { StaffingResource } from '../entities/staffing-resource';
import { WorkExperienceItem } from '../entities/work-experience-item';
import { EntityManagerProvider } from './entity-manager-provider';
import { IRepository } from './repository';
import { EntityFactory, UnitOfWork } from './unit-of-work';

/**
 * Port of `DomainServices/Factories/StaffingResourceFactory.cs`.
 *
 * Creates a resource pre-populated with a default (primary) address and phone number, so that the
 * "must have at least one of each" rule is satisfied the moment the entity exists.  The default
 * types come out of the cached lookup repositories - no server round trip - exactly as the original
 * did through `GlobalCacheRepository`.
 */
export class StaffingResourceFactory extends EntityFactory<StaffingResource> {
  constructor(
    manager: EntityManager,
    private readonly addressTypes: IRepository<AddressType>,
    private readonly phoneNumberTypes: IRepository<PhoneNumberType>,
  ) {
    super('StaffingResource', manager);
  }

  override async create(config?: Record<string, unknown>): Promise<StaffingResource> {
    const staffingResource = await super.create(config);

    const isDefault = new Predicate('default', FilterQueryOp.Equals, true);
    const [addressTypes, phoneNumberTypes] = await Promise.all([
      this.addressTypes.where(isDefault),
      this.phoneNumberTypes.where(isDefault),
    ]);

    if (!addressTypes.length || !phoneNumberTypes.length) {
      throw new Error('No default address type or phone number type is configured.');
    }

    staffingResource.addAddress(addressTypes[0]).primary = true;
    staffingResource.addPhoneNumber(phoneNumberTypes[0]).primary = true;

    return staffingResource;
  }
}

/**
 * Port of `DomainServices/IResourceMgtUnitOfWork.cs` + `ResourceMgtUnitOfWork.cs`.
 *
 * The lookup repositories pass `isCached = true`, which is the Breeze equivalent of DevForce's
 * `QueryStrategy.CacheOnly` on a `GlobalCacheRepository`.
 */
export class ResourceMgtUnitOfWork extends UnitOfWork {
  readonly staffingResources: IRepository<StaffingResource>;
  readonly addresses: IRepository<Address>;
  readonly phoneNumbers: IRepository<PhoneNumber>;
  readonly rates: IRepository<Rate>;
  readonly skills: IRepository<Skill>;
  readonly workExperienceItems: IRepository<WorkExperienceItem>;

  readonly addressTypes: IRepository<AddressType>;
  readonly phoneNumberTypes: IRepository<PhoneNumberType>;
  readonly rateTypes: IRepository<RateType>;
  readonly states: IRepository<State>;

  readonly staffingResourceFactory: StaffingResourceFactory;

  constructor(emProvider: EntityManagerProvider) {
    super(emProvider);

    this.staffingResources = this.createRepository<StaffingResource>(
      'StaffingResource',
      'StaffingResources',
    );
    this.addresses = this.createRepository<Address>('Address', 'Addresses');
    this.phoneNumbers = this.createRepository<PhoneNumber>('PhoneNumber', 'PhoneNumbers');
    this.rates = this.createRepository<Rate>('Rate', 'Rates');
    this.skills = this.createRepository<Skill>('Skill', 'Skills');
    this.workExperienceItems = this.createRepository<WorkExperienceItem>(
      'WorkExperienceItem',
      'WorkExperienceItems',
    );

    this.addressTypes = this.createRepository<AddressType>('AddressType', 'AddressTypes', true);
    this.phoneNumberTypes = this.createRepository<PhoneNumberType>(
      'PhoneNumberType',
      'PhoneNumberTypes',
      true,
    );
    this.rateTypes = this.createRepository<RateType>('RateType', 'RateTypes', true);
    this.states = this.createRepository<State>('State', 'States', true);

    this.staffingResourceFactory = new StaffingResourceFactory(
      this.manager,
      this.addressTypes,
      this.phoneNumberTypes,
    );
  }

  /**
   * Port of `DomainServices/Services/StaffingResourceSearchService.Simple`.
   *
   * The predicate itself now lives on the server (see `BreezeController.StaffingResourceListItems`);
   * the client just passes the search text through as a query parameter.  The result is a plain DTO
   * array rather than entities, which is why it bypasses the repositories.
   */
  async search(searchText?: string): Promise<StaffingResourceListItem[]> {
    const query = EntityQuery.from('StaffingResourceListItems').withParameters({
      searchText: searchText ?? '',
    });

    const data = await this.manager.executeQuery(query);

    return data.results as unknown as StaffingResourceListItem[];
  }

  /**
   * Loads a resource with everything the detail screen needs.  The original relied on DevForce's
   * `RelatedEntityList<T>` to fault the children in lazily; Breeze has no lazy loading, so the
   * child collections are requested up front with `expand`.
   */
  async loadStaffingResource(id: string): Promise<StaffingResource | null> {
    const query = EntityQuery.from('StaffingResources')
      .where('id', FilterQueryOp.Equals, id)
      .expand(['addresses', 'phoneNumbers', 'rates', 'skills', 'workExperience'].join(','));

    const data = await this.manager.executeQuery(query);
    const results = data.results as unknown as StaffingResource[];

    return results.length ? results[0] : null;
  }

  /** Exposes the manager so the detail screens can create entities directly. */
  get entityManager(): EntityManager {
    return this.manager;
  }
}
