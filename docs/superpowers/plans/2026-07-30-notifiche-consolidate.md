# Notifiche consolidate — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sostituire le notifiche OS "a raffica" (una per task scaduto) con un'unica notifica di riepilogo generata solo in background, e dare all'utente una vista in-app (banner Home + pannello "Da fare") per vedere e spuntare i promemoria automatici scaduti senza dipendere dalla notifica.

**Architecture:** Due helper puri e testabili (`overdueTasks`, `buildDigestNotification`) sostituiscono la logica finora incorporata nel service worker e nel foreground scheduler. Il service worker chiama `buildDigestNotification` per emettere una sola `showNotification`. Il foreground scheduler (`lib/notifications/foregroundScheduler.ts` + l'effect in `App.tsx`) viene rimosso del tutto — non genera più notifiche OS proprie, dato che ad app aperta l'utente vede già il banner reattivo in Home.

**Tech Stack:** React + TypeScript, Zustand (`useTasks`, `useBookings`), Vitest + Testing Library, Service Worker (`sw.ts`) con Workbox.

## Global Constraints

- Tutti i test esistenti (`npx vitest run` in `app/`) devono continuare a passare dopo ogni task.
- `npx tsc --noEmit` e `npx eslint src/` puliti prima di ogni commit.
- Testo UI in italiano, coerente con il resto dell'app (vedi `BookingForm.tsx`, `TodoPanel.tsx` per tono/stile).
- Commit Conventional Commits (`feat`, `fix`, `refactor`, `test`, `docs`), un commit per task.
- Spec di riferimento: [docs/superpowers/specs/2026-07-30-notifiche-consolidate-design.md](../specs/2026-07-30-notifiche-consolidate-design.md).

---

### Task 1: Helper `overdueTasks`

**Files:**
- Create: `app/src/lib/reminders/overdueTasks.ts`
- Test: `app/tests/lib/reminders/overdueTasks.test.ts`

**Interfaces:**
- Consumes: `BookingTask` da `app/src/types.ts` (campi usati: `done`, `deletedAt`, `dueAt`, `notificationStatus`).
- Produces: `overdueTasks(tasks: BookingTask[], now: Date): BookingTask[]` — usata nei task 5, 6, 7.

- [ ] **Step 1: Scrivi il test che fallisce**

`app/tests/lib/reminders/overdueTasks.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { overdueTasks } from '../../../src/lib/reminders/overdueTasks';
import type { BookingTask } from '../../../src/types';

const t = (over: Partial<BookingTask>): BookingTask => ({
  id: 'a', bookingId: 'b1', templateId: null, title: 'X',
  dueAt: '2026-05-04T08:00:00.000Z', done: false, notify: true,
  notificationStatus: 'pending', isService: false,
  createdAt: '2026-05-01T00:00:00.000Z', updatedAt: '2026-05-01T00:00:00.000Z',
  ...over,
});

describe('overdueTasks', () => {
  const now = new Date('2026-05-04T10:00:00.000Z');

  it('include un task scaduto e non fatto', () => {
    const result = overdueTasks([t({ id: '1' })], now);
    expect(result.map(x => x.id)).toEqual(['1']);
  });

  it('esclude i task non ancora scaduti', () => {
    const result = overdueTasks([t({ id: '1', dueAt: '2026-05-04T12:00:00.000Z' })], now);
    expect(result).toEqual([]);
  });

  it('esclude i task gia fatti', () => {
    const result = overdueTasks([t({ id: '1', done: true })], now);
    expect(result).toEqual([]);
  });

  it('esclude i task eliminati', () => {
    const result = overdueTasks([t({ id: '1', deletedAt: '2026-05-03T00:00:00.000Z' })], now);
    expect(result).toEqual([]);
  });

  it('include un task scaduto anche se gia notificato (notificationStatus shown)', () => {
    const result = overdueTasks([t({ id: '1', notificationStatus: 'shown' })], now);
    expect(result.map(x => x.id)).toEqual(['1']);
  });
});
```

- [ ] **Step 2: Esegui il test e verifica che fallisca**

Run: `cd app && npx vitest run tests/lib/reminders/overdueTasks.test.ts`
Expected: FAIL — `Cannot find module '../../../src/lib/reminders/overdueTasks'`

- [ ] **Step 3: Implementa**

`app/src/lib/reminders/overdueTasks.ts`:
```ts
import type { BookingTask } from '../../types';

export const overdueTasks = (tasks: BookingTask[], now: Date): BookingTask[] =>
  tasks.filter(t => !t.done && !t.deletedAt && new Date(t.dueAt).getTime() <= now.getTime());
```

- [ ] **Step 4: Esegui il test e verifica che passi**

Run: `cd app && npx vitest run tests/lib/reminders/overdueTasks.test.ts`
Expected: PASS (5 test)

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/reminders/overdueTasks.ts app/tests/lib/reminders/overdueTasks.test.ts
git commit -m "feat(reminders): aggiungi helper overdueTasks per i promemoria scaduti"
```

---

### Task 2: Helper `buildDigestNotification`

**Files:**
- Create: `app/src/lib/reminders/buildDigest.ts`
- Test: `app/tests/lib/reminders/buildDigest.test.ts`

**Interfaces:**
- Consumes: `BookingTask` (campo `title`).
- Produces: `interface DigestNotification { title: string; body: string }` e `buildDigestNotification(tasks: BookingTask[]): DigestNotification` — usata nel Task 3 (`sw.ts`).

- [ ] **Step 1: Scrivi il test che fallisce**

`app/tests/lib/reminders/buildDigest.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { buildDigestNotification } from '../../../src/lib/reminders/buildDigest';
import type { BookingTask } from '../../../src/types';

const t = (over: Partial<BookingTask>): BookingTask => ({
  id: 'a', bookingId: 'b1', templateId: null, title: 'X',
  dueAt: '2026-05-04T08:00:00.000Z', done: false, notify: true,
  notificationStatus: 'pending', isService: false,
  createdAt: '2026-05-01T00:00:00.000Z', updatedAt: '2026-05-01T00:00:00.000Z',
  ...over,
});

describe('buildDigestNotification', () => {
  it('usa il singolare per un solo task', () => {
    const { title, body } = buildDigestNotification([t({ title: 'Richiedi documenti' })]);
    expect(title).toBe('1 promemoria da controllare');
    expect(body).toBe('Richiedi documenti');
  });

  it('usa il plurale ed elenca tutti i titoli se sono 3 o meno', () => {
    const tasks = [t({ id: '1', title: 'A' }), t({ id: '2', title: 'B' }), t({ id: '3', title: 'C' })];
    const { title, body } = buildDigestNotification(tasks);
    expect(title).toBe('3 promemoria da controllare');
    expect(body).toBe('A, B, C');
  });

  it('tronca a 3 titoli e conta i restanti', () => {
    const tasks = ['A', 'B', 'C', 'D', 'E'].map((title, i) => t({ id: String(i), title }));
    const { title, body } = buildDigestNotification(tasks);
    expect(title).toBe('5 promemoria da controllare');
    expect(body).toBe('A, B, C e altri 2');
  });
});
```

- [ ] **Step 2: Esegui il test e verifica che fallisca**

Run: `cd app && npx vitest run tests/lib/reminders/buildDigest.test.ts`
Expected: FAIL — modulo non trovato

- [ ] **Step 3: Implementa**

`app/src/lib/reminders/buildDigest.ts`:
```ts
import type { BookingTask } from '../../types';

export interface DigestNotification {
  title: string;
  body: string;
}

export const buildDigestNotification = (tasks: BookingTask[]): DigestNotification => {
  const n = tasks.length;
  const title = n === 1 ? '1 promemoria da controllare' : `${n} promemoria da controllare`;
  const preview = tasks.slice(0, 3).map(t => t.title);
  const remaining = n - preview.length;
  const body = remaining > 0 ? `${preview.join(', ')} e altri ${remaining}` : preview.join(', ');
  return { title, body };
};
```

- [ ] **Step 4: Esegui il test e verifica che passi**

Run: `cd app && npx vitest run tests/lib/reminders/buildDigest.test.ts`
Expected: PASS (3 test)

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/reminders/buildDigest.ts app/tests/lib/reminders/buildDigest.test.ts
git commit -m "feat(reminders): aggiungi helper buildDigestNotification per il riepilogo"
```

---

### Task 3: Service worker — una sola notifica di riepilogo

**Files:**
- Modify: `app/src/sw.ts:37-60` (gestore `periodicsync`)

**Interfaces:**
- Consumes: `buildDigestNotification` dal Task 2, `pickToNotify` esistente (invariato).
- Produces: nessuna nuova interfaccia pubblica — comportamento runtime del SW.

Nota: il gestore `periodicsync` usa `self`/`ServiceWorkerGlobalScope`, non testabile in jsdom — coerente con `app/tests/lib/sw/periodicSync.test.ts` esistente, che testa la logica di dedup (`pickToNotify`) manipolando IndexedDB direttamente invece di invocare l'event listener. Questo task non aggiunge test per `sw.ts` stesso (nessuno esisteva prima); la parte nuova e testabile (`buildDigestNotification`) è già coperta dal Task 2.

- [ ] **Step 1: Modifica `sw.ts`**

Aggiungi l'import in cima al file (dopo la riga `import { pickToNotify } from './lib/reminders/pickToNotify';`):
```ts
import { buildDigestNotification } from './lib/reminders/buildDigest';
```

Sostituisci il blocco (righe 45-51 attuali):
```ts
    const nowIso = new Date().toISOString();
    for (const t of overdue) {
      await self.registration.showNotification(t.title, {
        body: t.notes,
        tag: t.id,
        data: { bookingId: t.bookingId, taskId: t.id },
      });
    }
```
con:
```ts
    const nowIso = new Date().toISOString();
    const { title, body } = buildDigestNotification(overdue);
    await self.registration.showNotification(title, {
      body,
      tag: 'overdue-digest',
      data: {},
    });
```

Il resto del gestore (marcatura `notificationStatus: 'shown'` su tutti i task in `overdue`, `writeTasks(updated)`) resta invariato.

- [ ] **Step 2: Verifica tipi e test esistenti**

Run: `cd app && npx tsc --noEmit && npx vitest run tests/lib/sw/periodicSync.test.ts`
Expected: entrambi PASS senza errori (il test esistente non tocca la parte modificata, verifica solo `pickToNotify` + IDB).

- [ ] **Step 3: Commit**

```bash
git add app/src/sw.ts
git commit -m "fix(notifications): consolida le notifiche di background in un unico riepilogo"
```

---

### Task 4: Rimuovi le notifiche in foreground

**Files:**
- Delete: `app/src/lib/notifications/foregroundScheduler.ts`
- Delete: `app/tests/lib/notifications/foregroundScheduler.test.ts`
- Modify: `app/src/App.tsx:16` (rimuovi import), `app/src/App.tsx:63-86` (rimuovi l'intero `useEffect`)

**Interfaces:**
- Nessuna — questo task rimuove codice, non ne aggiunge.

- [ ] **Step 1: Elimina modulo e test**

```bash
git rm app/src/lib/notifications/foregroundScheduler.ts app/tests/lib/notifications/foregroundScheduler.test.ts
```

- [ ] **Step 2: Rimuovi l'import in `App.tsx`**

Rimuovi la riga:
```ts
import { scheduleTask, cancelAll } from './lib/notifications/foregroundScheduler';
```

- [ ] **Step 3: Rimuovi l'effect in `App.tsx`**

Rimuovi interamente questo blocco (subito dopo `useFirestoreSync(uid);` e prima di `if (!user) return <SignIn />;`):
```tsx
  useEffect(() => {
    const onShown = (taskId: string) =>
      useTasks.getState().update(taskId, {
        notificationStatus: 'shown',
        notificationShownAt: new Date().toISOString(),
      });
    const reschedule = () => {
      cancelAll();
      const all = useTasks.getState().items;
      all.forEach(t => scheduleTask(t, onShown));
    };
    reschedule();
    const unsub = useTasks.subscribe(reschedule);
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') cancelAll();
      else reschedule();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      unsub();
      document.removeEventListener('visibilitychange', onVisibility);
      cancelAll();
    };
  }, []);
```

Non toccare l'altro `useEffect` (righe 22-49) che usa `useTasks.setState` e `idbGet` — resta necessario per idratare i task da IndexedDB all'avvio, e continua a usare gli import `useTasks`/`BookingTask` già presenti.

- [ ] **Step 4: Verifica tipi e suite completa**

Run: `cd app && npx tsc --noEmit && npx vitest run`
Expected: nessun errore di tipo (nessun riferimento pendente a `foregroundScheduler`), tutti i test rimanenti PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/App.tsx
git commit -m "refactor(notifications): rimuovi le notifiche OS in foreground

Ridondanti quando l'app e' gia' aperta (l'utente vede il banner in Home)
ed erano la causa della tempesta di reschedule a ogni mutazione dello
store dei task."
```

---

### Task 5: Banner "promemoria scaduti" in Home

**Files:**
- Modify: `app/src/components/Home.tsx`
- Test: `app/tests/components/Home.test.tsx` (esteso)

**Interfaces:**
- Consumes: `overdueTasks` dal Task 1, `useTasks` da `app/src/store/tasks.ts`, `useUI` (già presente: `goCalendar`, `openSide`).
- Produces: nessuna nuova interfaccia — solo UI.

- [ ] **Step 1: Scrivi i test che falliscono**

Aggiungi in cima a `app/tests/components/Home.test.tsx` l'import:
```ts
import { fireEvent } from '@testing-library/react';
import { useTasks } from '../../src/store/tasks';
import type { BookingTask } from '../../src/types';
```
(unisci `fireEvent` all'import esistente da `@testing-library/react` invece di duplicare la riga.)

Aggiungi nel `beforeEach` esistente, dopo `useUI.setState(...)`:
```ts
    useTasks.setState({ items: [] });
```

Aggiungi in fondo al file, dentro `describe('Home', ...)`, un helper e tre nuovi test:
```ts
const overdueTask = (over: Partial<BookingTask>): BookingTask => ({
  id: 't1', bookingId: 'b1', templateId: null, title: 'Richiedi documenti',
  dueAt: '2020-01-01T08:00:00.000Z', done: false, notify: true,
  notificationStatus: 'pending', isService: false,
  createdAt: '2020-01-01T00:00:00.000Z', updatedAt: '2020-01-01T00:00:00.000Z',
  ...over,
});

it('non mostra il banner scaduti se non ci sono task scaduti', () => {
  render(<Home />);
  expect(screen.queryByText(/promemoria scadut/i)).toBeNull();
});

it('mostra il banner scaduti con il conteggio corretto', () => {
  useTasks.setState({ items: [overdueTask({})] });
  render(<Home />);
  expect(screen.getByText(/1 promemoria scaduto/i)).toBeInTheDocument();
});

it('il click sul banner scaduti apre il calendario sul pannello Da fare', () => {
  useTasks.setState({ items: [overdueTask({})] });
  render(<Home />);
  fireEvent.click(screen.getByText(/1 promemoria scaduto/i));
  expect(useUI.getState().page).toBe('calendar');
  expect(useUI.getState().side).toEqual({ kind: 'todo' });
});
```

- [ ] **Step 2: Esegui i test e verifica che falliscano**

Run: `cd app && npx vitest run tests/components/Home.test.tsx`
Expected: FAIL sui 2 nuovi test che cercano il testo del banner (non esiste ancora).

- [ ] **Step 3: Implementa il banner in `Home.tsx`**

Sostituisci la riga import di React hooks:
```ts
import { useState } from 'react';
```
con:
```ts
import { useState, useEffect } from 'react';
```

Aggiungi dopo l'import di `TemplatesPage`:
```ts
import { useTasks } from '../store/tasks';
import { overdueTasks } from '../lib/reminders/overdueTasks';
```

Dentro il componente, dopo `const [showTemplates, setShowTemplates] = useState(false);` e prima di `if (showTemplates) return ...`:
```ts
  const tasks = useTasks(s => s.items);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);
