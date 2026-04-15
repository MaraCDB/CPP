# Piano B — Google Sheets sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sostituire `localStorage` con Google Sheets come backend. L'app rileva login Google, crea il foglio al primo uso, sincronizza ogni modifica, mantiene una cache IndexedDB per lettura offline e queue per scritture offline. Utenti con permesso `reader` entrano in modalità read-only.

**Architecture:** L'app resta 100% client-side. Auth via Google Identity Services (GSI), API calls a Google Sheets API v4 e Drive API v3 via `fetch` con access token. Zustand stores continuano a essere la source of truth in RAM, ma la persistenza è riscritta: cache IndexedDB + push → Sheets. Queue di operazioni pending persiste tra reload.

**Tech Stack:** `google-auth-library` client-side (GSI script da CDN), `idb` (wrapper IndexedDB), Zustand invariato, nessuna nuova dipendenza pesante.

**Prereq:** Piano A completato al tag `v0.1.0-piano-A`.

---

## File Structure (nuove aggiunte)

```
src/
├── lib/
│   ├── google/
│   │   ├── auth.ts                 # GSI wrapper + token lifecycle
│   │   ├── sheets.ts               # Sheets API v4 wrapper
│   │   ├── drive.ts                # Drive API v3 wrapper (metadati/permessi)
│   │   ├── bootstrap.ts            # crea spreadsheet al primo login
│   │   └── adapter.ts              # row ↔ TS object
│   ├── sync.ts                     # orchestratore cache ↔ cloud
│   └── idb.ts                      # IndexedDB wrapper semplice
├── store/
│   ├── auth.ts                     # user, access token, readonly
│   └── sync.ts                     # stato sync (idle/syncing/offline/error + queue count)
├── components/
│   ├── SignIn.tsx                  # schermata login iniziale
│   ├── SyncIndicator.tsx           # pill nella topbar: 🟢/🟡/🔴
│   └── ReadOnlyBanner.tsx          # banner "vista di sola lettura"
└── main.tsx                        # modificato: gate login + bootstrap sheet
```

---

## Phase 0 — Setup Google Cloud (manuale, ~3 minuti)

> **Questa fase è manuale. Richiede l'utente (Mara). Non è automatizzabile.**

