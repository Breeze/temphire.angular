import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ModelValidationMetadataMap } from 'ideablade-validation';
import { provideValidation } from 'ideablade-validation/angular';
import { breezeModelType, breezeValidator } from 'ideablade-validation/breeze';
import { DataService, EntityManager, MetadataStore } from 'breeze-client';

import metadata from '../../../../metadata.json';
import rules from '../../../../../server/TempHire.Server/Validation/validation.metadata.json';
import { PhoneNumber, StaffingResource } from '../../core/model';
import { ResourceMgtUnitOfWork } from '../../core/services/resource-mgt-unit-of-work';
import { ResourcePhoneComponent } from './resource-phone.component';

/**
 * One phone number card: the number written the preferred way when the user leaves the field, and
 * the card repainting for a change made elsewhere.  The rules are the server's, as the app loads
 * them, so the format check is the real `PHONE_NUMBER_FORMAT`.
 */
describe('ResourcePhoneComponent', () => {
  function setUp(number: string) {
    const metadataStore = new MetadataStore();
    metadataStore.importMetadata(metadata);
    const manager = new EntityManager({
      dataService: new DataService({ serviceName: 'api/resourcemgt', hasServerMetadata: false }),
      metadataStore,
    });

    // The unit of work's `changes` signal, bumped from the manager's events as `UnitOfWork` does.
    const changes = signal(0);
    manager.entityChanged.subscribe(() => changes.update((count) => count + 1));

    const phoneNumber = manager.createEntity('PhoneNumber', {
      id: crypto.randomUUID(),
      staffingResourceId: crypto.randomUUID(),
      number,
    }) as unknown as PhoneNumber;

    // What ValidationController serves: the file without its `$` keys.
    const serverRules = Object.fromEntries(
      Object.entries(rules).filter(([key]) => !key.startsWith('$')),
    ) as ModelValidationMetadataMap;

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        // As the app registers them (app.config.ts): the server's rules run with Breeze's own.
        provideValidation({ metadata: serverRules, validators: [breezeValidator], modelTypeResolvers: [breezeModelType] }),
      ],
    });

    const fixture = TestBed.createComponent(ResourcePhoneComponent);
    fixture.componentRef.setInput('phoneNumber', phoneNumber);
    fixture.componentRef.setInput('staffingResource', {} as StaffingResource);
    fixture.componentRef.setInput('readOnly', false);
    fixture.componentRef.setInput('unitOfWork', { changes } as unknown as ResourceMgtUnitOfWork);
    return { fixture, phoneNumber, card: fixture.componentInstance };
  }

  it('writes a valid number as (206) 555-1234 when the user leaves the field', () => {
    const { phoneNumber, card } = setUp('+1 206.555.1234');

    card.formatNumber();

    expect(phoneNumber.number).toBe('(206) 555-1234');
  });

  it('leaves a number the rules refuse as the user typed it', () => {
    const { phoneNumber, card } = setUp('206-555.1234');

    card.formatNumber();

    expect(phoneNumber.number).toBe('206-555.1234');
  });

  /** Regression test for the split into cards; see the address card's. */
  it('shows a change made outside the card', async () => {
    const { fixture, phoneNumber } = setUp('(206) 555-1234');
    await fixture.whenStable();
    const number = () => (fixture.nativeElement.querySelector('input[name="number"]') as HTMLInputElement).value;
    expect(number()).toBe('(206) 555-1234');

    phoneNumber.number = '(425) 555-9876';
    await fixture.whenStable();

    expect(number()).toBe('(425) 555-9876');
  });
});