```

Dopo la riga `const goArrivi = () => { goCalendar(); openSide({ kind: 'arrivi' }); };`, aggiungi:
```ts
  const overdueCount = overdueTasks(tasks, now).length;
  const goOverdue = () => { goCalendar(); openSide({ kind: 'todo' }); };
```

Nel JSX, subito dopo la chiusura di `</div>` di `home-hero` e prima di `<div className="home-buttons">`, aggiungi:
```tsx
        {overdueCount > 0 && (
          <button
            className="text-left text-[13px] font-medium rounded-xl px-4 py-3 mb-4"
            style={{ background: 'var(--banner-bg)', color: 'var(--banner-text)', border: 'none', cursor: 'pointer', width: 'min(420px,100%)' }}
            onClick={goOverdue}
          >
            ⚠️ {overdueCount} promemoria scadut{overdueCount === 1 ? 'o' : 'i'} da controllare
          </button>
        )}
```

- [ ] **Step 4: Esegui i test e verifica che passino**

Run: `cd app && npx vitest run tests/components/Home.test.tsx`
Expected: PASS (6 test totali nel file: 3 esistenti + 3 nuovi)

- [ ] **Step 5: Commit**

```bash
git add app/src/components/Home.tsx app/tests/components/Home.test.tsx
git commit -m "feat(home): mostra banner promemoria scaduti con link al pannello Da fare"
```

---

### Task 6: Sezione "Promemoria scaduti" nel pannello Da fare

**Files:**
- Modify: `app/src/components/panels/TodoPanel.tsx`
- Test: `app/tests/components/TodoPanel.test.tsx` (nuovo)

**Interfaces:**
- Consumes: `overdueTasks` dal Task 1, `useTasks` (`items`, `toggleDone`), `useBookings` (già importato in `TodoPanel.tsx`).
- Produces: nessuna nuova interfaccia — solo UI.

- [ ] **Step 1: Scrivi il test che fallisce**

`app/tests/components/TodoPanel.test.tsx`:
```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';

