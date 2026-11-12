import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DataService, Entity, EntityManager, MetadataStore } from 'breeze-client';

import metadata from '../../../../metadata.json';
import { StaffingResource } from '../../core/model';
import { AppDialogService } from '../../core/services/dialog.service';
import { ResourceMgtUnitOfWork } from '../../core/services/resource-mgt-unit-of-work';
import { ResourceAddressListComponent } from './resource-address-list.component';

/**
 * Regression test: an address added after the type dialog closes must appear at once.
 *
 * The add finishes after an `await`, outside any event in the component, so with zoneless OnPush
 * change detection nothing re-rendered the list - the new address only showed up on the next event
 * in the section.  The section now derives its rows from the unit of work's `changes` signal.
 *
 * The entities are real Breeze entities built from the checked-in metadata, so `addresses` is a
 * real relation array that Breeze changes in place.  The model classes are not registered (Breeze
 * binds a class to one store per page), so `addAddress` is stood in for.
 */
describe('ResourceAddressListComponent', () => {
  function setUp() {
    const metadataStore = new MetadataStore();
    metadataStore.importMetadata(metadata);
    const manager = new EntityManager({
      dataService: new DataService({ serviceName: 'api/breeze', hasServerMetadata: false }),
      metadataStore,
    });

    // The unit of work's `changes` signal, bumped from the manager's events as `UnitOfWork` does.
    const changes = signal(0);
    manager.entityChanged.subscribe(() => changes.update((count) => count + 1));
    const unitOfWork = {
      changes,
      addressTypes: { allInCache: () => [] },
      states: { allInCache: () => [] },
    };

    const resource = manager.createEntity('StaffingResource', {
      id: crypto.randomUUID(),
      firstName: 'Steven',
      lastName: 'Buchanan',
    }) as Entity & { id: string };
    const addAddressType = { id: crypto.randomUUID(), displayName: 'Work Address' };
    const staffingResource = Object.assign(resource, {
      addAddress: (type: { id: string }) =>
        manager.createEntity('Address', {
          id: crypto.randomUUID(),
          addressTypeId: type.id,
          staffingResourceId: resource.id,
        }),
    });

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        // The type dialog: resolves with the chosen type after the click handler has returned.
        { provide: AppDialogService, useValue: { open: () => Promise.resolve(addAddressType) } },
      ],
    });

    const fixture = TestBed.createComponent(ResourceAddressListComponent);
    fixture.componentRef.setInput(
      'staffingResource',
      staffingResource as unknown as StaffingResource,
    );
    fixture.componentRef.setInput('readOnly', false);
    fixture.componentRef.setInput('unitOfWork', unitOfWork as unknown as ResourceMgtUnitOfWork);

    const rows = () => fixture.nativeElement.querySelectorAll('.address').length;
    return { fixture, rows };
  }

  it('shows an address added after the type dialog, without another event', async () => {
    const { fixture, rows } = setUp();
    await fixture.whenStable();
    expect(rows()).toBe(0);

    await fixture.componentInstance.add();
    await fixture.whenStable();

    expect(rows()).toBe(1);
  });
});
