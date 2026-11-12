import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { SelectModule } from 'primeng/select';

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
  imports: [FormsModule, ButtonModule, SelectModule],
  template: `
    <div class="item-selector">
      <label class="item-selector__prompt" for="item-selector-list">{{ data.prompt }}</label>

      <p-select
        inputId="item-selector-list"
        [options]="data.items"
        [(ngModel)]="selectedItem"
        [optionLabel]="data.displayProperty"
        placeholder="Select..."
        appendTo="body"
        styleClass="item-selector__select"
      />

      <div class="item-selector__buttons">
        <p-button label="OK" [disabled]="!selectedItem" (onClick)="accept()" />
        <p-button label="Cancel" severity="secondary" [outlined]="true" (onClick)="cancel()" />
      </div>
    </div>
  `,
  styles: [
    `
      .item-selector {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .item-selector__prompt {
        font-weight: 600;
      }

      :host ::ng-deep .item-selector__select {
        width: 100%;
      }

      .item-selector__buttons {
        display: flex;
        gap: 0.5rem;
        justify-content: flex-end;
      }
    `,
  ],
})
export class ItemSelectorComponent {
  private readonly ref = inject(DynamicDialogRef);
  readonly data: ItemSelectorData = inject(DynamicDialogConfig).data;

  selectedItem: unknown = null;

  accept(): void {
    this.ref.close(this.selectedItem);
  }

  cancel(): void {
    this.ref.close(undefined);
  }
}
