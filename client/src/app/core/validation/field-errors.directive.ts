import { DestroyRef, Directive, computed, inject, signal } from '@angular/core';
import { NgControl } from '@angular/forms';

/**
 * Shows a form control's errors on the element: the messages as its `title`, so they show on hover,
 * and `aria-invalid` for assistive technology.
 *
 * Only presentation.  The errors are whatever the control's validators report - here
 * `@ideablade/validation`'s, which cover the server's validation metadata and Breeze's own rules
 * alike, each a `ValidationError` with an `errorMessage`.  It applies to every `ngModel` in a
 * component that imports it.
 */
@Directive({
  selector: '[ngModel]',
  host: {
    '[attr.title]': 'message()',
    '[attr.aria-invalid]': 'invalid() || null',
  },
})
export class FieldErrorsDirective {
  private readonly ngControl = inject(NgControl, { self: true });

  /** Bumped on every change to the control, whose state is not a signal. */
  private readonly version = signal(0);

  private readonly errors = computed(() => {
    this.version();
    return Object.values(this.ngControl.errors ?? {});
  });

  readonly invalid = computed(() => this.errors().length > 0);

  readonly message = computed(
    () =>
      this.errors()
        .map((error) => (error as { errorMessage?: string })?.errorMessage)
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
