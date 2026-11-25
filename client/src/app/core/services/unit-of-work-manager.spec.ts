import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { EntityManagerProvider } from './entity-manager-provider';
import { EventAggregator } from './event-aggregator';
import type { UnitOfWork } from './unit-of-work';
import { SHARED_UNIT_OF_WORK_KEY, UnitOfWorkManager } from './unit-of-work-manager';

/** A unit of work as far as the managers see one: it can commit, report changes and be cleared. */
type FakeUnitOfWork = UnitOfWork & { commit(): Promise<void>; clear: ReturnType<typeof vi.fn> };

function fakeUnitOfWork(onCommitted: () => void): FakeUnitOfWork {
  return {
    commit: async () => onCommitted(),
    hasChanges: () => false,
    clear: vi.fn(),
  } as unknown as FakeUnitOfWork;
}

/** Two workspaces, each with its own kind of unit of work and its own manager. */
class OrdersManager extends UnitOfWorkManager<FakeUnitOfWork> {
  protected override newUnitOfWork(onCommitted: () => void) {
    return fakeUnitOfWork(onCommitted);
  }
}
class InvoicesManager extends UnitOfWorkManager<FakeUnitOfWork> {
  protected override newUnitOfWork(onCommitted: () => void) {
    return fakeUnitOfWork(onCommitted);
  }
}

/**
 * The manager is generic: each workspace has its own, for its own unit of work.  Saves and sign-out
 * come as events (`EventAggregator`), and every manager reacts to them itself.
 */
describe('UnitOfWorkManager', () => {
  function setUp() {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), { provide: EntityManagerProvider, useValue: {} }],
    });
    const orders = TestBed.runInInjectionContext(() => new OrdersManager());
    const invoices = TestBed.runInInjectionContext(() => new InvoicesManager());
    return { orders, invoices, events: TestBed.inject(EventAggregator) };
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

  it('announces every save of its units of work, in any workspace', async () => {
    const { orders, invoices, events } = setUp();
    expect(events.lastSave()).toBeNull();

    const order = orders.get('order-1');
    await order.commit();
    const first = events.lastSave();
    expect(first?.unitOfWork?.deref()).toBe(order);

    const invoice = invoices.get('invoice-1');
    await invoice.commit();
    expect(events.lastSave()).not.toBe(first);
    expect(events.lastSave()?.unitOfWork?.deref()).toBe(invoice);
  });

  it("drops every workspace's shared cache after a save, except the one saved", async () => {
    const { orders, invoices } = setUp();
    const ordersShared = orders.get(SHARED_UNIT_OF_WORK_KEY);
    const invoicesShared = invoices.get(SHARED_UNIT_OF_WORK_KEY);

    await orders.get('order-1').commit();
    TestBed.tick();
    expect(ordersShared.clear).toHaveBeenCalledTimes(1);
    expect(invoicesShared.clear).toHaveBeenCalledTimes(1);

    await ordersShared.commit();
    TestBed.tick();
    expect(ordersShared.clear).toHaveBeenCalledTimes(1);
    expect(invoicesShared.clear).toHaveBeenCalledTimes(2);
  });

  it("drops every workspace's shared cache after a change saved elsewhere (Quinn)", () => {
    const { orders, invoices, events } = setUp();
    const ordersShared = orders.get(SHARED_UNIT_OF_WORK_KEY);
    const invoicesShared = invoices.get(SHARED_UNIT_OF_WORK_KEY);

    events.savedElsewhere({ by: 'Quinn', staffingResourceIds: ['n1'] });
    TestBed.tick();

    expect(ordersShared.clear).toHaveBeenCalledTimes(1);
    expect(invoicesShared.clear).toHaveBeenCalledTimes(1);
  });

  it('creates no shared unit of work just to clear it', async () => {
    const { orders, invoices } = setUp();
    await orders.get('order-1').commit();
    TestBed.tick();
    expect(invoices.has(SHARED_UNIT_OF_WORK_KEY)).toBe(false);
  });

  it('ignores the events from before it was created', async () => {
    const { orders, events } = setUp();
    await orders.get('order-1').commit();
    events.loggedOut();
    TestBed.tick();

    const late = TestBed.runInInjectionContext(() => new InvoicesManager());
    const shared = late.get(SHARED_UNIT_OF_WORK_KEY);
    TestBed.tick();
    expect(shared.clear).not.toHaveBeenCalled();
    expect(late.has(SHARED_UNIT_OF_WORK_KEY)).toBe(true);
  });

  it("forgets every workspace's units of work at sign-out", () => {
    const { orders, invoices, events } = setUp();
    orders.get('order-1');
    invoices.get(SHARED_UNIT_OF_WORK_KEY);

    events.loggedOut();
    TestBed.tick();

    expect(orders.has('order-1')).toBe(false);
    expect(invoices.has(SHARED_UNIT_OF_WORK_KEY)).toBe(false);
  });
});
