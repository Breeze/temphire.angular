import { EntityManager, EntityQuery } from 'breeze-client';

import { StaffingResourceListItem } from '../projections/staffing-resource-list-item';

/**
 * Port of `DomainServices/Services/StaffingResourceSearchService.cs`: the search the unit of work
 * offers as its `search` service, as `IResourceMgtUnitOfWork.Search` did.
 *
 * The predicate and the projection now live on the server (see
 * `ResourceMgtController.StaffingResourceListItems`); the client passes the search text through as a
 * query parameter.  The results are `StaffingResourceListItem` DTOs, not entities, which is why the
 * service queries the unit of work's manager rather than going through a repository.
 */
export class StaffingResourceSearchService {
  constructor(private readonly manager: EntityManager) {}

  /** Port of `Simple(text)`: the resources whose names, primary address or phone match `text`. */
  async simple(text?: string): Promise<StaffingResourceListItem[]> {
    // A DTO has no entity class to pass, so the type argument here is an assertion rather than
    // something Breeze checks against the metadata.
    const query = EntityQuery.from<StaffingResourceListItem>(
      'StaffingResourceListItems',
    ).withParameters({
      searchText: text ?? '',
    });

    const data = await this.manager.executeQuery(query);

    return data.results;
  }
}
