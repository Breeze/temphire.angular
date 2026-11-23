import { DestroyRef, Directive, computed, inject, signal } from '@angular/core';
import { NgControl } from '@angular/forms';
import { ValidationFieldDirective } from 'ideablade-validation/angular';

/**
 * Shows a form control's errors on the element: the messages as its `title`, so they show on hover,
 * and `aria-invalid` for assistive technology.  Templates use `invalid()` for PrimeNG's `[invalid]`
 * (`#city="fieldErrors"`, `[invalid]="city.invalid()"`), so the red border follows the same rule.
 *
 * Only presentation.  The errors are `ideablade-validation`'s, which cover the server's validation
 * metadata and Breeze's own rules alike, each a `ValidationError` with an `errorMessage`.  The
 * library's field directive, on the same `ngModel`, says which of them to show: with the screen's
 * `ErrorVisibility` (`provideErrorVisibility` in `ResourceMgtComponent`), a new entity's errors wait
 * until the user has touched the field, caused the error, or tried to save.  A control the library
 * does not validate shows its own errors.  It applies to every `ngModel` in a component that
 * imports it.
 */
@Directive({
  selector: '[ngModel]',
  exportAs: 'fieldErrors',
  host: {
    '[attr.title]': 'message()',
    '[attr.aria-invalid]': 'invalid() || null',
  },
})
export class FieldErrorsDirective {
  private readonly ngControl = inject(NgControl, { self: true });
  private readonly field = inject(ValidationFieldDirective, { self: true, optional: true });

  /** Bumped on every change to the control, whose state is not a signal. */
  private readonly version = signal(0);

  private readonly errors = computed(() => {
    const shown = this.field?.shownErrors();
    if (shown) {
      return shown;
    }
    this.version();
    return Object.values(this.ngControl.errors ?? {}) as { errorMessage?: string }[];
  });

  /** Whether the field has errors to show. */
  readonly invalid = computed(() => this.errors().length > 0);

  readonly message = computed(
    () =>
      this.errors()
        .map((error) => error?.errorMessage)
        .filter(Boolean)
        .join(' ') || null,
  );

  constructor() {
    const subscription = this.ngControl.control?.events.subscribe(() =>
      this.version.update((version) => version + 1),
    );
    inject(DestroyRef).onDestroy(() => subscription?.unsubscribe());
  }
}
