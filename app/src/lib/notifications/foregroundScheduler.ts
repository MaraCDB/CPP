import type { BookingTask } from '../../types';

const MAX_AHEAD_MS = 24 * 60 * 60 * 1000;
const timers = new Map<string, ReturnType<typeof setTimeout>>();

export const scheduleTask = (task: BookingTask, onShown: (taskId: string) => void): void => {
  if (timers.has(task.id)) return; // already scheduled
  if (!task.notify || task.done || task.deletedAt) return;
  if (task.notificationStatus !== 'pending') return;
  const ms = new Date(task.dueAt).getTime() - Date.now();
  if (ms < 0 || ms > MAX_AHEAD_MS) return;
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

  const handle = setTimeout(() => {
    try {
      new Notification(task.title, {
        body: task.notes,
        tag: task.id,
        data: { bookingId: task.bookingId, taskId: task.id },
      });
      onShown(task.id);
    } catch (err) {
      console.warn('[fg-scheduler] notification failed', err);
    } finally {
      timers.delete(task.id);
    }
  }, ms);
  timers.set(task.id, handle);
};

export const cancelTask = (taskId: string): void => {
  const h = timers.get(taskId);
  if (h) {
    clearTimeout(h);
    timers.delete(taskId);
  }
};

export const cancelAll = (): void => {
  for (const h of timers.values()) clearTimeout(h);
  timers.clear();
};

export const getActiveCount = (): number => timers.size;
