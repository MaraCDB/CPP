import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { scheduleTask, cancelAll, getActiveCount } from '../../../src/lib/notifications/foregroundScheduler';
import type { BookingTask } from '../../../src/types';

const t = (over: Partial<BookingTask>): BookingTask => ({
  id: 'a', bookingId: 'b1', templateId: 'preparation',
  title: 'X', dueAt: new Date(Date.now() + 1000).toISOString(),
  done: false, notify: true, notificationStatus: 'pending', isService: false,
  createdAt: '2026-05-04T10:00:00.000Z', updatedAt: '2026-05-04T10:00:00.000Z',
  ...over,
});

describe('foregroundScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    cancelAll();
    // mock di Notification
    (globalThis as unknown as { Notification: unknown }).Notification = vi.fn(function MockNotification() { /* noop */ });
    (globalThis as unknown as { Notification: { permission: string } }).Notification.permission = 'granted';
  });
  afterEach(() => {
    vi.useRealTimers();
    cancelAll();
  });

  it('schedula un timeout per un task entro 24h', () => {
    const task = t({ dueAt: new Date(Date.now() + 5000).toISOString() });
    const onShown = vi.fn();
    scheduleTask(task, onShown);
    expect(getActiveCount()).toBe(1);
  });
  it('NON schedula task oltre 24h', () => {
    const task = t({ dueAt: new Date(Date.now() + 25 * 3600 * 1000).toISOString() });
    scheduleTask(task, vi.fn());
    expect(getActiveCount()).toBe(0);
  });
  it('NON schedula task con notify=false', () => {
    scheduleTask(t({ notify: false }), vi.fn());
    expect(getActiveCount()).toBe(0);
  });
  it('NON schedula task done o gia mostrato', () => {
    scheduleTask(t({ done: true }), vi.fn());
    scheduleTask(t({ id: 'b', notificationStatus: 'shown' }), vi.fn());
    expect(getActiveCount()).toBe(0);
  });
  it('al timeout chiama onShown e crea Notification', () => {
    const task = t({ dueAt: new Date(Date.now() + 5000).toISOString() });
    const onShown = vi.fn();
    scheduleTask(task, onShown);
    vi.advanceTimersByTime(6000);
    expect(onShown).toHaveBeenCalledWith(task.id);
    expect((globalThis as unknown as { Notification: ReturnType<typeof vi.fn> }).Notification).toHaveBeenCalled();
  });
  it('cancelAll svuota i timeout', () => {
    scheduleTask(t({ dueAt: new Date(Date.now() + 5000).toISOString() }), vi.fn());
    cancelAll();
    expect(getActiveCount()).toBe(0);
  });
});
