import { EntityManager, EntityQuery, FilterQueryOp, InitialValues, Predicate } from 'breeze-client';

import {
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
} from '../model';
import { StaffingResourceListItem } from '../projections/staffing-resource-list-item';
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
    super(StaffingResource, manager);
  }

  override async create(config?: InitialValues<StaffingResource>): Promise<StaffingResource> {
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

    this.staffingResources = this.createRepository(StaffingResource);
    this.addresses = this.createRepository(Address);
    this.phoneNumbers = this.createRepository(PhoneNumber);
    this.rates = this.createRepository(Rate);
    this.skills = this.createRepository(Skill);
    this.workExperienceItems = this.createRepository(WorkExperienceItem);

    this.addressTypes = this.createRepository(AddressType, true);
    this.phoneNumberTypes = this.createRepository(PhoneNumberType, true);
    this.rateTypes = this.createRepository(RateType, true);
    this.states = this.createRepository(State, true);

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
    // A DTO has no entity class to pass, so the type argument here is an assertion rather than
    // something Breeze checks against the metadata.
    const query = EntityQuery.from<StaffingResourceListItem>(
      'StaffingResourceListItems',
    ).withParameters({
      searchText: searchText ?? '',
    });

    const data = await this.manager.executeQuery(query);

    return data.results;
  }

  /**
   * Loads a resource with everything the detail screen needs.  The original relied on DevForce's
   * `RelatedEntityList<T>` to fault the children in lazily; Breeze has no lazy loading, so the
   * child collections are requested up front with `expand`.
   */
  async loadStaffingResource(id: string): Promise<StaffingResource | null> {
    // `from(StaffingResource)` makes this an `EntityQuery<StaffingResource>`: the resource name
    // comes from the metadata, and `data.results` is `StaffingResource[]` with no cast.
    const query = EntityQuery.from(StaffingResource)
      .where('id', FilterQueryOp.Equals, id)
      .expand(['addresses', 'phoneNumbers', 'rates', 'skills', 'workExperience'].join(','));

    const data = await this.manager.executeQuery(query);

    return data.results[0] ?? null;
  }

  /** Exposes the manager so the detail screens can create entities directly. */
  get entityManager(): EntityManager {
    return this.manager;
  }
}
