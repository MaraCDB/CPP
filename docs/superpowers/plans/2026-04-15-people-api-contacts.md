# People API — Contatti Gmail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collegare il numero di telefono delle prenotazioni ai contatti Gmail via People API: lookup al salvataggio, creazione contatto opzionale, popover con scorciatoie WhatsApp/Chiamata/Email sulla card.

**Architecture:** Nuovo modulo `src/lib/google/people.ts` parallelo a `sheets.ts`/`drive.ts`, che usa l'`authFetch` pattern esistente. Scope OAuth `contacts` aggiunto a `auth.ts`. Normalizzazione E.164 in una utility dedicata `src/lib/phone.ts`. La logica di lookup vive nello submit del `BookingForm` (non nello store), che orchestra la modale di conferma. Due campi opzionali sulla `Prenotazione` (`contattoResourceName`, `contattoEmail`) fluiscono tramite `adapter.ts` nello Sheet.

**Tech Stack:** React 18 + TypeScript + Zustand + Vitest + libphonenumber-js + Google People API v1.

**Spec di riferimento:** `docs/superpowers/specs/2026-04-15-people-api-contacts-design.md`

**Working directory:** `d:\Workspace\CPP\app` (tutti i percorsi relativi a questa cartella salvo diversa indicazione)

**Comandi utili:**
- Test: `npm test -- --run` (dalla cartella `app/`)
- Type check: `npx tsc --noEmit`
- Dev server: `npm run dev`

---

## Task 1: Dipendenza libphonenumber-js

**Files:**
- Modify: `app/package.json`

- [ ] **Step 1: Installa libphonenumber-js**

Run: `cd app && npm install libphonenumber-js`
Expected: aggiunge la dep, crea/aggiorna package-lock.

- [ ] **Step 2: Verifica che compili**

Run: `cd app && npx tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 3: Commit**

```bash
git add app/package.json app/package-lock.json
git commit -m "feat: add libphonenumber-js for E.164 normalization"
```

---

## Task 2: Utility phone.ts (normalizzazione E.164)

**Files:**
- Create: `app/src/lib/phone.ts`
- Test: `app/tests/lib/phone.test.ts`

- [ ] **Step 1: Scrivi il test che fallisce**

File: `app/tests/lib/phone.test.ts`
```ts
import { describe, it, expect } from 'vitest';
import { toE164 } from '../../src/lib/phone';

describe('toE164', () => {
  it('normalizza un numero IT con prefisso esplicito', () => {
    expect(toE164('+39 335 1234567')).toBe('+393351234567');
  });
  it('normalizza un numero IT senza prefisso (default IT)', () => {
    expect(toE164('335 1234567')).toBe('+393351234567');
  });
  it('rimuove spazi, trattini e punti', () => {
    expect(toE164('+39-335.123-4567')).toBe('+393351234567');
  });
  it('ritorna null su input non numerico', () => {
    expect(toE164('casa Mario')).toBeNull();
  });
  it('ritorna null su stringa vuota', () => {
    expect(toE164('')).toBeNull();
  });
  it('accetta numero internazionale non-IT', () => {
    expect(toE164('+44 20 7946 0958')).toBe('+442079460958');
  });
});
```

- [ ] **Step 2: Verifica fail**

Run: `cd app && npm test -- --run tests/lib/phone.test.ts`
Expected: FAIL — modulo `phone` non esiste.

- [ ] **Step 3: Implementa phone.ts**

File: `app/src/lib/phone.ts`
```ts
import { parsePhoneNumberFromString } from 'libphonenumber-js';

export const toE164 = (raw: string, defaultCountry: 'IT' = 'IT'): string | null => {
  if (!raw || !raw.trim()) return null;
  try {
    const p = parsePhoneNumberFromString(raw.trim(), defaultCountry);
    if (!p || !p.isValid()) return null;
    return p.number;
  } catch {
    return null;
  }
};
```

- [ ] **Step 4: Verifica pass**

Run: `cd app && npm test -- --run tests/lib/phone.test.ts`
Expected: PASS (6/6).

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/phone.ts app/tests/lib/phone.test.ts
git commit -m "feat(phone): E.164 normalization utility"
```

---

## Task 3: Types — estendi Prenotazione

**Files:**
- Modify: `app/src/types.ts`

- [ ] **Step 1: Aggiungi campi opzionali a Prenotazione**

In `app/src/types.ts`, dentro `export interface Prenotazione`, sotto `note?: string;`:
```ts
  note?: string;
  contattoResourceName?: string;
  contattoEmail?: string;
  creatoIl: string;
```

- [ ] **Step 2: Type check**

