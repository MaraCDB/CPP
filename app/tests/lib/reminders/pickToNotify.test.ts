import { describe, it, expect } from 'vitest';
import { pickToNotify } from '../../../src/lib/reminders/pickToNotify';
import type { BookingTask } from '../../../src/types';

const t = (over: Partial<BookingTask>): BookingTask => ({
  id: 'x', bookingId: 'b', templateId: 't', title: 'X',
  dueAt: '2026-05-04T08:00:00.000Z', done: false, notify: true,
  notificationStatus: 'pending', isService: false,
  createdAt: '2026-05-01T00:00:00.000Z', updatedAt: '2026-05-01T00:00:00.000Z',
  ...over,
});

const NOW = new Date('2026-05-04T10:00:00.000Z');

describe('pickToNotify', () => {
  it('include task scaduto, notify=true, pending, non-done, non deleted', () => {
    const tasks = [t({})];
    expect(pickToNotify(tasks, NOW)).toHaveLength(1);
  });
  it('esclude task futuro', () => {
    expect(pickToNotify([t({ dueAt: '2026-05-04T12:00:00.000Z' })], NOW)).toHaveLength(0);
  });
  it('esclude task done', () => {
    expect(pickToNotify([t({ done: true })], NOW)).toHaveLength(0);
  });
  it('esclude task con notify=false', () => {
    expect(pickToNotify([t({ notify: false })], NOW)).toHaveLength(0);
  });
  it('esclude task gia mostrato', () => {
    expect(pickToNotify([t({ notificationStatus: 'shown' })], NOW)).toHaveLength(0);
  });
  it('esclude task soft-deleted', () => {
    expect(pickToNotify([t({ deletedAt: '2026-05-03T00:00:00.000Z' })], NOW)).toHaveLength(0);
  });
});
