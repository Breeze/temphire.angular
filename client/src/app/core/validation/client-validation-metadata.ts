import { ModelValidationMetadataMap } from 'ideablade-validation';

/**
 * Validation metadata for the client's own view models.  The entities' rules come from the server
 * (`EntityManagerProvider` loads them at sign-in), including the global `breeze` validator, which
 * here runs Breeze's own rules - built from the server's data annotations - and on the server the
 * annotations themselves.  These models exist only on the client, so their metadata lives here.
 *
 * `ResourceName` is what the name editor edits before the names are assigned to a
 * `StaffingResource`.  Each property follows the rules of the `StaffingResource` property of the
 * same name (`from`) - Breeze's `[Required]` / `[StringLength]` through `breezeRuleSource`, and the
 * display name - so the dialog enforces exactly what the entity will, without restating it.
 */
export const clientValidationMetadata: ModelValidationMetadataMap = {
  ResourceName: {
    properties: {
      firstName: { from: 'StaffingResource' },
      middleName: { from: 'StaffingResource' },
      lastName: { from: 'StaffingResource' },
    },
  },
};