- [ ] **Step 1: Crea un progetto Google Cloud**
  1. Apri [console.cloud.google.com](https://console.cloud.google.com) e accedi col tuo account Google
  2. In alto, dropdown "Seleziona un progetto" → "Nuovo progetto"
  3. Nome: `cuore-di-bosco-calendario`, Località: nessuna organizzazione → Crea
  4. Aspetta ~10 secondi che il progetto sia creato e selezionalo

- [ ] **Step 2: Abilita Google Sheets API + Google Drive API**
  1. Menu ≡ → "API e servizi" → "Libreria"
  2. Cerca "Google Sheets API" → click → "Abilita"
  3. Torna alla libreria, cerca "Google Drive API" → click → "Abilita"

- [ ] **Step 3: Configura schermata di consenso OAuth**
  1. "API e servizi" → "Schermata consenso OAuth"
  2. Tipo utente: **Esterno** → Crea
  3. Nome app: `Cuore di Bosco Calendario`
  4. Email assistenza utenti: la tua email
  5. Logo app: vuoto (ok)
  6. Dominio app: vuoto (ok per sviluppo)
  7. Email contatto sviluppatore: la tua email
  8. Salva e continua
  9. Ambiti: "Aggiungi o rimuovi ambiti" → spunta:
     - `https://www.googleapis.com/auth/spreadsheets`
     - `https://www.googleapis.com/auth/drive.file`
  10. Aggiorna → Salva e continua
  11. Utenti di test: "+ AGGIUNGI UTENTI" → aggiungi la tua email Gmail e quelle della famiglia che userà l'app in sola lettura
  12. Salva e continua

- [ ] **Step 4: Crea OAuth Client ID**
  1. "API e servizi" → "Credenziali"
  2. "+ CREA CREDENZIALI" → "ID client OAuth"
  3. Tipo applicazione: **Applicazione web**
  4. Nome: `Calendario B&B web`
  5. Origini JavaScript autorizzate → "+ AGGIUNGI URI":
     - `http://localhost:5173` (per sviluppo)
     - Eventuale URL produzione futuro (lo aggiungeremo in Piano C)
  6. URI di reindirizzamento autorizzati: lascia vuoto (usiamo GSI token flow, non redirect)
  7. Crea
  8. **COPIA l'ID client** (formato `xxx.apps.googleusercontent.com`) — servirà al prossimo passo

- [ ] **Step 5: Salva l'ID client in `.env.local`**

Crea `app/.env.local` (file già in `.gitignore` di Vite):
```
VITE_GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
```

Sostituisci `xxx.apps.googleusercontent.com` con l'ID copiato allo Step 4.8.

---

## Phase 1 — Dipendenze e tipi

### Task 1.1: Install `idb`

- [ ] **Step 1:** `cd app && npm install idb`
- [ ] **Step 2:** Commit `chore: add idb dependency for IndexedDB cache`

### Task 1.2: Tipi auth e sync in `types.ts`

**Files:**
- Modify: `src/types.ts` (aggiungere in fondo)

- [ ] **Step 1: Aggiungi**
```ts
export interface GoogleUser {
  email: string;
  name: string;
  picture?: string;
}

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error' | 'unauth';

export interface PendingOp {
  id: string;              // uid
  kind: 'upsert_booking' | 'delete_booking' | 'upsert_closure' | 'delete_closure' | 'upsert_promemoria' | 'delete_promemoria';
  payload: unknown;
  createdAt: string;
}
```
- [ ] **Step 2:** Commit `feat(types): auth and sync types`

---

## Phase 2 — Google Identity Services (auth)

### Task 2.1: Load GSI script

**Files:**
- Modify: `index.html`

- [ ] **Step 1:** Aggiungi prima di `</head>`:
```html
<script src="https://accounts.google.com/gsi/client" async defer></script>
```

- [ ] **Step 2:** Commit `chore(auth): load Google Identity Services script`

### Task 2.2: Auth store

**Files:**
- Create: `src/store/auth.ts`

- [ ] **Step 1:**
```ts
import { create } from 'zustand';
import type { GoogleUser } from '../types';

interface State {
  user: GoogleUser | null;
  accessToken: string | null;
  tokenExpiry: number;           // epoch ms
  readonly: boolean;
  setSession: (user: GoogleUser, token: string, expiresIn: number) => void;
  setReadonly: (v: boolean) => void;
  signOut: () => void;
}

export const useAuth = create<State>((set) => ({
  user: null,
  accessToken: null,
  tokenExpiry: 0,
  readonly: false,
  setSession: (user, accessToken, expiresIn) => set({
    user, accessToken, tokenExpiry: Date.now() + expiresIn * 1000,
  }),
  setReadonly: (readonly) => set({ readonly }),
  signOut: () => set({ user: null, accessToken: null, tokenExpiry: 0, readonly: false }),
}));
```
- [ ] **Step 2:** Commit `feat(store): auth`

### Task 2.3: GSI wrapper

**Files:**
- Create: `src/lib/google/auth.ts`

- [ ] **Step 1:**
```ts
import { useAuth } from '../../store/auth';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;
const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
  'openid', 'email', 'profile',
].join(' ');

declare global {
  interface Window { google?: any; }
}

let tokenClient: any = null;

export const initAuth = (): Promise<void> => new Promise((resolve) => {
  const check = () => {
    if (window.google?.accounts?.oauth2) {
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: async (resp: any) => {
          if (resp.error) return;
          const token = resp.access_token;
          const expiresIn = Number(resp.expires_in) || 3600;
          // fetch userinfo
          const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${token}` },
          });
          const info = await r.json();
          useAuth.getState().setSession(
            { email: info.email, name: info.name, picture: info.picture },
            token, expiresIn,
          );
        },
      });
      resolve();
    } else setTimeout(check, 50);
  };
  check();
});

export const signIn = () => tokenClient?.requestAccessToken({ prompt: 'consent' });
export const silentRefresh = () => tokenClient?.requestAccessToken({ prompt: '' });

// refresh preventivo 5 min prima della scadenza
export const startTokenAutoRefresh = () => {
  setInterval(() => {
    const { accessToken, tokenExpiry } = useAuth.getState();
    if (accessToken && tokenExpiry - Date.now() < 5 * 60 * 1000) silentRefresh();
  }, 60 * 1000);
};
```
- [ ] **Step 2:** Commit `feat(auth): GSI wrapper with token auto-refresh`

### Task 2.4: SignIn component

**Files:**
- Create: `src/components/SignIn.tsx`

- [ ] **Step 1:**
```tsx
import { signIn } from '../lib/google/auth';

