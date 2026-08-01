# Google Calendar Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Push automatico e unidirezionale (app → Calendar) di prenotazioni e chiusure verso un calendario Google esistente condiviso con il partner, senza ICS e senza inviti custom.

**Architecture:** Nuovo modulo `lib/google/calendarSync.ts` (mapping puro + chiamate REST a Calendar API v3), parallelo a `lib/google/driveBackup.ts`. Una coda di retry in `localStorage` (`lib/google/calendarQueue.ts`) per i push falliti. Impostazioni utente (`googleCalendarId`, `googleCalendarName`, `calendarSyncEnabled`) su un documento Firestore root `users/{uid}`, specchiate in uno store Zustand `store/calendarSettings.ts`. Hook fire-and-forget in `store/bookings.ts`/`store/closures.ts` dopo le scritture Firestore esistenti.

**Tech Stack:** React 19 · TypeScript 6 · Zustand 5 · Firebase 11 (Auth + Firestore) · Vitest 4 · nessuna nuova dipendenza (fetch diretto a Calendar API v3, come già fatto per Drive).

**Spec di riferimento:** `docs/superpowers/specs/2026-08-01-google-calendar-sync-design.md`

**Working directory:** `d:\Workspace\CPP\app` (tutti i percorsi relativi a questa cartella salvo diversa indicazione)

## Global Constraints

- Tutti i test esistenti (`npx vitest run` in `app/`) devono continuare a passare dopo ogni task.
- `npx tsc --noEmit` e `npx eslint .` puliti prima di ogni commit.
- Testo UI in italiano, coerente col resto dell'app.
- Commit Conventional Commits (`feat`, `fix`, `refactor`, `test`, `docs`), un commit per task.
- Date locali: usare sempre l'helper `iso()` da `lib/date.ts` per stringhe `YYYY-MM-DD`, mai `toISOString().slice(0,10)` (produce UTC e disallinea le date — vedi `lib/conflicts.ts:37` per il pattern già in uso).
- Sync sempre no-op se `calendarSyncEnabled` è `false` o `googleCalendarId` è `null` — nessun task deve rimuovere questo guard.

---

## Task 1: Scope OAuth Calendar

**Files:**
- Modify: `app/src/lib/firebase/auth.ts:12-14`

**Interfaces:**
- Produces: nessuna nuova funzione — solo estende lo scope già richiesto al login Google.

- [ ] **Step 1: Aggiungi lo scope**

In `src/lib/firebase/auth.ts`, dopo la riga esistente:

```ts
provider.addScope('https://www.googleapis.com/auth/drive.file');
```

aggiungi:

```ts
provider.addScope('https://www.googleapis.com/auth/calendar.events');
```

- [ ] **Step 2: Verifica che i test di auth esistenti passino ancora**

Run: `npx vitest run tests/lib/firebase/auth.test.ts`
Expected: PASS (nessuna asserzione sugli scope esatti, solo verifica che non rompa nulla)

- [ ] **Step 3: Commit**

```bash
git add src/lib/firebase/auth.ts
git commit -m "feat(calendar-sync): add calendar.events OAuth scope"
```

---

## Task 2: Persistenza impostazioni utente (Firestore + store)

**Files:**
- Modify: `app/src/lib/firebase/db.ts`
- Create: `app/src/store/calendarSettings.ts`
- Modify: `app/src/hooks/useFirestoreSync.ts`
- Test: `app/tests/lib/firebase/db.test.ts` (estendere)
- Test: `app/tests/store/calendarSettings.test.ts`

**Interfaces:**
- Produces: `UserSettings { googleCalendarId?: string | null; googleCalendarName?: string | null; calendarSyncEnabled?: boolean }`, `subscribeUserSettings(uid: string, cb: (s: UserSettings) => void): () => void`, `updateUserSettings(uid: string, patch: Partial<UserSettings>): Promise<void>` — usate da Task 9 (UI).
- Produces: `useCalendarSettings` store con stato `{ googleCalendarId: string | null; googleCalendarName: string | null; calendarSyncEnabled: boolean }` e azioni `setCalendar(id: string, name: string)`, `setEnabled(enabled: boolean)`, `disconnect()` — usato da Task 6 (orchestrazione) e Task 9 (UI).

- [ ] **Step 1: Scrivi i test falliti per `subscribeUserSettings`/`updateUserSettings`**

Aggiungi in fondo a `tests/lib/firebase/db.test.ts` (stesso mock già presente in cima al file, nessuna modifica ai mock esistenti):

```ts
  it('subscribeUserSettings wires onSnapshot on the root user doc', async () => {
    const { subscribeUserSettings } = await import('../../../src/lib/firebase/db');
    const cb = vi.fn();
    let snapHandler: ((s: { data: () => unknown }) => void) | null = null;
    mockOnSnapshot.mockImplementation((_ref, h) => { snapHandler = h; return () => {}; });
    subscribeUserSettings('u1', cb);
    snapHandler?.({ data: () => ({ googleCalendarId: 'cal1', calendarSyncEnabled: true }) });
    expect(cb).toHaveBeenCalledWith({ googleCalendarId: 'cal1', calendarSyncEnabled: true });
  });

  it('subscribeUserSettings passes empty object when doc has no data', async () => {
    const { subscribeUserSettings } = await import('../../../src/lib/firebase/db');
    const cb = vi.fn();
    let snapHandler: ((s: { data: () => unknown }) => void) | null = null;
    mockOnSnapshot.mockImplementation((_ref, h) => { snapHandler = h; return () => {}; });
    subscribeUserSettings('u1', cb);
    snapHandler?.({ data: () => undefined });
    expect(cb).toHaveBeenCalledWith({});
  });

  it('updateUserSettings writes via setDoc with merge', async () => {
    const { updateUserSettings } = await import('../../../src/lib/firebase/db');
    await updateUserSettings('u1', { calendarSyncEnabled: false });
    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.anything(),
      { calendarSyncEnabled: false },
      { merge: true },
    );
  });
```

