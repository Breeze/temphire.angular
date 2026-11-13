import { Component, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { DataService, Entity, EntityManager, MetadataStore } from 'breeze-client';
import { InputTextModule } from '@openng/optimus-ui/inputtext';

import metadata from '../../../../metadata.json';
import { BreezeFieldDirective } from './breeze-field.directive';

/**
 * The directive against real Breeze: an `Address` built from the checked-in metadata, whose
 * `[Required]` city Breeze validates on attach and on every change.  The model classes are not
 * registered, because Breeze binds a class to one metadata store per page and the app owns that.
 */
@Component({
  imports: [FormsModule, InputTextModule, BreezeFieldDirective],
  template: `
    <input
      pInputText
      [(ngModel)]="address().city"
      [breezeField]="address()"
      breezeProperty="city"
      #cityField="breezeField"
      [invalid]="cityField.invalid()"
    />
  `,
})
class Host {
  readonly address = signal<Entity & { city: string }>(undefined!);
}

describe('BreezeFieldDirective', () => {
  function newAddress() {
    const metadataStore = new MetadataStore();
    metadataStore.importMetadata(metadata);
    const manager = new EntityManager({
      dataService: new DataService({ serviceName: 'api/breeze', hasServerMetadata: false }),
      metadataStore,
    });
    // Attached as Added, so Breeze validates it at once and finds the required fields empty.
    return manager.createEntity('Address', { id: crypto.randomUUID(), city: '' });
  }

  async function render() {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(Host);
    const address = newAddress();
    fixture.componentInstance.address.set(address as Entity & { city: string });
    await fixture.whenStable();

    const input = fixture.debugElement.query(By.directive(BreezeFieldDirective));
    return { fixture, address, input, field: input.injector.get(BreezeFieldDirective) };
  }

  it('reports a Breeze error to the form and to Optimus UI', async () => {
    const { input, field } = await render();

    expect(field.invalid()).toBe(true);
    expect(field.message()).toMatch(/required/i);
    expect(input.nativeElement.classList).toContain('ng-invalid');
    expect(input.nativeElement.classList).toContain('p-invalid');
    expect(input.nativeElement.getAttribute('aria-invalid')).toBe('true');
  });

  it('clears the error once the user enters a value', async () => {
    const { fixture, address, input, field } = await render();

    input.nativeElement.value = 'Seattle';
    input.nativeElement.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    expect(address.getProperty('city')).toBe('Seattle');
    expect(field.invalid()).toBe(false);
    expect(input.nativeElement.classList).toContain('ng-valid');
    expect(input.nativeElement.classList).not.toContain('p-invalid');
  });

  it('highlights an error Breeze finds without an edit, as a save does', async () => {
    const { fixture, address, input, field } = await render();
    input.nativeElement.value = 'Seattle';
    input.nativeElement.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(field.invalid()).toBe(false);

    // Change the entity behind the form's back, then validate it, as saveChanges does.
    address.entityAspect.clearValidationErrors();
    address.setProperty('city', '');
    address.entityAspect.validateEntity();
    await fixture.whenStable();

    expect(field.invalid()).toBe(true);
    expect(input.nativeElement.classList).toContain('p-invalid');
  });
});