export const SignIn = () => (
  <section className="home" style={{ textAlign: 'center' }}>
    <div className="home-hero">
      <div className="logo" style={{ background:'linear-gradient(135deg,var(--lampone),var(--mirtillo))' }}>🏡</div>
      <h1>Cuore di Bosco</h1>
      <p>Calendario prenotazioni</p>
    </div>
    <div style={{ maxWidth: 360 }}>
      <p className="mb-4 text-sm" style={{ color:'var(--ink-soft)' }}>
        Accedi con Google per sincronizzare le prenotazioni tra tutti i tuoi dispositivi.
      </p>
      <button className="btn btn-primary w-full" onClick={signIn}>Accedi con Google</button>
    </div>
  </section>
);
```
- [ ] **Step 2:** Commit `feat(ui): SignIn screen`

---

## Phase 3 — Google Sheets / Drive API wrappers

### Task 3.1: Sheets API wrapper

**Files:**
- Create: `src/lib/google/sheets.ts`

- [ ] **Step 1:**
```ts
import { useAuth } from '../../store/auth';

const BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

const tokenOrThrow = () => {
  const t = useAuth.getState().accessToken;
  if (!t) throw new Error('No access token');
  return t;
};

const call = async <T = unknown>(url: string, init: RequestInit = {}): Promise<T> => {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${tokenOrThrow()}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`Sheets API ${res.status}: ${await res.text()}`);
  return res.json();
};

export interface SheetCreateResponse {
  spreadsheetId: string;
  spreadsheetUrl: string;
}

export const createSpreadsheet = (title: string, sheetTitles: string[]) =>
  call<SheetCreateResponse>(BASE, {
    method: 'POST',
    body: JSON.stringify({
      properties: { title },
      sheets: sheetTitles.map(t => ({ properties: { title: t } })),
    }),
  });

export const readRange = (spreadsheetId: string, range: string) =>
  call<{ values?: string[][] }>(`${BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}`);

export const writeRange = (spreadsheetId: string, range: string, values: unknown[][]) =>
  call(`${BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values }),
  });

export const appendRow = (spreadsheetId: string, range: string, values: unknown[][]) =>
  call(`${BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
    method: 'POST',
    body: JSON.stringify({ values }),
  });

export const clearRange = (spreadsheetId: string, range: string) =>
  call(`${BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}:clear`, { method: 'POST' });
```
- [ ] **Step 2:** Commit `feat(google): Sheets API wrapper`

### Task 3.2: Drive API wrapper (permessi read-only)

**Files:**
- Create: `src/lib/google/drive.ts`

- [ ] **Step 1:**
```ts
import { useAuth } from '../../store/auth';

const DRIVE = 'https://www.googleapis.com/drive/v3';

const call = async <T = unknown>(url: string, init: RequestInit = {}): Promise<T> => {
  const t = useAuth.getState().accessToken;
  if (!t) throw new Error('No access token');
  const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json', ...(init.headers || {}) } });
  if (!res.ok) throw new Error(`Drive API ${res.status}: ${await res.text()}`);
  return res.json();
};

export const getFileMetadata = (fileId: string) =>
  call<{ id: string; name: string; capabilities: { canEdit: boolean } }>(`${DRIVE}/files/${fileId}?fields=id,name,capabilities(canEdit)`);

export const listCdbSheets = () =>
  call<{ files: { id: string; name: string }[] }>(`${DRIVE}/files?q=${encodeURIComponent("name='Cuore di Bosco - Prenotazioni' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false")}&fields=files(id,name)`);
```
- [ ] **Step 2:** Commit `feat(google): Drive API wrapper for permissions and listing`

### Task 3.3: Row ↔ object adapter

**Files:**
- Create: `src/lib/google/adapter.ts`, `tests/lib/adapter.test.ts`

- [ ] **Step 1 (TDD test):**
```ts
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
```
- [ ] **Step 2:** Run test → fails. Then implement `src/lib/google/adapter.ts`:
```ts
import type { Prenotazione, Chiusura, Promemoria, Camera, Stato, ContattoVia, AnticipoTipo } from '../../types';

