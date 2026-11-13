import { Injectable, computed, signal } from '@angular/core';

/**
 * Port of Punch's `IBusyWatcher` / `BusyWatcher`.
 *
 * The WPF views wrapped their content in an Xceed `BusyIndicator` bound to `Busy.IsBusy`; the
 * Angular views use Optimus UI's `p-blockUI` or a `<p-progressSpinner>` bound to `isBusy()`.
 *
 * `Busy.GetTicket()` in a `using` block becomes `await busy.run(promise)` here - the counter is
 * incremented for the life of the promise and decremented in a `finally`, so nesting works the same
 * way tickets did.  Provided per-component (not in root) so each screen has its own indicator,
 * matching the original where every view model owned a `BusyWatcher`.
 */
@Injectable()
export class BusyService {
  private readonly counter = signal(0);

  readonly isBusy = computed(() => this.counter() > 0);

  async run<T>(operation: Promise<T>): Promise<T> {
    this.counter.update((value) => value + 1);

    try {
      return await operation;
    } finally {
      this.counter.update((value) => value - 1);
    }
  }
}
