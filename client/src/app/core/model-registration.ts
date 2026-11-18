import { MetadataStore } from 'breeze-client';

import { setDisplayNames } from './model-display-names';
import { registerModelClasses } from './model';

/**
 * Binds the generated entity classes to the entity types in the server metadata and gives every
 * property a friendly display name for validation messages (`setDisplayNames`).
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
 * The rules the annotations cannot express - an address has a state, a rate is not negative, a
 * resource keeps an address and a phone number - are not here either.  They are the server's
 * validation metadata, which `EntityManagerProvider` installs into Breeze next to these.
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
}
