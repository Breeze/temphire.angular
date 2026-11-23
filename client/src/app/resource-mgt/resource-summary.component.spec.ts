import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideValidation } from 'ideablade-validation/angular';
import { breezeModelType } from 'ideablade-validation/breeze';
import { DataService, Entity, EntityManager, MetadataStore } from 'breeze-client';

import metadata from '../../../metadata.json';
import { StaffingResource } from '../core/model';
import { AppDialogService } from '../core/services/dialog.service';
import { ResourceMgtUnitOfWork } from '../core/services/resource-mgt-unit-of-work';
import { ResourceSummaryComponent } from './resource-summary.component';

/**
 * Regression test: a name changed in the name dialog must show at once.
 *
 * The new name is set on the entity after the dialog closes, outside any event in the component,
 * so with zoneless OnPush change detection nothing re-rendered the summary - the old name stayed
 * until the next event in it.  The summary now derives the name and initials from the unit of
 * work's `changes` signal, as the detail sections derive their rows.
 *
 * The entity is a real Breeze entity built from the checked-in metadata.  The model classes are
 * not registered (Breeze binds a class to one store per page), so `fullName` is stood in for.
 */
describe('ResourceSummaryComponent', () => {
  function setUp() {
    const metadataStore = new MetadataStore();
    metadataStore.importMetadata(metadata);
    const manager = new EntityManager({
      dataService: new DataService({ serviceName: 'api/resourcemgt', hasServerMetadata: false }),
      metadataStore,
    });

    // The unit of work's `changes` signal, bumped from the manager's events as `UnitOfWork` does.
    const changes = signal(0);
    manager.entityChanged.subscribe(() => changes.update((count) => count + 1));
    const unitOfWork = { changes };

    const resource = manager.createEntity('StaffingResource', {
      id: crypto.randomUUID(),
      firstName: 'Steven',
      lastName: 'Buchanan',
      summary: 'A summary.',
    }) as Entity & { firstName: string; middleName: string; lastName: string };
    Object.defineProperty(resource, 'fullName', {
      get: () => [resource.firstName, resource.middleName, resource.lastName].filter(Boolean).join(' '),
    });

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        // The fields use the validation framework's form directives; entities supply their own type.
        provideValidation({ modelTypeResolvers: [breezeModelType] }),
        // The name dialog: resolves with the new name after the click handler has returned.
        {
          provide: AppDialogService,
          useValue: {
            open: () => Promise.resolve({ firstName: 'Stephen', middleName: 'J', lastName: 'Ward' }),
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(ResourceSummaryComponent);
    fixture.componentRef.setInput('staffingResource', resource as unknown as StaffingResource);
    fixture.componentRef.setInput('readOnly', false);
    fixture.componentRef.setInput('unitOfWork', unitOfWork as unknown as ResourceMgtUnitOfWork);

    const text = (selector: string) =>
      (fixture.nativeElement.querySelector(selector) as HTMLElement).textContent?.trim();
    return { fixture, text };
  }

  it('shows a name changed in the name dialog, without another event', async () => {
    const { fixture, text } = setUp();
    await fixture.whenStable();
    expect(text('.summary__name')).toBe('Steven Buchanan');
    expect(text('.summary__avatar')).toBe('SB');

    await fixture.componentInstance.editName();
    await fixture.whenStable();

    expect(text('.summary__name')).toBe('Stephen J Ward');
    expect(text('.summary__avatar')).toBe('SW');
  });
});
