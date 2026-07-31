import type { BookingTask } from '../../types';

export interface DigestNotification {
  title: string;
  body: string;
}

export const buildDigestNotification = (tasks: BookingTask[]): DigestNotification => {
  const n = tasks.length;
  const title = n === 1 ? '1 promemoria da controllare' : `${n} promemoria da controllare`;
  const preview = tasks.slice(0, 3).map(t => t.title);
  const remaining = n - preview.length;
  const body = remaining > 0 ? `${preview.join(', ')} e altri ${remaining}` : preview.join(', ');
  return { title, body };
};