Run: `cd app && npx tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 3: Commit**

```bash
git add app/src/types.ts
git commit -m "feat(types): add contattoResourceName and contattoEmail to Prenotazione"
```

---

## Task 4: Adapter — aggiunge 2 colonne allo schema

**Files:**
- Modify: `app/src/lib/google/adapter.ts`
- Modify: `app/tests/lib/adapter.test.ts`

- [ ] **Step 1: Aggiorna test round-trip per includere i nuovi campi**

In `app/tests/lib/adapter.test.ts`, modifica `const sample` aggiungendo i due nuovi campi:
```ts
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
```

Aggiungi anche un test per assenza dei nuovi campi:
```ts
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
```

- [ ] **Step 2: Verifica fail**

Run: `cd app && npm test -- --run tests/lib/adapter.test.ts`
Expected: FAIL.

- [ ] **Step 3: Modifica adapter.ts**

File: `app/src/lib/google/adapter.ts` — sostituisci `BOOKING_HEADERS`, `bookingToRow`, `rowToBooking`:
```ts
export const BOOKING_HEADERS = [
  'id','camera','checkin','checkout','stato','nome','riferimento','num_ospiti',
  'contatto_via','contatto_valore','prezzo_totale','anticipo_importo','anticipo_data','anticipo_tipo',
  'note','contatto_resource_name','contatto_email','creato_il','aggiornato_il',
] as const;
```

```ts
export const bookingToRow = (b: Prenotazione): string[] => [
  b.id, b.camera, b.checkin, b.checkout, b.stato, b.nome, opt(b.riferimento), optN(b.numOspiti),
  opt(b.contattoVia), opt(b.contattoValore), optN(b.prezzoTotale),
  optN(b.anticipo?.importo), opt(b.anticipo?.data), opt(b.anticipo?.tipo),
  opt(b.note), opt(b.contattoResourceName), opt(b.contattoEmail),
  b.creatoIl, b.aggiornatoIl,
];

export const rowToBooking = (r: string[]): Prenotazione => {
  const anticipoImporto = r[11] ? Number(r[11]) : undefined;
  return {
    id: r[0], camera: r[1] as Camera, checkin: r[2], checkout: r[3],
    stato: r[4] as Stato, nome: r[5], riferimento: r[6] || undefined,
    numOspiti: r[7] ? Number(r[7]) : undefined,
    contattoVia: (r[8] || undefined) as ContattoVia | undefined,
    contattoValore: r[9] || undefined,
    prezzoTotale: r[10] ? Number(r[10]) : undefined,
    anticipo: anticipoImporto != null ? {
      importo: anticipoImporto,
      data: r[12] || undefined,
      tipo: (r[13] || undefined) as AnticipoTipo | undefined,
    } : undefined,
    note: r[14] || undefined,
    contattoResourceName: r[15] || undefined,
    contattoEmail: r[16] || undefined,
    creatoIl: r[17], aggiornatoIl: r[18],
  };
};
```

- [ ] **Step 4: Verifica pass**

Run: `cd app && npm test -- --run tests/lib/adapter.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/google/adapter.ts app/tests/lib/adapter.test.ts
git commit -m "feat(adapter): add contatto_resource_name and contatto_email columns"
```

---

## Task 5: Bootstrap — migrazione colonne idempotente

**Files:**
- Modify: `app/src/lib/google/bootstrap.ts`

- [ ] **Step 1: Aggiorna bootstrap per scrivere sempre l'header nuovo**

Il codice attuale scrive l'header solo alla creazione. Per i fogli esistenti serve un ensureHeader che riscrive la riga 1 con `BOOKING_HEADERS` (idempotente — sovrascrive solo la prima riga).

File: `app/src/lib/google/bootstrap.ts` — sostituisci interamente con:
```ts
import { createSpreadsheet, writeRange } from './sheets';
import { listCdbSheets } from './drive';
import { BOOKING_HEADERS, CLOSURE_HEADERS, PROMEMORIA_HEADERS } from './adapter';

export const SHEET_NAMES = ['prenotazioni','chiusure','promemoria','impostazioni'];

const ensureHeaders = async (sid: string) => {
  await writeRange(sid, 'prenotazioni!A1', [ [...BOOKING_HEADERS] ]);
  await writeRange(sid, 'chiusure!A1', [ [...CLOSURE_HEADERS] ]);
  await writeRange(sid, 'promemoria!A1', [ [...PROMEMORIA_HEADERS] ]);
};

export const getOrCreateSheet = async (): Promise<string> => {
  const existing = await listCdbSheets();
  if (existing.files?.length) {
    const sid = existing.files[0].id;
    await ensureHeaders(sid);
    return sid;
  }

  const res = await createSpreadsheet('Cuore di Bosco - Prenotazioni', SHEET_NAMES);
  await ensureHeaders(res.spreadsheetId);
  await writeRange(res.spreadsheetId, 'impostazioni!A1', [ ['chiave','valore'], ['anticipo_default_pct','0.35'] ]);
  return res.spreadsheetId;
};
```

- [ ] **Step 2: Type check**

Run: `cd app && npx tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 3: Commit**