- [ ] **Step 2: Esegui i test per verificare che falliscano**

Run: `npx vitest run tests/lib/firebase/db.test.ts`
Expected: FAIL con "subscribeUserSettings is not a function" / "updateUserSettings is not a function"

- [ ] **Step 3: Implementa `subscribeUserSettings`/`updateUserSettings` in `db.ts`**

In `src/lib/firebase/db.ts`, aggiungi in fondo al file:

```ts
export interface UserSettings {
  googleCalendarId?: string | null;
  googleCalendarName?: string | null;
  calendarSyncEnabled?: boolean;
}

export const subscribeUserSettings = (
  uid: string,
  cb: (settings: UserSettings) => void,
): (() => void) => {
  const ref = doc(db, 'users', uid);
  return onSnapshot(ref, snap => {
    cb((snap.data() as UserSettings | undefined) ?? {});
  });
};

export const updateUserSettings = (
  uid: string, patch: Partial<UserSettings>,
): Promise<void> => setDoc(doc(db, 'users', uid), patch, { merge: true });
```

- [ ] **Step 4: Esegui i test per verificare che passino**

Run: `npx vitest run tests/lib/firebase/db.test.ts`
Expected: PASS

- [ ] **Step 5: Scrivi il test fallito per lo store `calendarSettings`**

Crea `tests/store/calendarSettings.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../src/lib/firebase/auth', () => ({ auth: { currentUser: { uid: 'u1' } } }));
const mockUpdateUserSettings = vi.fn().mockResolvedValue(undefined);
vi.mock('../../src/lib/firebase/db', () => ({
  updateUserSettings: mockUpdateUserSettings,
}));

import { useCalendarSettings } from '../../src/store/calendarSettings';

describe('calendarSettings store', () => {
  beforeEach(() => {
    useCalendarSettings.setState({ googleCalendarId: null, googleCalendarName: null, calendarSyncEnabled: false });
    mockUpdateUserSettings.mockClear();
  });

  it('inizia disconnesso', () => {
    const s = useCalendarSettings.getState();
    expect(s.googleCalendarId).toBeNull();
    expect(s.calendarSyncEnabled).toBe(false);
  });

  it('setCalendar salva id/nome e abilita il sync', () => {
    useCalendarSettings.getState().setCalendar('cal-123', 'Casa');
    const s = useCalendarSettings.getState();
    expect(s.googleCalendarId).toBe('cal-123');
    expect(s.googleCalendarName).toBe('Casa');
    expect(s.calendarSyncEnabled).toBe(true);
    expect(mockUpdateUserSettings).toHaveBeenCalledWith('u1', {
      googleCalendarId: 'cal-123', googleCalendarName: 'Casa', calendarSyncEnabled: true,
    });
  });

  it('setEnabled aggiorna solo il flag', () => {
    useCalendarSettings.getState().setCalendar('cal-123', 'Casa');
    useCalendarSettings.getState().setEnabled(false);
    expect(useCalendarSettings.getState().calendarSyncEnabled).toBe(false);
    expect(mockUpdateUserSettings).toHaveBeenCalledWith('u1', { calendarSyncEnabled: false });
  });

  it('disconnect azzera tutto', () => {
    useCalendarSettings.getState().setCalendar('cal-123', 'Casa');
    useCalendarSettings.getState().disconnect();
    const s = useCalendarSettings.getState();
    expect(s.googleCalendarId).toBeNull();
    expect(s.calendarSyncEnabled).toBe(false);
    expect(mockUpdateUserSettings).toHaveBeenCalledWith('u1', {
      googleCalendarId: null, googleCalendarName: null, calendarSyncEnabled: false,
    });
  });
});
```

- [ ] **Step 6: Esegui il test per verificare che fallisca**

Run: `npx vitest run tests/store/calendarSettings.test.ts`
Expected: FAIL con "Cannot find module '../../src/store/calendarSettings'"

- [ ] **Step 7: Crea `src/store/calendarSettings.ts`**

```ts
import { create } from 'zustand';
import { updateUserSettings } from '../lib/firebase/db';
import { auth } from '../lib/firebase/auth';

const getUid = (): string | null => auth.currentUser?.uid ?? null;

interface State {
  googleCalendarId: string | null;
  googleCalendarName: string | null;
  calendarSyncEnabled: boolean;
  setCalendar: (id: string, name: string) => void;
  setEnabled: (enabled: boolean) => void;
  disconnect: () => void;
}

export const useCalendarSettings = create<State>((set) => ({
  googleCalendarId: null,
  googleCalendarName: null,
  calendarSyncEnabled: false,
  setCalendar: (id, name) => {
    set({ googleCalendarId: id, googleCalendarName: name, calendarSyncEnabled: true });
    const u = getUid();
    if (u) void updateUserSettings(u, { googleCalendarId: id, googleCalendarName: name, calendarSyncEnabled: true });
  },
  setEnabled: (enabled) => {
    set({ calendarSyncEnabled: enabled });
    const u = getUid();
    if (u) void updateUserSettings(u, { calendarSyncEnabled: enabled });
  },
  disconnect: () => {
    set({ googleCalendarId: null, googleCalendarName: null, calendarSyncEnabled: false });
    const u = getUid();
    if (u) void updateUserSettings(u, { googleCalendarId: null, googleCalendarName: null, calendarSyncEnabled: false });
  },
}));
```

- [ ] **Step 8: Esegui il test per verificare che passi**

Run: `npx vitest run tests/store/calendarSettings.test.ts`
Expected: PASS

- [ ] **Step 9: Aggancia `subscribeUserSettings` in `useFirestoreSync.ts`**

In `src/hooks/useFirestoreSync.ts`, aggiungi l'import:

```ts
import { subscribeUserSettings } from '../lib/firebase/db';
import { useCalendarSettings } from '../store/calendarSettings';
```

e aggiungi una entry nell'array `unsubs` (dentro `useEffect`, insieme alle altre `subscribeCollection`):

