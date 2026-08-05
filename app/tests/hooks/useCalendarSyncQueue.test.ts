import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { create } from 'zustand';

const { mockProcessQueue } = vi.hoisted(() => ({
  mockProcessQueue: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../src/lib/google/calendarSync', () => ({
  processCalendarQueue: mockProcessQueue,
}));
vi.mock('../../src/store/bookings', () => ({ useBookings: { getState: () => ({ items: [] }) } }));
vi.mock('../../src/store/closures', () => ({ useClosures: { getState: () => ({ items: [] }) } }));

interface FakeCalendarSettings {
  googleCalendarId: string | null;
  calendarSyncEnabled: boolean;
}

const calendarSettingsStore = create<FakeCalendarSettings>(() => ({
  googleCalendarId: null,
  calendarSyncEnabled: false,
}));
vi.mock('../../src/store/calendarSettings', () => ({ useCalendarSettings: calendarSettingsStore }));

beforeEach(() => {
  mockProcessQueue.mockClear();
  calendarSettingsStore.setState({ googleCalendarId: null, calendarSyncEnabled: false });
});

describe('useCalendarSyncQueue', () => {
  it('non fa nulla al mount se uid è null (anche con impostazioni pronte)', async () => {
    calendarSettingsStore.setState({ googleCalendarId: 'cal1', calendarSyncEnabled: true });
    const { useCalendarSyncQueue } = await import('../../src/hooks/useCalendarSyncQueue');
    renderHook(() => useCalendarSyncQueue(null));
    expect(mockProcessQueue).not.toHaveBeenCalled();
  });

  it('non fa nulla se il sync non è abilitato', async () => {
    calendarSettingsStore.setState({ googleCalendarId: 'cal1', calendarSyncEnabled: false });
    const { useCalendarSyncQueue } = await import('../../src/hooks/useCalendarSyncQueue');
    renderHook(() => useCalendarSyncQueue('u1'));
    expect(mockProcessQueue).not.toHaveBeenCalled();
  });

  it('non fa nulla se nessun calendario è collegato', async () => {
    calendarSettingsStore.setState({ googleCalendarId: null, calendarSyncEnabled: true });
    const { useCalendarSyncQueue } = await import('../../src/hooks/useCalendarSyncQueue');
    renderHook(() => useCalendarSyncQueue('u1'));
    expect(mockProcessQueue).not.toHaveBeenCalled();
  });

  it('processa la coda al mount quando uid, enabled e calendarId sono tutti presenti', async () => {
    calendarSettingsStore.setState({ googleCalendarId: 'cal1', calendarSyncEnabled: true });
    const { useCalendarSyncQueue } = await import('../../src/hooks/useCalendarSyncQueue');
    renderHook(() => useCalendarSyncQueue('u1'));
    expect(mockProcessQueue).toHaveBeenCalledTimes(1);
  });

  it('processa la coda quando le impostazioni passano da non pronte a pronte (idratazione Firestore async)', async () => {
    const { useCalendarSyncQueue } = await import('../../src/hooks/useCalendarSyncQueue');
    renderHook(() => useCalendarSyncQueue('u1'));
    expect(mockProcessQueue).not.toHaveBeenCalled();

    act(() => {
      calendarSettingsStore.setState({ googleCalendarId: 'cal1', calendarSyncEnabled: true });
    });
    expect(mockProcessQueue).toHaveBeenCalledTimes(1);
  });

  it('processa di nuovo la coda quando il browser torna online', async () => {
    calendarSettingsStore.setState({ googleCalendarId: 'cal1', calendarSyncEnabled: true });
    const { useCalendarSyncQueue } = await import('../../src/hooks/useCalendarSyncQueue');
    renderHook(() => useCalendarSyncQueue('u1'));
    mockProcessQueue.mockClear();
    window.dispatchEvent(new Event('online'));
    expect(mockProcessQueue).toHaveBeenCalledTimes(1);
  });
});
