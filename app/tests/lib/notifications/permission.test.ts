import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Must mock store before importing permission module
vi.mock('../../../src/store/notifications', () => ({
  useNotificationsStore: {
    getState: vi.fn(() => ({ setPermission: vi.fn() })),
  },
}));

import { useNotificationsStore } from '../../../src/store/notifications';
import {
  requestNotificationPermission,
  registerPeriodicSync,
  isStandalone,
} from '../../../src/lib/notifications/permission';

const mockSetPermission = vi.fn();

beforeEach(() => {
  vi.mocked(useNotificationsStore.getState).mockReturnValue({
    setPermission: mockSetPermission,
  } as ReturnType<typeof useNotificationsStore.getState>);
  mockSetPermission.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── requestNotificationPermission ─────────────────────────────────────────

describe('requestNotificationPermission', () => {
  it('returns "denied" when Notification API is absent', async () => {
    const orig = (globalThis as Record<string, unknown>).Notification;
    delete (globalThis as Record<string, unknown>).Notification;
    const result = await requestNotificationPermission();
    expect(result).toBe('denied');
    (globalThis as Record<string, unknown>).Notification = orig;
  });

  it('returns early with "granted" without prompting when already granted', async () => {
    Object.defineProperty(globalThis, 'Notification', {
      value: { permission: 'granted', requestPermission: vi.fn() },
      writable: true, configurable: true,
    });
    const result = await requestNotificationPermission();
    expect(result).toBe('granted');
    expect(mockSetPermission).toHaveBeenCalledWith('granted');
    expect((globalThis as { Notification: { requestPermission: ReturnType<typeof vi.fn> } }).Notification.requestPermission).not.toHaveBeenCalled();
  });

  it('returns early with "denied" without prompting when already denied', async () => {
    Object.defineProperty(globalThis, 'Notification', {
      value: { permission: 'denied', requestPermission: vi.fn() },
      writable: true, configurable: true,
    });
    const result = await requestNotificationPermission();
    expect(result).toBe('denied');
    expect(mockSetPermission).toHaveBeenCalledWith('denied');
  });

  it('calls requestPermission when permission is default and stores result', async () => {
    const requestPermission = vi.fn().mockResolvedValue('granted');
    Object.defineProperty(globalThis, 'Notification', {
      value: { permission: 'default', requestPermission },
      writable: true, configurable: true,
    });
    // Provide a serviceWorker with no periodicSync so registerPeriodicSync returns false
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { ready: Promise.resolve({}) },
      writable: true, configurable: true,
    });
    const result = await requestNotificationPermission();
    expect(result).toBe('granted');
    expect(requestPermission).toHaveBeenCalled();
    expect(mockSetPermission).toHaveBeenCalledWith('granted');
  });
});

// ─── registerPeriodicSync ───────────────────────────────────────────────────

describe('registerPeriodicSync', () => {
  it('returns false when periodicSync is absent (registration has no periodicSync)', async () => {
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { ready: Promise.resolve({}) },
      writable: true, configurable: true,
    });
    expect(await registerPeriodicSync()).toBe(false);
  });

  it('returns false when periodicSync is not on the registration', async () => {
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { ready: Promise.resolve({}) },
      writable: true, configurable: true,
    });
    expect(await registerPeriodicSync()).toBe(false);
  });

  it('returns true and registers tag when periodicSync is available', async () => {
    const register = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { ready: Promise.resolve({ periodicSync: { register } }) },
      writable: true, configurable: true,
    });
    const result = await registerPeriodicSync();
    expect(result).toBe(true);
    expect(register).toHaveBeenCalledWith('check-overdue-tasks', { minInterval: 6 * 60 * 60 * 1000 });
  });

  it('returns false and warns when periodicSync.register throws', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const register = vi.fn().mockRejectedValue(new Error('denied'));
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { ready: Promise.resolve({ periodicSync: { register } }) },
      writable: true, configurable: true,
    });
    const result = await registerPeriodicSync();
    expect(result).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
  });
});

// ─── isStandalone ───────────────────────────────────────────────────────────

describe('isStandalone', () => {
  it('returns true when display-mode is standalone', () => {
    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn().mockReturnValue({ matches: true }),
      writable: true, configurable: true,
    });
    expect(isStandalone()).toBe(true);
  });

  it('returns false when not standalone and no iOS flag', () => {
    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn().mockReturnValue({ matches: false }),
      writable: true, configurable: true,
    });
    Object.defineProperty(window.navigator, 'standalone', {
      value: undefined, writable: true, configurable: true,
    });
    expect(isStandalone()).toBe(false);
  });

  it('returns true when iOS standalone flag is true', () => {
    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn().mockReturnValue({ matches: false }),
      writable: true, configurable: true,
    });
    Object.defineProperty(window.navigator, 'standalone', {
      value: true, writable: true, configurable: true,
    });
    expect(isStandalone()).toBe(true);
  });
});