```ts
      subscribeUserSettings(uid, settings => {
        useCalendarSettings.setState({
          googleCalendarId: settings.googleCalendarId ?? null,
          googleCalendarName: settings.googleCalendarName ?? null,
          calendarSyncEnabled: settings.calendarSyncEnabled ?? false,
        });
      }),
```

- [ ] **Step 10: Verifica type-check e test suite completa**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS, nessun errore di tipo

- [ ] **Step 11: Commit**

```bash
git add src/lib/firebase/db.ts src/store/calendarSettings.ts src/hooks/useFirestoreSync.ts tests/lib/firebase/db.test.ts tests/store/calendarSettings.test.ts
git commit -m "feat(calendar-sync): add user settings persistence (googleCalendarId, calendarSyncEnabled)"
```

---

## Task 3: Mapping puro prenotazione/chiusura → evento Calendar

**Files:**
- Create: `app/src/lib/google/calendarSync.ts`
- Test: `app/tests/lib/google/calendarSync.test.ts`

**Interfaces:**
- Consumes: `Prenotazione`, `Chiusura` da `src/types.ts`; `iso`, `parseISO`, `addDays` da `src/lib/date.ts`.
- Produces: `CalendarEventBody { summary: string; description?: string; start: { date: string }; end: { date: string }; extendedProperties: { private: { cdb_id: string } } }`, `buildBookingEvent(b: Prenotazione): CalendarEventBody`, `buildClosureEvent(c: Chiusura): CalendarEventBody` — usate da Task 6.

- [ ] **Step 1: Scrivi i test falliti per il mapping**

Crea `tests/lib/google/calendarSync.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildBookingEvent, buildClosureEvent } from '../../../src/lib/google/calendarSync';
import type { Prenotazione, Chiusura } from '../../../src/types';

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
```

- [ ] **Step 2: Esegui i test per verificare che falliscano**

Run: `npx vitest run tests/lib/google/calendarSync.test.ts`
Expected: FAIL con "Cannot find module '../../../src/lib/google/calendarSync'"

- [ ] **Step 3: Crea `src/lib/google/calendarSync.ts` con il mapping**

```ts
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
```

- [ ] **Step 4: Esegui i test per verificare che passino**

Run: `npx vitest run tests/lib/google/calendarSync.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/google/calendarSync.ts tests/lib/google/calendarSync.test.ts
git commit -m "feat(calendar-sync): add pure booking/closure to Calendar event mapping"
```

---

## Task 4: Client Calendar API (listCalendars, lookup evento)

**Files:**
- Modify: `app/src/lib/google/calendarSync.ts`
- Test: `app/tests/lib/google/calendarSync.test.ts` (estendere)

**Interfaces:**
- Consumes: `useAuth.getState().googleAccessToken` da `store/auth.ts`.
- Produces: `CalendarScopeError`, `GoogleCalendarListEntry { id: string; summary: string }`, `listCalendars(): Promise<GoogleCalendarListEntry[]>`, `findEventIdByCdbId(calendarId: string, cdbId: string): Promise<string | null>` — usate da Task 5 (CRUD) e Task 9 (UI).

- [ ] **Step 1: Scrivi i test falliti**

Il file esiste già dal Task 3 con `import { describe, it, expect } from 'vitest';` in cima. Sostituisci quella riga con:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

vi.mock('../../../src/store/auth', () => ({
  useAuth: { getState: () => ({ googleAccessToken: 'tok' }) },
}));
```

(`vi.mock` viene sollevato automaticamente in cima al modulo da Vitest, quindi la posizione esatta nel file non conta — questo blocco può stare subito sotto l'import.)

Poi aggiungi in fondo al file:

```ts
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
```

- [ ] **Step 2: Esegui i test per verificare che falliscano**

Run: `npx vitest run tests/lib/google/calendarSync.test.ts`
Expected: FAIL con "listCalendars is not a function" / "findEventIdByCdbId is not a function"

- [ ] **Step 3: Implementa in `calendarSync.ts`**

Aggiungi in cima al file (dopo gli import esistenti):

```ts
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
```

- [ ] **Step 4: Esegui i test per verificare che passino**

Run: `npx vitest run tests/lib/google/calendarSync.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/google/calendarSync.ts tests/lib/google/calendarSync.test.ts
git commit -m "feat(calendar-sync): add listCalendars and event lookup by cdb_id"
```

---

## Task 5: CRUD evento Calendar (upsert/delete)

**Files:**
- Modify: `app/src/lib/google/calendarSync.ts`
- Test: `app/tests/lib/google/calendarSync.test.ts` (estendere)

**Interfaces:**
- Consumes: `token()`, `CalendarScopeError`, `findEventIdByCdbId` (Task 4), `CalendarEventBody` (Task 3) — tutti interni allo stesso modulo.
- Produces: `upsertEvent(calendarId: string, body: CalendarEventBody): Promise<void>`, `deleteEventByCdbId(calendarId: string, cdbId: string): Promise<void>` — usate da Task 6 (orchestrazione).

- [ ] **Step 1: Scrivi i test falliti**

Aggiungi al `describe` block dei test Calendar API in `tests/lib/google/calendarSync.test.ts`:

```ts
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
```

- [ ] **Step 2: Esegui i test per verificare che falliscano**

Run: `npx vitest run tests/lib/google/calendarSync.test.ts`
Expected: FAIL con "upsertEvent is not a function" / "deleteEventByCdbId is not a function"

- [ ] **Step 3: Implementa `upsertEvent`/`deleteEventByCdbId`**

Aggiungi in fondo a `calendarSync.ts`:

```ts
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
```

- [ ] **Step 4: Esegui i test per verificare che passino**

Run: `npx vitest run tests/lib/google/calendarSync.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/google/calendarSync.ts tests/lib/google/calendarSync.test.ts
git commit -m "feat(calendar-sync): add upsertEvent/deleteEventByCdbId CRUD"
```

---

## Task 6: Coda di retry in localStorage

**Files:**
- Create: `app/src/lib/google/calendarQueue.ts`
- Test: `app/tests/lib/google/calendarQueue.test.ts`

**Interfaces:**
- Produces: `CalendarQueueOp { kind: 'booking' | 'closure'; id: string; action: 'upsert' | 'delete' }`, `enqueue(kind: 'booking' | 'closure', id: string, action: 'upsert' | 'delete'): void`, `listQueue(): CalendarQueueOp[]`, `removeFromQueue(kind: 'booking' | 'closure', id: string): void`, `clearQueue(): void` — usate da Task 7.

- [ ] **Step 1: Scrivi i test falliti**

Crea `tests/lib/google/calendarQueue.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { enqueue, listQueue, removeFromQueue, clearQueue } from '../../../src/lib/google/calendarQueue';

