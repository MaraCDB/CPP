import type { Prenotazione, Chiusura } from '../../types';
import { iso, parseISO, addDays } from '../date';

export interface CalendarEventBody {
  summary: string;
  description?: string;
  start: { date: string };
  end: { date: string };
  extendedProperties: { private: { cdb_id: string } };
}

const CAMERA_LABEL: Record<Prenotazione['camera'], string> = {
  lampone: 'Lampone',
  mirtillo: 'Mirtillo',
};

const STATO_LABEL: Record<Prenotazione['stato'], string> = {
  proposta: 'Proposta',
  anticipo_atteso: 'Anticipo atteso',
  confermato: 'Confermato',
};

export const buildBookingEvent = (b: Prenotazione): CalendarEventBody => {
  const camera = CAMERA_LABEL[b.camera];
  const summary = b.numOspiti ? `${camera} x${b.numOspiti} ${b.nome}` : `${camera} ${b.nome}`;
  const lines = [`Stato: ${STATO_LABEL[b.stato]}`];
  if (b.contattoValore) {
    lines.push(`Contatto: ${b.contattoValore}${b.contattoVia ? ` (${b.contattoVia})` : ''}`);
  }
  return {
    summary,
    description: lines.join('\n'),
    start: { date: b.checkin },
    end: { date: b.checkout },
    extendedProperties: { private: { cdb_id: b.id } },
  };
};

export const buildClosureEvent = (c: Chiusura): CalendarEventBody => ({
  summary: 'Struttura chiusa',
  description: c.note ?? '',
  start: { date: c.start },
  end: { date: iso(addDays(parseISO(c.end), 1)) },
  extendedProperties: { private: { cdb_id: c.id } },
});
