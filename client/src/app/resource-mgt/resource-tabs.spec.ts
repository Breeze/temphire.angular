import type { ValidationError } from 'ideablade-validation';
import { EntityType, MetadataStore } from 'breeze-client';

import metadata from '../../../metadata.json';
import validationMetadata from '../../../../server/TempHire.Server/Validation/validation.metadata.json';
import {
  RESOURCE_RULES_ON_TABS,
  TAB_OF_ENTITY_TYPE,
  countByTab,
  describeProblems,
  tabOf,
} from './resource-tabs';

/**
 * The tab marks are only as good as the placement of each error.  An entity type or a rule that is
 * not placed shows no mark anywhere, and nothing else would notice, so these tests fail until
 * someone decides where it goes.
 */

/** The resource's own rules shown in the summary above the tabs: its fields are there. */
const RESOURCE_RULES_IN_SUMMARY = ['ADULT_WHEN_HIRED'];

/** Just what `tabOf` reads of an error. */
function error(modelType: string, id = 'required_name'): ValidationError {
  return { modelType, id } as ValidationError;
}

describe('resource tabs', () => {
  const store = new MetadataStore();
  store.importMetadata(metadata);
  const entityTypes = store.getEntityTypes().filter((type): type is EntityType => type instanceof EntityType);

  it('places every entity type of the model', () => {
    const unplaced = entityTypes.map((type) => type.shortName).filter((name) => !(name in TAB_OF_ENTITY_TYPE));
    expect(unplaced).toEqual([]);
  });

  it('puts every collection of the resource on a tab', () => {
    const resource = store.getAsEntityType('StaffingResource');
    const collections = resource.navigationProperties
      .filter((property) => !property.isScalar)
      .map((property) => (property.entityType as EntityType).shortName);

    expect(collections.length).toBeGreaterThan(0);
    for (const type of collections) {
      expect(TAB_OF_ENTITY_TYPE[type], type).toBeTruthy();
    }
  });

  it("places every one of the resource's own rules", () => {
    const ids = validationMetadata.StaffingResource.validators.map((validator) => validator.id);
    const unplaced = ids.filter((id) => !(id in RESOURCE_RULES_ON_TABS) && !RESOURCE_RULES_IN_SUMMARY.includes(id));
    expect(unplaced).toEqual([]);
  });

  it('places an error by its entity type, and a rule of the resource by the rule', () => {
    expect(tabOf(error('Address'))).toBe('contact');
    expect(tabOf(error('Rate'))).toBe('rates');
    expect(tabOf(error('WorkExperienceItem'))).toBe('work');
    expect(tabOf(error('Skill'))).toBe('skills');
    expect(tabOf(error('StaffingResource', 'PHONE_NUMBER_REQUIRED'))).toBe('contact');
    expect(tabOf(error('StaffingResource', 'ADULT_WHEN_HIRED'))).toBeNull();
    expect(tabOf(error('StaffingResource', 'required_firstName'))).toBeNull();
  });

  it('counts the errors of each tab', () => {
    const counts = countByTab([
      error('Address'),
      error('StaffingResource', 'ADDRESS_REQUIRED'),
      error('Rate'),
      error('StaffingResource', 'ADULT_WHEN_HIRED'),
    ]);
    expect(counts).toEqual({ contact: 2, rates: 1, work: 0, skills: 0 });
  });

  it('says where to look', () => {
    // All on one tab.
    expect(describeProblems([error('Rate')])).toBe('One problem needs fixing, on the Rates tab. It is highlighted.');
    expect(describeProblems([error('Address'), error('StaffingResource', 'PHONE_NUMBER_REQUIRED')])).toBe(
      '2 problems need fixing, on the Contact Information tab. They are highlighted.',
    );
    // All above the tabs, in view.
    expect(describeProblems([error('StaffingResource', 'ADULT_WHEN_HIRED'), error('StaffingResource')])).toBe(
      '2 problems need fixing. They are highlighted.',
    );
  });

  it('gives each place its count when there are several, so the numbers add up', () => {
    // A new resource after Save: the summary, the address and phone rules, and a work experience item.
    expect(
      describeProblems([
        error('StaffingResource', 'required_summary'),
        error('StaffingResource', 'ADDRESS_REQUIRED'),
        error('StaffingResource', 'PHONE_NUMBER_REQUIRED'),
        error('Address'),
        error('Address'),
        error('WorkExperienceItem'),
      ]),
    ).toBe(
      '6 problems need fixing: 1 above the tabs, 4 on the Contact Information tab and 1 on the Work Experience tab. They are highlighted.',
    );
    expect(describeProblems([error('Skill'), error('Address'), error('Rate')])).toBe(
      '3 problems need fixing: 1 on the Contact Information tab, 1 on the Rates tab and 1 on the Skills tab. They are highlighted.',
    );
  });
});