describe('calendarQueue', () => {
  beforeEach(() => {
    localStorage.clear();
    clearQueue();
  });

  it('inizia vuota', () => {
    expect(listQueue()).toEqual([]);
  });

  it('enqueue aggiunge un\'operazione pendente', () => {
    enqueue('booking', 'b1', 'upsert');
    expect(listQueue()).toEqual([{ kind: 'booking', id: 'b1', action: 'upsert' }]);
  });

  it('enqueue sullo stesso kind+id sovrascrive l\'azione precedente (l\'ultima vince)', () => {
    enqueue('booking', 'b1', 'upsert');
    enqueue('booking', 'b1', 'delete');
    expect(listQueue()).toEqual([{ kind: 'booking', id: 'b1', action: 'delete' }]);
  });

  it('kind diversi con lo stesso id restano separati', () => {
    enqueue('booking', 'x1', 'upsert');
    enqueue('closure', 'x1', 'upsert');
    expect(listQueue()).toHaveLength(2);
  });

  it('removeFromQueue rimuove una singola entry', () => {
    enqueue('booking', 'b1', 'upsert');
    enqueue('closure', 'c1', 'upsert');
    removeFromQueue('booking', 'b1');
    expect(listQueue()).toEqual([{ kind: 'closure', id: 'c1', action: 'upsert' }]);
  });

  it('la coda persiste tra istanze diverse (localStorage)', () => {
    enqueue('booking', 'b1', 'upsert');
    expect(listQueue()).toHaveLength(1);
    // rileggendo da zero (nessun modulo in-memory, solo localStorage)
    expect(listQueue()).toEqual([{ kind: 'booking', id: 'b1', action: 'upsert' }]);
  });
});
```

- [ ] **Step 2: Esegui i test per verificare che falliscano**

Run: `npx vitest run tests/lib/google/calendarQueue.test.ts`
Expected: FAIL con "Cannot find module '../../../src/lib/google/calendarQueue'"

- [ ] **Step 3: Crea `src/lib/google/calendarQueue.ts`**

```ts
const KEY = 'cdb_calendar_queue';

export interface CalendarQueueOp {
  kind: 'booking' | 'closure';
  id: string;
  action: 'upsert' | 'delete';
}

type QueueMap = Record<string, CalendarQueueOp>;

const read = (): QueueMap => {
  const raw = localStorage.getItem(KEY);
  if (!raw) return {};
  try { return JSON.parse(raw) as QueueMap; } catch { return {}; }
};

const write = (map: QueueMap): void => {
  localStorage.setItem(KEY, JSON.stringify(map));
};

const keyOf = (kind: CalendarQueueOp['kind'], id: string): string => `${kind}:${id}`;

export const enqueue = (kind: CalendarQueueOp['kind'], id: string, action: CalendarQueueOp['action']): void => {
  const map = read();
  map[keyOf(kind, id)] = { kind, id, action };
  write(map);
};

export const listQueue = (): CalendarQueueOp[] => Object.values(read());

export const removeFromQueue = (kind: CalendarQueueOp['kind'], id: string): void => {
  const map = read();
  delete map[keyOf(kind, id)];
  write(map);
};

export const clearQueue = (): void => localStorage.removeItem(KEY);
```

- [ ] **Step 4: Esegui i test per verificare che passino**

Run: `npx vitest run tests/lib/google/calendarQueue.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/google/calendarQueue.ts tests/lib/google/calendarQueue.test.ts
git commit -m "feat(calendar-sync): add localStorage retry queue for failed pushes"
```

---

## Task 7: Orchestrazione (sync + queue + retry)

**Files:**
- Modify: `app/src/lib/google/calendarSync.ts`
- Test: `app/tests/lib/google/calendarSync.test.ts` (estendere)

**Interfaces:**
- Consumes: `useCalendarSettings` da `store/calendarSettings.ts` (Task 2); `enqueue`, `listQueue`, `removeFromQueue` da `lib/google/calendarQueue.ts` (Task 6); `buildBookingEvent`, `buildClosureEvent`, `upsertEvent`, `deleteEventByCdbId`, `CalendarScopeError` (Task 3-5, stesso modulo).
- Produces: `syncBookingToCalendar(booking: Prenotazione): Promise<void>`, `syncClosureToCalendar(closure: Chiusura): Promise<void>`, `deleteBookingFromCalendar(id: string): Promise<void>`, `deleteClosureFromCalendar(id: string): Promise<void>`, `processCalendarQueue(getBooking: (id: string) => Prenotazione | undefined, getClosure: (id: string) => Chiusura | undefined): Promise<void>` — usate da Task 8 (hook store) e Task 9 (retry al login).

**Nota di design:** `processCalendarQueue` riceve i lookup booking/chiusura come parametri (non importa `store/bookings.ts`/`store/closures.ts` direttamente) per evitare un import circolare: quegli store, dopo il Task 8, importeranno `calendarSync.ts` per chiamare `syncBookingToCalendar` ecc.

- [ ] **Step 1: Scrivi i test falliti**

Aggiungi in fondo a `tests/lib/google/calendarSync.test.ts`:

```ts
const mockSettings = { googleCalendarId: null as string | null, calendarSyncEnabled: false };
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

  it('non accoda se l\'errore è di scope (serve nuovo login, non un retry automatico)', async () => {
    fetchMock.mockResolvedValueOnce(new Response('forbidden', { status: 403 }));
    const { syncBookingToCalendar } = await import('../../../src/lib/google/calendarSync');
    const { listQueue } = await import('../../../src/lib/google/calendarQueue');
    await syncBookingToCalendar(booking());
    expect(listQueue()).toEqual([]);
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
});
```

- [ ] **Step 2: Esegui i test per verificare che falliscano**

Run: `npx vitest run tests/lib/google/calendarSync.test.ts`
Expected: FAIL con "syncBookingToCalendar is not a function" ecc.

- [ ] **Step 3: Implementa l'orchestrazione**

Aggiungi in cima a `calendarSync.ts` (dopo gli import esistenti):

```ts
import { useCalendarSettings } from '../../store/calendarSettings';
import { enqueue, listQueue, removeFromQueue } from './calendarQueue';
```

e in fondo al file:

```ts
export const syncBookingToCalendar = async (booking: Prenotazione): Promise<void> => {
  const { calendarSyncEnabled, googleCalendarId } = useCalendarSettings.getState();
  if (!calendarSyncEnabled || !googleCalendarId) return;
  try {
    await upsertEvent(googleCalendarId, buildBookingEvent(booking));
  } catch (e) {
    if (!(e instanceof CalendarScopeError)) enqueue('booking', booking.id, 'upsert');
  }
};

