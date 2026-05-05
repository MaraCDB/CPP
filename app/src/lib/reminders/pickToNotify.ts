import type { BookingTask } from '../../types';

export const pickToNotify = (tasks: BookingTask[], now: Date): BookingTask[] =>
  tasks.filter(t =>
    !t.deletedAt &&
    !t.done &&
    t.notify &&
    t.notificationStatus === 'pending' &&
    new Date(t.dueAt).getTime() <= now.getTime(),
  );
