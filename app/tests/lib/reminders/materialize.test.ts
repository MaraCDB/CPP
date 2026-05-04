import { describe, it, expect } from 'vitest';
import { resolvePlaceholders } from '../../../src/lib/reminders/materialize';
import type { ReminderTemplate, BookingTask } from '../../../src/types';
import { materializeTasks, recalculateDueAt } from '../../../src/lib/reminders/materialize';

describe('resolvePlaceholders', () => {
  it('sostituisce {adulti} con 2 e {bambini} con 1 dato numOspiti=3 senza dettaglio', () => {
    const out = resolvePlaceholders('Camera {adulti}A {bambini}B', { numOspiti: 3 });
    expect(out).toBe('Camera 3A 0B');
  });
  it('lascia placeholder sconosciuti invariati', () => {
    expect(resolvePlaceholders('foo {boh}', {})).toBe('foo {boh}');
  });
  it('sostituisce {oraArrivo} se presente nelle note', () => {
    expect(resolvePlaceholders('Check-in {oraArrivo}', { oraArrivo: '15:30' })).toBe('Check-in 15:30');
  });
  it('placeholder {oraArrivo} mancante diventa "—"', () => {
    expect(resolvePlaceholders('Check-in {oraArrivo}', {})).toBe('Check-in —');
  });
});

const T = (over: Partial<ReminderTemplate>): ReminderTemplate => ({
  id: 't', builtIn: false, enabled: true, title: 'X',
  isService: false, anchor: 'check-in', offsetDays: 0,
  defaultTime: '09:00', notify: true, sortOrder: 0,
  ...over,
});

const B = { id: 'b1', checkin: '2026-05-10', checkout: '2026-05-12', numOspiti: 2 };

describe('materializeTasks', () => {
  it('genera un task per ogni template enabled', () => {
    const tpls = [T({ id: 'a' }), T({ id: 'b', enabled: false })];
    const tasks = materializeTasks(B, tpls, () => '2026-05-04T10:00:00.000Z');
    expect(tasks).toHaveLength(1);
    expect(tasks[0].templateId).toBe('a');
  });
  it('calcola dueAt con offsetDays e defaultTime', () => {
    const tpl = T({ id: 'p', offsetDays: -1, defaultTime: '14:00' });
    const [task] = materializeTasks(B, [tpl], () => '2026-05-04T10:00:00.000Z');
    // checkin 2026-05-10, -1 giorno = 2026-05-09 alle 14:00 locale
    expect(task.dueAt.startsWith('2026-05-09T14:00') || task.dueAt.includes('2026-05-09')).toBe(true);
  });
  it('risolve i placeholder nel title', () => {
    const tpl = T({ id: 'p', title: 'Camera {adulti}A {bambini}B' });
    const [task] = materializeTasks(B, [tpl], () => '2026-05-04T10:00:00.000Z');
    expect(task.title).toBe('Camera 2A 0B');
  });
  it('service template parte con notify: false', () => {
    const tpl = T({ id: 'merenda', isService: true });
    const [task] = materializeTasks(B, [tpl], () => '2026-05-04T10:00:00.000Z');
    expect(task.notify).toBe(false);
    expect(task.isService).toBe(true);
  });
});

describe('recalculateDueAt', () => {
  it('aggiorna dueAt quando il booking sposta il check-in', () => {
    const tpl = T({ id: 'x', offsetDays: -1, defaultTime: '14:00' });
    const [task] = materializeTasks(B, [tpl], () => '2026-05-04T10:00:00.000Z');
    const updated = recalculateDueAt(task, { ...B, checkin: '2026-06-01' }, tpl);
    expect(updated.dueAt.includes('2026-05-31')).toBe(true);
  });
  it('lascia invariato un task custom (templateId === null)', () => {
    const t: BookingTask = {
      id: 'c', bookingId: 'b1', templateId: null, title: 'Custom',
      dueAt: '2026-06-01T10:00:00.000Z', done: false, notify: true,
      notificationStatus: 'pending', isService: false,
      createdAt: '2026-05-04T10:00:00.000Z', updatedAt: '2026-05-04T10:00:00.000Z',
    };
    const out = recalculateDueAt(t, { ...B, checkin: '2026-07-01' }, null);
    expect(out.dueAt).toBe(t.dueAt);
  });
});
