import {
  Directive,
  Injector,
  computed,
  effect,
  forwardRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { NG_VALIDATORS, NgControl, ValidationErrors, Validator } from '@angular/forms';
import { Entity, ValidationError } from 'breeze-client';

/**
 * Connects one entity property's **Breeze** validation to the Angular form control bound to it.
 *
 * Breeze is the source of validation for entities: the `[Required]` and `[StringLength]` attributes
 * on the server's model arrive in the metadata as validators, and Breeze runs them whenever a
 * property changes, an entity is attached, or a save is attempted.  This directive passes those
 * errors on:
 *
 *  - **to the Angular form.**  It registers as a validator on the control (`NG_VALIDATORS`), so an
 *    `NgModel` bound to an entity property is invalid exactly when Breeze says the property is, and
 *    gets the usual `ng-invalid` class.  There is no `required` or other Angular validator: the
 *    rules live once, on the server's model.
 *  - **to PrimeNG**, through the `invalid` signal, which the template binds to the control's
 *    `[invalid]` input.  PrimeNG components only read that input, not the form control's state.
 *
 * It listens to the entity's `validationErrorsChanged` event, so errors that appear without the
 * user touching the field - when a new entity is attached empty, or when a save validates every
 * entity - highlight the field too.
 *
 * ```html
 * <input pInputText [(ngModel)]="address.city"
 *        [breezeField]="address" breezeProperty="city" #city="breezeField"
 *        [invalid]="city.invalid()" />
 * ```
 *
 * The error message is set as the element's `title`, so it shows on hover, and `aria-invalid` is
 * set for assistive technology.
 */
@Directive({
  selector: '[breezeField]',
  exportAs: 'breezeField',
  providers: [
    { provide: NG_VALIDATORS, useExisting: forwardRef(() => BreezeFieldDirective), multi: true },
  ],
  host: {
    '[attr.title]': 'message()',
    '[attr.aria-invalid]': 'invalid() || null',
  },
})
export class BreezeFieldDirective implements Validator {
  /** The entity whose property the control edits. */
  readonly entity = input<Entity | undefined>(undefined, { alias: 'breezeField' });

  /** The property's name, as the client sees it (`city`, not `City`). */
  readonly property = input<string | undefined>(undefined, { alias: 'breezeProperty' });

  /** Bumped whenever this property's errors change, because Breeze entities are not signals. */
  private readonly version = signal(0);

  /** The property's current Breeze validation errors. */
  readonly errors = computed<readonly ValidationError[]>(() => {
    this.version();
    const entity = this.entity();
    const property = this.property();
    return entity && property ? entity.entityAspect.getValidationErrors(property) : [];
  });

  readonly invalid = computed(() => this.errors().length > 0);

  readonly message = computed(
    () =>
      this.errors()
        .map((error) => error.errorMessage)
        .join(' ') || null,
  );

  // `NgModel` injects this directive as a validator, so this directive must not inject `NgModel`
  // in turn; it looks the control up when it needs it.
  private readonly injector = inject(Injector);

  constructor() {
    effect((onCleanup) => {
      const entity = this.entity();
      const property = this.property();
      if (!entity || !property) {
        return;
      }

      const aspect = entity.entityAspect;
      const token = aspect.validationErrorsChanged.subscribe(({ added, removed }) => {
        if (![...added, ...removed].some((error) => error.propertyName === property)) {
          return;
        }

        this.version.update((version) => version + 1);

        // The form ran its validators when the value changed, *before* the new value reached the
        // entity and Breeze re-validated it.  Run them again now that Breeze has its answer.
        this.injector
          .get(NgControl, null, { self: true })
          ?.control?.updateValueAndValidity({ emitEvent: false });
      });

      onCleanup(() => aspect.validationErrorsChanged.unsubscribe(token));
    });
  }

  validate(): ValidationErrors | null {
    const errors = this.errors();
    return errors.length ? { breeze: errors.map((error) => error.errorMessage) } : null;
  }
}
