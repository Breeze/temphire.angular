import { Component, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormsModule, NgModel } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { ModelValidationMetadataMap, ValidationError } from '@ideablade/validation';
import {
  ValidationFormsDirectives,
  provideErrorVisibility,
  provideValidation,
} from '@ideablade/validation/angular';
import {
  breezeIsNew,
  breezeModelType,
  breezeValidator,
  installBreezeValidators,
} from '@ideablade/validation/breeze';
import { ErrorVisibility, ValidationService } from '@ideablade/validation';
import { InputTextModule } from '@openng/optimus-ui/inputtext';
import { DataService, Entity, EntityManager, MetadataStore } from 'breeze-client';

import metadata from '../../../../metadata.json';
import rules from '../../../../../server/TempHire.Server/Validation/validation.metadata.json';
import { displayNameMetadata, setDisplayNames } from '../model-display-names';
import { clientValidationMetadata } from './client-validation-metadata';
import { FieldErrorsDirective } from './field-errors.directive';

/**
 * Entity fields as the app builds them: the library's template-driven-forms directives over a
 * Breeze entity, with the app's validation setup.  Breeze's own rules (`'City' is required`, from
 * `[Required]`) and the server's validation metadata (`'State' is required`) reach the field the
 * same way, as `ValidationError`s, and `FieldErrorsDirective` shows them.
 */
@Component({
  imports: [FormsModule, InputTextModule, ValidationFormsDirectives, FieldErrorsDirective],
  template: `
    <div ngForm [validationModel]="address()">
      <input pInputText name="city" [(ngModel)]="address().city" #city="fieldErrors" [invalid]="city.invalid()" />
      <input pInputText name="stateId" [(ngModel)]="address().stateId" />
      <input type="radio" name="primary-address" [ngModel]="true" />
    </div>
  `,
})
class Host {
  readonly address = signal<Entity & { city: string; stateId: string }>(undefined!);
}

describe('entity fields', () => {
  /** With `visibility`, as on the resource management screen: a new entity's first errors wait. */
  async function render(visibility = false) {
    const metadataStore = new MetadataStore();
    metadataStore.importMetadata(metadata);
    setDisplayNames(metadataStore);
    const serverRules = Object.fromEntries(
      Object.entries(rules).filter(([key]) => !key.startsWith('$')),
    ) as ModelValidationMetadataMap;

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideValidation({
          metadata: [clientValidationMetadata, serverRules, displayNameMetadata(metadataStore)],
          validators: [breezeValidator],
          modelTypeResolvers: [breezeModelType],
        }),
        ...(visibility ? [provideErrorVisibility({ isNew: breezeIsNew })] : []),
      ],
    });
    installBreezeValidators(metadataStore, TestBed.inject(ValidationService));

    const manager = new EntityManager({
      dataService: new DataService({ serviceName: 'api/resourcemgt', hasServerMetadata: false }),
      metadataStore,
    });
    const address = manager.createEntity('Address', {
      id: crypto.randomUUID(),
      city: '',
      stateId: '00000000-0000-0000-0000-000000000000',
    }) as Entity & { city: string; stateId: string };

    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.address.set(address);
    await fixture.whenStable();

    const field = (name: string) => {
      const element = fixture.debugElement
        .queryAll(By.directive(NgModel))
        .find((e) => e.attributes['name'] === name)!;
      const errors = Object.values(element.injector.get(NgModel).errors ?? {}) as ValidationError[];
      return { element: element.nativeElement as HTMLElement, messages: errors.map((e) => e.errorMessage) };
    };
    return { fixture, field };
  }

  it("shows Breeze's rules and the server's rules the same way", async () => {
    const { field } = await render();

    expect(field('city').messages).toEqual(["'City' is required"]);
    expect(field('stateId').messages).toEqual(["'State' is required"]);
    expect(field('city').element.getAttribute('title')).toBe("'City' is required");
    expect(field('city').element.getAttribute('aria-invalid')).toBe('true');
    expect(field('city').element.classList).toContain('p-invalid');

    // A control that is not an entity property is left alone.
    expect(field('primary-address').messages).toEqual([]);
  });

  it('validates the value the user types', async () => {
    const { fixture, field } = await render();
    const city = field('city').element as HTMLInputElement;

    city.value = 'Seattle';
    city.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    expect(field('city').messages).toEqual([]);
    expect(field('city').element.getAttribute('title')).toBeNull();
    expect(field('city').element.classList).not.toContain('p-invalid');
  });

  it("hides a new entity's first errors until the user leaves the field, or tries to save", async () => {
    const { fixture, field } = await render(true);
    expect(field('city').messages).toEqual(["'City' is required"]);
    expect(field('city').element.getAttribute('title')).toBeNull();
    expect(field('city').element.classList).not.toContain('p-invalid');

    field('city').element.dispatchEvent(new Event('blur'));
    await fixture.whenStable();
    expect(field('city').element.getAttribute('title')).toBe("'City' is required");
    expect(field('city').element.classList).toContain('p-invalid');
    expect(field('stateId').element.getAttribute('title')).toBeNull();

    TestBed.inject(ErrorVisibility).revealAll();
    await fixture.whenStable();
    expect(field('stateId').element.getAttribute('title')).toBe("'State' is required");
  });
});
