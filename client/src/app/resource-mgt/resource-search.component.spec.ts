import { Component, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { StaffingResourceListItem } from '../core/projections/staffing-resource-list-item';
import { ResourceMgtUnitOfWorkManager } from '../core/services/resource-mgt-unit-of-work-manager';
import { ResourceSearchComponent } from './resource-search.component';

/**
 * Regression test: the grid's highlight follows the resource the workspace has open
 * (`selectedId`), not the last click.
 *
 * Optimus UI's table moves its own selection on a click, and unselects a row that is clicked
 * again.  So when the workspace refused a change (Cancel in the unsaved-changes prompt), the clicked
 * row stayed highlighted with the old resource on screen, and clicking it again "unselected" it
 * without asking.  Clicking the open resource's own row cleared its highlight too.
 */
describe('ResourceSearchComponent', () => {
  const rows = ['Ann', 'Ben', 'Cal'].map(
    (name, i) => ({ id: `id-${i}`, fullName: name }) as StaffingResourceListItem,
  );

  @Component({
    imports: [ResourceSearchComponent],
    template: `<app-resource-search
      [selectedId]="selectedId()"
      (selectionChange)="chosen.push($event)"
    />`,
  })
  class Host {
    /** The workspace: it opened Ben, and refuses every change (it never updates `selectedId`). */
    readonly selectedId = signal<string | null>('id-1');
    readonly chosen: (StaffingResourceListItem | null)[] = [];
  }

  /** The text of every search the grid ran. */
  let searches: string[];

  async function setUp() {
    searches = [];
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        {
          provide: ResourceMgtUnitOfWorkManager,
          useValue: {
            get: () => ({
              search: {
                simple: async (text: string) => {
                  searches.push(text);
                  return rows;
                },
              },
            }),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const row = (i: number) => element.querySelectorAll('tbody tr')[i] as HTMLElement;
    const highlighted = () =>
      [...element.querySelectorAll('tbody tr')].flatMap((r, i) =>
        r.classList.contains('p-datatable-row-selected') ? [i] : [],
      );
    const click = async (i: number) => {
      (row(i).querySelector('td') as HTMLElement).click();
      await fixture.whenStable();
    };
    const box = element.querySelector('input') as HTMLInputElement;
    const button = (label: string) =>
      [...element.querySelectorAll('button')].find(
        (b) => b.textContent?.trim() === label,
      ) as HTMLButtonElement;
    /** Types into the search box: `value` replaces its text, as the X or deleting it would. */
    const type = async (value: string) => {
      box.value = value;
      box.dispatchEvent(new Event('input'));
      await fixture.whenStable();
    };
    const press = async (label: string) => {
      button(label).click();
      await fixture.whenStable();
    };
    const clearButton = () =>
      element.querySelector('[aria-label="Clear search"]') as HTMLButtonElement | null;
    return {
      host: fixture.componentInstance,
      fixture,
      highlighted,
      click,
      type,
      press,
      button,
      box,
      clearButton,
    };
  }

  it('highlights the open resource', async () => {
    const { highlighted } = await setUp();
    expect(highlighted()).toEqual([1]);
  });

  it('keeps the highlight on the open resource when the workspace refuses a change', async () => {
    const { host, highlighted, click } = await setUp();

    await click(2);
    expect(host.chosen.map((item) => item?.id)).toEqual(['id-2']);
    expect(highlighted()).toEqual([1]);

    // The same row again is a new request, not an "unselect".
    await click(2);
    expect(host.chosen.map((item) => item?.id)).toEqual(['id-2', 'id-2']);
    expect(highlighted()).toEqual([1]);
  });

  it('keeps the open resource highlighted when its own row is clicked', async () => {
    const { host, highlighted, click } = await setUp();
    await click(1);
    expect(highlighted()).toEqual([1]);
    expect(host.chosen).toEqual([]);
  });

  it('moves the highlight when the workspace accepts the change', async () => {
    const { host, fixture, highlighted, click } = await setUp();
    await click(0);
    host.selectedId.set('id-0');
    await fixture.whenStable();
    expect(highlighted()).toEqual([0]);
  });

  describe('the search box', () => {
    it('shows the full list again when the box is emptied after a search', async () => {
      const { type, press } = await setUp();
      await type('Cal');
      await press('Search');
      expect(searches).toEqual(['', 'Cal']);

      // The X in the box, Escape, or deleting the text: all leave it empty.
      await type('');
      expect(searches).toEqual(['', 'Cal', '']);
    });

    it('does not search again when the box is emptied while nothing is filtered', async () => {
      const { type } = await setUp();
      await type('Cal');
      await type('');
      expect(searches).toEqual(['']);
    });

    it('runs an empty search, which lists everyone', async () => {
      const { press, button } = await setUp();
      expect(button('Search').disabled).toBe(false);
      await press('Search');
      expect(searches).toEqual(['', '']);
    });

    it('has no Clear button', async () => {
      const { button } = await setUp();
      expect(button('Clear')).toBeUndefined();
    });
  });

  /** The box draws its own X rather than the browser's, so it looks the same in every browser. */
  describe('the X in the box', () => {
    it('is there only while the box has text', async () => {
      const { type, clearButton } = await setUp();
      expect(clearButton()).toBeNull();
      await type('Cal');
      expect(clearButton()).not.toBeNull();
      await type('');
      expect(clearButton()).toBeNull();
    });

    it('empties the box and shows the full list again after a search', async () => {
      const { fixture, type, press, box, clearButton } = await setUp();
      await type('Cal');
      await press('Search');
      expect(searches).toEqual(['', 'Cal']);

      clearButton()!.click();
      await fixture.whenStable();
      expect(searches).toEqual(['', 'Cal', '']);
      expect(box.value).toBe('');
      expect(document.activeElement).toBe(box);
      expect(clearButton()).toBeNull();
    });

    it('only empties the box while nothing is filtered', async () => {
      const { fixture, type, box, clearButton } = await setUp();
      await type('Cal');
      clearButton()!.click();
      await fixture.whenStable();
      expect(searches).toEqual(['']);
      expect(box.value).toBe('');
    });
  });
});
