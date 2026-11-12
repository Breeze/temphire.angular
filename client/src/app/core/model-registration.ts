import { MetadataStore, Validator } from 'breeze-client';

import { setDisplayNames } from './model-display-names';
import { Address, Rate, registerModelClasses } from './model';

/**
 * Binds the generated entity classes to the entity types in the server metadata, gives every
 * property a friendly display name for validation messages (`setDisplayNames`), and adds the few
 * validation rules that cannot be inferred from the model.
 *
 * In the DevForce app there was nothing to do here: client and server shared the same assembly, so
 * the behaviour and the `[Required]` / `[StringLength]` annotations came along for free.  Breeze
 * splits that in two:
 *
 *  - the annotations *are* still shared, because Breeze reads them off the EF Core model and ships
 *    them in the metadata as validators, so `[Required]` on `Address.City` still lights up the
 *    client-side validation;
 *  - the *behaviour* is not, so the classes in `./model` are registered here to give each entity
 *    type its constructor and its methods.
 *
 * `registerModelClasses` is written by the entity generator (`npm run model:generate`) into
 * `./model/index.ts`, so a new entity type on the server is registered by regenerating rather than
 * by editing a list here.
 *
 * Call this once, on the master manager's store: Breeze binds a class to a single `MetadataStore`,
 * and every other manager shares that store through `createEmptyCopy()`.
 */
export function registerModel(metadataStore: MetadataStore): void {
  registerModelClasses(metadataStore);
  setDisplayNames(metadataStore);
  addValidators(metadataStore);
}

function addValidators(metadataStore: MetadataStore): void {
  // `Address.Validate` on the server rejects a missing state.  The server-side FK is a non-null
  // Guid so Breeze cannot infer "must not be the empty guid" from the metadata; add it explicitly
  // so the user finds out while typing rather than on save.
  const emptyGuid = '00000000-0000-0000-0000-000000000000';
  const stateRequired = new Validator(
    'stateRequired',
    (value: unknown) => !!value && value !== emptyGuid,
    // Worded like Breeze's own `required` message, and named by the property's display name.
    { messageTemplate: "'%displayName%' is required" },
  );

  // Passing the class rather than the name `'Address'` is checked: the class only resolves to an
  // entity type once `registerModelClasses` has run.
  metadataStore.getAsEntityType(Address).getProperty('stateId')?.validators.push(stateRequired);

  // `Rate.Amount` is a non-negative currency value.  DevForce enforced this in the WPF view with a
  // masked numeric editor; Breeze can express it as a real rule on the model.
  const nonNegative = new Validator(
    'nonNegativeNumber',
    (value: unknown) =>
      value === null || value === undefined || (typeof value === 'number' && value >= 0),
    { messageTemplate: '%displayName% must not be negative' },
  );

  metadataStore.getAsEntityType(Rate).getProperty('amount')?.validators.push(nonNegative);
}