export const syncClosureToCalendar = async (closure: Chiusura): Promise<void> => {
  const { calendarSyncEnabled, googleCalendarId } = useCalendarSettings.getState();
  if (!calendarSyncEnabled || !googleCalendarId) return;
  try {
    await upsertEvent(googleCalendarId, buildClosureEvent(closure));
  } catch (e) {
    if (!(e instanceof CalendarScopeError)) enqueue('closure', closure.id, 'upsert');
  }
};

export const deleteBookingFromCalendar = async (id: string): Promise<void> => {
  const { calendarSyncEnabled, googleCalendarId } = useCalendarSettings.getState();
  if (!calendarSyncEnabled || !googleCalendarId) return;
  try {
    await deleteEventByCdbId(googleCalendarId, id);
  } catch (e) {
    if (!(e instanceof CalendarScopeError)) enqueue('booking', id, 'delete');
  }
};

export const deleteClosureFromCalendar = async (id: string): Promise<void> => {
  const { calendarSyncEnabled, googleCalendarId } = useCalendarSettings.getState();
  if (!calendarSyncEnabled || !googleCalendarId) return;
  try {
    await deleteEventByCdbId(googleCalendarId, id);
  } catch (e) {
    if (!(e instanceof CalendarScopeError)) enqueue('closure', id, 'delete');
  }
};

export const processCalendarQueue = async (
  getBooking: (id: string) => Prenotazione | undefined,
  getClosure: (id: string) => Chiusura | undefined,
): Promise<void> => {
  const { calendarSyncEnabled, googleCalendarId } = useCalendarSettings.getState();
  if (!calendarSyncEnabled || !googleCalendarId) return;
  for (const op of listQueue()) {
    try {
      if (op.action === 'delete') {
        await deleteEventByCdbId(googleCalendarId, op.id);
      } else if (op.kind === 'booking') {
        const b = getBooking(op.id);
        if (b) await upsertEvent(googleCalendarId, buildBookingEvent(b));
      } else {
        const c = getClosure(op.id);
        if (c) await upsertEvent(googleCalendarId, buildClosureEvent(c));
      }
      removeFromQueue(op.kind, op.id);
    } catch (e) {
      if (e instanceof CalendarScopeError) return;
      // altri errori: lascia in coda, prova il prossimo
    }
  }
};
```

- [ ] **Step 4: Esegui i test per verificare che passino**

Run: `npx vitest run tests/lib/google/calendarSync.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/google/calendarSync.ts tests/lib/google/calendarSync.test.ts
git commit -m "feat(calendar-sync): add sync orchestration with retry queue integration"
```

---

## Task 8: Hook negli store bookings/closures

**Files:**
- Modify: `app/src/store/bookings.ts`
- Modify: `app/src/store/closures.ts`
- Test: `app/tests/store/bookings.test.ts` (estendere)
- Test: `app/tests/store/closures.test.ts` (estendere, se non esiste crearlo seguendo lo stesso pattern di `bookings.test.ts`)

**Interfaces:**
- Consumes: `syncBookingToCalendar`, `deleteBookingFromCalendar` (per `bookings.ts`); `syncClosureToCalendar`, `deleteClosureFromCalendar` (per `closures.ts`) — tutte da `lib/google/calendarSync.ts` (Task 7).

- [ ] **Step 1: Scrivi i test falliti per `bookings.ts`**

Aggiungi in `tests/store/bookings.test.ts`, in cima al file (accanto ai `vi.mock` già presenti):

```ts
const mockSyncBooking = vi.fn().mockResolvedValue(undefined);
const mockDeleteBooking = vi.fn().mockResolvedValue(undefined);
vi.mock('../../src/lib/google/calendarSync', () => ({
  syncBookingToCalendar: mockSyncBooking,
  deleteBookingFromCalendar: mockDeleteBooking,
}));
```

e in fondo al file un nuovo `describe`:

```ts
describe('bookings store — calendar sync hook', () => {
  beforeEach(() => {
    useBookings.setState({ items: [] });
    mockSyncBooking.mockClear();
    mockDeleteBooking.mockClear();
  });

  it('add chiama syncBookingToCalendar con il booking creato', () => {
    const b = useBookings.getState().add({
      camera: 'lampone', checkin: '2026-08-10', checkout: '2026-08-14',
      stato: 'confermato', nome: 'Rossi',
    });
    expect(mockSyncBooking).toHaveBeenCalledWith(expect.objectContaining({ id: b.id }));
  });

  it('update chiama syncBookingToCalendar con il booking aggiornato', () => {
    const b = useBookings.getState().add({
      camera: 'lampone', checkin: '2026-08-10', checkout: '2026-08-14',
      stato: 'proposta', nome: 'Rossi',
    });
    mockSyncBooking.mockClear();
    useBookings.getState().update(b.id, { stato: 'confermato' });
    expect(mockSyncBooking).toHaveBeenCalledWith(expect.objectContaining({ id: b.id, stato: 'confermato' }));
  });

  it('remove chiama deleteBookingFromCalendar con l\'id rimosso', () => {
    const b = useBookings.getState().add({
      camera: 'lampone', checkin: '2026-08-10', checkout: '2026-08-14',
      stato: 'confermato', nome: 'Rossi',
    });
    useBookings.getState().remove(b.id);
    expect(mockDeleteBooking).toHaveBeenCalledWith(b.id);
  });
});
```

- [ ] **Step 2: Esegui i test per verificare che falliscano**

Run: `npx vitest run tests/store/bookings.test.ts`
Expected: FAIL (mock chiamato 0 volte)

- [ ] **Step 3: Aggancia le chiamate in `store/bookings.ts`**

Apri `src/store/bookings.ts` e aggiungi l'import:

```ts
import { syncBookingToCalendar, deleteBookingFromCalendar } from '../lib/google/calendarSync';
```

Nel metodo `add`, dopo `if (u) void upsertDoc(u, 'bookings', item.id, item);` e prima di `return item;`, aggiungi:

```ts
    void syncBookingToCalendar(item);
