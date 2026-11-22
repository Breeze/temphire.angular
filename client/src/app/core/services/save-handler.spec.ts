import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ErrorVisibility, asyncValidator, createEntityStore, createValidationService } from '@ideablade/validation';
import { MessageService } from '@openng/optimus-ui/api';
import { Subject, firstValueFrom, skip } from 'rxjs';
import { vi } from 'vitest';

import { SaveHandler } from './save-handler';

/**
 * Regression test: Save must decide on the data as it is when clicked.
 *
 * Resource Management decided on the continuous validation of its unit of work, which catches up
 * with an edit only after the change has been coalesced.  A Save clicked right after an edit
 * counted the errors from before it ("One problem needs fixing" with two on screen).  The handler
 * validates the unit of work itself; these tests make the edit and call it in the same task.
 */
describe('SaveHandler', () => {
  interface Order {
    name: string;
    code: string;
  }

  function setUp(order: Order, options: { slowRule?: boolean } = {}) {
    const changes = new Subject<void>();
    const entityStore = createEntityStore({ entities: () => [{ entityType: 'Order', entity: order }], changes });
    const validation = createValidationService({
      metadata: {
        Order: {
          properties: {
            name: { displayName: 'Name', required: true },
            ...(options.slowRule ? { code: { validators: [{ name: 'notTaken', async: true }] } } : {}),
          },
        },
      },
      // An async rule that answers later: "taken" is taken.
      validators: [asyncValidator('notTaken', (value) => new Promise<boolean>((resolve) => setTimeout(() => resolve(value !== 'taken'), 20)), '%displayName% is taken')],
      entityStore,
    });
    const calls: string[] = [];
    const unitOfWork = {
      entityStore,
      commit: vi.fn(async () => {
        calls.push('commit');
        return [];
      }),
    };
    const messages = { add: vi.fn() };
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), { provide: MessageService, useValue: messages }],
    });
    const edit = (change: Partial<Order>) => {
      Object.assign(order, change);
      changes.next();
    };
    return { handler: TestBed.inject(SaveHandler), validation, unitOfWork, messages, calls, edit };
  }

  it('decides on an edit made just before, which the continuous validation has not seen yet', async () => {
    const { handler, validation, unitOfWork, messages, edit } = setUp({ name: 'Ann', code: '' });
    // The screen's continuous validation, settled: no errors.
    const continuous: { errors: number }[] = [];
    validation.validateEntityStore().subscribe((r) => continuous.push({ errors: r.validationErrors.length }));
    await new Promise((resolve) => setTimeout(resolve));
    expect(continuous.at(-1)).toEqual({ errors: 0 });

    // The edit and the click in the same task.
    edit({ name: '' });
    expect(continuous.at(-1)).toEqual({ errors: 0 }); // the continuous result has not caught up
    const saved = await handler.save(unitOfWork, validation);

    expect(saved).toBe(false);
    expect(unitOfWork.commit).not.toHaveBeenCalled();
    expect(messages.add).toHaveBeenCalledWith(expect.objectContaining({ summary: 'Not saved', detail: 'One problem needs fixing. It is highlighted.' }));
  });

  it('shows every error and describes them as the workspace asks', async () => {
    const { handler, validation, unitOfWork, messages } = setUp({ name: '', code: '' });
    const visibility = new ErrorVisibility();
    const revealAll = vi.spyOn(visibility, 'revealAll');

    const saved = await handler.save(unitOfWork, validation, { visibility, describe: (errors) => `${errors.length} on the tab` });

    expect(saved).toBe(false);
    expect(revealAll).toHaveBeenCalledOnce();
    expect(messages.add).toHaveBeenCalledWith(expect.objectContaining({ detail: '1 on the tab' }));
  });

  it('waits for async rules', async () => {
    const { handler, validation, unitOfWork, edit } = setUp({ name: 'Ann', code: '' }, { slowRule: true });
    edit({ code: 'taken' });
    expect(await handler.save(unitOfWork, validation)).toBe(false);
    expect(unitOfWork.commit).not.toHaveBeenCalled();
  });

  it('commits valid data, after the workspace has prepared for it', async () => {
    const { handler, validation, unitOfWork, messages, calls } = setUp({ name: 'Ann', code: 'free' }, { slowRule: true });
    const saved = await handler.save(unitOfWork, validation, { beforeCommit: () => calls.push('beforeCommit') });
    expect(saved).toBe(true);
    expect(calls).toEqual(['beforeCommit', 'commit']);
    expect(messages.add).not.toHaveBeenCalled();
  });

  it('lets a failed commit throw, for the workspace to report', async () => {
    const { handler, validation, unitOfWork } = setUp({ name: 'Ann', code: '' });
    unitOfWork.commit.mockRejectedValueOnce(new Error('Server says no'));
    await expect(handler.save(unitOfWork, validation)).rejects.toThrow('Server says no');
  });

  // Control for the first test: the store does report the edit, and the continuous validation sees
  // it a moment later.  So what the first test shows is timing, not an edit nobody heard of.
  it('has a continuous validation that does catch up a moment later', async () => {
    const { validation, edit } = setUp({ name: 'Ann', code: '' });
    const caughtUp = firstValueFrom(validation.validateEntityStore().pipe(skip(1)));
    edit({ name: '' });
    expect((await caughtUp).validationErrors.map((e) => e.key)).toEqual(['required_name']);
  });
});
