import type { BookingTask } from '../../types';

const LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;

export const overdueTasks = (tasks: BookingTask[], now: Date): BookingTask[] => {
  const nowMs = now.getTime();
  const lowerBoundMs = nowMs - LOOKBACK_MS;
  return tasks.filter(t => {
    if (t.done || t.deletedAt) return false;
    if (t.isService && !t.notify) return false; // servizio mai ordinato dall'ospite: non e' "lavoro da fare"
    const dueMs = new Date(t.dueAt).getTime();
    return dueMs <= nowMs && dueMs >= lowerBoundMs;
  });
};