```

Nel metodo `update`, dentro il blocco `if (updated) { ... }`, dopo la chiamata a `upsertDoc`, aggiungi:

```ts
      void syncBookingToCalendar(updated);
```

Nel metodo `remove`, dopo `if (u) void removeDoc(u, 'bookings', id);`, aggiungi:

```ts
    void deleteBookingFromCalendar(id);
```

- [ ] **Step 4: Esegui i test per verificare che passino**

Run: `npx vitest run tests/store/bookings.test.ts`
Expected: PASS

- [ ] **Step 5: Ripeti lo stesso pattern per `closures.ts`**

Verifica se `tests/store/closures.test.ts` esiste già:

Run: `ls tests/store/closures.test.ts 2>/dev/null || echo "non esiste"`

Se non esiste, crealo seguendo lo stesso schema di `tests/store/bookings.test.ts` (mock `../../src/lib/firebase/auth`, `../../src/lib/firebase/db`, più il nuovo mock `../../src/lib/google/calendarSync`):

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../src/lib/firebase/auth', () => ({ auth: { currentUser: null } }));
vi.mock('../../src/lib/firebase/db', () => ({
  upsertDoc: vi.fn().mockResolvedValue(undefined),
  removeDoc: vi.fn().mockResolvedValue(undefined),
}));
const mockSyncClosure = vi.fn().mockResolvedValue(undefined);
const mockDeleteClosure = vi.fn().mockResolvedValue(undefined);
vi.mock('../../src/lib/google/calendarSync', () => ({
  syncClosureToCalendar: mockSyncClosure,
  deleteClosureFromCalendar: mockDeleteClosure,
}));

import { useClosures } from '../../src/store/closures';

describe('closures store — calendar sync hook', () => {
  beforeEach(() => {
    useClosures.setState({ items: [] });
    mockSyncClosure.mockClear();
    mockDeleteClosure.mockClear();
  });

  it('add chiama syncClosureToCalendar con la chiusura creata', () => {
    const c = useClosures.getState().add({ start: '2026-09-01', end: '2026-09-03' });
    expect(mockSyncClosure).toHaveBeenCalledWith(expect.objectContaining({ id: c.id }));
  });

  it('update chiama syncClosureToCalendar con la chiusura aggiornata', () => {
    const c = useClosures.getState().add({ start: '2026-09-01', end: '2026-09-03' });
    mockSyncClosure.mockClear();
    useClosures.getState().update(c.id, { note: 'manutenzione' });
    expect(mockSyncClosure).toHaveBeenCalledWith(expect.objectContaining({ id: c.id, note: 'manutenzione' }));
  });

  it('remove chiama deleteClosureFromCalendar con l\'id rimosso', () => {
    const c = useClosures.getState().add({ start: '2026-09-01', end: '2026-09-03' });
    useClosures.getState().remove(c.id);
    expect(mockDeleteClosure).toHaveBeenCalledWith(c.id);
  });
});
```

- [ ] **Step 6: Esegui i test per verificare che falliscano, poi aggancia in `store/closures.ts`**

Run: `npx vitest run tests/store/closures.test.ts` → Expected: FAIL

In `src/store/closures.ts`, aggiungi l'import:

```ts
import { syncClosureToCalendar, deleteClosureFromCalendar } from '../lib/google/calendarSync';
```

Stesso pattern di `bookings.ts`: `void syncClosureToCalendar(item)` in fondo ad `add` (prima del `return item`), `void syncClosureToCalendar(updated)` dentro l'`if (updated)` di `update`, `void deleteClosureFromCalendar(id)` in fondo a `remove`.

- [ ] **Step 7: Esegui entrambi i test per verificare che passino**

Run: `npx vitest run tests/store/bookings.test.ts tests/store/closures.test.ts`
Expected: PASS

