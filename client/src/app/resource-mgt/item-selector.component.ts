import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonDirective } from '@openng/optimus-ui/button';
import { DynamicDialogConfig, DynamicDialogRef } from '@openng/optimus-ui/dynamicdialog';
import { SelectModule } from '@openng/optimus-ui/select';

export interface ItemSelectorData<T = Record<string, unknown>> {
  /** Prompt shown above the list - the original passed "Select type:". */
  prompt: string;
  /** Property of each item to display - "DisplayName" for address/rate types, "Name" for phones. */
  displayProperty: string;
  items: T[];
}

/**
 * Port of `TempHire/ViewModels/ItemSelectorViewModel.cs` + `Views/ItemSelectorView.xaml`.
 *
 * A tiny reusable "pick one of these" dialog, used when adding an address, a phone number or a rate
 * to choose its type.  The original took a `Func<Task<IEnumerable>>` and loaded the list itself;
 * here the caller passes the already-cached lookup entities in, because they are always resident in
 * the EntityManager (see `EntityManagerProvider`).
 */
@Component({
  selector: 'app-item-selector',
  imports: [FormsModule, ButtonDirective, SelectModule],
  templateUrl: './item-selector.component.html',
  styleUrl: './item-selector.component.css',
})
export class ItemSelectorComponent {
  private readonly ref = inject(DynamicDialogRef);
  readonly data: ItemSelectorData = inject(DynamicDialogConfig).data;

  /** A signal, which `[(ngModel)]` reads and writes directly. */
  readonly selectedItem = signal<unknown>(null);

  accept(): void {
    this.ref.close(this.selectedItem());
  }

  cancel(): void {
    this.ref.close(undefined);
  }
}
