import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildBookingEvent, buildClosureEvent } from '../../../src/lib/google/calendarSync';
import type { Prenotazione, Chiusura } from '../../../src/types';

const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

vi.mock('../../../src/store/auth', () => ({
  useAuth: { getState: () => ({ googleAccessToken: 'tok' }) },
}));

const booking = (over: Partial<Prenotazione> = {}): Prenotazione => ({
  id: 'b1', camera: 'lampone', checkin: '2026-08-10', checkout: '2026-08-14',
  stato: 'confermato', nome: 'Rossi', creatoIl: '2026-08-01T00:00:00.000Z',
  aggiornatoIl: '2026-08-01T00:00:00.000Z', ...over,
});

describe('buildBookingEvent', () => {
  it('include camera, ospiti e nome nel summary quando numOspiti è presente', () => {
    const e = buildBookingEvent(booking({ numOspiti: 2 }));
    expect(e.summary).toBe('Lampone x2 Rossi');
  });

  it('omette "x{n}" quando numOspiti è assente', () => {
    const e = buildBookingEvent(booking({ numOspiti: undefined }));
    expect(e.summary).toBe('Lampone Rossi');
  });

  it('usa checkin/checkout come date all-day', () => {
    const e = buildBookingEvent(booking());
    expect(e.start).toEqual({ date: '2026-08-10' });
    expect(e.end).toEqual({ date: '2026-08-14' });
  });

  it('description contiene stato e contatto quando presente', () => {
    const e = buildBookingEvent(booking({ contattoValore: '333-1234567', contattoVia: 'whatsapp' }));
    expect(e.description).toBe('Stato: Confermato\nContatto: 333-1234567 (whatsapp)');
  });

  it('description omette la riga contatto quando assente', () => {
    const e = buildBookingEvent(booking());
    expect(e.description).toBe('Stato: Confermato');
  });

  it('imposta extendedProperties.private.cdb_id sull\'id booking', () => {
    const e = buildBookingEvent(booking());
    expect(e.extendedProperties.private.cdb_id).toBe('b1');
  });

  it('traduce correttamente ogni stato', () => {
    expect(buildBookingEvent(booking({ stato: 'proposta' })).description).toContain('Stato: Proposta');
    expect(buildBookingEvent(booking({ stato: 'anticipo_atteso' })).description).toContain('Stato: Anticipo atteso');
  });

  it('usa "Mirtillo" per camera mirtillo', () => {
    const e = buildBookingEvent(booking({ camera: 'mirtillo', numOspiti: undefined }));
    expect(e.summary).toBe('Mirtillo Rossi');
  });
});

describe('buildClosureEvent', () => {
  const closure = (over: Partial<Chiusura> = {}): Chiusura => ({
    id: 'c1', start: '2026-09-01', end: '2026-09-03', ...over,
  });

  it('summary fisso "Struttura chiusa"', () => {
    const e = buildClosureEvent(closure());
    expect(e.summary).toBe('Struttura chiusa');
  });

  it('end.date è il giorno successivo a end (inclusivo → esclusivo)', () => {
    const e = buildClosureEvent(closure());
    expect(e.start).toEqual({ date: '2026-09-01' });
    expect(e.end).toEqual({ date: '2026-09-04' });
  });

  it('description contiene la nota se presente', () => {
    const e = buildClosureEvent(closure({ note: 'manutenzione caldaia' }));
    expect(e.description).toBe('manutenzione caldaia');
  });

  it('description vuota se nota assente', () => {
    const e = buildClosureEvent(closure());
    expect(e.description).toBe('');
  });

  it('imposta extendedProperties.private.cdb_id sull\'id chiusura', () => {
    const e = buildClosureEvent(closure());
    expect(e.extendedProperties.private.cdb_id).toBe('c1');
  });
});

describe('listCalendars', () => {
  it('GET su calendarList e mappa id/summary', async () => {
    fetchMock.mockResolvedValueOnce(new Response(
      JSON.stringify({ items: [{ id: 'cal1', summary: 'Casa' }] }),
      { status: 200 },
    ));
    const { listCalendars } = await import('../../../src/lib/google/calendarSync');
    const list = await listCalendars();
    expect(list).toEqual([{ id: 'cal1', summary: 'Casa' }]);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/users/me/calendarList'),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer tok' }) }),
    );
  });

  it('lancia CalendarScopeError su 403', async () => {
    fetchMock.mockResolvedValueOnce(new Response('forbidden', { status: 403 }));
    const { listCalendars, CalendarScopeError } = await import('../../../src/lib/google/calendarSync');
    await expect(listCalendars()).rejects.toThrow(CalendarScopeError);
  });
});

