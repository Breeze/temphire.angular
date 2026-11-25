import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideValidation } from 'ideablade-validation/angular';
import { breezeModelType } from 'ideablade-validation/breeze';
import { DataService, EntityManager, MetadataStore } from 'breeze-client';

import metadata from '../../../../metadata.json';
import { Address, StaffingResource } from '../../core/model';
import { AddressSuggestionService } from '../../core/services/address-suggestion.service';
import { ResourceMgtUnitOfWork } from '../../core/services/resource-mgt-unit-of-work';
import { ResourceAddressComponent } from './resource-address.component';

/**
 * One address card: address completion, and the card repainting for a change made elsewhere.
 *
 * The address is a real Breeze entity built from the checked-in metadata.  The model classes are
 * not registered (Breeze binds a class to one store per page), and the unit of work is a stand-in
 * with the `changes` signal and the cached states the card reads.
 */
describe('ResourceAddressComponent', () => {
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
    const unitOfWork = { changes, states: { allInCache: () => [washington] } };

    const address = manager.createEntity('Address', {
      id: crypto.randomUUID(),
      staffingResourceId: crypto.randomUUID(),
      address1: '9 Old Rd',
      address2: 'Apt 4',
      city: 'Tacoma',
      zipcode: '98401',
    }) as unknown as Address;

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        // The fields use the validation framework's form directives; entities supply their own type.
        provideValidation({ modelTypeResolvers: [breezeModelType] }),
        // Address completion: one suggestion for anything typed.
        {
          provide: AddressSuggestionService,
          useValue: {
            suggest: () =>
              Promise.resolve({
                attribution: '© OpenStreetMap contributors',
                suggestions: [
                  { address1: '1600 Capitol Way', city: 'Olympia', stateId: washington.id, label: '1600 Capitol Way, Olympia, WA' },
                ],
              }),
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(ResourceAddressComponent);
    fixture.componentRef.setInput('address', address);
    fixture.componentRef.setInput('staffingResource', {} as StaffingResource);
    fixture.componentRef.setInput('readOnly', false);
    fixture.componentRef.setInput('unitOfWork', unitOfWork as unknown as ResourceMgtUnitOfWork);
    return { fixture, address, card: fixture.componentInstance };
  }

  /**
   * Picking a suggested address fills the card: its first line, city, state and ZIP code, and
   * clears those it doesn't know rather than keep the previous address's.  Address 2 stays.
   */
  it('fills the address with the suggestion the user picked', () => {
    const { address, card } = setUp();

    card.fill({ address1: '1600 Capitol Way', city: 'Olympia', stateId: washington.id, label: '1600 Capitol Way, Olympia, WA' });

    expect([address.address1, address.address2, address.city, address.stateId, address.zipcode]).toEqual([
      '1600 Capitol Way',
      'Apt 4',
      'Olympia',
      washington.id,
      '',
    ]);
  });

  it('leaves the state empty for a state the app does not have', () => {
    const { address, card } = setUp();
    address.stateId = washington.id;

    card.fill({ address1: '1 Main St', stateId: crypto.randomUUID(), label: '1 Main St' });

    expect(address.stateId).toBe('00000000-0000-0000-0000-000000000000');
  });

  /** The autocomplete reports a picked suggestion as the field's value too; only typing writes it. */
  it('writes what the user types to Address 1, not the picked suggestion', () => {
    const { address, card } = setUp();

    card.address1Changed('1600 Cap');
    expect(address.address1).toBe('1600 Cap');

    card.address1Changed({ address1: '1600 Capitol Way', label: '1600 Capitol Way, Olympia, WA' });
    expect(address.address1).toBe('1600 Cap');
  });

  it('shows the suggestions with the credit the data asks for', async () => {
    const { card } = setUp();

    await card.suggest('1600 Cap');

    expect(card.suggestions().map((s) => s.label)).toEqual(['1600 Capitol Way, Olympia, WA']);
    expect(card.attribution()).toBe('© OpenStreetMap contributors');
  });

  /**
   * Regression test for the split into cards: a card is OnPush, so a change made outside it - here
   * in code, as Cancel or another card does - must still reach its fields.  It reads the address
   * through `entity`, which follows the unit of work's `changes`.
   */
  it('shows a change made outside the card', async () => {
    const { fixture, address } = setUp();
    await fixture.whenStable();
    const city = () => (fixture.nativeElement.querySelector('input[name="city"]') as HTMLInputElement).value;
    expect(city()).toBe('Tacoma');

    address.city = 'Spokane';
    await fixture.whenStable();

    expect(city()).toBe('Spokane');
  });
});