```bash
git add app/src/lib/google/bootstrap.ts
git commit -m "feat(bootstrap): idempotent header migration for existing sheets"
```

---

## Task 6: OAuth scope contacts

**Files:**
- Modify: `app/src/lib/google/auth.ts`

- [ ] **Step 1: Aggiungi scope contacts**

In `app/src/lib/google/auth.ts`, modifica l'array SCOPES:
```ts
const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/contacts',
  'openid', 'email', 'profile',
].join(' ');
```

- [ ] **Step 2: Type check**

Run: `cd app && npx tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 3: Commit**

```bash
git add app/src/lib/google/auth.ts
git commit -m "feat(auth): add People API contacts scope to OAuth"
```

---

## Task 7: People API client — searchByPhone, createContact, getContact

**Files:**
- Create: `app/src/lib/google/people.ts`
- Test: `app/tests/lib/google/people.test.ts`

- [ ] **Step 1: Scrivi i test che falliscono**

File: `app/tests/lib/google/people.test.ts`
```ts
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useAuth } from '../../../src/store/auth';
import { searchByPhone, createContact, ScopeError } from '../../../src/lib/google/people';

const mockFetch = (responses: Array<{ ok: boolean; status?: number; body: any }>) => {
  let i = 0;
  return vi.fn(async () => {
    const r = responses[i++];
    return {
      ok: r.ok,
      status: r.status ?? (r.ok ? 200 : 500),
      json: async () => r.body,
      text: async () => JSON.stringify(r.body),
    } as Response;
  });
};

describe('people API', () => {
  beforeEach(() => {
    useAuth.setState({ accessToken: 'fake-token', tokenExpiry: Date.now() + 3600_000 } as any);
  });
  afterEach(() => vi.restoreAllMocks());

  describe('searchByPhone', () => {
    it('ritorna match esatto su numero E.164', async () => {
      vi.stubGlobal('fetch', mockFetch([{
        ok: true, body: {
          results: [{
            person: {
              resourceName: 'people/c1',
              names: [{ displayName: 'Mario Rossi' }],
              phoneNumbers: [{ value: '+39 335 1234567', canonicalForm: '+393351234567' }],
              emailAddresses: [{ value: 'mario@rossi.it' }],
            },
          }],
        },
      }]));
      const r = await searchByPhone('+393351234567');
      expect(r).toEqual({
        resourceName: 'people/c1',
        displayName: 'Mario Rossi',
        phoneE164: '+393351234567',
        email: 'mario@rossi.it',
      });
    });

    it('ritorna null se nessun match', async () => {
      vi.stubGlobal('fetch', mockFetch([{ ok: true, body: { results: [] } }]));
      const r = await searchByPhone('+393351234567');
      expect(r).toBeNull();
    });

    it('ritorna null se il match ha un numero diverso dopo normalizzazione', async () => {
      vi.stubGlobal('fetch', mockFetch([{
        ok: true, body: {
          results: [{
            person: {
              resourceName: 'people/c1',
              names: [{ displayName: 'Altro' }],
              phoneNumbers: [{ value: '+39 02 1234' }],
            },
          }],
        },
      }]));
      const r = await searchByPhone('+393351234567');
      expect(r).toBeNull();
    });

    it('preferisce telefono primary se presente', async () => {
      vi.stubGlobal('fetch', mockFetch([{
        ok: true, body: {
          results: [{
            person: {
              resourceName: 'people/c1',
              names: [{ displayName: 'Mario' }],
              phoneNumbers: [
                { value: '+39 02 0000000' },
                { value: '+393351234567', metadata: { primary: true } },
              ],
            },
          }],
        },
      }]));
      const r = await searchByPhone('+393351234567');
      expect(r?.phoneE164).toBe('+393351234567');
    });

    it('lancia ScopeError su 403', async () => {
      vi.stubGlobal('fetch', mockFetch([{ ok: false, status: 403, body: { error: 'insufficient scope' } }]));
      await expect(searchByPhone('+393351234567')).rejects.toThrow(ScopeError);
    });
  });

  describe('createContact', () => {
    it('POSTa il payload corretto e ritorna il contatto', async () => {
      const fetchSpy = mockFetch([{
        ok: true, body: {
          resourceName: 'people/c2',
          names: [{ displayName: 'Nuovo Ospite' }],
          phoneNumbers: [{ value: '+393351234567' }],
        },
      }]);
      vi.stubGlobal('fetch', fetchSpy);
      const r = await createContact({ name: 'Nuovo Ospite', phoneE164: '+393351234567' });
      expect(r.resourceName).toBe('people/c2');
      expect(r.phoneE164).toBe('+393351234567');
      const call = fetchSpy.mock.calls[0];
      expect(call[0]).toContain('people:createContact');
      const body = JSON.parse((call[1] as RequestInit).body as string);
      expect(body.names[0].givenName).toBe('Nuovo Ospite');
      expect(body.phoneNumbers[0].value).toBe('+393351234567');
    });
  });
});
```

- [ ] **Step 2: Verifica fail**

Run: `cd app && npm test -- --run tests/lib/google/people.test.ts`
Expected: FAIL — modulo non esiste.

- [ ] **Step 3: Implementa people.ts**

File: `app/src/lib/google/people.ts`
```ts
import { useAuth } from '../../store/auth';
import { toE164 } from '../phone';

