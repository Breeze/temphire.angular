import { ModelValidationMetadataMap, createValidationService } from '@ideablade/validation';
import {
  breezeStoreQuery,
  breezeValidator,
  installBreezeValidators,
} from '@ideablade/validation/breeze';
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
    const service = createValidationService({
      metadata: [serverRules, displayNameMetadata(metadataStore)],
      validators: [breezeValidator],
      storeResolvers: [breezeStoreQuery],
    });
    installBreezeValidators(metadataStore, service);

    const manager = new EntityManager({
      dataService: new DataService({ serviceName: 'api/breeze', hasServerMetadata: false }),
      metadataStore,
    });

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

    return { manager, resource, addAddress, addPhoneNumber, ruleIds };
  }

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