vi.mock('../../src/lib/firebase/auth', () => ({ auth: { currentUser: null } }));
vi.mock('../../src/lib/firebase/db', () => ({
  upsertDoc: vi.fn().mockResolvedValue(undefined),
  removeDoc: vi.fn().mockResolvedValue(undefined),
}));

import { render, screen, fireEvent } from '@testing-library/react';
import { TodoPanel } from '../../src/components/panels/TodoPanel';
import { useBookings } from '../../src/store/bookings';
import { usePromemoria } from '../../src/store/promemoria';
import { useTasks } from '../../src/store/tasks';
import type { BookingTask, Prenotazione } from '../../src/types';

const booking = (over: Partial<Prenotazione>): Prenotazione => ({
  id: 'b1', camera: 'lampone', checkin: '2020-01-01', checkout: '2020-01-02',
  stato: 'confermato', nome: 'Rossi',
  creatoIl: '2020-01-01T00:00:00.000Z', aggiornatoIl: '2020-01-01T00:00:00.000Z',
  ...over,
});

const task = (over: Partial<BookingTask>): BookingTask => ({
  id: 't1', bookingId: 'b1', templateId: null, title: 'Richiedi documenti',
  dueAt: '2020-01-01T08:00:00.000Z', done: false, notify: true,
  notificationStatus: 'pending', isService: false,
  createdAt: '2020-01-01T00:00:00.000Z', updatedAt: '2020-01-01T00:00:00.000Z',
  ...over,
});

