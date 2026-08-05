import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const { mockProcessQueue } = vi.hoisted(() => ({
  mockProcessQueue: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../src/lib/google/calendarSync', () => ({
  processCalendarQueue: mockProcessQueue,
}));
vi.mock('../../src/store/bookings', () => ({ useBookings: { getState: () => ({ items: [] }) } }));
vi.mock('../../src/store/closures', () => ({ useClosures: { getState: () => ({ items: [] }) } }));

beforeEach(() => mockProcessQueue.mockClear());

describe('useCalendarSyncQueue', () => {
  it('processa la coda al mount se uid è presente', async () => {
    const { useCalendarSyncQueue } = await import('../../src/hooks/useCalendarSyncQueue');
    renderHook(() => useCalendarSyncQueue('u1'));
    expect(mockProcessQueue).toHaveBeenCalledTimes(1);
  });

  it('non fa nulla al mount se uid è null', async () => {
    const { useCalendarSyncQueue } = await import('../../src/hooks/useCalendarSyncQueue');
    renderHook(() => useCalendarSyncQueue(null));
    expect(mockProcessQueue).not.toHaveBeenCalled();
  });

  it('processa di nuovo la coda quando il browser torna online', async () => {
    const { useCalendarSyncQueue } = await import('../../src/hooks/useCalendarSyncQueue');
    renderHook(() => useCalendarSyncQueue('u1'));
    mockProcessQueue.mockClear();
    window.dispatchEvent(new Event('online'));
    expect(mockProcessQueue).toHaveBeenCalledTimes(1);
  });
});
