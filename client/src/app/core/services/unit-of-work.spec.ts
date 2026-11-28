import { EntityManager, EntityState, MetadataStore } from 'breeze-client';

import metadata from '../../../../metadata.json';
import { Address, StaffingResource, registerModelClasses } from '../model';
import { EntityManagerProvider } from './entity-manager-provider';
import { UnitOfWork } from './unit-of-work';

/**
 * Breeze keeps an entity Modified when an edit is undone by hand; the unit of work returns it to
 * Unchanged, so Save and Cancel (`hasChanges`) go back to disabled.
 */
describe('UnitOfWork', () => {
  const metadataStore = new MetadataStore();
  metadataStore.importMetadata(metadata);
  registerModelClasses(metadataStore);

  /** A unit of work, and a resource with one address loaded into it from the "server". */
  function setUp() {
    const emProvider = {
      newManager: () => new EntityManager({ metadataStore }),
    } as unknown as EntityManagerProvider;
    const uow = new (class extends UnitOfWork {
      attach<T>(entity: T, state = EntityState.Unchanged) {
        return this.manager.attachEntity(entity as never, state) as T;
      }
    })(emProvider, 'api/test');

    const resource = uow.attach(
      Object.assign(new StaffingResource(), {
        id: '11111111-1111-1111-1111-111111111111',
        firstName: 'Anna',
        lastName: 'Lindqvist',
        hireDate: new Date(2020, 0, 15),
      }),
    );
    const address = uow.attach(
      Object.assign(new Address(), {
        id: '22222222-2222-2222-2222-222222222222',
        staffingResourceId: resource.id,
        city: 'Seattle',
      }),
    );
    return { uow, resource, address };
  }

  it('returns an entity to Unchanged when its value is typed back', () => {
    const { uow, resource } = setUp();

    resource.firstName = 'Ann';
    expect(resource.entityAspect.entityState).toBe(EntityState.Modified);
    expect(uow.hasChanges()).toBe(true);

    resource.firstName = 'Anna';
    expect(resource.entityAspect.entityState).toBe(EntityState.Unchanged);
    expect(uow.hasChanges()).toBe(false);
  });

  it('stays Modified while any property still differs', () => {
    const { uow, resource } = setUp();

    resource.firstName = 'Ann';
    resource.lastName = 'Lind';
    resource.firstName = 'Anna';

    expect(resource.entityAspect.entityState).toBe(EntityState.Modified);
    expect(resource.entityAspect.getChangedProperties()).toEqual(['lastName']);
    expect(uow.hasChanges()).toBe(true);
  });

  it('compares dates by time, not by instance', () => {
    const { uow, resource } = setUp();

    resource.hireDate = new Date(2021, 5, 1);
    resource.hireDate = new Date(2020, 0, 15);

    expect(resource.entityAspect.entityState).toBe(EntityState.Unchanged);
    expect(uow.hasChanges()).toBe(false);
  });

  it('judges each related entity on its own', () => {
    const { uow, resource, address } = setUp();

    resource.firstName = 'Ann';
    address.city = 'Tacoma';
    resource.firstName = 'Anna';

    expect(resource.entityAspect.entityState).toBe(EntityState.Unchanged);
    expect(address.entityAspect.entityState).toBe(EntityState.Modified);
    expect(uow.hasChanges()).toBe(true);

    address.city = 'Seattle';
    expect(address.entityAspect.entityState).toBe(EntityState.Unchanged);
    expect(uow.hasChanges()).toBe(false);
  });

  it('leaves an Added entity Added', () => {
    const { uow, resource } = setUp();
    const added = uow.attach(
      Object.assign(new Address(), { id: '33333333-3333-3333-3333-333333333333' }),
      EntityState.Added,
    );
    added.staffingResourceId = resource.id;
    added.city = 'Spokane';
    added.city = '';

    expect(added.entityAspect.entityState).toBe(EntityState.Added);
    expect(uow.hasChanges()).toBe(true);
  });
});
