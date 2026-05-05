import { useNotificationsStore } from '../../store/notifications';

interface PeriodicSyncManager {
  register: (tag: string, opts?: { minInterval: number }) => Promise<void>;
}

interface RegistrationWithSync extends ServiceWorkerRegistration {
  periodicSync?: PeriodicSyncManager;
}

export const requestNotificationPermission = async (): Promise<'granted' | 'denied' | 'default'> => {
  if (!('Notification' in window)) return 'denied';
  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    useNotificationsStore.getState().setPermission(Notification.permission);
    return Notification.permission;
  }
  const result = await Notification.requestPermission();
  useNotificationsStore.getState().setPermission(result);
  if (result === 'granted') void registerPeriodicSync();
  return result;
};

export const registerPeriodicSync = async (): Promise<boolean> => {
  if (!('serviceWorker' in navigator)) return false;
  const reg = (await navigator.serviceWorker.ready) as RegistrationWithSync;
  if (!reg.periodicSync) return false;
  try {
    await reg.periodicSync.register('check-overdue-tasks', { minInterval: 6 * 60 * 60 * 1000 });
    return true;
  } catch (err) {
    console.warn('[notifications] periodicSync register failed', err);
    return false;
  }
};

export const isStandalone = (): boolean =>
  window.matchMedia('(display-mode: standalone)').matches ||
  // iOS Safari
  ('standalone' in window.navigator && (window.navigator as Navigator & { standalone?: boolean }).standalone === true);