describe('findEventIdByCdbId', () => {
  it('trova l\'id evento tramite privateExtendedProperty', async () => {
    fetchMock.mockResolvedValueOnce(new Response(
      JSON.stringify({ items: [{ id: 'evt1' }] }),
      { status: 200 },
    ));
    const { findEventIdByCdbId } = await import('../../../src/lib/google/calendarSync');
    const id = await findEventIdByCdbId('cal1', 'b1');
    expect(id).toBe('evt1');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('privateExtendedProperty=cdb_id%3Db1'),
      expect.anything(),
    );
  });

  it('ritorna null se nessun evento trovato', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ items: [] }), { status: 200 }));
    const { findEventIdByCdbId } = await import('../../../src/lib/google/calendarSync');
    expect(await findEventIdByCdbId('cal1', 'b1')).toBeNull();
  });
});

describe('upsertEvent', () => {
  it('fa POST (insert) quando nessun evento esiste per cdb_id', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [] }), { status: 200 })) // lookup
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'evt1' }), { status: 200 })); // insert
    const { upsertEvent } = await import('../../../src/lib/google/calendarSync');
    await upsertEvent('cal1', {
      summary: 'x', start: { date: '2026-08-10' }, end: { date: '2026-08-14' },
      extendedProperties: { private: { cdb_id: 'b1' } },
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2,
      expect.stringMatching(/\/calendars\/cal1\/events$/),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('fa PATCH (update) quando un evento esiste già per cdb_id', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [{ id: 'evt1' }] }), { status: 200 })) // lookup
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'evt1' }), { status: 200 })); // patch
    const { upsertEvent } = await import('../../../src/lib/google/calendarSync');
    await upsertEvent('cal1', {
      summary: 'x', start: { date: '2026-08-10' }, end: { date: '2026-08-14' },
      extendedProperties: { private: { cdb_id: 'b1' } },
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2,
      expect.stringMatching(/\/calendars\/cal1\/events\/evt1$/),
      expect.objectContaining({ method: 'PATCH' }),
    );
  });

  it('lancia CalendarScopeError se il PATCH/POST risponde 401', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response('unauthorized', { status: 401 }));
    const { upsertEvent, CalendarScopeError } = await import('../../../src/lib/google/calendarSync');
    await expect(upsertEvent('cal1', {
      summary: 'x', start: { date: '2026-08-10' }, end: { date: '2026-08-14' },
      extendedProperties: { private: { cdb_id: 'b1' } },
    })).rejects.toThrow(CalendarScopeError);
  });
});

describe('deleteEventByCdbId', () => {
  it('non fa nulla se nessun evento trovato', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ items: [] }), { status: 200 }));
    const { deleteEventByCdbId } = await import('../../../src/lib/google/calendarSync');
    await deleteEventByCdbId('cal1', 'b1');
    expect(fetchMock).toHaveBeenCalledTimes(1); // solo la lookup, nessuna DELETE
  });

  it('fa DELETE sull\'evento trovato', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [{ id: 'evt1' }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const { deleteEventByCdbId } = await import('../../../src/lib/google/calendarSync');
    await deleteEventByCdbId('cal1', 'b1');
    expect(fetchMock).toHaveBeenNthCalledWith(2,
      expect.stringMatching(/\/calendars\/cal1\/events\/evt1$/),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('tratta 410 (Gone) come successo (già cancellato)', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [{ id: 'evt1' }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response('gone', { status: 410 }));
    const { deleteEventByCdbId } = await import('../../../src/lib/google/calendarSync');
    await expect(deleteEventByCdbId('cal1', 'b1')).resolves.toBeUndefined();
  });
});

const { mockSettings } = vi.hoisted(() => ({
  mockSettings: { googleCalendarId: null as string | null, calendarSyncEnabled: false },
}));
vi.mock('../../../src/store/calendarSettings', () => ({
  useCalendarSettings: { getState: () => mockSettings },
}));

