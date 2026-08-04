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
