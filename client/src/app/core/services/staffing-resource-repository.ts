import { EntityManager, EntityQuery, FilterQueryOp } from 'breeze-client';

import { StaffingResource } from '../model';
import { Repository } from './repository';

/**
 * Port of `DomainServices/Repositories/StaffingResourceRepository.cs`.  The repository decides what
 * loading a resource brings with it, so every caller of `withId` gets a resource with all of its
 * children, and none has to know which ones the screens need.
 *
 * The original's `GetKeyQuery` included the addresses and phone numbers, and DevForce's
 * `RelatedEntityList<T>` faulted the other collections in lazily.  Breeze has no lazy loading, so
 * every child collection is requested up front with `expand`.
 */
export class StaffingResourceRepository extends Repository<StaffingResource> {
  constructor(manager: EntityManager) {
    super(manager, StaffingResource);
  }

  /**
   * The resource with its addresses, phone numbers, rates, skills and work experience, or `null`
   * if there is none.  Always from the server: a resource already in the cache (from a save, say)
   * isn't known to have its children loaded.
   */
  override async withId(key: string): Promise<StaffingResource | null> {
    const query = EntityQuery.from(StaffingResource)
      .where('id', FilterQueryOp.Equals, key)
      .expand(['addresses', 'phoneNumbers', 'rates', 'skills', 'workExperience'].join(','));

    const results = await this.executeQuery(query);

    return results[0] ?? null;
  }
}