describe('syncBookingToCalendar', () => {
  beforeEach(() => {
    mockSettings.googleCalendarId = 'cal1';
    mockSettings.calendarSyncEnabled = true;
    localStorage.clear();
  });

  it('non fa nulla se il sync è disabilitato', async () => {
    mockSettings.calendarSyncEnabled = false;
    const { syncBookingToCalendar } = await import('../../../src/lib/google/calendarSync');
    await syncBookingToCalendar(booking());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('non fa nulla se nessun calendario è collegato', async () => {
    mockSettings.googleCalendarId = null;
    const { syncBookingToCalendar } = await import('../../../src/lib/google/calendarSync');
    await syncBookingToCalendar(booking());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('chiama upsertEvent quando sync abilitato', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'evt1' }), { status: 200 }));
    const { syncBookingToCalendar } = await import('../../../src/lib/google/calendarSync');
    await syncBookingToCalendar(booking());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('accoda l\'operazione se il push fallisce per errore di rete (non scope)', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    const { syncBookingToCalendar } = await import('../../../src/lib/google/calendarSync');
    const { listQueue } = await import('../../../src/lib/google/calendarQueue');
    await syncBookingToCalendar(booking());
    expect(listQueue()).toEqual([{ kind: 'booking', id: 'b1', action: 'upsert' }]);
  });

  it('accoda anche se l\'errore è di scope (ripartirà al prossimo login/reconnect)', async () => {
    fetchMock.mockResolvedValueOnce(new Response('forbidden', { status: 403 }));
    const { syncBookingToCalendar } = await import('../../../src/lib/google/calendarSync');
    const { listQueue } = await import('../../../src/lib/google/calendarQueue');
    await syncBookingToCalendar(booking());
    expect(listQueue()).toEqual([{ kind: 'booking', id: 'b1', action: 'upsert' }]);
  });
});

describe('deleteBookingFromCalendar', () => {
  beforeEach(() => {
    mockSettings.googleCalendarId = 'cal1';
    mockSettings.calendarSyncEnabled = true;
    localStorage.clear();
  });

  it('chiama deleteEventByCdbId ed elimina l\'evento', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [{ id: 'evt1' }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const { deleteBookingFromCalendar } = await import('../../../src/lib/google/calendarSync');
    await deleteBookingFromCalendar('b1');
    expect(fetchMock).toHaveBeenNthCalledWith(2,
      expect.stringMatching(/\/events\/evt1$/),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('accoda un\'azione delete se fallisce', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    const { deleteBookingFromCalendar } = await import('../../../src/lib/google/calendarSync');
    const { listQueue } = await import('../../../src/lib/google/calendarQueue');
    await deleteBookingFromCalendar('b1');
    expect(listQueue()).toEqual([{ kind: 'booking', id: 'b1', action: 'delete' }]);
  });
});

describe('processCalendarQueue', () => {
  beforeEach(() => {
    mockSettings.googleCalendarId = 'cal1';
    mockSettings.calendarSyncEnabled = true;
    localStorage.clear();
  });

  it('rilavora un upsert pendente e lo rimuove dalla coda se riesce', async () => {
    const { enqueue } = await import('../../../src/lib/google/calendarQueue');
    enqueue('booking', 'b1', 'upsert');
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'evt1' }), { status: 200 }));
    const { processCalendarQueue } = await import('../../../src/lib/google/calendarSync');
    const { listQueue } = await import('../../../src/lib/google/calendarQueue');
    await processCalendarQueue(id => id === 'b1' ? booking() : undefined, () => undefined);
    expect(listQueue()).toEqual([]);
  });

  it('lascia l\'operazione in coda se il retry fallisce ancora', async () => {
    const { enqueue } = await import('../../../src/lib/google/calendarQueue');
    enqueue('booking', 'b1', 'upsert');
    fetchMock.mockRejectedValueOnce(new Error('still down'));
    const { processCalendarQueue } = await import('../../../src/lib/google/calendarSync');
    const { listQueue } = await import('../../../src/lib/google/calendarQueue');
    await processCalendarQueue(id => id === 'b1' ? booking() : undefined, () => undefined);
    expect(listQueue()).toEqual([{ kind: 'booking', id: 'b1', action: 'upsert' }]);
  });

  it('interrompe il giro (senza svuotare gli altri) su CalendarScopeError', async () => {
    const { enqueue } = await import('../../../src/lib/google/calendarQueue');
    enqueue('booking', 'b1', 'upsert');
    enqueue('booking', 'b2', 'upsert');
    fetchMock.mockResolvedValueOnce(new Response('forbidden', { status: 403 }));
    const { processCalendarQueue } = await import('../../../src/lib/google/calendarSync');
    const { listQueue } = await import('../../../src/lib/google/calendarQueue');
    await processCalendarQueue(
      id => id === 'b1' ? booking({ id: 'b1' }) : id === 'b2' ? booking({ id: 'b2' }) : undefined,
      () => undefined,
    );
    expect(listQueue()).toHaveLength(2); // nessuna delle due processata: si ferma al primo scope error
  });

  it('lascia l\'upsert in coda se l\'entità non è (ancora) nello store, invece di scartarlo', async () => {
    const { enqueue } = await import('../../../src/lib/google/calendarQueue');
    enqueue('booking', 'b1', 'upsert');
    const { processCalendarQueue } = await import('../../../src/lib/google/calendarSync');
    const { listQueue } = await import('../../../src/lib/google/calendarQueue');
    await processCalendarQueue(() => undefined, () => undefined);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(listQueue()).toEqual([{ kind: 'booking', id: 'b1', action: 'upsert' }]);
  });
});