- [ ] **Step 8: Type-check e suite completa**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/store/bookings.ts src/store/closures.ts tests/store/bookings.test.ts tests/store/closures.test.ts
git commit -m "feat(calendar-sync): hook booking/closure add-update-remove into Calendar sync"
```

---

## Task 9: Retry al login/online

**Files:**
- Create: `app/src/hooks/useCalendarSyncQueue.ts`
- Modify: `app/src/App.tsx`
- Test: `app/tests/hooks/useCalendarSyncQueue.test.ts`

**Interfaces:**
- Consumes: `processCalendarQueue` da `lib/google/calendarSync.ts` (Task 7); `useBookings`, `useClosures` (già esistenti).
- Produces: `useCalendarSyncQueue(uid: string | null): void` — chiamato da `App.tsx` accanto a `useFirestoreSync(uid)`.

- [ ] **Step 1: Scrivi il test fallito**

Crea `tests/hooks/useCalendarSyncQueue.test.ts`, stesso stile di `tests/hooks/useFirestoreSync.test.ts` (import dinamico dentro ogni test, niente JSX):

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const mockProcessQueue = vi.fn().mockResolvedValue(undefined);
vi.mock('../../src/lib/google/calendarSync', () => ({
  processCalendarQueue: mockProcessQueue,
}));
vi.mock('../../src/store/bookings', () => ({ useBookings: { getState: () => ({ items: [] }) } }));
vi.mock('../../src/store/closures', () => ({ useClosures: { getState: () => ({ items: [] }) } }));

beforeEach(() => mockProcessQueue.mockClear());

describe('useCalendarSyncQueue', () => {
  it('processa la coda al mount se uid è presente', async () => {
    const { useCalendarSyncQueue } = await import('../../src/hooks/useCalendarSyncQueue');
    renderHook(() => useCalendarSyncQueue('u1'));
    expect(mockProcessQueue).toHaveBeenCalledTimes(1);
  });

  it('non fa nulla al mount se uid è null', async () => {
    const { useCalendarSyncQueue } = await import('../../src/hooks/useCalendarSyncQueue');
    renderHook(() => useCalendarSyncQueue(null));
    expect(mockProcessQueue).not.toHaveBeenCalled();
  });

  it('processa di nuovo la coda quando il browser torna online', async () => {
    const { useCalendarSyncQueue } = await import('../../src/hooks/useCalendarSyncQueue');
    renderHook(() => useCalendarSyncQueue('u1'));
    mockProcessQueue.mockClear();
    window.dispatchEvent(new Event('online'));
    expect(mockProcessQueue).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Esegui il test per verificare che fallisca**

Run: `npx vitest run tests/hooks/useCalendarSyncQueue.test.ts`
Expected: FAIL con "Cannot find module '../../src/hooks/useCalendarSyncQueue'"

- [ ] **Step 3: Crea `src/hooks/useCalendarSyncQueue.ts`**

```ts
import { useEffect } from 'react';
import { processCalendarQueue } from '../lib/google/calendarSync';
import { useBookings } from '../store/bookings';
import { useClosures } from '../store/closures';

const runQueue = (): void => {
  void processCalendarQueue(
    id => useBookings.getState().items.find(b => b.id === id),
    id => useClosures.getState().items.find(c => c.id === id),
  );
};

export const useCalendarSyncQueue = (uid: string | null): void => {
  useEffect(() => {
    if (!uid) return;
    runQueue();
    window.addEventListener('online', runQueue);
    return () => window.removeEventListener('online', runQueue);
  }, [uid]);
};
```

- [ ] **Step 4: Esegui il test per verificare che passi**

Run: `npx vitest run tests/hooks/useCalendarSyncQueue.test.ts`
Expected: PASS

- [ ] **Step 5: Aggancia l'hook in `App.tsx`**

In `src/App.tsx`, aggiungi l'import:

```ts
import { useCalendarSyncQueue } from './hooks/useCalendarSyncQueue';
```

e subito dopo la riga `useFirestoreSync(uid);`:

```ts
  useCalendarSyncQueue(uid);
```

- [ ] **Step 6: Type-check e suite completa**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useCalendarSyncQueue.ts src/App.tsx tests/hooks/useCalendarSyncQueue.test.ts
git commit -m "feat(calendar-sync): retry pending Calendar pushes on login and reconnect"
```

---

## Task 10: UI Impostazioni — sezione "Sync Google Calendar"

**Files:**
- Create: `app/src/components/settings/CalendarSyncSection.tsx`
- Modify: `app/src/components/settings/TemplatesPage.tsx`
- Test: `app/tests/components/CalendarSyncSection.test.tsx`

**Interfaces:**
- Consumes: `listCalendars`, `GoogleCalendarListEntry`, `CalendarScopeError` da `lib/google/calendarSync.ts` (Task 4); `useCalendarSettings` da `store/calendarSettings.ts` (Task 2).

Segue lo stesso pattern di `src/components/settings/AccountSection.tsx`: componente in un file dedicato, testato direttamente (a differenza di `BackupSection`, che resta inline in `TemplatesPage.tsx` e non ha test propri — non toccare quella convenzione esistente).

- [ ] **Step 1: Scrivi il test fallito**

Crea `tests/components/CalendarSyncSection.test.tsx` (stesso path flat di `tests/components/AccountSection.test.tsx`):

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockListCalendars = vi.fn();
vi.mock('../../src/lib/google/calendarSync', () => ({
  listCalendars: mockListCalendars,
  CalendarScopeError: class CalendarScopeError extends Error {},
}));

import { useCalendarSettings } from '../../src/store/calendarSettings';
import { CalendarSyncSection } from '../../src/components/settings/CalendarSyncSection';