const BASE = 'https://people.googleapis.com/v1';
const READ_MASK = 'names,phoneNumbers,emailAddresses';

export interface GoogleContact {
  resourceName: string;
  displayName: string;
  phoneE164: string;
  email?: string;
}

export class ScopeError extends Error {
  constructor(msg = 'Missing People API scope') { super(msg); this.name = 'ScopeError'; }
}

const call = async <T = unknown>(url: string, init: RequestInit = {}): Promise<T> => {
  const t = useAuth.getState().accessToken;
  if (!t) throw new Error('No access token');
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  if (res.status === 403) throw new ScopeError();
  if (!res.ok) throw new Error(`People API ${res.status}: ${await res.text()}`);
  return res.json();
};

interface PersonResp {
  resourceName: string;
  names?: Array<{ displayName?: string; givenName?: string }>;
  phoneNumbers?: Array<{ value?: string; canonicalForm?: string; metadata?: { primary?: boolean } }>;
  emailAddresses?: Array<{ value?: string; metadata?: { primary?: boolean } }>;
}

const toContact = (p: PersonResp, targetE164: string): GoogleContact | null => {
  const phones = p.phoneNumbers || [];
  // Preferisci primary, poi primo match dopo normalizzazione
  const sorted = [...phones].sort((a, b) => {
    const ap = a.metadata?.primary ? 0 : 1;
    const bp = b.metadata?.primary ? 0 : 1;
    return ap - bp;
  });
  const match = sorted.find(ph => {
    const norm = ph.canonicalForm || toE164(ph.value || '');
    return norm === targetE164;
  });
  if (!match) return null;
  const email = (p.emailAddresses || []).find(e => e.metadata?.primary)?.value
    || p.emailAddresses?.[0]?.value;
  return {
    resourceName: p.resourceName,
    displayName: p.names?.[0]?.displayName || p.names?.[0]?.givenName || '',
    phoneE164: targetE164,
    email: email || undefined,
  };
};

export const searchByPhone = async (e164: string): Promise<GoogleContact | null> => {
  const url = `${BASE}/people:searchContacts?query=${encodeURIComponent(e164)}&readMask=${encodeURIComponent(READ_MASK)}`;
  const r = await call<{ results?: Array<{ person: PersonResp }> }>(url);
  for (const entry of r.results || []) {
    const c = toContact(entry.person, e164);
    if (c) return c;
  }
  return null;
};

export const createContact = async (input: { name: string; phoneE164: string }): Promise<GoogleContact> => {
  const url = `${BASE}/people:createContact?personFields=${encodeURIComponent(READ_MASK)}`;
  const body = {
    names: [{ givenName: input.name }],
    phoneNumbers: [{ value: input.phoneE164 }],
  };
  const p = await call<PersonResp>(url, { method: 'POST', body: JSON.stringify(body) });
  return {
    resourceName: p.resourceName,
    displayName: p.names?.[0]?.displayName || input.name,
    phoneE164: input.phoneE164,
    email: p.emailAddresses?.[0]?.value || undefined,
  };
};

export const getContact = async (resourceName: string): Promise<GoogleContact | null> => {
  const url = `${BASE}/${resourceName}?personFields=${encodeURIComponent(READ_MASK)}`;
  const p = await call<PersonResp>(url);
  const firstPhone = p.phoneNumbers?.[0];
  const e164 = firstPhone?.canonicalForm || toE164(firstPhone?.value || '') || '';
  return {
    resourceName: p.resourceName,
    displayName: p.names?.[0]?.displayName || '',
    phoneE164: e164,
    email: p.emailAddresses?.[0]?.value || undefined,
  };
};

// Warmup call — people:searchContacts richiede una prima call per popolare la cache server-side.
export const warmupPeopleSearch = async (): Promise<void> => {
  try { await searchByPhone('+0'); } catch { /* intenzionalmente ignorato */ }
};
```

- [ ] **Step 4: Verifica pass**

Run: `cd app && npm test -- --run tests/lib/google/people.test.ts`
Expected: PASS (6/6).

- [ ] **Step 5: Type check**

Run: `cd app && npx tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/google/people.ts app/tests/lib/google/people.test.ts
git commit -m "feat(google): People API client with searchByPhone and createContact"
```

---

## Task 8: Warmup al boot

**Files:**
- Modify: `app/src/lib/sync.ts`

- [ ] **Step 1: Chiama warmup al termine del bootSync**

In `app/src/lib/sync.ts`, aggiungi l'import in cima al file:
```ts
import { warmupPeopleSearch } from './google/people';
```

E dentro `bootSync`, dopo `void processQueue();` (prima dei setInterval), aggiungi:
```ts
  void processQueue();
  void warmupPeopleSearch();
