import { EntityManager, EntityQuery, FilterQueryOp } from 'breeze-client';

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
import { IEntityFactory, UnitOfWork } from './unit-of-work';

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

  /**
   * Port of `DomainServices/Factories/StaffingResourceFactory.cs`, now the generic factory.  The
   * original pre-populated a new resource with a default (primary) address and phone number, so that
   * the "must have at least one of each" rule was satisfied the moment the entity existed.  Here the
   * resource is created alone: the rule is in the validation metadata, so the resource breaks it, and
   * nothing is saved, until the user adds an address and a phone number.
   */
  readonly staffingResourceFactory: IEntityFactory<StaffingResource>;

  constructor(emProvider: EntityManagerProvider, onCommitted?: () => void) {
    super(emProvider, onCommitted);

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

    this.staffingResourceFactory = this.createFactory(StaffingResource);
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
