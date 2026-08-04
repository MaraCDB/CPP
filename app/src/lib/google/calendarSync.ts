import type { Prenotazione, Chiusura } from '../../types';
import { iso, parseISO, addDays } from '../date';
import { useAuth } from '../../store/auth';

const BASE = 'https://www.googleapis.com/calendar/v3';

export class CalendarScopeError extends Error {
  constructor(msg = 'Missing Calendar scope or token expired') { super(msg); this.name = 'CalendarScopeError'; }
}

const token = (): string => {
  const t = useAuth.getState().googleAccessToken;
  if (!t) throw new CalendarScopeError('Not authenticated for Calendar');
  return t;
};

export interface CalendarEventBody {
  summary: string;
  description?: string;
  start: { date: string };
  end: { date: string };
  extendedProperties: { private: { cdb_id: string } };
}

export interface GoogleCalendarListEntry {
  id: string;
  summary: string;
}

export const listCalendars = async (): Promise<GoogleCalendarListEntry[]> => {
  const res = await fetch(`${BASE}/users/me/calendarList`, {
    headers: { Authorization: `Bearer ${token()}` },
  });
  if (res.status === 401 || res.status === 403) throw new CalendarScopeError();
  if (!res.ok) throw new Error(`Calendar list ${res.status}: ${await res.text()}`);
  const j = (await res.json()) as { items: { id: string; summary: string }[] };
  return j.items.map(i => ({ id: i.id, summary: i.summary }));
};

export const findEventIdByCdbId = async (calendarId: string, cdbId: string): Promise<string | null> => {
  const url = `${BASE}/calendars/${encodeURIComponent(calendarId)}/events?` +
    `privateExtendedProperty=${encodeURIComponent(`cdb_id=${cdbId}`)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token()}` } });
  if (res.status === 401 || res.status === 403) throw new CalendarScopeError();
  if (!res.ok) throw new Error(`Calendar event lookup ${res.status}: ${await res.text()}`);
  const j = (await res.json()) as { items: { id: string }[] };
  return j.items[0]?.id ?? null;
};

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

export const upsertEvent = async (calendarId: string, body: CalendarEventBody): Promise<void> => {
  const existingId = await findEventIdByCdbId(calendarId, body.extendedProperties.private.cdb_id);
  const url = existingId
    ? `${BASE}/calendars/${encodeURIComponent(calendarId)}/events/${existingId}`
    : `${BASE}/calendars/${encodeURIComponent(calendarId)}/events`;
  const res = await fetch(url, {
    method: existingId ? 'PATCH' : 'POST',
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.status === 401 || res.status === 403) throw new CalendarScopeError();
  if (!res.ok) throw new Error(`Calendar event upsert ${res.status}: ${await res.text()}`);
};

export const deleteEventByCdbId = async (calendarId: string, cdbId: string): Promise<void> => {
  const id = await findEventIdByCdbId(calendarId, cdbId);
  if (!id) return;
  const res = await fetch(`${BASE}/calendars/${encodeURIComponent(calendarId)}/events/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token()}` },
  });
  if (res.status === 401 || res.status === 403) throw new CalendarScopeError();
  if (!res.ok && res.status !== 410) throw new Error(`Calendar event delete ${res.status}: ${await res.text()}`);
};
