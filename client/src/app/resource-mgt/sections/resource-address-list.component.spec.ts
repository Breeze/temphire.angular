import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideValidation } from 'ideablade-validation/angular';
import { breezeModelType } from 'ideablade-validation/breeze';
import { DataService, Entity, EntityManager, MetadataStore } from 'breeze-client';

import metadata from '../../../../metadata.json';
import { StaffingResource } from '../../core/model';
import { AddressSuggestionService } from '../../core/services/address-suggestion.service';
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
  const washington = { id: crypto.randomUUID(), name: 'Washington' };

  function setUp() {
    const metadataStore = new MetadataStore();
    metadataStore.importMetadata(metadata);
    const manager = new EntityManager({
      dataService: new DataService({ serviceName: 'api/resourcemgt', hasServerMetadata: false }),
      metadataStore,
    });

    // The unit of work's `changes` signal, bumped from the manager's events as `UnitOfWork` does.
    const changes = signal(0);
    manager.entityChanged.subscribe(() => changes.update((count) => count + 1));
    const unitOfWork = {
      changes,
      addressTypes: { allInCache: () => [] },
      states: { allInCache: () => [washington] },
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
        // The fields use the validation framework's form directives; entities supply their own type.
        provideValidation({ modelTypeResolvers: [breezeModelType] }),
        // The type dialog: resolves with the chosen type after the click handler has returned.
        { provide: AppDialogService, useValue: { open: () => Promise.resolve(addAddressType) } },
        // Address completion: one suggestion for anything typed.
        {
          provide: AddressSuggestionService,
          useValue: {
            suggest: () =>
              Promise.resolve({
                attribution: '© OpenStreetMap contributors',
                suggestions: [{ address1: '1600 Capitol Way', city: 'Olympia', stateId: washington.id, label: '1600 Capitol Way, Olympia, WA' }],
              }),
          },
        },
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
    const newAddress = () =>
      staffingResource.addAddress(addAddressType) as unknown as Parameters<ResourceAddressListComponent['fill']>[0];
    return { fixture, rows, newAddress };
  }

  it('shows an address added after the type dialog, without another event', async () => {
    const { fixture, rows } = setUp();
    await fixture.whenStable();
    expect(rows()).toBe(0);

    await fixture.componentInstance.add();
    await fixture.whenStable();

    expect(rows()).toBe(1);
  });

  /**
   * Picking a suggested address fills the form: its first line, city, state and ZIP code, and
   * clears those it doesn't know rather than keep the previous address's.  Address 2 stays.
   */
  it('fills the address with the suggestion the user picked', () => {
    const { fixture, newAddress } = setUp();
    const address = newAddress();
    Object.assign(address, { address1: '9 Old Rd', address2: 'Apt 4', city: 'Tacoma', zipcode: '98401' });

    fixture.componentInstance.fill(address, {
      address1: '1600 Capitol Way',
      city: 'Olympia',
      stateId: washington.id,
      label: '1600 Capitol Way, Olympia, WA',
    });

    expect([address.address1, address.address2, address.city, address.stateId, address.zipcode]).toEqual([
      '1600 Capitol Way',
      'Apt 4',
      'Olympia',
      washington.id,
      '',
    ]);
  });

  it('leaves the state empty for a state the app does not have', () => {
    const { fixture, newAddress } = setUp();
    const address = newAddress();
    address.stateId = washington.id;

    fixture.componentInstance.fill(address, { address1: '1 Main St', stateId: crypto.randomUUID(), label: '1 Main St' });

    expect(address.stateId).toBe('00000000-0000-0000-0000-000000000000');
  });

  /** The autocomplete reports a picked suggestion as the field's value too; only typing writes it. */
  it('writes what the user types to Address 1, not the picked suggestion', () => {
    const { fixture, newAddress } = setUp();
    const address = newAddress();
    const list = fixture.componentInstance;

    list.address1Changed(address, '1600 Cap');
    expect(address.address1).toBe('1600 Cap');

    list.address1Changed(address, { address1: '1600 Capitol Way', label: '1600 Capitol Way, Olympia, WA' });
    expect(address.address1).toBe('1600 Cap');
  });

  it('shows the suggestions with the credit the data asks for', async () => {
    const { fixture } = setUp();

    await fixture.componentInstance.suggest('1600 Cap');

    expect(fixture.componentInstance.suggestions().map((s) => s.label)).toEqual(['1600 Capitol Way, Olympia, WA']);
    expect(fixture.componentInstance.attribution()).toBe('© OpenStreetMap contributors');
  });
});