export const BOOKING_HEADERS = [
  'id','camera','checkin','checkout','stato','nome','riferimento','num_ospiti',
  'contatto_via','contatto_valore','prezzo_totale','anticipo_importo','anticipo_data','anticipo_tipo',
  'note','creato_il','aggiornato_il',
] as const;

export const CLOSURE_HEADERS = ['id','start','end','note'] as const;
export const PROMEMORIA_HEADERS = ['id','testo','created_at','done'] as const;

const opt = (s: string | undefined) => s ?? '';
const optN = (n: number | undefined) => n != null ? String(n) : '';

export const bookingToRow = (b: Prenotazione): string[] => [
  b.id, b.camera, b.checkin, b.checkout, b.stato, b.nome, opt(b.riferimento), optN(b.numOspiti),
  opt(b.contattoVia), opt(b.contattoValore), optN(b.prezzoTotale),
  optN(b.anticipo?.importo), opt(b.anticipo?.data), opt(b.anticipo?.tipo),
  opt(b.note), b.creatoIl, b.aggiornatoIl,
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
    creatoIl: r[15], aggiornatoIl: r[16],
  };
};

export const closureToRow = (c: Chiusura): string[] => [c.id, c.start, c.end, opt(c.note)];
export const rowToClosure = (r: string[]): Chiusura => ({
  id: r[0], start: r[1], end: r[2], note: r[3] || undefined,
});

export const promemoriaToRow = (p: Promemoria): string[] => [p.id, p.testo, p.createdAt, p.done ? '1' : '0'];
export const rowToPromemoria = (r: string[]): Promemoria => ({
  id: r[0], testo: r[1], createdAt: r[2], done: r[3] === '1',
});
```
- [ ] **Step 3:** Run test → green. Commit `feat(google): row adapter with round-trip tests`

### Task 3.4: Bootstrap spreadsheet

**Files:**
- Create: `src/lib/google/bootstrap.ts`

- [ ] **Step 1:**
```ts
import { createSpreadsheet, writeRange } from './sheets';
import { listCdbSheets } from './drive';
import { BOOKING_HEADERS, CLOSURE_HEADERS, PROMEMORIA_HEADERS } from './adapter';

export const SHEET_NAMES = ['prenotazioni','chiusure','promemoria','impostazioni'];

export const getOrCreateSheet = async (): Promise<string> => {
  const existing = await listCdbSheets();
  if (existing.files?.length) return existing.files[0].id;

  const res = await createSpreadsheet('Cuore di Bosco - Prenotazioni', SHEET_NAMES);
  // header row in ogni tab
  await writeRange(res.spreadsheetId, 'prenotazioni!A1', [ [...BOOKING_HEADERS] ]);
  await writeRange(res.spreadsheetId, 'chiusure!A1', [ [...CLOSURE_HEADERS] ]);
  await writeRange(res.spreadsheetId, 'promemoria!A1', [ [...PROMEMORIA_HEADERS] ]);
  await writeRange(res.spreadsheetId, 'impostazioni!A1', [ ['chiave','valore'], ['anticipo_default_pct','0.35'] ]);
  return res.spreadsheetId;
};
```
- [ ] **Step 2:** Commit `feat(google): spreadsheet bootstrap`

---

## Phase 4 — IndexedDB cache + sync orchestrator

### Task 4.1: IndexedDB wrapper

**Files:**
- Create: `src/lib/idb.ts`

- [ ] **Step 1:**
```ts
import { openDB, type IDBPDatabase } from 'idb';

const DB = 'cdb_cache';
const VERSION = 1;

let dbP: Promise<IDBPDatabase> | null = null;
const db = () => dbP ??= openDB(DB, VERSION, {
  upgrade(d) {
    ['bookings','closures','promemoria','settings'].forEach(s => {
      if (!d.objectStoreNames.contains(s)) d.createObjectStore(s);
    });
  },
});

export const idbGet = async <T = unknown>(store: string, key: string): Promise<T | undefined> => (await db()).get(store, key);
export const idbSet = async (store: string, key: string, val: unknown): Promise<void> => { await (await db()).put(store, val, key); };
export const idbDel = async (store: string, key: string): Promise<void> => { await (await db()).delete(store, key); };
```
- [ ] **Step 2:** Commit `feat(cache): IndexedDB wrapper`

### Task 4.2: Sync store

**Files:**
- Create: `src/store/sync.ts`

- [ ] **Step 1:**
```ts
import { create } from 'zustand';
import type { SyncStatus, PendingOp } from '../types';

