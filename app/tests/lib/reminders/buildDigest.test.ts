import { describe, it, expect } from 'vitest';
import { buildDigestNotification } from '../../../src/lib/reminders/buildDigest';
import type { BookingTask } from '../../../src/types';

const t = (over: Partial<BookingTask>): BookingTask => ({
  id: 'a', bookingId: 'b1', templateId: null, title: 'X',
  dueAt: '2026-05-04T08:00:00.000Z', done: false, notify: true,
  notificationStatus: 'pending', isService: false,
  createdAt: '2026-05-01T00:00:00.000Z', updatedAt: '2026-05-01T00:00:00.000Z',
  ...over,
});

describe('buildDigestNotification', () => {
  it('usa il singolare per un solo task', () => {
    const { title, body } = buildDigestNotification([t({ title: 'Richiedi documenti' })]);
    expect(title).toBe('1 promemoria da controllare');
    expect(body).toBe('Richiedi documenti');
  });

  it('usa il plurale ed elenca tutti i titoli se sono 3 o meno', () => {
    const tasks = [t({ id: '1', title: 'A' }), t({ id: '2', title: 'B' }), t({ id: '3', title: 'C' })];
    const { title, body } = buildDigestNotification(tasks);
    expect(title).toBe('3 promemoria da controllare');
    expect(body).toBe('A, B, C');
  });

  it('tronca a 3 titoli e conta i restanti', () => {
    const tasks = ['A', 'B', 'C', 'D', 'E'].map((title, i) => t({ id: String(i), title }));
    const { title, body } = buildDigestNotification(tasks);
    expect(title).toBe('5 promemoria da controllare');
    expect(body).toBe('A, B, C e altri 2');
  });
});
