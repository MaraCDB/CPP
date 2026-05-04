import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { useTasks } from '../../src/store/tasks';
import type { BookingTask } from '../../src/types';

const t = (over: Partial<BookingTask>): BookingTask => ({
  id: 't1', bookingId: 'b1', templateId: 'preparation',
  title: 'X', dueAt: '2026-05-09T14:00:00.000Z', done: false, notify: true,
  notificationStatus: 'pending', isService: false,
  createdAt: '2026-05-04T10:00:00.000Z', updatedAt: '2026-05-04T10:00:00.000Z',
  ...over,
});

describe('tasks store', () => {
  beforeEach(() => {
    useTasks.setState({ items: [] });
    vi.clearAllMocks();
  });
  it('add inserisce un task', () => {
    useTasks.getState().add(t({ id: 'a' }));
    expect(useTasks.getState().items).toHaveLength(1);
  });
  it('addMany inserisce piu task in una volta sola', () => {
    useTasks.getState().addMany([t({ id: 'a' }), t({ id: 'b' })]);
    expect(useTasks.getState().items).toHaveLength(2);
  });
  it('update modifica un task esistente preservando i campi non modificati', () => {
    useTasks.getState().add(t({ id: 'a', title: 'old', notes: 'keep' }));
    useTasks.getState().update('a', { title: 'new' });
    const out = useTasks.getState().items.find(x => x.id === 'a')!;
    expect(out.title).toBe('new');
    expect(out.notes).toBe('keep');
  });
  it('toggleDone flippa done e setta doneAt', () => {
    useTasks.getState().add(t({ id: 'a' }));
    useTasks.getState().toggleDone('a');
    const out = useTasks.getState().items.find(x => x.id === 'a')!;
    expect(out.done).toBe(true);
    expect(out.doneAt).toBeDefined();
  });
  it('removeByBooking soft-delete tutti i task del booking', () => {
    useTasks.getState().addMany([
      t({ id: 'a', bookingId: 'b1' }),
      t({ id: 'b', bookingId: 'b2' }),
    ]);
    useTasks.getState().removeByBooking('b1');
    const out = useTasks.getState().items.find(x => x.id === 'a')!;
    expect(out.deletedAt).toBeDefined();
    expect(useTasks.getState().items.find(x => x.id === 'b')!.deletedAt).toBeUndefined();
  });
  it('byBooking ritorna i task non-deleted di un booking', () => {
    useTasks.getState().addMany([
      t({ id: 'a', bookingId: 'b1' }),
      t({ id: 'b', bookingId: 'b1', deletedAt: '2026-05-04T00:00:00Z' }),
      t({ id: 'c', bookingId: 'b2' }),
    ]);
    const out = useTasks.getState().byBooking('b1');
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('a');
  });
});