interface State {
  status: SyncStatus;
  queue: PendingOp[];
  spreadsheetId: string | null;
  setStatus: (s: SyncStatus) => void;
  setSpreadsheetId: (id: string) => void;
  enqueue: (op: PendingOp) => void;
  removeOp: (id: string) => void;
  setQueue: (q: PendingOp[]) => void;
}

export const useSync = create<State>((set, get) => ({
  status: 'unauth',
  queue: [],
  spreadsheetId: null,
  setStatus: (status) => set({ status }),
  setSpreadsheetId: (spreadsheetId) => set({ spreadsheetId }),
  enqueue: (op) => set({ queue: [...get().queue, op] }),
  removeOp: (id) => set({ queue: get().queue.filter(o => o.id !== id) }),
  setQueue: (queue) => set({ queue }),
}));
```
- [ ] **Step 2:** Commit `feat(store): sync status and queue`

### Task 4.3: Sync orchestrator

**Files:**
- Create: `src/lib/sync.ts`

Questo è il cuore della sincronizzazione. Logica:
1. **Al login + bootstrap**: leggi tutto dal foglio, popola cache IDB, popola store Zustand.
2. **Su ogni modifica**: aggiorna store + cache + enqueue operazione.
3. **Loop di processing queue**: ogni 3 secondi (o on-demand dopo enqueue), se online e con token, processa in ordine.
4. **Pull periodico**: ogni 60 secondi refresh da Sheets (tolleriamo eventual consistency: se qualcuno modifica via browser del foglio, vediamo la modifica al prossimo pull).

- [ ] **Step 1:**
```ts
import { readRange, writeRange, appendRow, clearRange } from './google/sheets';
import { getFileMetadata } from './google/drive';
import { getOrCreateSheet } from './google/bootstrap';
import {
  BOOKING_HEADERS, CLOSURE_HEADERS, PROMEMORIA_HEADERS,
  bookingToRow, rowToBooking, closureToRow, rowToClosure, promemoriaToRow, rowToPromemoria,
} from './google/adapter';
import { useBookings } from '../store/bookings';
import { useClosures } from '../store/closures';
import { usePromemoria } from '../store/promemoria';
import { useAuth } from '../store/auth';
import { useSync } from '../store/sync';
import { idbGet, idbSet } from './idb';
import { uid } from './id';
import type { Prenotazione, Chiusura, Promemoria, PendingOp } from '../types';

const QUEUE_KEY = 'queue';

const loadQueue = async () => {
  const q = await idbGet<PendingOp[]>('settings', QUEUE_KEY);
  if (q) useSync.getState().setQueue(q);
};
const persistQueue = async () => idbSet('settings', QUEUE_KEY, useSync.getState().queue);

export const enqueue = async (kind: PendingOp['kind'], payload: unknown) => {
  const op: PendingOp = { id: uid('op'), kind, payload, createdAt: new Date().toISOString() };
  useSync.getState().enqueue(op);
  await persistQueue();
  void processQueue();
};

const processQueue = async () => {
  const { spreadsheetId, queue, status } = useSync.getState();
  if (!spreadsheetId || status === 'syncing' || status === 'offline' || status === 'unauth') return;
  if (queue.length === 0) { useSync.getState().setStatus('idle'); return; }

  useSync.getState().setStatus('syncing');
  for (const op of [...queue]) {
    try {
      await applyOp(spreadsheetId, op);
      useSync.getState().removeOp(op.id);
      await persistQueue();
    } catch (e) {
      // se è errore di rete → offline; altrimenti error
      if (!navigator.onLine) useSync.getState().setStatus('offline');
      else useSync.getState().setStatus('error');
      return;
    }
  }
  useSync.getState().setStatus('idle');
};

