import { ApplicationRef, Component, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';

import { ToolbarAction, executeAction } from './toolbar.service';

/**
 * Regression test: Cancel clicked within a frame of typing left the discarded text in the field.
 *
 * Angular writes a value to a field only when its binding changed since the last change detection.
 * Typing changed the sandbox's entity, and the click came before change detection had seen it.
 * Cancel rolled the entity back and showed the shared unit of work's entity instead, with the same
 * saved text: the value the binding had last seen.  So nothing was written, and the field kept the
 * typed text.  `executeAction` runs change detection first.
 */
describe('executeAction', () => {
  interface Resource {
    summary: string;
  }

  /** A detail screen: an entity field edited through `ngModel`, the entity held in a signal. */
  @Component({
    imports: [FormsModule],
    template: `<textarea [(ngModel)]="resource().summary"></textarea>`,
  })
  class Screen {
    /** The shared unit of work's entity, shown in view mode. */
    readonly shared: Resource = { summary: 'Saved' };
    /** The sandbox's copy, shown while editing. */
    readonly sandbox: Resource = { summary: 'Saved' };
    readonly resource = signal<Resource>(this.sandbox);
  }

  async function setUp() {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(Screen);
    // Under the application, as the app's screens are (a test fixture isn't by default).
    TestBed.inject(ApplicationRef).attachView(fixture.componentRef.hostView);
    await fixture.whenStable();
    const screen = fixture.componentInstance;
    const field = (fixture.nativeElement as HTMLElement).querySelector('textarea')!;
    expect(field.value).toBe('Saved');

    // The user types, and clicks Cancel before change detection runs.
    field.value = 'Saved, then edited';
    field.dispatchEvent(new Event('input'));
    expect(screen.sandbox.summary).toBe('Saved, then edited');

    const cancel: ToolbarAction = {
      label: 'Cancel',
      execute: () => {
        screen.sandbox.summary = 'Saved'; // rollback
        screen.resource.set(screen.shared); // back to view mode
      },
    };
    return { fixture, field, cancel };
  }

  it('shows the saved value after Cancel run right after typing', async () => {
    const { fixture, field, cancel } = await setUp();

    executeAction(cancel, TestBed.inject(ApplicationRef));
    await fixture.whenStable();

    expect(field.value).toBe('Saved');
  });

  it('would keep the typed text if the command ran without change detection first', async () => {
    const { fixture, field, cancel } = await setUp();

    cancel.execute();
    await fixture.whenStable();

    expect(field.value).toBe('Saved, then edited');
  });
});
