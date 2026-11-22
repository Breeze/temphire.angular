import {
  EntityManager,
  EntityQuery,
  FetchStrategy,
  MetadataStore,
  QueryResult,
} from 'breeze-client';
import { vi } from 'vitest';

import metadata from '../../../../metadata.json';
import { StaffingResource, registerModelClasses } from '../model';
import { StaffingResourceRepository } from './staffing-resource-repository';
import { StaffingResourceSearchService } from './staffing-resource-search-service';

/**
 * The resource repository decides what loading a resource brings with it, so no caller has to: the
 * detail screens show every child collection, and Breeze loads only what is expanded.
 */
describe('StaffingResourceRepository and StaffingResourceSearchService', () => {
  const metadataStore = new MetadataStore();
  metadataStore.importMetadata(metadata);
  registerModelClasses(metadataStore);

  /** A manager whose queries are recorded and answered with `results`. */
  function setUp(results: unknown[] = []) {
    const manager = new EntityManager({ metadataStore });
    const queries: EntityQuery[] = [];
    vi.spyOn(manager, 'executeQuery').mockImplementation(async (query) => {
      queries.push(query as unknown as EntityQuery);
      return { results } as unknown as QueryResult;
    });
    return { manager, queries };
  }

  it('loads a resource with all of its children, from the server', async () => {
    const resource = new StaffingResource();
    const { manager, queries } = setUp([resource]);

    expect(await new StaffingResourceRepository(manager).withId('id-1')).toBe(resource);

    const [query] = queries;
    expect(query.resourceName).toBe('StaffingResources');
    expect(query.expandClause?.propertyPaths).toEqual([
      'addresses',
      'phoneNumbers',
      'rates',
      'skills',
      'workExperience',
    ]);
    expect(query.wherePredicate?.toString()).toContain('id-1');
    expect(query.queryOptions?.fetchStrategy).toBe(FetchStrategy.FromServer);
  });

  it('answers null for a resource that does not exist', async () => {
    const { manager } = setUp([]);
    expect(await new StaffingResourceRepository(manager).withId('missing')).toBeNull();
  });

  it('searches the list items with the text as a parameter', async () => {
    const { manager, queries } = setUp([{ id: 'id-1' }]);

    expect(await new StaffingResourceSearchService(manager).simple('Ann')).toEqual([
      { id: 'id-1' },
    ]);
    expect(await new StaffingResourceSearchService(manager).simple()).toEqual([{ id: 'id-1' }]);

    expect(queries.map((query) => query.resourceName)).toEqual([
      'StaffingResourceListItems',
      'StaffingResourceListItems',
    ]);
    expect(queries.map((query) => query.parameters)).toEqual([
      { searchText: 'Ann' },
      { searchText: '' },
    ]);
  });
});