const applyOp = async (sid: string, op: PendingOp) => {
  // strategia semplice: rewrite dell'intera tab quando cambia qualcosa.
  // Per 200 righe all'anno è accettabile e garantisce consistency.
  if (op.kind.startsWith('upsert_booking') || op.kind.startsWith('delete_booking')) {
    const items = useBookings.getState().items.map(bookingToRow);
    await clearRange(sid, 'prenotazioni!A2:Z');
    if (items.length) await writeRange(sid, 'prenotazioni!A2', items);
  } else if (op.kind.includes('closure')) {
    const items = useClosures.getState().items.map(closureToRow);
    await clearRange(sid, 'chiusure!A2:Z');
    if (items.length) await writeRange(sid, 'chiusure!A2', items);
  } else if (op.kind.includes('promemoria')) {
    const items = usePromemoria.getState().items.map(promemoriaToRow);
    await clearRange(sid, 'promemoria!A2:Z');
    if (items.length) await writeRange(sid, 'promemoria!A2', items);
  }
};

export const fullPull = async () => {
  const { spreadsheetId } = useSync.getState();
  if (!spreadsheetId) return;
  useSync.getState().setStatus('syncing');
  try {
    const [b, c, p] = await Promise.all([
      readRange(spreadsheetId, 'prenotazioni!A2:Z'),
      readRange(spreadsheetId, 'chiusure!A2:Z'),
      readRange(spreadsheetId, 'promemoria!A2:Z'),
    ]);
    const bookings = (b.values || []).filter(r => r[0]).map(rowToBooking);
    const closures = (c.values || []).filter(r => r[0]).map(rowToClosure);
    const promemoria = (p.values || []).filter(r => r[0]).map(rowToPromemoria);
    useBookings.setState({ items: bookings });
    useClosures.setState({ items: closures });
    usePromemoria.setState({ items: promemoria });
    await Promise.all([
      idbSet('bookings', 'all', bookings),
      idbSet('closures', 'all', closures),
      idbSet('promemoria', 'all', promemoria),
    ]);
    useSync.getState().setStatus('idle');
  } catch {
    if (!navigator.onLine) useSync.getState().setStatus('offline');
    else useSync.getState().setStatus('error');
  }
};

export const hydrateFromCache = async () => {
  const [b, c, p] = await Promise.all([
    idbGet<Prenotazione[]>('bookings', 'all'),
    idbGet<Chiusura[]>('closures', 'all'),
    idbGet<Promemoria[]>('promemoria', 'all'),
  ]);
  if (b) useBookings.setState({ items: b });
  if (c) useClosures.setState({ items: c });
  if (p) usePromemoria.setState({ items: p });
};

export const bootSync = async () => {
  await loadQueue();
  await hydrateFromCache();
  const sid = await getOrCreateSheet();
  useSync.getState().setSpreadsheetId(sid);
  // check readonly
  const meta = await getFileMetadata(sid);
  useAuth.getState().setReadonly(!meta.capabilities.canEdit);
  await fullPull();
  void processQueue();
  // pull periodico
  setInterval(() => void fullPull(), 60_000);
  // processing queue periodico
  setInterval(() => void processQueue(), 3_000);
  // listener online/offline
  window.addEventListener('online', () => { useSync.getState().setStatus('idle'); void processQueue(); });
  window.addEventListener('offline', () => useSync.getState().setStatus('offline'));
};
```

- [ ] **Step 2:** Commit `feat(sync): orchestrator with cache, queue, periodic pull`

---

## Phase 5 — Integrazione stores ↔ sync

### Task 5.1: Wrap store mutations per enqueue automatico

**Files:**
- Modify: `src/store/bookings.ts`, `closures.ts`, `promemoria.ts`

Approccio: intercetta `add/update/remove` per richiamare `enqueue(...)` dopo la modifica locale. Rimuovi il middleware `persist` (non più utile — ora cache è in IDB, persist scrive in Sheets).

- [ ] **Step 1: Modifica `bookings.ts`:**

```ts
import { create } from 'zustand';
import type { Prenotazione } from '../types';
import { uid } from '../lib/id';

// lazy import per evitare cicli
const enq = async (kind: 'upsert_booking' | 'delete_booking', payload: unknown) => {
  const { enqueue } = await import('../lib/sync');
  void enqueue(kind, payload);
};

interface State {
  items: Prenotazione[];
  add: (b: Omit<Prenotazione, 'id'|'creatoIl'|'aggiornatoIl'>) => Prenotazione;
  update: (id: string, patch: Partial<Prenotazione>) => void;
  remove: (id: string) => void;
}

