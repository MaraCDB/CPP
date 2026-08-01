import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockOnSnapshot = vi.fn();
const mockSetDoc = vi.fn();
const mockDeleteDoc = vi.fn();
const mockDoc = vi.fn((..._args) => ({ __ref: _args }));
const mockCollection = vi.fn((..._args) => ({ __ref: _args }));
const mockInitializeFirestore = vi.fn(() => ({}));

vi.mock('firebase/firestore', () => ({
  initializeFirestore: mockInitializeFirestore,
  persistentLocalCache: vi.fn(() => ({})),
  persistentSingleTabManager: vi.fn(() => ({})),
  collection: mockCollection,
  doc: mockDoc,
  onSnapshot: mockOnSnapshot,
  setDoc: mockSetDoc,
  deleteDoc: mockDeleteDoc,
  enableNetwork: vi.fn().mockResolvedValue(undefined),
  disableNetwork: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../src/lib/firebase/config', () => ({ app: {} }));

beforeEach(() => vi.clearAllMocks());

describe('firebase db', () => {
  it('subscribeCollection wires onSnapshot and decodes docs', async () => {
    const { subscribeCollection } = await import('../../../src/lib/firebase/db');
    const cb = vi.fn();
    let snapHandler: ((s: { docs: { data: () => unknown }[] }) => void) | null = null;
    mockOnSnapshot.mockImplementation((_ref, h) => { snapHandler = h; return () => {}; });
    subscribeCollection<{ id: string; v: number }>('u1', 'bookings', cb);
    snapHandler?.({ docs: [{ data: () => ({ id: 'a', v: 1 }) }] });
    expect(cb).toHaveBeenCalledWith([{ id: 'a', v: 1 }]);
  });

  it('upsertDoc writes via setDoc', async () => {
    const { upsertDoc } = await import('../../../src/lib/firebase/db');
    await upsertDoc('u1', 'bookings', 'b1', { id: 'b1' });
    expect(mockSetDoc).toHaveBeenCalled();
  });

  it('removeDoc calls deleteDoc', async () => {
    const { removeDoc } = await import('../../../src/lib/firebase/db');
    await removeDoc('u1', 'bookings', 'b1');
    expect(mockDeleteDoc).toHaveBeenCalled();
  });

  it('subscribeUserSettings wires onSnapshot on the root user doc', async () => {
    const { subscribeUserSettings } = await import('../../../src/lib/firebase/db');
    const cb = vi.fn();
    let snapHandler: ((s: { data: () => unknown }) => void) | null = null;
    mockOnSnapshot.mockImplementation((_ref, h) => { snapHandler = h; return () => {}; });
    subscribeUserSettings('u1', cb);
    snapHandler?.({ data: () => ({ googleCalendarId: 'cal1', calendarSyncEnabled: true }) });
    expect(cb).toHaveBeenCalledWith({ googleCalendarId: 'cal1', calendarSyncEnabled: true });
  });

  it('subscribeUserSettings passes empty object when doc has no data', async () => {
    const { subscribeUserSettings } = await import('../../../src/lib/firebase/db');
    const cb = vi.fn();
    let snapHandler: ((s: { data: () => unknown }) => void) | null = null;
    mockOnSnapshot.mockImplementation((_ref, h) => { snapHandler = h; return () => {}; });
    subscribeUserSettings('u1', cb);
    snapHandler?.({ data: () => undefined });
    expect(cb).toHaveBeenCalledWith({});
  });

  it('updateUserSettings writes via setDoc with merge', async () => {
    const { updateUserSettings } = await import('../../../src/lib/firebase/db');
    await updateUserSettings('u1', { calendarSyncEnabled: false });
    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.anything(),
      { calendarSyncEnabled: false },
      { merge: true },
    );
  });
});
