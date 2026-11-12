import {
  SchemaPath,
  ValidationError as FormValidationError,
  validate,
} from '@angular/forms/signals';
import { DataProperty, ValidationError } from 'breeze-client';

/**
 * Validates a Signal Forms field with the Breeze validators of an entity property.
 *
 * For a form whose values are bound for an entity that does not exist yet - the name entered
 * before a `StaffingResource` is created - this applies the same rules the entity will: the
 * validators Breeze built from the server's `[Required]` and `[StringLength]` attributes.  Each
 * Breeze error becomes a Signal Forms error, which the form shows like any other, and which
 * `[formField]` passes on to PrimeNG as `invalid`.
 *
 * ```ts
 * const firstName = metadataStore.getAsEntityType(StaffingResource).getDataProperty('firstName');
 * form(model, (name) => validateWithBreeze(name.firstName, firstName));
 * ```
 */
export function validateWithBreeze(path: SchemaPath<string>, property: DataProperty): void {
  validate(path, ({ value }) => {
    const errors = property.validators
      .map((validator) => validator.validate(value(), { property, propertyName: property.name }))
      .filter((error): error is ValidationError => !!error)
      .map((error): FormValidationError => ({
        kind: `breeze.${error.validator?.name ?? error.key}`,
        message: error.errorMessage,
      }));

    return errors.length ? errors : undefined;
  });
}