export const useBookings = create<State>((set, get) => ({
  items: [],
  add: (b) => {
    const now = new Date().toISOString();
    const item: Prenotazione = { ...b, id: uid('b'), creatoIl: now, aggiornatoIl: now };
    set({ items: [...get().items, item] });
    void enq('upsert_booking', item);
    return item;
  },
  update: (id, patch) => {
    set({ items: get().items.map(b => b.id === id ? { ...b, ...patch, aggiornatoIl: new Date().toISOString() } : b) });
    const updated = get().items.find(b => b.id === id);
    if (updated) void enq('upsert_booking', updated);
  },
  remove: (id) => {
    set({ items: get().items.filter(b => b.id !== id) });
    void enq('delete_booking', { id });
  },
}));
```

Nota: test `bookings.test.ts` esistente continua a passare perché `enqueue` è dinamico e fallisce silent senza spreadsheetId — questo è OK in test environment dove non c'è sync.

- [ ] **Step 2:** Analogamente per `closures.ts` (kind `upsert_closure`/`delete_closure`, prefix `c`) e `promemoria.ts` (kind `upsert_promemoria`/`delete_promemoria`, prefix `p`, rimuovendo persist).

- [ ] **Step 3:** Rimuovi i MOCK dal `main.tsx` (ora i dati vengono da Sheets):

Sostituisci `main.tsx` con:
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

Elimina anche `src/data/mock.ts` (non più necessario).

- [ ] **Step 4:** Verifica `npm run test` — 18 test ancora verdi (i test non usano sync).

- [ ] **Step 5:** Commit `feat(store): integrate stores with sync queue, remove persist middleware`

---

## Phase 6 — UI: gate auth + indicatori

### Task 6.1: SyncIndicator

**Files:**
- Create: `src/components/SyncIndicator.tsx`

- [ ] **Step 1:**
```tsx
import { useSync } from '../store/sync';
import { fullPull } from '../lib/sync';

const LABEL = {
  idle: { icon:'🟢', text:'Sincronizzato' },
  syncing: { icon:'🟡', text:'Sincronizzazione…' },
  offline: { icon:'🔴', text:'Offline' },
  error: { icon:'⚠️', text:'Errore' },
  unauth: { icon:'🔒', text:'Non connesso' },
} as const;

export const SyncIndicator = () => {
  const { status, queue } = useSync();
  const l = LABEL[status];
  return (
    <button className="btn btn-ghost !p-2 text-xs" title={`${l.text}${queue.length ? ` · ${queue.length} in coda` : ''}`}
      onClick={() => void fullPull()}>
      {l.icon}{queue.length > 0 && <span className="ml-1">{queue.length}</span>}
    </button>
  );
};
```

- [ ] **Step 2:** Aggiungi `<SyncIndicator />` nella `Topbar.tsx` e `Home.tsx` (accanto al ThemeToggle).

- [ ] **Step 3:** Commit `feat(ui): SyncIndicator pill with queue count`

### Task 6.2: ReadOnlyBanner

**Files:**
- Create: `src/components/ReadOnlyBanner.tsx`

- [ ] **Step 1:**
```tsx
import { useAuth } from '../store/auth';

export const ReadOnlyBanner = () => {
  const readonly = useAuth(s => s.readonly);
  if (!readonly) return null;
  return (
    <div className="px-4 py-2 text-[12px]" style={{ background:'var(--banner-bg)', color:'var(--banner-text)', borderBottom:'1px solid var(--banner-border)' }}>
      👁️ <b>Sola visualizzazione</b> — non hai i permessi di modifica su questo calendario.
    </div>
  );
};
```

- [ ] **Step 2:** Nel `CalendarPage.tsx` aggiungi `<ReadOnlyBanner />` sotto la topbar.

- [ ] **Step 3:** Modifica BottomBar, BookingForm, ClosureForm, DayDetailPanel, TodoPanel: nascondi bottoni di modifica quando `useAuth(s => s.readonly)` è true.

Esempio per `BottomBar`:
```tsx
const readonly = useAuth(s => s.readonly);
// ...
{!readonly && <button className="btn btn-ghost" title="Chiusura" onClick={() => openModal({ kind: 'closure' })}>🔒</button>}
{!readonly && <button className="btn btn-primary" onClick={() => openModal({ kind: 'booking', prefillCheckin: today })}>➕ <span className="lbl">Nuova</span></button>}
```

Analogamente: `DayDetailPanel` nasconde "Nuova prenotazione"; `BookingForm/ClosureForm` disabilita `<form>` se `readonly` (o meglio: non mostrarli proprio — se readonly li blocchiamo a monte nella CalendarPage).

- [ ] **Step 4:** Commit `feat(ui): read-only mode with banner and hidden edit buttons`

### Task 6.3: Gate auth + bootstrap sync in `App.tsx`

**Files:**
- Modify: `src/App.tsx`, `src/main.tsx`

- [ ] **Step 1: Sostituisci `App.tsx`:**
```tsx
import { useEffect } from 'react';
import { useAuth } from './store/auth';
import { useUI } from './store/ui';
import { Home } from './components/Home';
import { CalendarPage } from './components/calendar/CalendarPage';
import { SignIn } from './components/SignIn';
import { initAuth, startTokenAutoRefresh } from './lib/google/auth';
import { bootSync } from './lib/sync';