```

- [ ] **Step 2: Type check**

Run: `cd app && npx tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 3: Commit**

```bash
git add app/src/lib/sync.ts
git commit -m "feat(sync): warmup People API search cache on boot"
```

---

## Task 9: Modale ConfirmCreateContactModal

**Files:**
- Create: `app/src/components/common/ConfirmCreateContactModal.tsx`

- [ ] **Step 1: Crea il componente**

File: `app/src/components/common/ConfirmCreateContactModal.tsx`
```tsx
import { Modal } from './Modal';

interface Props {
  open: boolean;
  name: string;
  phoneE164: string;
  onConfirm: () => void;
  onSkip: () => void;
}

export const ConfirmCreateContactModal = ({ open, name, phoneE164, onConfirm, onSkip }: Props) => {
  if (!open) return null;
  return (
    <Modal open onClose={onSkip} title="Aggiungere a rubrica Gmail?">
      <div className="p-4">
        <p className="mb-3">Il numero <strong>{phoneE164}</strong> non è nei tuoi contatti Gmail.</p>
        <p className="mb-4">Vuoi aggiungere <strong>{name || 'questo ospite'}</strong> alla rubrica?</p>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onSkip}>No, salta</button>
          <button type="button" className="btn btn-primary" onClick={onConfirm}>Aggiungi a Gmail</button>
        </div>
      </div>
    </Modal>
  );
};
```

- [ ] **Step 2: Type check**

Run: `cd app && npx tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/common/ConfirmCreateContactModal.tsx
git commit -m "feat(ui): ConfirmCreateContactModal for adding new phone to Gmail contacts"
```

---

## Task 10: BookingForm — orchestrazione lookup/creazione

**Files:**
- Modify: `app/src/components/forms/BookingForm.tsx`

- [ ] **Step 1: Estrai helper di risoluzione contatto e integra nel submit**

In `app/src/components/forms/BookingForm.tsx`:

Aggiungi import in cima:
```ts
import { toE164 } from '../../lib/phone';
import { searchByPhone, createContact, ScopeError } from '../../lib/google/people';
import { ConfirmCreateContactModal } from '../common/ConfirmCreateContactModal';
```

Aggiungi state per la modale (dopo `const [antTouched, setAntTouched] = useState(...)`):
```ts
  const [pendingConfirm, setPendingConfirm] = useState<{
    candidate: Prenotazione;
    e164: string;
  } | null>(null);
```

Sostituisci l'intero `onSubmit` con:
```ts
  const finalize = (candidate: Prenotazione) => {
    const { id: _id, creatoIl: _c, aggiornatoIl: _u, ...rest } = candidate;
    if (existing) update(existing.id, rest);
    else add(rest);
    onClose();
  };

  const resolveContact = async (candidate: Prenotazione): Promise<Prenotazione> => {
    if (candidate.contattoVia !== 'telefono' || !candidate.contattoValore) return candidate;
    const e164 = toE164(candidate.contattoValore);
    if (!e164) return candidate;
    const numberChanged = !existing || toE164(existing.contattoValore || '') !== e164;
    if (!numberChanged && candidate.contattoResourceName) return candidate;
    try {
      const match = await searchByPhone(e164);
      if (match) {
        return { ...candidate, contattoResourceName: match.resourceName, contattoEmail: match.email };
      }
      // Niente match — apri modale e sospendi finalize
      setPendingConfirm({ candidate, e164 });
      throw new Error('__PENDING_CONFIRM__');
    } catch (err) {
      if (err instanceof Error && err.message === '__PENDING_CONFIRM__') throw err;
      if (err instanceof ScopeError) {
        alert('Serve ri-autorizzare l\u2019accesso ai contatti Gmail. Esci e rientra.');
        return candidate;
      }
      // Offline / network error — salva senza link
      console.warn('People lookup failed, saving without contact link', err);
      return candidate;
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!data.checkin || !data.checkout || (data.checkout <= data.checkin)) {
      alert('Il check-out deve essere dopo il check-in'); return;
    }
    const candidate: Prenotazione = {
      id: existing?.id || 'tmp',
      creatoIl: existing?.creatoIl || new Date().toISOString(),
      aggiornatoIl: new Date().toISOString(),
      camera: (data.camera || 'lampone') as Camera,
      checkin: data.checkin, checkout: data.checkout,
      stato: (data.stato || 'proposta') as Stato,
      nome: (data.nome || '').trim(),
      riferimento: data.riferimento?.trim() || undefined,
      numOspiti: data.numOspiti || 2,
      contattoVia: data.contattoVia,
      contattoValore: data.contattoValore?.trim() || undefined,
      prezzoTotale: data.prezzoTotale || undefined,
      anticipo: data.anticipo?.importo ? { importo: data.anticipo.importo, data: data.anticipo.data, tipo: data.anticipo.tipo } : undefined,
      note: data.note?.trim() || undefined,
      contattoResourceName: existing?.contattoResourceName,
      contattoEmail: existing?.contattoEmail,
    };
    const conf = checkConflicts(candidate, items, closures);
    if (conf?.block) { setWarn(conf); ackRef.current = false; return; }
    if (conf && !ackRef.current) { setWarn(conf); ackRef.current = true; return; }

    try {
      const resolved = await resolveContact(candidate);
      finalize(resolved);
    } catch (err) {
      if (err instanceof Error && err.message === '__PENDING_CONFIRM__') return;
      throw err;
    }
  };

  const handleConfirmCreate = async () => {
    if (!pendingConfirm) return;
    const { candidate, e164 } = pendingConfirm;
    setPendingConfirm(null);
    try {
      const created = await createContact({ name: candidate.nome, phoneE164: e164 });
      finalize({ ...candidate, contattoResourceName: created.resourceName, contattoEmail: created.email });
    } catch (err) {
      console.warn('createContact failed', err);
      finalize(candidate);
    }
  };

  const handleSkipCreate = () => {
    if (!pendingConfirm) return;
    const { candidate } = pendingConfirm;
    setPendingConfirm(null);
    finalize(candidate);
  };
```

