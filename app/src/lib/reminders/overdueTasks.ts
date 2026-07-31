import type { BookingTask } from '../../types';

export const overdueTasks = (tasks: BookingTask[], now: Date): BookingTask[] =>
  tasks.filter(t => !t.done && !t.deletedAt && new Date(t.dueAt).getTime() <= now.getTime());
