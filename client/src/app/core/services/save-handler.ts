import { Injectable, inject } from '@angular/core';
import type { ErrorVisibility, ValidationError, ValidationService } from '@ideablade/validation';
import { MessageService } from '@openng/optimus-ui/api';
import { firstValueFrom } from 'rxjs';

import type { UnitOfWork } from './unit-of-work';

/** What a workspace adds to {@link SaveHandler.save}. */
export interface SaveOptions {
  /** The workspace's error visibility: an attempt with broken rules shows every error, hidden ones too. */
  visibility?: ErrorVisibility | null;
  /**
   * The "Not saved" message for the broken rules, such as where on the screen they are. Default:
   * how many, and that they are highlighted.
   */
  describe?: (errors: readonly ValidationError[]) => string;
  /** Runs once the data is valid, just before the commit, such as selecting the row the save will reload. */
  beforeCommit?: () => void;
}

/**
 * Saves a unit of work if its data is valid as it is now: the save logic every workspace shares.
 *
 * It validates the unit of work when called, with the workspace's validation service, and decides on
 * that.  Not on the continuous validation the screen follows (`validateEntityStore()`): that result
 * catches up with an edit a moment later, once the change has been coalesced (a `setTimeout`), and
 * until then it still holds the result from before the edit, not pending.  A Save clicked right after
 * an edit decided on that: it counted too few problems ("One problem needs fixing" with two on
 * screen), and with no problems before the edit it would have saved one it had not seen, leaving
 * Breeze and the server to refuse it.  Validating here also waits for async rules.
 *
 * The busy indicator and what follows a save (reloading, releasing a sandbox) stay with the
 * workspace: `BusyService` is per screen, and so is what a save means for it.
 */
@Injectable({ providedIn: 'root' })
export class SaveHandler {
  private readonly messages = inject(MessageService);

  /**
   * Validates the unit of work and saves it.  With broken rules nothing is saved: every error is
   * shown and a "Not saved" message says why.  A failed commit throws, as `UnitOfWork.commit` does.
   *
   * @returns true when saved; false when rules are broken.
   */
  async save(
    unitOfWork: Pick<UnitOfWork, 'entityStore' | 'commit'>,
    validation: ValidationService,
    options: SaveOptions = {},
  ): Promise<boolean> {
    const { validationErrors } = await firstValueFrom(validation.validateEntityStoreOneTime(unitOfWork.entityStore));
    if (validationErrors.length > 0) {
      options.visibility?.revealAll();
      this.messages.add({
        severity: 'warn',
        summary: 'Not saved',
        detail: (options.describe ?? describeCount)(validationErrors),
        life: 6000,
      });
      return false;
    }

    options.beforeCommit?.();
    await unitOfWork.commit();
    return true;
  }
}

/** "One problem needs fixing. It is highlighted." / "3 problems need fixing. They are highlighted." */
export function describeCount(errors: readonly ValidationError[]): string {
  return errors.length === 1 ? 'One problem needs fixing. It is highlighted.' : `${errors.length} problems need fixing. They are highlighted.`;
}
