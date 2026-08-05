import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../src/lib/firebase/auth', () => ({ auth: { currentUser: null } }));
vi.mock('../../src/lib/firebase/db', () => ({
  upsertDoc: vi.fn().mockResolvedValue(undefined),
  removeDoc: vi.fn().mockResolvedValue(undefined),
}));
const { mockSyncClosure, mockDeleteClosure } = vi.hoisted(() => ({
  mockSyncClosure: vi.fn().mockResolvedValue(undefined),
  mockDeleteClosure: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../src/lib/google/calendarSync', () => ({
  syncClosureToCalendar: mockSyncClosure,
  deleteClosureFromCalendar: mockDeleteClosure,
}));

import { useClosures } from '../../src/store/closures';

describe('closures store — calendar sync hook', () => {
  beforeEach(() => {
    useClosures.setState({ items: [] });
    mockSyncClosure.mockClear();
    mockDeleteClosure.mockClear();
  });

  it('add chiama syncClosureToCalendar con la chiusura creata', () => {
    const c = useClosures.getState().add({ start: '2026-09-01', end: '2026-09-03' });
    expect(mockSyncClosure).toHaveBeenCalledWith(expect.objectContaining({ id: c.id }));
  });

  it('update chiama syncClosureToCalendar con la chiusura aggiornata', () => {
    const c = useClosures.getState().add({ start: '2026-09-01', end: '2026-09-03' });
    mockSyncClosure.mockClear();
    useClosures.getState().update(c.id, { note: 'manutenzione' });
    expect(mockSyncClosure).toHaveBeenCalledWith(expect.objectContaining({ id: c.id, note: 'manutenzione' }));
  });

  it('remove chiama deleteClosureFromCalendar con l\'id rimosso', () => {
    const c = useClosures.getState().add({ start: '2026-09-01', end: '2026-09-03' });
    useClosures.getState().remove(c.id);
    expect(mockDeleteClosure).toHaveBeenCalledWith(c.id);
  });
});
