import { describe, it, expect } from 'vitest';
import { overdueTasks } from '../../../src/lib/reminders/overdueTasks';
import type { BookingTask } from '../../../src/types';

const t = (over: Partial<BookingTask>): BookingTask => ({
  id: 'a', bookingId: 'b1', templateId: null, title: 'X',
  dueAt: '2026-05-04T08:00:00.000Z', done: false, notify: true,
  notificationStatus: 'pending', isService: false,
  createdAt: '2026-05-01T00:00:00.000Z', updatedAt: '2026-05-01T00:00:00.000Z',
  ...over,
});

describe('overdueTasks', () => {
  const now = new Date('2026-05-04T10:00:00.000Z');

  it('include un task scaduto e non fatto', () => {
    const result = overdueTasks([t({ id: '1' })], now);
    expect(result.map(x => x.id)).toEqual(['1']);
  });

  it('esclude i task non ancora scaduti', () => {
    const result = overdueTasks([t({ id: '1', dueAt: '2026-05-04T12:00:00.000Z' })], now);
    expect(result).toEqual([]);
  });

  it('esclude i task gia fatti', () => {
    const result = overdueTasks([t({ id: '1', done: true })], now);
    expect(result).toEqual([]);
  });

  it('esclude i task eliminati', () => {
    const result = overdueTasks([t({ id: '1', deletedAt: '2026-05-03T00:00:00.000Z' })], now);
    expect(result).toEqual([]);
  });

  it('include un task scaduto anche se gia notificato (notificationStatus shown)', () => {
    const result = overdueTasks([t({ id: '1', notificationStatus: 'shown' })], now);
    expect(result.map(x => x.id)).toEqual(['1']);
  });
});