describe('TodoPanel - promemoria scaduti', () => {
  beforeEach(() => {
    useBookings.setState({ items: [booking({})] });
    usePromemoria.setState({ items: [] });
    useTasks.setState({ items: [task({})] });
  });

  it('mostra i promemoria scaduti con il nome della prenotazione', () => {
    render(<TodoPanel onClose={() => {}} />);
    expect(screen.getByText(/Richiedi documenti/)).toBeInTheDocument();
    expect(screen.getByText(/Rossi/)).toBeInTheDocument();
  });

  it('non mostra i task gia fatti o non ancora scaduti', () => {
    useTasks.setState({
      items: [
        task({ id: 't2', title: 'Fatto', done: true }),
        task({ id: 't3', title: 'Futuro', dueAt: '2099-01-01T00:00:00.000Z' }),
      ],
    });
    render(<TodoPanel onClose={() => {}} />);
    expect(screen.queryByText(/Fatto/)).toBeNull();
    expect(screen.queryByText(/Futuro/)).toBeNull();
  });

  it('la checkbox del promemoria scaduto chiama toggleDone', () => {
    render(<TodoPanel onClose={() => {}} />);
    fireEvent.click(screen.getByLabelText(/Segna Richiedi documenti/));
    expect(useTasks.getState().items.find(t => t.id === 't1')?.done).toBe(true);
  });
});
```

- [ ] **Step 2: Esegui il test e verifica che fallisca**

Run: `cd app && npx vitest run tests/components/TodoPanel.test.tsx`
Expected: FAIL — il testo "Richiedi documenti" non è renderizzato, `getByLabelText` non trova nulla.

- [ ] **Step 3: Implementa la sezione in `TodoPanel.tsx`**

Aggiungi due import in cima al file:
```ts
import { useTasks } from '../../store/tasks';
import { overdueTasks } from '../../lib/reminders/overdueTasks';
import type { Promemoria, BookingTask } from '../../types';
```
(sostituisci la riga `import type { Promemoria } from '../../types';` esistente con quella sopra, che aggiunge `BookingTask`.)

Dentro il componente, dopo la riga `const { items: promemoria, add, toggle, remove } = usePromemoria();`, aggiungi:
```ts
  const tasks = useTasks(s => s.items);
  const toggleTaskDone = useTasks(s => s.toggleDone);
  const scaduti = overdueTasks(tasks, new Date()).sort((a, b) => a.dueAt.localeCompare(b.dueAt));
