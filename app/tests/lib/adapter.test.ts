import { describe, it, expect } from 'vitest';
import { bookingToRow, rowToBooking, BOOKING_HEADERS } from '../../src/lib/google/adapter';
import type { Prenotazione } from '../../src/types';

const sample: Prenotazione = {
  id: 'b1', camera: 'lampone', checkin: '2026-04-10', checkout: '2026-04-14',
  stato: 'confermato', nome: 'Rossi', riferimento: '#12', numOspiti: 3,
  contattoVia: 'mail', contattoValore: 'rossi@mail.it', prezzoTotale: 320,
  anticipo: { importo: 112, data: '2026-03-20', tipo: 'bonifico' },
  note: 'Arrivo 16', creatoIl: '2026-01-01T00:00:00.000Z', aggiornatoIl: '2026-01-01T00:00:00.000Z',
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
});
