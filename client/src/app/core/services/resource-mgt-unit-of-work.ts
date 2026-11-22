import { EntityManager } from 'breeze-client';

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
import { EntityManagerProvider } from './entity-manager-provider';
import { IRepository } from './repository';
import { StaffingResourceRepository } from './staffing-resource-repository';
import { StaffingResourceSearchService } from './staffing-resource-search-service';
import { IEntityFactory, UnitOfWork } from './unit-of-work';

/**
 * Port of `DomainServices/IResourceMgtUnitOfWork.cs` + `ResourceMgtUnitOfWork.cs`.
 *
 * The lookup repositories pass `isCached = true`, which is the Breeze equivalent of DevForce's
 * `QueryStrategy.CacheOnly` on a `GlobalCacheRepository`.
 */
export class ResourceMgtUnitOfWork extends UnitOfWork {
  /**
   * Its `withId` loads a resource with all of its children: what the detail screens expect of any
   * resource they show.
   */
  readonly staffingResources: StaffingResourceRepository;
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

  /** Port of `IResourceMgtUnitOfWork.Search`: the search pane's query. */
  readonly search: StaffingResourceSearchService;

  constructor(emProvider: EntityManagerProvider, onCommitted?: () => void) {
    super(emProvider, onCommitted);

    this.staffingResources = new StaffingResourceRepository(this.manager);
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

    this.search = new StaffingResourceSearchService(this.manager);
  }

  /** Exposes the manager so the detail screens can create entities directly. */
  get entityManager(): EntityManager {
    return this.manager;
  }
}