In fondo al JSX, subito prima di `</Modal>`, aggiungi la modale:
```tsx
        {pendingConfirm && (
          <ConfirmCreateContactModal
            open
            name={pendingConfirm.candidate.nome}
            phoneE164={pendingConfirm.e164}
            onConfirm={handleConfirmCreate}
            onSkip={handleSkipCreate}
          />
        )}
```

Cambia anche la firma del form per tollerare async onSubmit:
```tsx
      <form onSubmit={(e) => { void onSubmit(e); }} className="p-4">
```

- [ ] **Step 2: Type check**

Run: `cd app && npx tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/forms/BookingForm.tsx
git commit -m "feat(booking-form): lookup Gmail contact on save, prompt to create if missing"
```

---

## Task 11: ContactMenu — popover con WhatsApp/Chiama/Email

**Files:**
- Create: `app/src/components/common/ContactMenu.tsx`
- Test: `app/tests/components/ContactMenu.test.tsx`

- [ ] **Step 1: Scrivi il test che fallisce**

File: `app/tests/components/ContactMenu.test.tsx`
```tsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ContactMenu } from '../../src/components/common/ContactMenu';

describe('ContactMenu', () => {
  it('mostra WhatsApp e Chiama sempre', () => {
    render(<ContactMenu phoneE164="+393351234567" label="+39 335 1234567" />);
    fireEvent.click(screen.getByRole('button', { name: /\+39 335 1234567/ }));
    expect(screen.getByText(/WhatsApp/i)).toBeInTheDocument();
    expect(screen.getByText(/Chiama/i)).toBeInTheDocument();
  });

  it('mostra Email solo se contattoEmail è presente', () => {
    const { rerender } = render(<ContactMenu phoneE164="+393351234567" label="+39 335 1234567" />);
    fireEvent.click(screen.getByRole('button', { name: /\+39 335 1234567/ }));
    expect(screen.queryByText(/Email/i)).not.toBeInTheDocument();

    rerender(<ContactMenu phoneE164="+393351234567" label="+39 335 1234567" email="x@y.it" />);
    expect(screen.getByText(/Email/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Email/i })).toHaveAttribute('href', 'mailto:x@y.it');
  });

  it('link WhatsApp usa E.164 senza +', () => {
    render(<ContactMenu phoneE164="+393351234567" label="+39 335 1234567" />);
    fireEvent.click(screen.getByRole('button', { name: /\+39 335 1234567/ }));
    expect(screen.getByRole('link', { name: /WhatsApp/i })).toHaveAttribute('href', 'https://wa.me/393351234567');
  });

  it('mostra "Apri in Gmail" solo se resourceName è presente', () => {
    render(<ContactMenu phoneE164="+393351234567" label="X" resourceName="people/c1" />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText(/Apri in Gmail/i)).toBeInTheDocument();
  });
});
```

Aggiungi `@testing-library/react` se non presente:

Run: `cd app && npm ls @testing-library/react`
Se assente: `cd app && npm install -D @testing-library/react @testing-library/jest-dom`
E aggiungi `import '@testing-library/jest-dom'` in `app/tests/setup.ts` se non c'è già.

- [ ] **Step 2: Verifica fail**

Run: `cd app && npm test -- --run tests/components/ContactMenu.test.tsx`
Expected: FAIL — componente non esiste.

- [ ] **Step 3: Implementa ContactMenu**

