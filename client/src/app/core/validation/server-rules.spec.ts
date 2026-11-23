import { ModelValidationMetadataMap, createValidationService } from 'ideablade-validation';
import {
  breezeEntityStore,
  breezeValidator,
  installBreezeValidators,
} from 'ideablade-validation/breeze';
import { DataService, Entity, EntityManager, MetadataStore } from 'breeze-client';

import metadata from '../../../../metadata.json';
import rules from '../../../../../server/TempHire.Server/Validation/validation.metadata.json';
import { displayNameMetadata, setDisplayNames } from '../model-display-names';

/**
 * The server's validation metadata, as the client uses it: installed into Breeze next to Breeze's
 * own rules, with Breeze's display names, and evaluated against the entities in an `EntityManager`.
 * This is what `EntityManagerProvider` sets up at sign-in, with the rules file the server serves.
 *
 * The entities are real Breeze entities built from the checked-in metadata.  The model classes are
 * not registered (Breeze binds a class to one store per page).
 */
describe('the server validation rules on the client', () => {
  const EMPTY_GUID = '00000000-0000-0000-0000-000000000000';

  function setUp() {
    const metadataStore = new MetadataStore();
    metadataStore.importMetadata(metadata);
    setDisplayNames(metadataStore);

    // What ValidationController serves: the file without its `$` keys.
    const serverRules = Object.fromEntries(
      Object.entries(rules).filter(([key]) => !key.startsWith('$')),
    ) as ModelValidationMetadataMap;
    const manager = new EntityManager({
      dataService: new DataService({ serviceName: 'api/resourcemgt', hasServerMetadata: false }),
      metadataStore,
    });

    // A service whose entity store is the manager's entities, as a unit of work's is.
    const service = createValidationService({
      metadata: [serverRules, displayNameMetadata(metadataStore)],
      validators: [breezeValidator],
      entityStore: breezeEntityStore(manager),
    });
    installBreezeValidators(metadataStore, service);

    const resource = manager.createEntity('StaffingResource', {
      id: crypto.randomUUID(),
      firstName: 'Nancy',
      lastName: 'Davolio',
      summary: 'A summary.',
    }) as Entity & { id: string };

    const addAddress = (values: Record<string, unknown> = {}) =>
      manager.createEntity('Address', {
        id: crypto.randomUUID(),
        staffingResourceId: resource.id,
        stateId: crypto.randomUUID(),
        ...values,
      });
    const addPhoneNumber = () =>
      manager.createEntity('PhoneNumber', {
        id: crypto.randomUUID(),
        staffingResourceId: resource.id,
      });
    const ruleIds = () => service.validateModelSync(resource, 'StaffingResource').map((e) => e.id);

    return { manager, service, resource, addAddress, addPhoneNumber, ruleIds };
  }

  it('wants a resource at least 18 years old when hired, and reports it on both dates', () => {
    const { resource, addAddress, addPhoneNumber, service } = setUp();
    addAddress();
    addPhoneNumber();
    resource.setProperty('dateOfBirth', new Date(2000, 4, 15));
    const ids = (hireDate: Date) => {
      resource.setProperty('hireDate', hireDate);
      return service.validateModelSync(resource, 'StaffingResource').map((e) => [e.id, e.errorMessage, e.propertyNames]);
    };

    const tooYoung = [['ADULT_WHEN_HIRED', 'A staffing resource must be at least 18 years old when hired', ['dateOfBirth', 'hireDate']]];
    expect(ids(new Date(2000, 5, 5))).toEqual(tooYoung); // three weeks old
    expect(ids(new Date(2018, 4, 14))).toEqual(tooYoung); // the day before the 18th birthday
    expect(ids(new Date(2018, 4, 15))).toEqual([]); // the 18th birthday
    expect(ids(new Date(2030, 0, 1))).toEqual([]);
  });

  it('wants a plausible date of birth: not in the future, not more than 123 years ago', () => {
    const { resource, addAddress, addPhoneNumber, ruleIds } = setUp();
    addAddress();
    addPhoneNumber();
    const today = new Date();
    const yearsAgo = (years: number, days = 0) =>
      new Date(today.getFullYear() - years, today.getMonth(), today.getDate() - days);
    const idsFor = (dateOfBirth: Date) => {
      resource.setProperty('dateOfBirth', dateOfBirth);
      return ruleIds();
    };

    expect(idsFor(yearsAgo(0, -1))).toEqual(['PLAUSIBLE_DATE_OF_BIRTH']); // tomorrow
    expect(idsFor(yearsAgo(0))).toEqual([]); // today
    expect(idsFor(yearsAgo(40))).toEqual([]);
    expect(idsFor(yearsAgo(123))).toEqual([]); // the oldest still plausible
    expect(idsFor(yearsAgo(123, 1))).toEqual(['PLAUSIBLE_DATE_OF_BIRTH']);
  });

  it('wants a new resource to have an address and a phone number', () => {
    const { addAddress, addPhoneNumber, ruleIds } = setUp();
    expect(ruleIds()).toEqual(['ADDRESS_REQUIRED', 'PHONE_NUMBER_REQUIRED']);

    addAddress();
    expect(ruleIds()).toEqual(['PHONE_NUMBER_REQUIRED']);

    addPhoneNumber();
    expect(ruleIds()).toEqual([]);
  });

  it('notices when the last address is deleted', () => {
    const { addAddress, addPhoneNumber, ruleIds } = setUp();
    const address = addAddress();
    addPhoneNumber();
    expect(ruleIds()).toEqual([]);

    address.entityAspect.setDeleted();
    expect(ruleIds()).toEqual(['ADDRESS_REQUIRED']);
  });

  it('has Breeze check a property rule, named by Breeze display name', () => {
    const { addAddress } = setUp();
    const address = addAddress({ stateId: EMPTY_GUID });

    // Attaching validated the new address; the installed rule reported on its property.
    expect(address.entityAspect.getValidationErrors('stateId').map((e) => e.errorMessage)).toEqual([
      "'State' is required",
    ]);

    address.setProperty('stateId', crypto.randomUUID());
    expect(address.entityAspect.getValidationErrors('stateId')).toEqual([]);
  });

  describe('field formats', () => {
    /** The messages of the validation metadata's rules about one property (Breeze's own left out). */
    function messagesFor(entityType: string, values: Record<string, unknown>, property: string) {
      const { manager, resource, service } = setUp();
      const entity = manager.createEntity(entityType, {
        id: crypto.randomUUID(),
        staffingResourceId: resource.id,
        ...values,
      });
      return service
        .validateModelSync(entity, entityType, { predicate: (v) => v.name !== 'breeze' })
        .filter((e) => e.isFor(property))
        .map((e) => e.errorMessage);
    }

    it('wants a U.S. ZIP code', () => {
      expect(messagesFor('Address', { zipcode: '98101' }, 'zipcode')).toEqual([]);
      expect(messagesFor('Address', { zipcode: '98101-1234' }, 'zipcode')).toEqual([]);
      expect(messagesFor('Address', { zipcode: 'SW1 8JR' }, 'zipcode')).toEqual([
        "'Zipcode' must be a U.S. ZIP code, like 98101 or 98101-1234",
      ]);
    });

    it('wants a 3-digit area code and a 7-digit number, with a dash or a dot after 3 digits', () => {
      expect(messagesFor('PhoneNumber', { areaCode: '206' }, 'areaCode')).toEqual([]);
      expect(messagesFor('PhoneNumber', { areaCode: '20a' }, 'areaCode')).toEqual(["'Area code' must be 3 digits"]);
      expect(messagesFor('PhoneNumber', { areaCode: '20' }, 'areaCode')).toEqual(["'Area code' must be 3 digits"]);

      for (const number of ['555-1234', '555.1234', '5551234']) {
        expect(messagesFor('PhoneNumber', { number }, 'number')).toEqual([]);
      }
      for (const number of ['55-51234', '555-123', '555 1234', '555-12345']) {
        expect(messagesFor('PhoneNumber', { number }, 'number')).toEqual([
          "'Phone number' must be 7 digits, like 555-1234",
        ]);
      }
    });

    it('wants valid dates', () => {
      expect(messagesFor('WorkExperienceItem', { from: new Date(2020, 0, 1) }, 'from')).toEqual([]);
      expect(messagesFor('WorkExperienceItem', { from: new Date(Number.NaN) }, 'from')).toEqual([
        "'From' must be a valid date",
      ]);
      const { resource, service } = setUp();
      resource.setProperty('hireDate', new Date(Number.NaN));
      expect(
        service
          .validateModelSync(resource, 'StaffingResource', { predicate: (v) => v.name === 'date' })
          .map((e) => e.errorMessage),
      ).toEqual(["'Hire date' must be a valid date"]);
    });

    it('wants a valid amount', () => {
      expect(messagesFor('Rate', { amount: 125.5 }, 'amount')).toEqual([]);
      expect(messagesFor('Rate', { amount: 'lots' }, 'amount')).toContain("'Rate' must be a valid amount");
    });
  });

  it('uses the display name overrides', () => {
    const { manager, resource } = setUp();
    const rate = manager.createEntity('Rate', {
      id: crypto.randomUUID(),
      staffingResourceId: resource.id,
      amount: -1,
    });

    expect(rate.entityAspect.getValidationErrors('amount').map((e) => e.errorMessage)).toEqual([
      'Rate must not be negative',
    ]);
  });

  it('stops a save that breaks a rule before it leaves the client', async () => {
    const { manager } = setUp();

    const error = await manager.saveChanges().then(
      () => undefined,
      (e: { entityErrors?: { errorMessage: string }[] }) => e,
    );

    expect(error?.entityErrors?.map((e) => e.errorMessage)).toContain(
      'A staffing resource must have at least one address; A staffing resource must have at least one phone number',
    );
  });
});
