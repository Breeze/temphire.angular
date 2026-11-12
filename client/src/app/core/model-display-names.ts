import { EntityType, MetadataStore } from 'breeze-client';

import { modelClasses } from './model';

type ModelName = keyof typeof modelClasses;
type PropertyName<K extends ModelName> = keyof InstanceType<(typeof modelClasses)[K]> & string;

/**
 * Display names that differ from what `humanize` derives from the property name - mostly to match
 * the labels on screen, so that a message names the field the user can see.
 *
 * Keyed by the generated classes, so a misspelt type or property, or one the server has dropped, is
 * a compile error.
 */
const DISPLAY_NAMES: { [K in ModelName]?: Partial<Record<PropertyName<K>, string>> } = {
  Address: { zipcode: 'Zipcode' },
  PhoneNumber: { number: 'Phone number', phoneNumberTypeId: 'Phone type' },
  Rate: { amount: 'Rate' },
  Skill: { description: 'Skill' },
  WorkExperienceItem: { positionTitle: 'Position' },
};

/** Audit columns, the same on every entity that has them. */
const COMMON_DISPLAY_NAMES: Record<string, string> = {
  createdUser: 'Created by',
  modifyUser: 'Modified by',
};

/**
 * Gives every property in the model a friendly display name.
 *
 * Breeze names a property in its validation messages by its `displayName` - "'%displayName%' is
 * required" - and falls back to the property name.  The Breeze .NET server does not send display
 * names, so without this the user would read "'firstName' is required".  Display names can be set
 * on the client once the metadata has loaded; `registerModel` does it straight after.
 *
 * Each name is the override from `DISPLAY_NAMES` if there is one, else derived from the property
 * name: `positionTitle` becomes "Position title", `address1` "Address 1", and a foreign key such as
 * `stateId` is named after what it points to, "State".  The name editor's Signal Form uses the same
 * Breeze validators (`validateWithBreeze`), so its messages read the same way.
 */
export function setDisplayNames(metadataStore: MetadataStore): void {
  for (const type of metadataStore.getEntityTypes()) {
    const overrides: Record<string, string | undefined> =
      DISPLAY_NAMES[type.shortName as ModelName] ?? {};
    const properties = [
      ...type.dataProperties,
      ...(type instanceof EntityType ? type.navigationProperties : []),
    ];

    for (const property of properties) {
      property.displayName =
        overrides[property.name] ?? COMMON_DISPLAY_NAMES[property.name] ?? humanize(property.name);
    }
  }
}

/** `positionTitle` -> "Position title", `address1` -> "Address 1", `stateId` -> "State", `id` -> "ID". */
export function humanize(propertyName: string): string {
  if (propertyName === 'id') {
    return 'ID';
  }

  const words = propertyName
    .replace(/(.)Id$/, '$1') // a foreign key is named after what it refers to
    .replace(/([a-z])([A-Z0-9])/g, '$1 $2')
    .toLowerCase();

  return words.charAt(0).toUpperCase() + words.slice(1);
}