File: `app/src/components/common/ContactMenu.tsx`
```tsx
import { useState, useRef, useEffect } from 'react';

interface Props {
  phoneE164: string;
  label: string;               // testo mostrato nel bottone (numero grezzo)
  email?: string;
  resourceName?: string;
}

export const ContactMenu = ({ phoneE164, label, email, resourceName }: Props) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const waNumber = phoneE164.replace(/^\+/, '');
  const gmailId = resourceName?.split('/').pop();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        className="underline"
        style={{ color: 'var(--ink-soft)' }}
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
      >{label}</button>
      {open && (
        <div
          className="absolute z-10 mt-1 rounded-lg border shadow-lg p-1 min-w-[180px]"
          style={{ background: 'var(--surface)', borderColor: 'var(--line)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <a className="block px-3 py-2 rounded hover:bg-gray-100" href={`https://wa.me/${waNumber}`} target="_blank" rel="noreferrer">📱 WhatsApp</a>
          <a className="block px-3 py-2 rounded hover:bg-gray-100" href={`tel:${phoneE164}`}>📞 Chiama</a>
          {email && (
            <a className="block px-3 py-2 rounded hover:bg-gray-100" href={`mailto:${email}`}>✉️ Email</a>
          )}
          {gmailId && (
            <>
              <div className="my-1 border-t" style={{ borderColor: 'var(--line)' }} />
              <a className="block px-3 py-2 rounded hover:bg-gray-100" href={`https://contacts.google.com/person/${gmailId}`} target="_blank" rel="noreferrer">👤 Apri in Gmail</a>
            </>
          )}
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 4: Verifica pass**

Run: `cd app && npm test -- --run tests/components/ContactMenu.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/common/ContactMenu.tsx app/tests/components/ContactMenu.test.tsx
git commit -m "feat(ui): ContactMenu popover with WhatsApp/call/email shortcuts"
```

---

## Task 12: BookingCard — integrazione ContactMenu + stato

**Files:**
- Modify: `app/src/components/common/BookingCard.tsx`

- [ ] **Step 1: Integra ContactMenu nella card**

In `app/src/components/common/BookingCard.tsx`:

Aggiungi import:
```ts
import { ContactMenu } from './ContactMenu';
import { toE164 } from '../../lib/phone';
```

Sostituisci il blocco `{b.contattoVia && <div ...>...</div>}` con:
```tsx
      {b.contattoVia && b.contattoValore && (
        <div
          className="text-[12px] flex items-center gap-1"
          style={{ color: 'var(--ink-soft)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <span>{CONTACT_ICON[b.contattoVia]}</span>
          {b.contattoVia === 'telefono' && toE164(b.contattoValore) ? (
            <>
              <ContactMenu
                phoneE164={toE164(b.contattoValore)!}
                label={b.contattoValore}
                email={b.contattoEmail}
                resourceName={b.contattoResourceName}
              />
              {b.contattoResourceName && (
                <span title="Contatto Gmail collegato" style={{ color: '#22c55e' }}>●</span>
              )}
            </>
          ) : (
            <span>{b.contattoValore}</span>
          )}
        </div>
      )}
```

- [ ] **Step 2: Type check**

Run: `cd app && npx tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/common/BookingCard.tsx
git commit -m "feat(booking-card): clickable phone with ContactMenu and Gmail link indicator"
```

---

## Task 13: Refresh email on-demand nel popover

**Files:**
- Modify: `app/src/components/common/ContactMenu.tsx`

- [ ] **Step 1: Aggiungi prop onMissingEmail e trigger al primo open**

Sostituisci il componente `ContactMenu` — aggiungi prop e useEffect:

In `app/src/components/common/ContactMenu.tsx`, aggiungi `onMissingEmail?: () => void;` alle Props e aggiungi dopo il `useEffect` esistente:
```tsx
  useEffect(() => {
    if (open && resourceName && !email && onMissingEmail) onMissingEmail();
  }, [open, resourceName, email, onMissingEmail]);
```

Esegui anche il fix di destrutturazione:
```ts
export const ContactMenu = ({ phoneE164, label, email, resourceName, onMissingEmail }: Props) => {
```

In `BookingCard.tsx`, aggiungi import e handler:
```ts
import { useBookings } from '../../store/bookings';
import { getContact } from '../../lib/google/people';
```

E prima del return aggiungi:
```ts
  const updateBooking = useBookings(s => s.update);
  const fetchEmail = async () => {
    if (!b.contattoResourceName || b.contattoEmail) return;
    try {
      const c = await getContact(b.contattoResourceName);
      if (c?.email) updateBooking(b.id, { contattoEmail: c.email });
    } catch { /* ignore */ }
  };
```

Passa la prop alla `ContactMenu`:
```tsx
              <ContactMenu
                phoneE164={toE164(b.contattoValore)!}
                label={b.contattoValore}
                email={b.contattoEmail}
                resourceName={b.contattoResourceName}
                onMissingEmail={fetchEmail}
              />
```

