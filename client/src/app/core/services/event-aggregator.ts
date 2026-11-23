import { Injectable, Signal, signal } from '@angular/core';

/** A successful save, in any unit of work of any workspace.  A new object for every save. */
export interface SavedEvent {
  /**
   * The unit of work that was saved.  Held weakly, so the latest save doesn't keep a sandbox alive
   * after its screen has let go of it (see `UnitOfWorkManager`).
   */
  readonly unitOfWork: WeakRef<object>;
}

/** A sign-out.  A new object for every one. */
export type LoggedOutEvent = Readonly<Record<string, never>>;

/**
 * Port of Caliburn.Micro's `IEventAggregator`, through which Punch's services and screens told each
 * other what had happened (`SavedMessage`, `LoggedOutMessage`) without knowing about each other.
 *
 * Here an event is a signal holding the latest occurrence, and its notification method sets it:
 * whoever cares reads the signal - a `computed`, a `resource`'s params, an `effect` - and reacts on
 * its own.  `IHandle<SavedMessage>` becomes a read of `lastSave()`.  The aggregator only carries the
 * events; it knows nothing of who listens.
 *
 * An event is published once per occurrence and replaces the one before, so a reader sees the
 * latest; an effect runs once per change detection, so two saves in one task show as one.  Both
 * readers here only need to know that something was saved since they last looked.
 */
@Injectable({ providedIn: 'root' })
export class EventAggregator {
  private readonly _lastSave = signal<SavedEvent | null>(null);
  private readonly _lastLogout = signal<LoggedOutEvent | null>(null);

  /**
   * The latest successful save, or `null` before the first.  Port of Punch's `SavedMessage`: the
   * search list reloads on it, and every unit-of-work manager drops its shared cache.
   */
  readonly lastSave: Signal<SavedEvent | null> = this._lastSave.asReadonly();

  /**
   * The latest sign-out, or `null`.  Port of Punch's `LoggedOutMessage`: every unit-of-work manager
   * forgets its units of work.
   */
  readonly lastLogout: Signal<LoggedOutEvent | null> = this._lastLogout.asReadonly();

  /** Called by a unit of work after every successful save. */
  saved(unitOfWork: object): void {
    this._lastSave.set({ unitOfWork: new WeakRef(unitOfWork) });
  }

  /** Called at sign-out. */
  loggedOut(): void {
    this._lastLogout.set({});
  }
}
