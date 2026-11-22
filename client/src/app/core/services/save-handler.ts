import { Injectable, inject } from '@angular/core';
import type { ErrorVisibility, ValidationError, ValidationService } from '@ideablade/validation';
import { MessageService } from '@openng/optimus-ui/api';
import { firstValueFrom } from 'rxjs';

import type { UnitOfWork } from './unit-of-work';
import { SHARED_UNIT_OF_WORK_KEY, UnitOfWorkManager } from './unit-of-work-manager';

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

/** What the handler needs of a unit of work. */
export type SavableUnitOfWork = Pick<UnitOfWork, 'entityStore' | 'commit'>;

/**
 * Saves units of work: the save logic every workspace shares, so none has to remember it.
 *
 * - **`save`** decides on the data as it is when called.  It validates the unit of work with the
 *   workspace's validation service, not the continuous validation the screen follows
 *   (`validateEntityStore()`): that result catches up with an edit a moment later, once the change
 *   has been coalesced (a `setTimeout`), and until then it still holds the result from before the
 *   edit, not pending.  A Save clicked right after an edit decided on that: it counted too few
 *   problems ("One problem needs fixing" with two on screen), and with no problems before the edit
 *   it would have saved one it had not seen, leaving Breeze and the server to refuse it.
 *   Validating here also waits for async rules.
 * - **After every successful commit** it drops the shared unit of work's cache.  The save happened
 *   in a sandbox, so the shared manager still holds whatever it last loaded, including children the
 *   save just deleted.  A Breeze query merge never detaches cached entities the server omitted, so
 *   re-querying would not remove them; the shared cache has to be dropped and re-seeded.
 *   DevForce's shared EntityManager was refreshed for the same reason.
 *
 * The busy indicator and what else follows a save (releasing the sandbox, reloading) stay with the
 * workspace: `BusyService` is per screen, and so is what a save means for it.
 */
@Injectable({ providedIn: 'root' })
export class SaveHandler {
  private readonly messages = inject(MessageService);
  private readonly unitOfWorkManager = inject(UnitOfWorkManager);

  /**
   * Validates the unit of work and saves it.  With broken rules nothing is saved: every error is
   * shown and a "Not saved" message says why.  A failed commit throws, as `UnitOfWork.commit` does.
   *
   * @returns true when saved; false when rules are broken.
   */
  async save(unitOfWork: SavableUnitOfWork, validation: ValidationService, options: SaveOptions = {}): Promise<boolean> {
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
    await this.commit(unitOfWork);
    return true;
  }

  /**
   * Commits the unit of work without validating it, such as a deletion: a record that breaks a
   * rule can still be deleted.  Then drops the shared cache, as after every save.  A failed commit
   * throws.
   */
  async commit(unitOfWork: SavableUnitOfWork): Promise<void> {
    await unitOfWork.commit();
    this.dropSharedCache(unitOfWork);
  }

  /** Drops the shared unit of work's cache, unless there is none yet or it is the one just saved. */
  private dropSharedCache(saved: SavableUnitOfWork): void {
    if (!this.unitOfWorkManager.has(SHARED_UNIT_OF_WORK_KEY)) {
      return;
    }
    const shared = this.unitOfWorkManager.get(SHARED_UNIT_OF_WORK_KEY);
    if (shared !== saved) {
      shared.clear();
    }
  }
}

/** "One problem needs fixing. It is highlighted." / "3 problems need fixing. They are highlighted." */
export function describeCount(errors: readonly ValidationError[]): string {
  return errors.length === 1 ? 'One problem needs fixing. It is highlighted.' : `${errors.length} problems need fixing. They are highlighted.`;
}
