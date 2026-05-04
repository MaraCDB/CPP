export interface PlaceholderData {
  numOspiti?: number;
  adulti?: number;
  bambini?: number;
  oraArrivo?: string;
}

const KNOWN: Record<string, (d: PlaceholderData) => string> = {
  '{adulti}': (d) => String(d.adulti ?? d.numOspiti ?? 0),
  '{bambini}': (d) => String(d.bambini ?? 0),
  '{oraArrivo}': (d) => d.oraArrivo ?? '—',
};

export const resolvePlaceholders = (tpl: string, data: PlaceholderData): string => {
  let out = tpl;
  for (const [key, fn] of Object.entries(KNOWN)) {
    out = out.split(key).join(fn(data));
  }
  return out;
};

import type { ReminderTemplate, BookingTask } from '../../types';
import { uid } from '../id';

export interface BookingShape {
  id: string;
  checkin: string;
  checkout: string;
  numOspiti?: number;
  oraArrivo?: string;
}

const computeDueAt = (booking: BookingShape, tpl: ReminderTemplate): string => {
  const base = tpl.anchor === 'check-out' ? booking.checkout : booking.checkin;
  const [y, m, d] = base.split('-').map(Number);
  const local = new Date(y, m - 1, d);
  local.setDate(local.getDate() + tpl.offsetDays);
  const [hh, mm] = tpl.defaultTime.split(':').map(Number);
  local.setHours(hh, mm, 0, 0);
  return local.toISOString();
};

export const materializeTasks = (
  booking: BookingShape,
  templates: ReminderTemplate[],
  nowIso: () => string = () => new Date().toISOString(),
): BookingTask[] => {
  const now = nowIso();
  return templates.filter(t => t.enabled).map(tpl => ({
    id: uid('tk'),
    bookingId: booking.id,
    templateId: tpl.id,
    title: resolvePlaceholders(tpl.title, {
      numOspiti: booking.numOspiti,
      oraArrivo: booking.oraArrivo,
    }),
    description: tpl.description ? resolvePlaceholders(tpl.description, {
      numOspiti: booking.numOspiti,
      oraArrivo: booking.oraArrivo,
    }) : undefined,
    dueAt: computeDueAt(booking, tpl),
    done: false,
    notify: tpl.isService ? false : tpl.notify,
    notificationStatus: 'pending' as const,
    isService: tpl.isService,
    createdAt: now,
    updatedAt: now,
  }));
};

export const recalculateDueAt = (
  task: BookingTask,
  booking: BookingShape,
  tpl: ReminderTemplate | null,
): BookingTask => {
  if (!tpl || task.templateId === null) return task;
  return {
    ...task,
    dueAt: computeDueAt(booking, tpl),
    title: resolvePlaceholders(tpl.title, {
      numOspiti: booking.numOspiti,
      oraArrivo: booking.oraArrivo,
    }),
    updatedAt: new Date().toISOString(),
  };
};