describe('CalendarSyncSection', () => {
  beforeEach(() => {
    useCalendarSettings.setState({ googleCalendarId: null, googleCalendarName: null, calendarSyncEnabled: false });
    mockListCalendars.mockReset();
  });

  it('mostra "Non connesso" quando nessun calendario è collegato', () => {
    render(<CalendarSyncSection />);
    expect(screen.getByText(/Non connesso/i)).toBeInTheDocument();
  });

  it('bottone "Connetti calendario" carica la lista e permette di scegliere', async () => {
    mockListCalendars.mockResolvedValueOnce([{ id: 'cal1', summary: 'Casa' }]);
    render(<CalendarSyncSection />);
    fireEvent.click(screen.getByText(/Connetti calendario/i));
    await waitFor(() => expect(screen.getByText('Casa')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Casa'));
    expect(useCalendarSettings.getState().googleCalendarId).toBe('cal1');
    expect(useCalendarSettings.getState().calendarSyncEnabled).toBe(true);
  });

  it('mostra "Connesso a «Casa»" e il toggle quando collegato', () => {
    useCalendarSettings.setState({ googleCalendarId: 'cal1', googleCalendarName: 'Casa', calendarSyncEnabled: true });
    render(<CalendarSyncSection />);
    expect(screen.getByText(/Casa/)).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('il toggle disabilita il sync senza scollegare', () => {
    useCalendarSettings.setState({ googleCalendarId: 'cal1', googleCalendarName: 'Casa', calendarSyncEnabled: true });
    render(<CalendarSyncSection />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(useCalendarSettings.getState().calendarSyncEnabled).toBe(false);
    expect(useCalendarSettings.getState().googleCalendarId).toBe('cal1');
  });

  it('"Disconnetti" azzera il calendario collegato', () => {
    useCalendarSettings.setState({ googleCalendarId: 'cal1', googleCalendarName: 'Casa', calendarSyncEnabled: true });
    render(<CalendarSyncSection />);
    fireEvent.click(screen.getByText(/Disconnetti/i));
    expect(useCalendarSettings.getState().googleCalendarId).toBeNull();
  });
});
```

- [ ] **Step 2: Esegui il test per verificare che fallisca**

Run: `npx vitest run tests/components/CalendarSyncSection.test.tsx`
Expected: FAIL con "Cannot find module '../../src/components/settings/CalendarSyncSection'"

- [ ] **Step 3: Crea `src/components/settings/CalendarSyncSection.tsx`**

```tsx
import { useState } from 'react';
import { listCalendars, CalendarScopeError, type GoogleCalendarListEntry } from '../../lib/google/calendarSync';
import { useCalendarSettings } from '../../store/calendarSettings';

export const CalendarSyncSection = () => {
  const calendarId = useCalendarSettings(s => s.googleCalendarId);
  const calendarName = useCalendarSettings(s => s.googleCalendarName);
  const enabled = useCalendarSettings(s => s.calendarSyncEnabled);
  const setCalendar = useCalendarSettings(s => s.setCalendar);
  const setEnabled = useCalendarSettings(s => s.setEnabled);
  const disconnect = useCalendarSettings(s => s.disconnect);

  const [choosing, setChoosing] = useState(false);
  const [options, setOptions] = useState<GoogleCalendarListEntry[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const onConnect = async () => {
    setErr(null);
    try {
      setOptions(await listCalendars());
      setChoosing(true);
    } catch (e) {
      setErr(e instanceof CalendarScopeError
        ? 'Riconnetti l’account Google per accedere a Calendar (sessione scaduta).'
        : 'Impossibile leggere i calendari.');
    }
  };

  return (
    <section className="mt-6">
      <h3 className="font-semibold mb-2">Sync Google Calendar</h3>
      {calendarId ? (
        <>
          <div className="text-sm mb-2">Connesso a «{calendarName}»</div>
          <label className="flex items-center gap-2 text-sm mb-2">
            <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />
            Sync attivo
          </label>
          <button className="btn btn-ghost" onClick={disconnect}>Disconnetti</button>
        </>
      ) : (
        <>
          <div className="text-sm mb-2" style={{ color: 'var(--ink-soft)' }}>Non connesso</div>
          <button className="btn btn-primary mb-2" onClick={() => void onConnect()}>Connetti calendario</button>
        </>
      )}
      {err && <div className="text-xs mb-2" style={{ color: 'crimson' }}>{err}</div>}
      {choosing && (
        <ul className="flex flex-col gap-1 text-sm">
          {options.map(o => (
            <li key={o.id}>
              <button className="btn btn-ghost" onClick={() => { setCalendar(o.id, o.summary); setChoosing(false); }}>
                {o.summary}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
```

- [ ] **Step 4: Esegui il test per verificare che passi**

Run: `npx vitest run tests/components/CalendarSyncSection.test.tsx`
Expected: PASS

- [ ] **Step 5: Aggancia `CalendarSyncSection` in `TemplatesPage.tsx`**

Aggiungi l'import in cima a `src/components/settings/TemplatesPage.tsx`:

```ts
import { CalendarSyncSection } from './CalendarSyncSection';
```

e inseriscila nel JSX subito dopo `<BackupSection />` e prima di `<AccountSection />`:

```tsx
      <BackupSection />

      <CalendarSyncSection />

      <AccountSection />
```

- [ ] **Step 6: Type-check e suite completa**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/components/settings/CalendarSyncSection.tsx src/components/settings/TemplatesPage.tsx tests/components/CalendarSyncSection.test.tsx
git commit -m "feat(calendar-sync): add Calendar sync settings UI (connect, toggle, disconnect)"
```

---

## Task 11: Verifica finale

**Files:** nessuno (solo comandi di verifica)

- [ ] **Step 1: Suite di test completa**

Run: `npx vitest run`
Expected: tutti i test passano (esistenti + i nuovi di questo piano)

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: nessun errore

- [ ] **Step 3: Lint**

Run: `npx eslint .`
Expected: nessun errore (regola bloccante di progetto prima di ogni commit — vedi CLAUDE.md)

- [ ] **Step 4: Verifica manuale (non automatizzabile in CI)**

Annota nel report finale che restano da fare manualmente, con un vero calendario Google condiviso:
- Login con consenso al nuovo scope `calendar.events`.
- Impostazioni → "Connetti calendario" → selezione calendario reale.
- Creazione/modifica/cancellazione di una prenotazione → verifica che l'evento compaia/si aggiorni/sparisca sul calendario Google reale.
- Creazione di una chiusura → verifica l'evento "Struttura chiusa" con le date corrette (end esclusivo).
- Test offline: crea una prenotazione offline, torna online, verifica che l'evento compaia dopo il retry automatico.