```

Dopo la definizione di `PromemoriaCard` (prima del `return`), aggiungi:
```tsx
  const fmtDateTime = (isoStr: string) => {
    const d = new Date(isoStr);
    return d.toLocaleString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  const OverdueTaskRow = ({ t }: { t: BookingTask }) => {
    const b = bookings.find(x => x.id === t.bookingId);
    return (
      <div className="promemoria-card">
        <input type="checkbox" checked={t.done} onChange={() => toggleTaskDone(t.id)} aria-label={`Segna ${t.title}`} />
        <div className="txt">
          {t.title}{b ? ` · ${b.nome}` : ''}
          <div className="meta">{fmtDateTime(t.dueAt)}</div>
        </div>
      </div>
    );
  };
```

Nel JSX, aggiungi la nuova sezione subito dopo il `<form className="quicknote" ...>` e prima del blocco `{open.length > 0 && ...}`:
```tsx
      {scaduti.length > 0 && <>
        <div className="section-title">⏰ Promemoria scaduti ({scaduti.length})</div>
        {scaduti.map(t => <OverdueTaskRow key={t.id} t={t} />)}
      </>}
```

Aggiorna la condizione dello stato vuoto per includere anche `scaduti`:
```tsx
      {open.length + auto.length + done.length + scaduti.length === 0 && (
```

- [ ] **Step 4: Esegui il test e verifica che passi**

Run: `cd app && npx vitest run tests/components/TodoPanel.test.tsx`
Expected: PASS (3 test)

- [ ] **Step 5: Esegui tutta la suite**

Run: `cd app && npx vitest run`
Expected: tutti i test PASS (nessuna regressione su `Home.test.tsx` o altri).

- [ ] **Step 6: Commit**

```bash
git add app/src/components/panels/TodoPanel.tsx app/tests/components/TodoPanel.test.tsx
git commit -m "feat(todo-panel): aggiungi sezione promemoria scaduti con check diretto"
```

---

### Task 7: Includi i promemoria scaduti nel badge "Da fare"

**Files:**
- Modify: `app/src/components/calendar/BottomBar.tsx`
- Test: `app/tests/components/BottomBar.test.tsx` (nuovo)

**Interfaces:**
- Consumes: `overdueTasks` dal Task 1, `useTasks`.
- Produces: nessuna nuova interfaccia — solo UI.

- [ ] **Step 1: Scrivi il test che fallisce**

`app/tests/components/BottomBar.test.tsx`:
```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BottomBar } from '../../src/components/calendar/BottomBar';
import { useBookings } from '../../src/store/bookings';
import { usePromemoria } from '../../src/store/promemoria';
import { useTasks } from '../../src/store/tasks';
import type { BookingTask } from '../../src/types';

const task = (over: Partial<BookingTask>): BookingTask => ({
  id: 't1', bookingId: 'b1', templateId: null, title: 'X',
  dueAt: '2020-01-01T08:00:00.000Z', done: false, notify: true,
  notificationStatus: 'pending', isService: false,
  createdAt: '2020-01-01T00:00:00.000Z', updatedAt: '2020-01-01T00:00:00.000Z',
  ...over,
});

describe('BottomBar - badge Da fare', () => {
  beforeEach(() => {
    useBookings.setState({ items: [] });
    usePromemoria.setState({ items: [] });
    useTasks.setState({ items: [] });
  });

  it('include i promemoria automatici scaduti nel conteggio', () => {
    useTasks.setState({ items: [task({})] });
    render(<BottomBar />);
    expect(screen.getByRole('button', { name: /Da fare/i })).toHaveTextContent('1');
  });

  it('non conta i task non ancora scaduti', () => {
    useTasks.setState({ items: [task({ dueAt: '2099-01-01T00:00:00.000Z' })] });
    render(<BottomBar />);
    expect(screen.getByRole('button', { name: /Da fare/i })).toHaveTextContent('0');
  });
});
```

- [ ] **Step 2: Esegui il test e verifica che fallisca**

Run: `cd app && npx vitest run tests/components/BottomBar.test.tsx`
Expected: FAIL sul primo test (il badge mostra `0` invece di `1`, perché il conteggio non include ancora i task).

- [ ] **Step 3: Implementa in `BottomBar.tsx`**

Aggiungi due import:
```ts
import { useTasks } from '../../store/tasks';
import { overdueTasks } from '../../lib/reminders/overdueTasks';
```

Nel componente, aggiungi dopo `const promemoria = usePromemoria(s => s.items);`:
```ts
  const tasks = useTasks(s => s.items);
```

Aggiorna `todoCount`:
```ts
  const todoCount = bookings.filter(b => b.stato === 'proposta' || b.stato === 'anticipo_atteso').length
    + promemoria.filter(p => !p.done).length
    + overdueTasks(tasks, new Date()).length;
```

- [ ] **Step 4: Esegui il test e verifica che passi**

Run: `cd app && npx vitest run tests/components/BottomBar.test.tsx`
Expected: PASS (2 test)

- [ ] **Step 5: Commit**

```bash
git add app/src/components/calendar/BottomBar.tsx app/tests/components/BottomBar.test.tsx
git commit -m "fix(bottom-bar): includi i promemoria scaduti nel badge Da fare"
```

---

### Task 8: Verifica finale

**Files:** nessuno (solo verifica)

- [ ] **Step 1: Suite completa**

Run: `cd app && npx vitest run`
Expected: tutti i test PASS, nessuna regressione.

- [ ] **Step 2: Type check**

Run: `cd app && npx tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 3: Lint**

Run: `cd app && npx eslint src/`
Expected: nessun errore.

- [ ] **Step 4: Nota per il verificatore umano**

Il comportamento del service worker (`periodicsync`, `showNotification`) non è eseguibile in test automatici (richiede `ServiceWorkerGlobalScope` reale). Prima di considerare il lavoro chiuso end-to-end, segnalare all'utente che una verifica manuale su un dispositivo Android con l'app installata come PWA (o su desktop Chrome con l'app installata) è consigliata per confermare che la notifica di riepilogo appaia correttamente — i test coprono tutta la logica pura (`overdueTasks`, `buildDigestNotification`, dedup via `pickToNotify`), non l'integrazione reale con l'OS.
