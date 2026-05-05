import { describe, it, expect } from 'vitest';
import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import type { BookingTask } from '../../../src/types';
import { pickToNotify } from '../../../src/lib/reminders/pickToNotify';

const t = (over: Partial<BookingTask>): BookingTask => ({
  id: 'a',
  bookingId: 'b1',
  templateId: 'preparation',
  title: 'X',
  dueAt: '2026-05-04T08:00:00.000Z',
  done: false,
  notify: true,
  notificationStatus: 'pending',
  isService: false,
  createdAt: '2026-05-01T00:00:00.000Z',
  updatedAt: '2026-05-01T00:00:00.000Z',
  ...over,
});

describe('SW periodicsync logic (integration with IDB)', () => {
  it('legge tasks da IDB e seleziona i due overdue notifiable', async () => {
    const db = await openDB('cdb_cache', 2, {
      upgrade(d) {
        if (!d.objectStoreNames.contains('tasks')) d.createObjectStore('tasks');
      },
    });
    const tasks: BookingTask[] = [
      t({ id: '1', dueAt: '2026-05-04T07:00:00.000Z' }),
      t({ id: '2', dueAt: '2026-05-04T07:30:00.000Z' }),
      t({ id: '3', dueAt: '2026-05-04T20:00:00.000Z' }),
      t({ id: '4', dueAt: '2026-05-04T07:00:00.000Z', done: true }),
      t({
        id: '5',
        dueAt: '2026-05-04T07:00:00.000Z',
        notificationStatus: 'shown',
      }),
    ];
    await db.put('tasks', tasks, 'all');

    const stored = (await db.get('tasks', 'all')) as BookingTask[];
    const overdue = pickToNotify(stored, new Date('2026-05-04T10:00:00.000Z'));
    expect(overdue.map((t) => t.id)).toEqual(['1', '2']);

    // simulate SW marking shown
    const updated = stored.map((t) =>
      overdue.some((o) => o.id === t.id)
        ? { ...t, notificationStatus: 'shown' as const }
        : t,
    );
    await db.put('tasks', updated, 'all');

    const after = (await db.get('tasks', 'all')) as BookingTask[];
    expect(after.find((x) => x.id === '1')!.notificationStatus).toBe('shown');
    expect(after.find((x) => x.id === '3')!.notificationStatus).toBe('pending');
  });
});