- [ ] **Step 2: Type check + test**

Run: `cd app && npx tsc --noEmit && npm test -- --run tests/components/ContactMenu.test.tsx`
Expected: passa.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/common/ContactMenu.tsx app/src/components/common/BookingCard.tsx
git commit -m "feat(contact-menu): on-demand email refresh when popover opens"
```

---

## Task 14: Test store bookings — include i nuovi campi

**Files:**
- Modify: `app/tests/store/bookings.test.ts`

- [ ] **Step 1: Verifica che la suite esistente passi con i campi opzionali**

Run: `cd app && npm test -- --run tests/store/bookings.test.ts`
Expected: PASS (i nuovi campi sono opzionali, non dovrebbero rompere nulla).

Se fallisce, leggi il test e adatta le sample data; altrimenti salta al commit.

- [ ] **Step 2: Aggiungi test che verifica che `update` preservi contattoResourceName e contattoEmail**

In coda al file `app/tests/store/bookings.test.ts`, aggiungi:
```ts
import { useBookings } from '../../src/store/bookings';
// (se non già importato sopra)

describe('bookings store — contact link persistence', () => {
  it('update preserva contattoResourceName quando non incluso nella patch', () => {
    useBookings.setState({ items: [] });
    const b = useBookings.getState().add({
      camera: 'lampone', checkin: '2026-05-01', checkout: '2026-05-03',
      stato: 'confermato', nome: 'Test', numOspiti: 2,
      contattoVia: 'telefono', contattoValore: '+393351234567',
      contattoResourceName: 'people/c99', contattoEmail: 'a@b.it',
    });
    useBookings.getState().update(b.id, { note: 'ciao' });
    const updated = useBookings.getState().items.find(x => x.id === b.id);
    expect(updated?.contattoResourceName).toBe('people/c99');
    expect(updated?.contattoEmail).toBe('a@b.it');
  });
});
```

- [ ] **Step 3: Run test**

Run: `cd app && npm test -- --run tests/store/bookings.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/tests/store/bookings.test.ts
git commit -m "test(bookings): verify contact link fields survive partial updates"
```

---

## Task 15: Verifica finale e smoke test manuale

**Files:** nessuno.

- [ ] **Step 1: Full test suite**

Run: `cd app && npm test -- --run`
Expected: tutti i test passano.

- [ ] **Step 2: Type check completo**

Run: `cd app && npx tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 3: Build di produzione**

Run: `cd app && npm run build`
Expected: build pulita senza warning bloccanti.

- [ ] **Step 4: Smoke test manuale — serve Google account reale**

Run: `cd app && npm run dev`

Checklist da verificare nel browser:
1. Login → al primo accesso dopo la modifica dello scope, Google chiede consenso per "Vedere, modificare, scaricare ed eliminare i contatti". Accettare.
2. Crea una prenotazione nuova con Contatto=Telefono e valore `+39 335 XXXXXXX` di un contatto esistente nella tua rubrica Gmail.
   - Al salvataggio, nessuna modale. Riapri la card: deve comparire il pallino verde accanto al numero.
3. Click sul numero nella card: si apre popover con WhatsApp, Chiama, Email (se il contatto ha email), Apri in Gmail.
4. Crea una prenotazione con un numero NON in rubrica. Al salvataggio compare la modale "Aggiungere a rubrica Gmail?". Clicca "Aggiungi a Gmail". Verifica in contacts.google.com che il contatto sia stato creato.
5. Modifica una prenotazione esistente cambiando il numero con uno presente in rubrica. Salva. Il pallino verde deve aggiornarsi.
6. Modalità offline (DevTools → Network offline): crea prenotazione con telefono. Il salvataggio funziona ma senza link (nessuna modale). Torna online → il sync normale procede.

Se tutti i punti passano, la feature è completa.

- [ ] **Step 5: Aggiorna MEMORY.md del repo principale** (opzionale, se presente)

Se esiste `d:\Workspace\CPP\CPP\MEMORY.md` o `d:\Workspace\CPP\MEMORY.md`, aggiungi una voce che referenzia questo piano e lo spec.

- [ ] **Step 6: Commit finale (se ci sono modifiche)**

```bash
git status
# se ci sono modifiche residue:
git add -A
git commit -m "chore: finalize People API integration"
```

---

## Note per chi esegue

- **Lo scope OAuth cambia:** al primo login dopo il merge, Google ri-chiede il consenso. Non è un bug.
- **Warmup:** la prima call a `searchContacts` può tornare risultati incompleti. Il warmup al boot mitiga il problema.
- **Rate limit People API:** 90 req/min per utente. Con una B&B a 2 camere il traffico è trascurabile.
- **Numeri internazionali:** l'utility `toE164` default country è `IT`. Se un giorno si aggiungono ospiti stranieri che inseriscono numeri locali del loro paese senza prefisso, serviranno comunque del prefisso `+`.
