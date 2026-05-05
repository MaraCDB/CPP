import { describe, it, expect } from 'vitest';
import { bookingToRow, rowToBooking, BOOKING_HEADERS } from '../../src/lib/google/adapter';
import type { Prenotazione } from '../../src/types';

const sample: Prenotazione = {
  id: 'b1', camera: 'lampone', checkin: '2026-04-10', checkout: '2026-04-14',
  stato: 'confermato', nome: 'Rossi', riferimento: '#12', numOspiti: 3,
  contattoVia: 'mail', contattoValore: 'rossi@mail.it', prezzoTotale: 320,
  anticipo: { importo: 112, data: '2026-03-20', tipo: 'bonifico' },
  note: 'Arrivo 16',
  contattoResourceName: 'people/c1234567890',
  contattoEmail: 'rossi@mail.it',
  creatoIl: '2026-01-01T00:00:00.000Z', aggiornatoIl: '2026-01-01T00:00:00.000Z',
};

describe('adapter', () => {
  it('BOOKING_HEADERS is stable', () => {
    expect(BOOKING_HEADERS).toContain('id');
    expect(BOOKING_HEADERS).toContain('checkin');
  });
  it('round-trip preserva tutti i campi', () => {
    const row = bookingToRow(sample);
    const back = rowToBooking(row);
    expect(back).toEqual(sample);
  });
  it('handles missing anticipo', () => {
    const b = { ...sample, anticipo: undefined };
    const row = bookingToRow(b);
    const back = rowToBooking(row);
    expect(back.anticipo).toBeUndefined();
  });
  it('handles missing contact link', () => {
    const b = { ...sample, contattoResourceName: undefined, contattoEmail: undefined };
    const row = bookingToRow(b);
    const back = rowToBooking(row);
    expect(back.contattoResourceName).toBeUndefined();
    expect(back.contattoEmail).toBeUndefined();
  });
  it('BOOKING_HEADERS include i nuovi campi', () => {
    expect(BOOKING_HEADERS).toContain('contatto_resource_name');
    expect(BOOKING_HEADERS).toContain('contatto_email');
  });
});

import { taskToRow, rowToTask, TASK_HEADERS } from '../../src/lib/google/adapter';
import type { BookingTask } from '../../src/types';

describe('task adapter round-trip', () => {
  it('header ha 16 colonne', () => {
    expect(TASK_HEADERS).toHaveLength(16);
  });
  it('round-trip preserva tutti i campi (eccetto notificationStatus che torna pending)', () => {
    const original: BookingTask = {
      id: 't1', bookingId: 'b1', templateId: 'preparation',
      title: 'Prepara', description: 'desc', dueAt: '2026-05-09T14:00:00.000Z',
      done: true, doneAt: '2026-05-09T15:00:00.000Z', notes: 'note',
      notify: true, notificationStatus: 'shown', notificationShownAt: '2026-05-09T14:00:00.000Z',
      isService: false,
      createdAt: '2026-05-04T10:00:00.000Z', updatedAt: '2026-05-04T11:00:00.000Z',
      deletedAt: undefined,
    };
    const row = taskToRow(original);
    const back = rowToTask(row);
    expect(back.id).toBe('t1');
    expect(back.bookingId).toBe('b1');
    expect(back.templateId).toBe('preparation');
    expect(back.title).toBe('Prepara');
    expect(back.description).toBe('desc');
    expect(back.dueAt).toBe('2026-05-09T14:00:00.000Z');
    expect(back.done).toBe(true);
    expect(back.doneAt).toBe('2026-05-09T15:00:00.000Z');
    expect(back.notes).toBe('note');
    expect(back.notify).toBe(true);
    // notificationStatus / shownAt: NON sincronizzati, sempre pending/undefined
    expect(back.notificationStatus).toBe('pending');
    expect(back.notificationShownAt).toBeUndefined();
    expect(back.isService).toBe(false);
    expect(back.createdAt).toBe('2026-05-04T10:00:00.000Z');
    expect(back.updatedAt).toBe('2026-05-04T11:00:00.000Z');
  });
  it('templateId vuoto torna null', () => {
    const t: BookingTask = {
      id: 'x', bookingId: 'b1', templateId: null,
      title: 'Custom', dueAt: '2026-05-09T14:00:00.000Z',
      done: false, notify: true, notificationStatus: 'pending', isService: false,
      createdAt: '2026-05-04T10:00:00.000Z', updatedAt: '2026-05-04T11:00:00.000Z',
    };
    const back = rowToTask(taskToRow(t));
    expect(back.templateId).toBeNull();
  });
});

import { templateToRow, rowToTemplate, TEMPLATE_HEADERS } from '../../src/lib/google/adapter';
import type { ReminderTemplate } from '../../src/types';

describe('template adapter round-trip', () => {
  it('header ha 12 colonne', () => {
    expect(TEMPLATE_HEADERS).toHaveLength(12);
  });
  it('round-trip preserva tutti i campi', () => {
    const original: ReminderTemplate = {
      id: 'merenda', builtIn: true, enabled: true,
      title: 'Preparare merenda', description: 'desc',
      isService: true, serviceLabel: 'Merenda',
      anchor: 'check-in', offsetDays: 0,
      defaultTime: '16:30', notify: true, sortOrder: 50,
    };
    const back = rowToTemplate(templateToRow(original));
    expect(back).toEqual(original);
  });
  it('offsetDays negativo round-trip', () => {
    const t: ReminderTemplate = {
      id: 'p', builtIn: true, enabled: true, title: 'X',
      isService: false, anchor: 'check-in', offsetDays: -2,
      defaultTime: '14:00', notify: true, sortOrder: 1,
    };
    expect(rowToTemplate(templateToRow(t)).offsetDays).toBe(-2);
  });
});