export default function App() {
  const user = useAuth(s => s.user);
  const page = useUI(s => s.page);

  useEffect(() => {
    void initAuth().then(startTokenAutoRefresh);
  }, []);

  useEffect(() => {
    if (user) void bootSync();
  }, [user]);

  if (!user) return <SignIn />;
  return page === 'home' ? <Home /> : <CalendarPage />;
}
```

- [ ] **Step 2:** Verifica `npm run dev` — vedi schermata SignIn, click "Accedi con Google" apre il popup OAuth (richiede aver fatto Phase 0 manualmente).

- [ ] **Step 3:** Commit `feat(app): auth gate and sync bootstrap`

---

## Phase 7 — Verifica finale

### Task 7.1: Test suite

- [ ] **Step 1:** `cd app && npm run test` — devono essere **21 test verdi** (18 preesistenti + 3 nuovi adapter).
- [ ] **Step 2:** `npx tsc --noEmit` → 0 errori.
- [ ] **Step 3:** `npm run build` → OK.

### Task 7.2: Smoke test manuale (golden path)

- [ ] **Step 1:** `npm run dev` (con `.env.local` configurato)
- [ ] **Step 2:** Flusso:
  1. Apri browser → vedi SignIn
  2. Login Google → popup, autorizza
  3. Attende bootstrap → crea foglio "Cuore di Bosco - Prenotazioni" su Drive (verifica che appaia su [drive.google.com](https://drive.google.com))
  4. Vedi calendario vuoto (è nuovo)
  5. Crea una prenotazione → dopo ~2 secondi controlla nel foglio Google: appare la riga
  6. Modifica la prenotazione → foglio si aggiorna
  7. Elimina → foglio la perde
  8. Ricarica la pagina → dati persistono (pull da sheets)
  9. Condividi il foglio Drive con altro account Google in **sola lettura**
  10. Da incognito, login con quell'account → vedi banner "Sola visualizzazione", bottoni ➕/🔒 nascosti
  11. Spegni WiFi → crea una prenotazione → vedi 🔴 Offline + badge coda
  12. Accendi WiFi → vedi 🟡 → 🟢, badge coda azzerato, foglio sincronizzato

### Task 7.3: Tag + commit

- [ ] **Step 1:**
```bash
git tag -a v0.2.0-piano-B -m "Piano B milestone: Google Sheets sync + read-only mode"
```

---

## Definition of Done — Piano B

✅ Login Google richiesto all'avvio
✅ Al primo login, foglio creato automaticamente su Drive dell'utente
✅ Ogni modifica locale sincronizzata su Sheets entro 3 secondi
✅ Pull periodico ogni 60 secondi (modifiche esterne visibili)
✅ Cache IndexedDB rende l'app aperta-bile offline
✅ Queue offline: modifiche fatte senza rete partono al ritorno online
✅ Indicatore sync sempre visibile (🟢/🟡/🔴)
✅ Utenti con permesso `reader` vedono il calendario in sola lettura
✅ Tutti i 21 test verdi, tsc 0 errori, build OK
✅ Tag `v0.2.0-piano-B`

**Cosa NON è ancora fatto** (Piano C):
- Installazione PWA (manifest + icone + service worker)
- Deploy pubblico GitHub Pages
- Offline "vero" (service worker per cache dell'app shell)
