import { Component, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { StaffingResourceListItem } from '../core/projections/staffing-resource-list-item';
import { UnitOfWorkManager } from '../core/services/unit-of-work-manager';
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
  const rows = ['Ann', 'Ben', 'Cal'].map((name, i) => ({ id: `id-${i}`, fullName: name }) as StaffingResourceListItem);

  @Component({
    imports: [ResourceSearchComponent],
    template: `<app-resource-search [selectedId]="selectedId()" (selectionChange)="chosen.push($event)" />`,
  })
  class Host {
    /** The workspace: it opened Ben, and refuses every change (it never updates `selectedId`). */
    readonly selectedId = signal<string | null>('id-1');
    readonly chosen: (StaffingResourceListItem | null)[] = [];
  }

  async function setUp() {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        {
          provide: UnitOfWorkManager,
          useValue: { saves: signal(0), get: () => ({ search: async () => rows }) },
        },
      ],
    });
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const row = (i: number) => element.querySelectorAll('tbody tr')[i] as HTMLElement;
    const highlighted = () =>
      [...element.querySelectorAll('tbody tr')].flatMap((r, i) => (r.classList.contains('p-datatable-row-selected') ? [i] : []));
    const click = async (i: number) => {
      (row(i).querySelector('td') as HTMLElement).click();
      await fixture.whenStable();
    };
    return { host: fixture.componentInstance, fixture, highlighted, click };
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

  it("keeps the open resource highlighted when its own row is clicked", async () => {
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
});
