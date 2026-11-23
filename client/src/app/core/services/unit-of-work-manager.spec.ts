import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { EntityManagerProvider } from './entity-manager-provider';
import type { UnitOfWork } from './unit-of-work';
import {
  SHARED_UNIT_OF_WORK_KEY,
  UnitOfWorkManager,
  UnitOfWorkManagers,
} from './unit-of-work-manager';

/** A unit of work as far as the managers see one: it can commit, report changes and be cleared. */
function fakeUnitOfWork(onCommitted: () => void) {
  return {
    commit: async () => onCommitted(),
    hasChanges: () => false,
    clear: vi.fn(),
  } as unknown as UnitOfWork & { commit(): Promise<void>; clear: ReturnType<typeof vi.fn> };
}

/** Two workspaces, each with its own kind of unit of work and its own manager. */
class OrdersUnitOfWork {}
class OrdersManager extends UnitOfWorkManager<UnitOfWork & OrdersUnitOfWork> {
  protected override newUnitOfWork(onCommitted: () => void) {
    return fakeUnitOfWork(onCommitted) as UnitOfWork & OrdersUnitOfWork;
  }
}
class InvoicesManager extends UnitOfWorkManager<UnitOfWork> {
  protected override newUnitOfWork(onCommitted: () => void) {
    return fakeUnitOfWork(onCommitted);
  }
}

/**
 * The manager is generic: each workspace has its own, for its own unit of work, and what concerns
 * them all (the saves, the shared caches after a save, sign-out) goes through `UnitOfWorkManagers`.
 */
describe('UnitOfWorkManager', () => {
  function setUp() {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: EntityManagerProvider, useValue: {} },
      ],
    });
    const orders = TestBed.runInInjectionContext(() => new OrdersManager());
    const invoices = TestBed.runInInjectionContext(() => new InvoicesManager());
    return { orders, invoices, managers: TestBed.inject(UnitOfWorkManagers) };
  }

  it('holds its units of work weakly: a collected one is replaced on the next get', () => {
    // A test can't make the garbage collector run, so `WeakRef` is replaced by one whose target the
    // test can drop, as a collection would.
    const refs: { target: object | undefined }[] = [];
    vi.stubGlobal(
      'WeakRef',
      class {
        target: object | undefined;
        constructor(target: object) {
          this.target = target;
          refs.push(this);
        }
        deref() {
          return this.target;
        }
      },
    );
    try {
      const { orders } = setUp();
      const sandbox = orders.get('order-1');
      expect(orders.get('order-1')).toBe(sandbox);

      refs.forEach((ref) => (ref.target = undefined)); // nothing held it, and it was collected
      expect(orders.has('order-1')).toBe(false);
      expect(orders.get('order-1')).not.toBe(sandbox);
      expect(orders.has('order-1')).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('keeps one unit of work per key, and a new one for each create', () => {
    const { orders } = setUp();
    expect(orders.get(SHARED_UNIT_OF_WORK_KEY)).toBe(orders.get(SHARED_UNIT_OF_WORK_KEY));
    expect(orders.get('order-1')).not.toBe(orders.get(SHARED_UNIT_OF_WORK_KEY));
    expect(orders.create()).not.toBe(orders.create());
  });

  it('counts a save in any workspace', async () => {
    const { orders, invoices } = setUp();
    expect(orders.saves()).toBe(0);

    await orders.get('order-1').commit();
    await invoices.get('invoice-1').commit();

    expect(orders.saves()).toBe(2);
    expect(invoices.saves()).toBe(2);
  });

  it("drops every workspace's shared cache after a save, except the one saved", () => {
    const { orders, invoices, managers } = setUp();
    const ordersShared = orders.get(SHARED_UNIT_OF_WORK_KEY) as unknown as {
      clear: ReturnType<typeof vi.fn>;
    };
    const invoicesShared = invoices.get(SHARED_UNIT_OF_WORK_KEY) as unknown as {
      clear: ReturnType<typeof vi.fn>;
    };

    managers.dropSharedCaches(orders.get('order-1'));
    expect(ordersShared.clear).toHaveBeenCalledTimes(1);
    expect(invoicesShared.clear).toHaveBeenCalledTimes(1);

    managers.dropSharedCaches(ordersShared);
    expect(ordersShared.clear).toHaveBeenCalledTimes(1);
    expect(invoicesShared.clear).toHaveBeenCalledTimes(2);
  });

  it("forgets every workspace's units of work at sign-out", () => {
    const { orders, invoices, managers } = setUp();
    orders.get('order-1');
    invoices.get(SHARED_UNIT_OF_WORK_KEY);

    managers.clear();

    expect(orders.has('order-1')).toBe(false);
    expect(invoices.has(SHARED_UNIT_OF_WORK_KEY)).toBe(false);
  });
});
