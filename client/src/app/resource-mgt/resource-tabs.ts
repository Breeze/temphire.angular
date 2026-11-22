import type { ValidationError } from '@ideablade/validation';

/**
 * The detail screen's tabs, and which of them shows each validation error.
 *
 * The tabs mark the ones with errors to show, so a problem on a tab the user is not looking at
 * does not have to be hunted for.  The marks come from the entities, not from the fields: three of
 * the four tabs are deferred, so a tab that has not been opened yet has no fields to ask.  Which
 * tab an error belongs to follows from the type of the entity it is about, and for the resource's
 * own rules from the rule.  `resource-tabs.spec.ts` checks that every entity type and every rule
 * of the resource is placed, so a new one cannot quietly end up with no mark anywhere.
 */
export type ResourceTab = 'contact' | 'rates' | 'work' | 'skills';

export interface ResourceTabInfo {
  readonly value: ResourceTab;
  readonly label: string;
}

/** In the order of the WPF sections' `Index`: see `ResourceDetailComponent`. */
export const RESOURCE_TABS: readonly ResourceTabInfo[] = [
  { value: 'contact', label: 'Contact Information' },
  { value: 'rates', label: 'Rates' },
  { value: 'work', label: 'Work Experience' },
  { value: 'skills', label: 'Skills' },
];

/**
 * The tab that shows the errors of each entity type.  `null`: not on a tab.  The resource's own
 * fields are in the summary above the tabs, which is always in view (its rules are placed one by
 * one, below), and the lookups are read-only.
 */
export const TAB_OF_ENTITY_TYPE: Readonly<Record<string, ResourceTab | null>> = {
  StaffingResource: null,
  Address: 'contact',
  PhoneNumber: 'contact',
  Rate: 'rates',
  WorkExperienceItem: 'work',
  Skill: 'skills',
  AddressType: null,
  PhoneNumberType: null,
  RateType: null,
  State: null,
};

/**
 * The resource's rules about its related entities, shown with those entities' lists rather than in
 * the summary.  Its other rules are about its own fields, in the summary.
 */
export const RESOURCE_RULES_ON_TABS: Readonly<Record<string, ResourceTab>> = {
  ADDRESS_REQUIRED: 'contact',
  PHONE_NUMBER_REQUIRED: 'contact',
};

/** The tab that shows `error`, or `null` when it is shown above the tabs. */
export function tabOf(error: ValidationError): ResourceTab | null {
  if (error.modelType === 'StaffingResource') {
    return RESOURCE_RULES_ON_TABS[error.id] ?? null;
  }
  return TAB_OF_ENTITY_TYPE[error.modelType] ?? null;
}

/** How many of `errors` each tab shows. */
export function countByTab(errors: readonly ValidationError[]): Record<ResourceTab, number> {
  const counts: Record<ResourceTab, number> = { contact: 0, rates: 0, work: 0, skills: 0 };
  for (const error of errors) {
    const tab = tabOf(error);
    if (tab) {
      counts[tab]++;
    }
  }
  return counts;
}

/**
 * The "Not saved" message for `errors`: how many problems, and which tabs to look on.  The errors
 * above the tabs are in view anyway, so they are counted but not located.
 */
export function describeProblems(errors: readonly ValidationError[]): string {
  const counts = countByTab(errors);
  const tabs = RESOURCE_TABS.filter((tab) => counts[tab.value] > 0).map((tab) => tab.label);
  const problems = errors.length === 1 ? 'One problem needs fixing' : `${errors.length} problems need fixing`;
  const where =
    tabs.length === 0
      ? ''
      : tabs.length === 1
        ? `, on the ${tabs[0]} tab`
        : `, on the ${tabs.slice(0, -1).join(', ')} and ${tabs[tabs.length - 1]} tabs`;
  return `${problems}${where}. ${errors.length === 1 ? 'It is' : 'They are'} highlighted.`;
}
