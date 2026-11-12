import { MetadataStore } from 'breeze-client';

import metadata from '../../../metadata.json';
import { humanize, setDisplayNames } from './model-display-names';

describe('setDisplayNames', () => {
  function store() {
    const metadataStore = new MetadataStore();
    metadataStore.importMetadata(metadata);
    setDisplayNames(metadataStore);
    return metadataStore;
  }

  const displayName = (metadataStore: MetadataStore, type: string, property: string) =>
    metadataStore.getAsEntityType(type).getProperty(property)?.displayName;

  it('names every property in the model', () => {
    const metadataStore = store();
    const unnamed = metadataStore
      .getEntityTypes()
      .flatMap((type) => type.dataProperties.map((p) => `${type.shortName}.${p.name}`))
      .filter((name) => {
        const [type, property] = name.split('.');
        const value = displayName(metadataStore, type, property);
        return !value || value === property;
      });

    expect(unnamed).toEqual([]);
  });

  it('derives names, and applies the overrides', () => {
    const metadataStore = store();

    expect(displayName(metadataStore, 'StaffingResource', 'firstName')).toBe('First name');
    expect(displayName(metadataStore, 'Address', 'address1')).toBe('Address 1');
    expect(displayName(metadataStore, 'Address', 'stateId')).toBe('State');
    expect(displayName(metadataStore, 'Address', 'state')).toBe('State'); // navigation property
    expect(displayName(metadataStore, 'PhoneNumber', 'number')).toBe('Phone number');
    expect(displayName(metadataStore, 'Skill', 'description')).toBe('Skill');
    expect(displayName(metadataStore, 'Rate', 'createdUser')).toBe('Created by');
  });

  it('is what Breeze names a property in its validation messages', () => {
    const firstName = store().getAsEntityType('StaffingResource').getDataProperty('firstName');
    const messages = firstName.validators
      .map((validator) =>
        validator.validate('', { property: firstName, propertyName: 'firstName' }),
      )
      .filter((error) => !!error)
      .map((error) => error!.errorMessage);

    expect(messages).toEqual(["'First name' is required"]);
  });
});

describe('humanize', () => {
  it.each([
    ['positionTitle', 'Position title'],
    ['address1', 'Address 1'],
    ['stateId', 'State'],
    ['staffingResourceId', 'Staffing resource'],
    ['id', 'ID'],
    ['to', 'To'],
  ])('%s -> %s', (name, expected) => {
    expect(humanize(name)).toBe(expected);
  });
});
