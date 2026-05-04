# PWA + Promemoria locali Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trasformare l'app in PWA installabile su Android Chrome con sistema di promemoria locali (template configurabili, task per booking, notifiche schedulate via foreground scheduler + Periodic Background Sync).

**Architecture:** PWA con Service Worker custom (modalità `injectManifest` di vite-plugin-pwa). Due nuove entità (`ReminderTemplate`, `BookingTask`) gestite con il pattern Zustand+enqueue→Sheets già usato per booking/closures/promemoria. IndexedDB come bridge tra client e SW per i task. Notifiche con due canali coordinati: `setTimeout` quando l'app è aperta, `periodicsync` quando è chiusa. Stato `notificationStatus` mantenuto solo localmente per device.

**Tech Stack:** React 19 · TypeScript 6 · Zustand 5 · vite-plugin-pwa 1.2 · Workbox · idb 8 · Vitest 4 · React Testing Library 16

**Spec di riferimento:** `docs/superpowers/specs/2026-05-04-pwa-promemoria-design.md`

**Working directory:** `d:\Workspace\CPP\app` (tutti i percorsi relativi a questa cartella salvo diversa indicazione)

**Comandi chiave:**
- Test: `npm test -- --run`
- Lint: `npm run lint` (BLOCCANTE prima di ogni commit per regola di progetto)
- Type check: `npx tsc --noEmit`
- Dev: `npm run dev`
- Build: `npm run build`

---

## File Structure

```
app/src/
├── main.tsx                            # MODIFY: registrare SW
├── sw.ts                               # NEW: Service Worker custom (injectManifest)
├── types.ts                            # MODIFY: + ReminderTemplate, BookingTask, PendingOp kinds
├── lib/
│   ├── idb.ts                          # MODIFY: aggiungere object stores 'tasks', 'templates'
│   ├── sync.ts                         # MODIFY: applyOp + fullPull + hydrateFromCache per task/template
│   ├── google/
│   │   ├── adapter.ts                  # MODIFY: + taskToRow/rowToTask, templateToRow/rowToTemplate
│   │   └── bootstrap.ts                # MODIFY: ensureHeaders su tasks + reminder_templates
│   ├── reminders/
│   │   ├── templates.ts                # NEW: 9 default seed
│   │   ├── materialize.ts              # NEW: materializeTasks, recalculateDueAt, resolvePlaceholders
│   │   └── pickToNotify.ts             # NEW: predicate condiviso client+SW
│   └── notifications/
│       ├── foregroundScheduler.ts      # NEW: setTimeout-based scheduler in-app
│       └── permission.ts               # NEW: Notification.requestPermission + periodicSync register
├── store/
│   ├── tasks.ts                        # NEW: useTasks Zustand slice + IDB mirror
│   ├── templates.ts                    # NEW: useTemplates Zustand slice
│   └── notifications.ts                # NEW: stato permission + setting locale
└── components/
    ├── UpdateToast.tsx                 # NEW: toast needRefresh / offlineReady
    ├── NotificationOnboarding.tsx      # NEW: banner permesso notifiche
    ├── forms/
    │   └── BookingForm.tsx             # MODIFY: + sezione "Promemoria e servizi"
    ├── common/
    │   ├── BookingCard.tsx             # MODIFY: + task indicator
    │   └── TaskList.tsx                # NEW: lista riusabile task con toggle done / edit
    └── settings/
        └── TemplatesPage.tsx           # NEW: gestione template globali

app/tests/
├── lib/
│   ├── reminders/
│   │   ├── materialize.test.ts         # NEW
│   │   └── pickToNotify.test.ts        # NEW
│   ├── notifications/
│   │   └── foregroundScheduler.test.ts # NEW
│   └── adapter.test.ts                 # MODIFY: + round-trip task/template
├── store/
│   ├── tasks.test.ts                   # NEW
│   └── templates.test.ts               # NEW
└── components/
    └── BookingForm.test.tsx            # NEW (sezione Promemoria)

app/vite.config.ts                      # MODIFY: strategies: 'injectManifest', srcDir: 'src', filename: 'sw.ts'
```

**Convenzioni:**
- Tutti i tipi in `src/types.ts`
- Logica pura in `src/lib/reminders/` (testabile senza React/SW)
- Pattern Zustand+enqueue identico ai booking esistenti
- ESLint zero-error obbligatorio prima di ogni commit (regola progetto)
- Update di `MEMORY.md` alla fine di ogni fase major

**Riferimento ground truth:**
- `src/store/bookings.ts` è il template per gli store nuovi (tasks, templates)
- `src/lib/google/adapter.ts` è il template per le funzioni di serializzazione
- `src/lib/sync.ts` è il template per estendere `applyOp` e `fullPull`

---

## Phase 1 — PWA base attiva (4 task)

Obiettivo: app installabile, SW registrato, toast di update/offline. L'`InstallPrompt` esiste già completo (`src/components/InstallPrompt.tsx`) e `App.tsx` lo usa.

### Task 1.1: Switch a `injectManifest` in vite.config.ts

**Files:**
- Modify: `vite.config.ts`

- [ ] **Step 1: Modificare la configurazione di VitePWA**

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/CPP/',
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      },
      includeAssets: ['favicon.svg', 'icon.svg'],
      manifest: {
        name: 'Cuore di Bosco — Calendario',
        short_name: 'Cuore di Bosco',
        description: 'Calendario prenotazioni del B&B Cuore di Bosco',
        theme_color: '#2E8F5C',
        background_color: '#FAF8F5',
        display: 'standalone',
        orientation: 'portrait',
        lang: 'it',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
});
```

- [ ] **Step 2: Verificare che il build NON fallisca per mancanza di sw.ts**

Run: `npm run build`
Expected: FAIL con "Could not load src/sw.ts" — è atteso, lo creiamo nel task successivo.

- [ ] **Step 3: NON committare ancora** (build rotto, andiamo al task 1.2 che lo ripara)

### Task 1.2: Service Worker minimale

**Files:**
- Create: `src/sw.ts`

- [ ] **Step 1: Scrivere il SW minimale con precache Workbox**

```ts
// src/sw.ts
/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('install', () => {
  void self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
```

- [ ] **Step 2: Aggiungere workbox-precaching alle dipendenze se mancante**

Run (dalla cartella `app/`):
```bash
npm ls workbox-precaching || npm i -D workbox-precaching
```
Expected: pacchetto presente o installato senza errori.

- [ ] **Step 3: Build di verifica**

Run: `npm run build`
Expected: PASS, output `dist/sw.js` generato.

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: zero errori.

- [ ] **Step 5: Commit**

```bash
git add vite.config.ts src/sw.ts package.json package-lock.json
git commit -m "feat(pwa): switch to injectManifest with custom service worker"
```

### Task 1.3: Registrare il SW in main.tsx con UpdateToast

**Files:**
- Create: `src/components/UpdateToast.tsx`
- Modify: `src/main.tsx`

- [ ] **Step 1: Creare il componente UpdateToast**

```tsx
// src/components/UpdateToast.tsx
import { useRegisterSW } from 'virtual:pwa-register/react';

export const UpdateToast = () => {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(reg) { console.info('[pwa] SW registered', reg); },
    onRegisterError(err) { console.warn('[pwa] SW register error', err); },
  });

  if (!needRefresh && !offlineReady) return null;

  return (
    <div
      className="fixed bottom-3 left-3 right-3 px-4 py-3 rounded-xl flex items-center gap-3 shadow-lg z-50"
      style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}
    >
      <div className="text-sm flex-1">
        {needRefresh ? '🔄 Aggiornamento disponibile' : '📴 App pronta offline'}
      </div>
      {needRefresh && (
        <button className="btn btn-primary" onClick={() => void updateServiceWorker(true)}>
          Ricarica
        </button>
      )}
      <button
        className="btn btn-ghost"
        onClick={() => { setNeedRefresh(false); setOfflineReady(false); }}
      >
        Chiudi
      </button>
    </div>
  );
};
```

- [ ] **Step 2: Importarlo in main.tsx (NON in App.tsx, così è disponibile anche prima del login)**

```tsx
// src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { UpdateToast } from './components/UpdateToast';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <UpdateToast />
  </StrictMode>,
);
```

- [ ] **Step 3: Aggiungere `vite-plugin-pwa/client` ai tipi globali**

Crea `src/vite-env.d.ts` se non esiste, o aggiungi le righe se esiste:

```ts
/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />
```

Verifica `src/vite-env.d.ts`:
```bash
cat d:/Workspace/CPP/app/src/vite-env.d.ts 2>/dev/null || echo "MISSING"
```
- Se esiste: aggiungi solo la riga mancante
- Se manca: crealo con entrambe le `<reference>`

- [ ] **Step 4: Type check**

Run: `npx tsc --noEmit`
Expected: zero errori.

- [ ] **Step 5: Lint + build**

Run: `npm run lint && npm run build`
Expected: tutto ok.

- [ ] **Step 6: Commit**

```bash
git add src/main.tsx src/components/UpdateToast.tsx src/vite-env.d.ts
git commit -m "feat(pwa): register service worker with update toast"
```

### Task 1.4: Smoke test installabilità

**Files:**
- (nessuna modifica codice, solo verifica)

- [ ] **Step 1: Avviare dev e ispezionare manifest in DevTools**

Run: `npm run dev`
Apri Chrome → DevTools → Application → Manifest. Verifica che le icone siano caricate, theme color sia `#2E8F5C`, scope sia `./`.

- [ ] **Step 2: Lighthouse PWA audit**

In Chrome DevTools → Lighthouse → categoria "Progressive Web App" → Generate report.
Expected: PWA score 100 (o ≥90 con dettaglio dei warning accettabili).

- [ ] **Step 3: Smoke test offline**

DevTools → Application → Service Workers → "Offline" checked. Ricarica la pagina.
Expected: l'app shell carica senza chiamate di rete (le risorse sono in cache).

- [ ] **Step 4: NESSUN COMMIT** (solo verifica). Termina la fase 1 con un update di MEMORY.md (regola progetto).

```markdown
- [PWA Phase 1](feature_pwa_phase1.md) — SW custom registrato, toast update/offline, lighthouse PWA 100
```

Crea il file `C:/Users/Mara/.claude/projects/d--Workspace-CPP/memory/feature_pwa_phase1.md` con frontmatter e contenuto sintetico, poi aggiungi la riga sopra a `MEMORY.md`.

---

## Phase 2 — Modello dati e store (10 task)

Obiettivo: tipi, slice Zustand `useTasks`/`useTemplates`, IndexedDB mirror, logica pura.

### Task 2.1: Tipi `ReminderTemplate` e `BookingTask`

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Aggiungere i tipi in fondo al file**

```ts
// src/types.ts (aggiunte in fondo, dopo PendingOp)

export type TemplateAnchor = 'check-in' | 'check-out';

export interface ReminderTemplate {
  id: string;
  builtIn: boolean;
  enabled: boolean;
  title: string;
  description?: string;
  isService: boolean;
  serviceLabel?: string;
  anchor: TemplateAnchor;
  offsetDays: number;
  defaultTime: string; // 'HH:mm'
  notify: boolean;
  sortOrder: number;
}

export type NotificationStatus = 'pending' | 'shown' | 'dismissed' | 'failed';

export interface BookingTask {
  id: string;
  bookingId: string;
  templateId: string | null;
  title: string;
  description?: string;
  dueAt: string; // ISO local datetime
  done: boolean;
  doneAt?: string;
  notes?: string;
  notify: boolean;
  notificationStatus: NotificationStatus;
  notificationShownAt?: string;
  isService: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}
```

- [ ] **Step 2: Estendere `PendingOp.kind` con i nuovi tipi**

Sostituisci la dichiarazione esistente di `PendingOp`:

```ts
export interface PendingOp {
  id: string;
  kind:
    | 'upsert_booking' | 'delete_booking'
    | 'upsert_closure' | 'delete_closure'
    | 'upsert_promemoria' | 'delete_promemoria'
    | 'upsert_task' | 'delete_task'
    | 'upsert_template' | 'delete_template';
  payload: unknown;
  createdAt: string;
}
```

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: zero errori.

- [ ] **Step 4: Commit**

```bash
git add src/types.ts
git commit -m "feat(types): add ReminderTemplate and BookingTask types"
```

### Task 2.2: Default template seed (logica pura) + test

**Files:**
- Create: `src/lib/reminders/templates.ts`
- Test: `tests/lib/reminders/templates.test.ts`

- [ ] **Step 1: Scrivere il test**

```ts
// tests/lib/reminders/templates.test.ts
import { describe, it, expect } from 'vitest';
import { DEFAULT_TEMPLATES } from '../../../src/lib/reminders/templates';

describe('DEFAULT_TEMPLATES', () => {
  it('contiene esattamente 9 template', () => {
    expect(DEFAULT_TEMPLATES).toHaveLength(9);
  });
  it('tutti i default hanno builtIn: true', () => {
    expect(DEFAULT_TEMPLATES.every(t => t.builtIn)).toBe(true);
  });
  it('contiene gli id attesi', () => {
    const ids = DEFAULT_TEMPLATES.map(t => t.id).sort();
    expect(ids).toEqual([
      'cena', 'check-in-today', 'documents', 'istat-questura',
      'merenda', 'preparation', 'receipt-issue', 'receipt-print', 'tourism-tax',
    ]);
  });
  it('preparation è -1 giorno alle 14:00', () => {
    const t = DEFAULT_TEMPLATES.find(t => t.id === 'preparation')!;
    expect(t.offsetDays).toBe(-1);
    expect(t.defaultTime).toBe('14:00');
  });
  it('check-in-today è offset 0 alle 00:00', () => {
    const t = DEFAULT_TEMPLATES.find(t => t.id === 'check-in-today')!;
    expect(t.offsetDays).toBe(0);
    expect(t.defaultTime).toBe('00:00');
  });
  it('merenda e cena sono service', () => {
    const merenda = DEFAULT_TEMPLATES.find(t => t.id === 'merenda')!;
    const cena = DEFAULT_TEMPLATES.find(t => t.id === 'cena')!;
    expect(merenda.isService).toBe(true);
    expect(cena.isService).toBe(true);
  });
  it('sortOrder è univoco e crescente', () => {
    const orders = DEFAULT_TEMPLATES.map(t => t.sortOrder).sort((a, b) => a - b);
    expect(new Set(orders).size).toBe(9);
  });
});
```

- [ ] **Step 2: Run del test (deve fallire)**

Run: `npm test -- --run tests/lib/reminders/templates.test.ts`
Expected: FAIL "Cannot find module".

- [ ] **Step 3: Implementare il modulo**

```ts
// src/lib/reminders/templates.ts
import type { ReminderTemplate } from '../../types';

export const DEFAULT_TEMPLATES: ReminderTemplate[] = [
  {
    id: 'preparation', builtIn: true, enabled: true,
    title: 'Prepara camera per {adulti}A {bambini}B',
    isService: false, anchor: 'check-in', offsetDays: -1,
    defaultTime: '14:00', notify: true, sortOrder: 10,
  },
  {
    id: 'check-in-today', builtIn: true, enabled: true,
    title: 'Check-in oggi alle {oraArrivo}',
    isService: false, anchor: 'check-in', offsetDays: 0,
    defaultTime: '00:00', notify: true, sortOrder: 20,
  },
  {
    id: 'documents', builtIn: true, enabled: true,
    title: 'Registra documenti Alloggiati Web',
    isService: false, anchor: 'check-in', offsetDays: 0,
    defaultTime: '21:00', notify: true, sortOrder: 30,
  },
  {
    id: 'receipt-issue', builtIn: true, enabled: true,
    title: 'Emetti ricevuta',
    isService: false, anchor: 'check-in', offsetDays: 0,
    defaultTime: '21:00', notify: true, sortOrder: 31,
  },
  {
    id: 'receipt-print', builtIn: true, enabled: true,
    title: 'Stampa copia ricevuta',
    isService: false, anchor: 'check-in', offsetDays: 0,
    defaultTime: '21:00', notify: true, sortOrder: 32,
  },
  {
    id: 'tourism-tax', builtIn: true, enabled: true,
    title: 'Registro tassa di soggiorno',
    isService: false, anchor: 'check-in', offsetDays: 0,
    defaultTime: '21:00', notify: true, sortOrder: 33,
  },
  {
    id: 'istat-questura', builtIn: true, enabled: true,
    title: 'ISTAT + scarica ricevuta questura',
    isService: false, anchor: 'check-in', offsetDays: 2,
    defaultTime: '10:00', notify: true, sortOrder: 40,
  },
  {
    id: 'merenda', builtIn: true, enabled: true,
    title: 'Preparare merenda',
    isService: true, serviceLabel: 'Merenda',
    anchor: 'check-in', offsetDays: 0,
    defaultTime: '16:30', notify: true, sortOrder: 50,
  },
  {
    id: 'cena', builtIn: true, enabled: true,
    title: 'Preparare cena',
    isService: true, serviceLabel: 'Cena',
    anchor: 'check-in', offsetDays: 0,
    defaultTime: '19:30', notify: true, sortOrder: 60,
  },
];
```

- [ ] **Step 4: Run del test (deve passare)**

Run: `npm test -- --run tests/lib/reminders/templates.test.ts`
Expected: PASS.

- [ ] **Step 5: Lint + commit**

```bash
npm run lint
git add src/lib/reminders/templates.ts tests/lib/reminders/templates.test.ts
git commit -m "feat(reminders): add 9 default reminder templates with seed"
```

### Task 2.3: `resolvePlaceholders` (logica pura) + test

**Files:**
- Create: `src/lib/reminders/materialize.ts` (parziale: solo resolvePlaceholders)
- Test: `tests/lib/reminders/materialize.test.ts`

- [ ] **Step 1: Scrivere il test**

```ts
// tests/lib/reminders/materialize.test.ts
import { describe, it, expect } from 'vitest';
import { resolvePlaceholders } from '../../../src/lib/reminders/materialize';

describe('resolvePlaceholders', () => {
  it('sostituisce {adulti} con 2 e {bambini} con 1 dato numOspiti=3 senza dettaglio', () => {
    const out = resolvePlaceholders('Camera {adulti}A {bambini}B', { numOspiti: 3 });
    expect(out).toBe('Camera 3A 0B');
  });
  it('lascia placeholder sconosciuti invariati', () => {
    expect(resolvePlaceholders('foo {boh}', {})).toBe('foo {boh}');
  });
  it('sostituisce {oraArrivo} se presente nelle note', () => {
    expect(resolvePlaceholders('Check-in {oraArrivo}', { oraArrivo: '15:30' })).toBe('Check-in 15:30');
  });
  it('placeholder {oraArrivo} mancante diventa "—"', () => {
    expect(resolvePlaceholders('Check-in {oraArrivo}', {})).toBe('Check-in —');
  });
});
```

- [ ] **Step 2: Run del test (FAIL)**

Run: `npm test -- --run tests/lib/reminders/materialize.test.ts`
Expected: FAIL "Cannot find module".

- [ ] **Step 3: Implementare**

```ts
// src/lib/reminders/materialize.ts
export interface PlaceholderData {
  numOspiti?: number;
  adulti?: number;
  bambini?: number;
  oraArrivo?: string;
}

const KNOWN: Record<string, (d: PlaceholderData) => string> = {
  '{adulti}': (d) => String(d.adulti ?? d.numOspiti ?? 0),
  '{bambini}': (d) => String(d.bambini ?? 0),
  '{oraArrivo}': (d) => d.oraArrivo ?? '—',
};

export const resolvePlaceholders = (tpl: string, data: PlaceholderData): string => {
  let out = tpl;
  for (const [key, fn] of Object.entries(KNOWN)) {
    out = out.split(key).join(fn(data));
  }
  return out;
};
```

- [ ] **Step 4: Run del test (PASS)**

Run: `npm test -- --run tests/lib/reminders/materialize.test.ts`
Expected: PASS.

- [ ] **Step 5: Lint + commit**

```bash
npm run lint
git add src/lib/reminders/materialize.ts tests/lib/reminders/materialize.test.ts
git commit -m "feat(reminders): add placeholder resolution helper"
```

### Task 2.4: `materializeTasks` e `recalculateDueAt` + test

**Files:**
- Modify: `src/lib/reminders/materialize.ts`
- Modify: `tests/lib/reminders/materialize.test.ts`

- [ ] **Step 1: Aggiungere test in append al file di test**

```ts
// tests/lib/reminders/materialize.test.ts (in append)
import type { ReminderTemplate, BookingTask } from '../../../src/types';
import { materializeTasks, recalculateDueAt } from '../../../src/lib/reminders/materialize';

const T = (over: Partial<ReminderTemplate>): ReminderTemplate => ({
  id: 't', builtIn: false, enabled: true, title: 'X',
  isService: false, anchor: 'check-in', offsetDays: 0,
  defaultTime: '09:00', notify: true, sortOrder: 0,
  ...over,
});

const B = { id: 'b1', checkin: '2026-05-10', checkout: '2026-05-12', numOspiti: 2 };

describe('materializeTasks', () => {
  it('genera un task per ogni template enabled', () => {
    const tpls = [T({ id: 'a' }), T({ id: 'b', enabled: false })];
    const tasks = materializeTasks(B, tpls, () => '2026-05-04T10:00:00.000Z');
    expect(tasks).toHaveLength(1);
    expect(tasks[0].templateId).toBe('a');
  });
  it('calcola dueAt con offsetDays e defaultTime', () => {
    const tpl = T({ id: 'p', offsetDays: -1, defaultTime: '14:00' });
    const [task] = materializeTasks(B, [tpl], () => '2026-05-04T10:00:00.000Z');
    // checkin 2026-05-10, -1 giorno = 2026-05-09 alle 14:00 locale
    expect(task.dueAt.startsWith('2026-05-09T14:00')).toBe(true);
  });
  it('risolve i placeholder nel title', () => {
    const tpl = T({ id: 'p', title: 'Camera {adulti}A {bambini}B' });
    const [task] = materializeTasks(B, [tpl], () => '2026-05-04T10:00:00.000Z');
    expect(task.title).toBe('Camera 2A 0B');
  });
  it('service template parte con notify: false', () => {
    const tpl = T({ id: 'merenda', isService: true });
    const [task] = materializeTasks(B, [tpl], () => '2026-05-04T10:00:00.000Z');
    expect(task.notify).toBe(false);
    expect(task.isService).toBe(true);
  });
});

describe('recalculateDueAt', () => {
  it('aggiorna dueAt quando il booking sposta il check-in', () => {
    const tpl = T({ id: 'x', offsetDays: -1, defaultTime: '14:00' });
    const [task] = materializeTasks(B, [tpl], () => '2026-05-04T10:00:00.000Z');
    const updated = recalculateDueAt(task, { ...B, checkin: '2026-06-01' }, tpl);
    expect(updated.dueAt.startsWith('2026-05-31T14:00')).toBe(true);
  });
  it('lascia invariato un task custom (templateId === null)', () => {
    const t: BookingTask = {
      id: 'c', bookingId: 'b1', templateId: null, title: 'Custom',
      dueAt: '2026-06-01T10:00:00.000Z', done: false, notify: true,
      notificationStatus: 'pending', isService: false,
      createdAt: '2026-05-04T10:00:00.000Z', updatedAt: '2026-05-04T10:00:00.000Z',
    };
    const out = recalculateDueAt(t, { ...B, checkin: '2026-07-01' }, null);
    expect(out.dueAt).toBe(t.dueAt);
  });
});
```

- [ ] **Step 2: Run del test (FAIL su nuove funzioni)**

Run: `npm test -- --run tests/lib/reminders/materialize.test.ts`
Expected: FAIL "materializeTasks is not a function".

- [ ] **Step 3: Implementare in materialize.ts**

```ts
// src/lib/reminders/materialize.ts (aggiunta dopo resolvePlaceholders)
import type { ReminderTemplate, BookingTask } from '../../types';
import { uid } from '../id';

export interface BookingShape {
  id: string;
  checkin: string;
  checkout: string;
  numOspiti?: number;
  oraArrivo?: string;
}

const computeDueAt = (booking: BookingShape, tpl: ReminderTemplate): string => {
  const base = tpl.anchor === 'check-out' ? booking.checkout : booking.checkin;
  const [y, m, d] = base.split('-').map(Number);
  const local = new Date(y, m - 1, d);
  local.setDate(local.getDate() + tpl.offsetDays);
  const [hh, mm] = tpl.defaultTime.split(':').map(Number);
  local.setHours(hh, mm, 0, 0);
  return local.toISOString();
};

export const materializeTasks = (
  booking: BookingShape,
  templates: ReminderTemplate[],
  nowIso: () => string = () => new Date().toISOString(),
): BookingTask[] => {
  const now = nowIso();
  return templates.filter(t => t.enabled).map(tpl => ({
    id: uid('tk'),
    bookingId: booking.id,
    templateId: tpl.id,
    title: resolvePlaceholders(tpl.title, {
      numOspiti: booking.numOspiti,
      oraArrivo: booking.oraArrivo,
    }),
    description: tpl.description ? resolvePlaceholders(tpl.description, {
      numOspiti: booking.numOspiti,
      oraArrivo: booking.oraArrivo,
    }) : undefined,
    dueAt: computeDueAt(booking, tpl),
    done: false,
    notify: tpl.isService ? false : tpl.notify,
    notificationStatus: 'pending',
    isService: tpl.isService,
    createdAt: now,
    updatedAt: now,
  }));
};

export const recalculateDueAt = (
  task: BookingTask,
  booking: BookingShape,
  tpl: ReminderTemplate | null,
): BookingTask => {
  if (!tpl || task.templateId === null) return task;
  return {
    ...task,
    dueAt: computeDueAt(booking, tpl),
    title: resolvePlaceholders(tpl.title, {
      numOspiti: booking.numOspiti,
      oraArrivo: booking.oraArrivo,
    }),
    updatedAt: new Date().toISOString(),
  };
};
```

- [ ] **Step 4: Run del test (PASS)**

Run: `npm test -- --run tests/lib/reminders/materialize.test.ts`
Expected: tutti i 9 test PASS.

- [ ] **Step 5: Lint + commit**

```bash
npm run lint
git add src/lib/reminders/materialize.ts tests/lib/reminders/materialize.test.ts
git commit -m "feat(reminders): materializeTasks and recalculateDueAt logic"
```

### Task 2.5: `pickToNotify` predicate + test

**Files:**
- Create: `src/lib/reminders/pickToNotify.ts`
- Test: `tests/lib/reminders/pickToNotify.test.ts`

- [ ] **Step 1: Scrivere il test**

```ts
// tests/lib/reminders/pickToNotify.test.ts
import { describe, it, expect } from 'vitest';
import { pickToNotify } from '../../../src/lib/reminders/pickToNotify';
import type { BookingTask } from '../../../src/types';

const t = (over: Partial<BookingTask>): BookingTask => ({
  id: 'x', bookingId: 'b', templateId: 't', title: 'X',
  dueAt: '2026-05-04T08:00:00.000Z', done: false, notify: true,
  notificationStatus: 'pending', isService: false,
  createdAt: '2026-05-01T00:00:00.000Z', updatedAt: '2026-05-01T00:00:00.000Z',
  ...over,
});

const NOW = new Date('2026-05-04T10:00:00.000Z');

describe('pickToNotify', () => {
  it('include task scaduto, notify=true, pending, non-done, non deleted', () => {
    const tasks = [t({})];
    expect(pickToNotify(tasks, NOW)).toHaveLength(1);
  });
  it('esclude task futuro', () => {
    expect(pickToNotify([t({ dueAt: '2026-05-04T12:00:00.000Z' })], NOW)).toHaveLength(0);
  });
  it('esclude task done', () => {
    expect(pickToNotify([t({ done: true })], NOW)).toHaveLength(0);
  });
  it('esclude task con notify=false', () => {
    expect(pickToNotify([t({ notify: false })], NOW)).toHaveLength(0);
  });
  it('esclude task gia mostrato', () => {
    expect(pickToNotify([t({ notificationStatus: 'shown' })], NOW)).toHaveLength(0);
  });
  it('esclude task soft-deleted', () => {
    expect(pickToNotify([t({ deletedAt: '2026-05-03T00:00:00.000Z' })], NOW)).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run del test (FAIL)**

Run: `npm test -- --run tests/lib/reminders/pickToNotify.test.ts`
Expected: FAIL "Cannot find module".

- [ ] **Step 3: Implementare**

```ts
// src/lib/reminders/pickToNotify.ts
import type { BookingTask } from '../../types';

export const pickToNotify = (tasks: BookingTask[], now: Date): BookingTask[] =>
  tasks.filter(t =>
    !t.deletedAt &&
    !t.done &&
    t.notify &&
    t.notificationStatus === 'pending' &&
    new Date(t.dueAt).getTime() <= now.getTime(),
  );
```

- [ ] **Step 4: Run del test (PASS)**

Run: `npm test -- --run tests/lib/reminders/pickToNotify.test.ts`
Expected: tutti i 6 test PASS.

- [ ] **Step 5: Lint + commit**

```bash
npm run lint
git add src/lib/reminders/pickToNotify.ts tests/lib/reminders/pickToNotify.test.ts
git commit -m "feat(reminders): pickToNotify predicate shared by client and SW"
```

### Task 2.6: Estendere IndexedDB con stores `tasks` e `templates`

**Files:**
- Modify: `src/lib/idb.ts`

- [ ] **Step 1: Aggiornare l'upgrade della versione DB**

```ts
// src/lib/idb.ts
import { openDB, type IDBPDatabase } from 'idb';

const DB = 'cdb_cache';
const VERSION = 2; // bumped from 1

let dbP: Promise<IDBPDatabase> | null = null;
const db = () => dbP ??= openDB(DB, VERSION, {
  upgrade(d, oldVersion) {
    if (oldVersion < 1) {
      ['bookings','closures','promemoria','settings'].forEach(s => {
        if (!d.objectStoreNames.contains(s)) d.createObjectStore(s);
      });
    }
    if (oldVersion < 2) {
      ['tasks','templates'].forEach(s => {
        if (!d.objectStoreNames.contains(s)) d.createObjectStore(s);
      });
    }
  },
});

export const idbGet = async <T = unknown>(store: string, key: string): Promise<T | undefined> => (await db()).get(store, key) as Promise<T | undefined>;
export const idbSet = async (store: string, key: string, val: unknown): Promise<void> => { await (await db()).put(store, val, key); };
export const idbDel = async (store: string, key: string): Promise<void> => { await (await db()).delete(store, key); };
```

- [ ] **Step 2: Type check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: zero errori.

- [ ] **Step 3: Commit**

```bash
git add src/lib/idb.ts
git commit -m "feat(idb): add tasks and templates object stores (v2)"
```

### Task 2.7: Slice `useTemplates` + test

**Files:**
- Create: `src/store/templates.ts`
- Test: `tests/store/templates.test.ts`

- [ ] **Step 1: Scrivere il test**

```ts
// tests/store/templates.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useTemplates } from '../../src/store/templates';
import { DEFAULT_TEMPLATES } from '../../src/lib/reminders/templates';

describe('templates store', () => {
  beforeEach(() => {
    useTemplates.setState({ items: [] });
  });
  it('seedDefaults popola i 9 template default solo se vuoto', () => {
    useTemplates.getState().seedDefaults();
    expect(useTemplates.getState().items).toHaveLength(DEFAULT_TEMPLATES.length);
    useTemplates.getState().seedDefaults();
    expect(useTemplates.getState().items).toHaveLength(DEFAULT_TEMPLATES.length);
  });
  it('upsert aggiunge nuovo o aggiorna esistente', () => {
    useTemplates.getState().seedDefaults();
    const merenda = useTemplates.getState().items.find(t => t.id === 'merenda')!;
    useTemplates.getState().upsert({ ...merenda, defaultTime: '17:00' });
    expect(useTemplates.getState().items.find(t => t.id === 'merenda')!.defaultTime).toBe('17:00');
  });
  it('remove elimina un template', () => {
    useTemplates.getState().seedDefaults();
    const initial = useTemplates.getState().items.length;
    useTemplates.getState().remove('merenda');
    expect(useTemplates.getState().items).toHaveLength(initial - 1);
  });
  it('toggleEnabled inverte enabled', () => {
    useTemplates.getState().seedDefaults();
    useTemplates.getState().toggleEnabled('cena');
    expect(useTemplates.getState().items.find(t => t.id === 'cena')!.enabled).toBe(false);
  });
});
```

- [ ] **Step 2: Run del test (FAIL)**

Run: `npm test -- --run tests/store/templates.test.ts`
Expected: FAIL "Cannot find module".

- [ ] **Step 3: Implementare lo store**

```ts
// src/store/templates.ts
import { create } from 'zustand';
import type { ReminderTemplate } from '../types';
import { DEFAULT_TEMPLATES } from '../lib/reminders/templates';

const enq = async (kind: 'upsert_template' | 'delete_template', payload: unknown) => {
  const { enqueue } = await import('../lib/sync');
  void enqueue(kind, payload);
};

interface State {
  items: ReminderTemplate[];
  seedDefaults: () => void;
  upsert: (t: ReminderTemplate) => void;
  remove: (id: string) => void;
  toggleEnabled: (id: string) => void;
}

export const useTemplates = create<State>((set, get) => ({
  items: [],
  seedDefaults: () => {
    if (get().items.length > 0) return;
    set({ items: [...DEFAULT_TEMPLATES] });
    DEFAULT_TEMPLATES.forEach(t => void enq('upsert_template', t));
  },
  upsert: (t) => {
    const exists = get().items.some(x => x.id === t.id);
    set({
      items: exists
        ? get().items.map(x => x.id === t.id ? t : x)
        : [...get().items, t],
    });
    void enq('upsert_template', t);
  },
  remove: (id) => {
    set({ items: get().items.filter(t => t.id !== id) });
    void enq('delete_template', { id });
  },
  toggleEnabled: (id) => {
    set({
      items: get().items.map(t => t.id === id ? { ...t, enabled: !t.enabled } : t),
    });
    const updated = get().items.find(t => t.id === id);
    if (updated) void enq('upsert_template', updated);
  },
}));
```

- [ ] **Step 4: Run del test (PASS)**

Run: `npm test -- --run tests/store/templates.test.ts`
Expected: tutti PASS.

- [ ] **Step 5: Lint + commit**

```bash
npm run lint
git add src/store/templates.ts tests/store/templates.test.ts
git commit -m "feat(templates): add useTemplates Zustand store with seed"
```

### Task 2.8: Slice `useTasks` con IDB mirror + test

**Files:**
- Create: `src/store/tasks.ts`
- Test: `tests/store/tasks.test.ts`

- [ ] **Step 1: Scrivere il test**

```ts
// tests/store/tasks.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { useTasks } from '../../src/store/tasks';
import type { BookingTask } from '../../src/types';

const t = (over: Partial<BookingTask>): BookingTask => ({
  id: 't1', bookingId: 'b1', templateId: 'preparation',
  title: 'X', dueAt: '2026-05-09T14:00:00.000Z', done: false, notify: true,
  notificationStatus: 'pending', isService: false,
  createdAt: '2026-05-04T10:00:00.000Z', updatedAt: '2026-05-04T10:00:00.000Z',
  ...over,
});

describe('tasks store', () => {
  beforeEach(() => {
    useTasks.setState({ items: [] });
    vi.clearAllMocks();
  });
  it('add inserisce un task', () => {
    useTasks.getState().add(t({ id: 'a' }));
    expect(useTasks.getState().items).toHaveLength(1);
  });
  it('addMany inserisce piu task in una volta sola', () => {
    useTasks.getState().addMany([t({ id: 'a' }), t({ id: 'b' })]);
    expect(useTasks.getState().items).toHaveLength(2);
  });
  it('update modifica un task esistente preservando i campi non modificati', () => {
    useTasks.getState().add(t({ id: 'a', title: 'old', notes: 'keep' }));
    useTasks.getState().update('a', { title: 'new' });
    const out = useTasks.getState().items.find(x => x.id === 'a')!;
    expect(out.title).toBe('new');
    expect(out.notes).toBe('keep');
  });
  it('toggleDone flippa done e setta doneAt', () => {
    useTasks.getState().add(t({ id: 'a' }));
    useTasks.getState().toggleDone('a');
    const out = useTasks.getState().items.find(x => x.id === 'a')!;
    expect(out.done).toBe(true);
    expect(out.doneAt).toBeDefined();
  });
  it('removeByBooking soft-delete tutti i task del booking', () => {
    useTasks.getState().addMany([
      t({ id: 'a', bookingId: 'b1' }),
      t({ id: 'b', bookingId: 'b2' }),
    ]);
    useTasks.getState().removeByBooking('b1');
    const out = useTasks.getState().items.find(x => x.id === 'a')!;
    expect(out.deletedAt).toBeDefined();
    expect(useTasks.getState().items.find(x => x.id === 'b')!.deletedAt).toBeUndefined();
  });
  it('byBooking ritorna i task non-deleted di un booking', () => {
    useTasks.getState().addMany([
      t({ id: 'a', bookingId: 'b1' }),
      t({ id: 'b', bookingId: 'b1', deletedAt: '2026-05-04T00:00:00Z' }),
      t({ id: 'c', bookingId: 'b2' }),
    ]);
    const out = useTasks.getState().byBooking('b1');
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('a');
  });
});
```

- [ ] **Step 2: Installare fake-indexeddb**

Run (dalla cartella `app/`):
```bash
npm i -D fake-indexeddb
```

- [ ] **Step 3: Run del test (FAIL)**

Run: `npm test -- --run tests/store/tasks.test.ts`
Expected: FAIL "Cannot find module".

- [ ] **Step 4: Implementare lo store**

```ts
// src/store/tasks.ts
import { create } from 'zustand';
import type { BookingTask } from '../types';
import { idbSet } from '../lib/idb';

const enq = async (kind: 'upsert_task' | 'delete_task', payload: unknown) => {
  const { enqueue } = await import('../lib/sync');
  void enqueue(kind, payload);
};

const mirrorAll = (items: BookingTask[]) => { void idbSet('tasks', 'all', items); };

interface State {
  items: BookingTask[];
  add: (task: BookingTask) => void;
  addMany: (tasks: BookingTask[]) => void;
  update: (id: string, patch: Partial<BookingTask>) => void;
  toggleDone: (id: string) => void;
  remove: (id: string) => void;
  removeByBooking: (bookingId: string) => void;
  byBooking: (bookingId: string) => BookingTask[];
}

export const useTasks = create<State>((set, get) => ({
  items: [],
  add: (task) => {
    set({ items: [...get().items, task] });
    mirrorAll(get().items);
    void enq('upsert_task', task);
  },
  addMany: (tasks) => {
    set({ items: [...get().items, ...tasks] });
    mirrorAll(get().items);
    tasks.forEach(t => void enq('upsert_task', t));
  },
  update: (id, patch) => {
    set({
      items: get().items.map(t =>
        t.id === id ? { ...t, ...patch, updatedAt: new Date().toISOString() } : t,
      ),
    });
    mirrorAll(get().items);
    const updated = get().items.find(t => t.id === id);
    if (updated) void enq('upsert_task', updated);
  },
  toggleDone: (id) => {
    const now = new Date().toISOString();
    set({
      items: get().items.map(t =>
        t.id === id
          ? { ...t, done: !t.done, doneAt: !t.done ? now : undefined, updatedAt: now }
          : t,
      ),
    });
    mirrorAll(get().items);
    const updated = get().items.find(t => t.id === id);
    if (updated) void enq('upsert_task', updated);
  },
  remove: (id) => {
    const now = new Date().toISOString();
    set({
      items: get().items.map(t => t.id === id ? { ...t, deletedAt: now, updatedAt: now } : t),
    });
    mirrorAll(get().items);
    void enq('delete_task', { id });
  },
  removeByBooking: (bookingId) => {
    const now = new Date().toISOString();
    set({
      items: get().items.map(t =>
        t.bookingId === bookingId && !t.deletedAt
          ? { ...t, deletedAt: now, updatedAt: now }
          : t,
      ),
    });
    mirrorAll(get().items);
    get().items.filter(t => t.bookingId === bookingId).forEach(t => void enq('upsert_task', t));
  },
  byBooking: (bookingId) =>
    get().items.filter(t => t.bookingId === bookingId && !t.deletedAt),
}));
```

- [ ] **Step 5: Run del test (PASS)**

Run: `npm test -- --run tests/store/tasks.test.ts`
Expected: tutti PASS.

- [ ] **Step 6: Lint + commit**

```bash
npm run lint
git add src/store/tasks.ts tests/store/tasks.test.ts package.json package-lock.json
git commit -m "feat(tasks): add useTasks store with IndexedDB mirror"
```

### Task 2.9: Hook bookings → tasks (creazione/cancellazione)

**Files:**
- Modify: `src/store/bookings.ts`
- Test: nessun nuovo file (smoke check con i test esistenti dei bookings)

**NOTA**: Per evitare circular import (bookings → tasks → sync → bookings), usiamo dynamic import come già fatto per `enqueue`.

- [ ] **Step 1: Aggiornare `add` e `remove` di useBookings**

```ts
// src/store/bookings.ts
import { create } from 'zustand';
import type { Prenotazione } from '../types';
import { uid } from '../lib/id';

const enq = async (kind: 'upsert_booking' | 'delete_booking', payload: unknown) => {
  const { enqueue } = await import('../lib/sync');
  void enqueue(kind, payload);
};

const onBookingCreated = async (booking: Prenotazione) => {
  const { useTemplates } = await import('./templates');
  const { useTasks } = await import('./tasks');
  const { materializeTasks } = await import('../lib/reminders/materialize');
  const templates = useTemplates.getState().items;
  if (templates.length === 0) return;
  const tasks = materializeTasks(booking, templates);
  useTasks.getState().addMany(tasks);
};

const onBookingUpdated = async (oldB: Prenotazione, newB: Prenotazione) => {
  if (oldB.checkin === newB.checkin && oldB.checkout === newB.checkout && oldB.numOspiti === newB.numOspiti) return;
  const { useTemplates } = await import('./templates');
  const { useTasks } = await import('./tasks');
  const { recalculateDueAt } = await import('../lib/reminders/materialize');
  const templates = useTemplates.getState().items;
  const tasks = useTasks.getState().byBooking(newB.id);
  tasks.forEach(t => {
    if (t.templateId === null || t.done) return;
    const tpl = templates.find(x => x.id === t.templateId);
    if (!tpl) return;
    const updated = recalculateDueAt(t, newB, tpl);
    useTasks.getState().update(t.id, {
      dueAt: updated.dueAt,
      title: updated.title,
    });
  });
};

const onBookingRemoved = async (bookingId: string) => {
  const { useTasks } = await import('./tasks');
  useTasks.getState().removeByBooking(bookingId);
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
    void onBookingCreated(item);
    return item;
  },
  update: (id, patch) => {
    const old = get().items.find(b => b.id === id);
    set({ items: get().items.map(b => b.id === id ? { ...b, ...patch, aggiornatoIl: new Date().toISOString() } : b) });
    const updated = get().items.find(b => b.id === id);
    if (updated) {
      void enq('upsert_booking', updated);
      if (old) void onBookingUpdated(old, updated);
    }
  },
  remove: (id) => {
    set({ items: get().items.filter(b => b.id !== id) });
    void enq('delete_booking', { id });
    void onBookingRemoved(id);
  },
}));
```

- [ ] **Step 2: Run dei test esistenti dei bookings (devono ancora passare)**

Run: `npm test -- --run tests/store/bookings.test.ts`
Expected: tutti PASS (gli hook async non interferiscono con i test esistenti perché tasks/templates partono vuoti).

- [ ] **Step 3: Type check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: zero errori.

- [ ] **Step 4: Commit**

```bash
git add src/store/bookings.ts
git commit -m "feat(bookings): hook task lifecycle on create/update/delete"
```

### Task 2.10: Seed templates al boot e hydrate da IndexedDB

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Aggiungere seed iniziale e hydrate**

```tsx
// src/App.tsx (aggiungere import e useEffect)
import { useEffect } from 'react';
import { useAuth } from './store/auth';
import { useUI } from './store/ui';
import { Home } from './components/Home';
import { CalendarPage } from './components/calendar/CalendarPage';
import { SignIn } from './components/SignIn';
import { InstallPrompt } from './components/InstallPrompt';
import { initAuth, startTokenAutoRefresh } from './lib/google/auth';
import { bootSync } from './lib/sync';
import { useTemplates } from './store/templates';
import { useTasks } from './store/tasks';
import { idbGet } from './lib/idb';
import type { BookingTask } from './types';

export default function App() {
  const user = useAuth(s => s.user);
  const page = useUI(s => s.page);

  useEffect(() => {
    void initAuth().then(startTokenAutoRefresh);
    useTemplates.getState().seedDefaults();
    void idbGet<BookingTask[]>('tasks', 'all').then(arr => {
      if (arr) useTasks.setState({ items: arr });
    });
  }, []);

  useEffect(() => {
    if (user) void bootSync();
  }, [user]);

  if (!user) return <SignIn />;
  return (
    <>
      <InstallPrompt />
      {page === 'home' ? <Home /> : <CalendarPage />}
    </>
  );
}
```

- [ ] **Step 2: Type check + lint + run all tests**

Run: `npx tsc --noEmit && npm run lint && npm test -- --run`
Expected: zero errori, tutti i test PASS.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat(boot): seed default templates and hydrate tasks from IDB"
```

---

## Phase 3 — Sync Google Sheets per task e template (5 task)

### Task 3.1: Adapter `taskToRow` / `rowToTask` + test

**Files:**
- Modify: `src/lib/google/adapter.ts`
- Modify: `tests/lib/adapter.test.ts`

- [ ] **Step 1: Aggiungere il test in append a adapter.test.ts**

```ts
// tests/lib/adapter.test.ts (in append)
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
```

- [ ] **Step 2: Run del test (FAIL)**

Run: `npm test -- --run tests/lib/adapter.test.ts`
Expected: FAIL "taskToRow is not a function".

- [ ] **Step 3: Aggiungere helper e funzioni in adapter.ts**

```ts
// src/lib/google/adapter.ts (aggiungere alla fine)

import type { BookingTask, NotificationStatus } from '../../types';

export const TASK_HEADERS = [
  'id','booking_id','template_id','title','description',
  'due_at','done','done_at','notes','notify',
  'notification_status','notification_shown_at','is_service',
  'created_at','updated_at','deleted_at',
] as const;

const optB = (v: boolean | undefined) => v ? 'TRUE' : 'FALSE';
const isTrue = (v: string | undefined) => v === 'TRUE' || v === 'true' || v === '1';

export const taskToRow = (t: BookingTask): string[] => [
  t.id,
  t.bookingId,
  t.templateId ?? '',
  t.title,
  opt(t.description),
  t.dueAt,
  optB(t.done),
  opt(t.doneAt),
  opt(t.notes),
  optB(t.notify),
  'pending',          // notificationStatus NON sincronizzato (sempre 'pending')
  '',                 // notificationShownAt NON sincronizzato
  optB(t.isService),
  t.createdAt,
  t.updatedAt,
  opt(t.deletedAt),
];

export const rowToTask = (r: string[]): BookingTask => ({
  id: r[0],
  bookingId: r[1],
  templateId: r[2] || null,
  title: r[3],
  description: r[4] || undefined,
  dueAt: r[5],
  done: isTrue(r[6]),
  doneAt: r[7] || undefined,
  notes: r[8] || undefined,
  notify: isTrue(r[9]),
  notificationStatus: 'pending' as NotificationStatus,
  notificationShownAt: undefined,
  isService: isTrue(r[12]),
  createdAt: r[13],
  updatedAt: r[14],
  deletedAt: r[15] || undefined,
});
```

- [ ] **Step 4: Run del test (PASS)**

Run: `npm test -- --run tests/lib/adapter.test.ts`
Expected: tutti i nuovi test PASS, gli esistenti ancora PASS.

- [ ] **Step 5: Lint + commit**

```bash
npm run lint
git add src/lib/google/adapter.ts tests/lib/adapter.test.ts
git commit -m "feat(adapter): task row serialization and round-trip"
```

### Task 3.2: Adapter `templateToRow` / `rowToTemplate` + test

**Files:**
- Modify: `src/lib/google/adapter.ts`
- Modify: `tests/lib/adapter.test.ts`

- [ ] **Step 1: Aggiungere il test**

```ts
// tests/lib/adapter.test.ts (in append)
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
```

- [ ] **Step 2: Run (FAIL)**

Run: `npm test -- --run tests/lib/adapter.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementare**

```ts
// src/lib/google/adapter.ts (aggiungere alla fine)

import type { ReminderTemplate, TemplateAnchor } from '../../types';

export const TEMPLATE_HEADERS = [
  'id','built_in','enabled','title','description',
  'is_service','service_label','anchor','offset_days',
  'default_time','notify','sort_order',
] as const;

export const templateToRow = (t: ReminderTemplate): string[] => [
  t.id,
  optB(t.builtIn),
  optB(t.enabled),
  t.title,
  opt(t.description),
  optB(t.isService),
  opt(t.serviceLabel),
  t.anchor,
  String(t.offsetDays),
  t.defaultTime,
  optB(t.notify),
  String(t.sortOrder),
];

export const rowToTemplate = (r: string[]): ReminderTemplate => ({
  id: r[0],
  builtIn: isTrue(r[1]),
  enabled: isTrue(r[2]),
  title: r[3],
  description: r[4] || undefined,
  isService: isTrue(r[5]),
  serviceLabel: r[6] || undefined,
  anchor: r[7] as TemplateAnchor,
  offsetDays: Number(r[8]),
  defaultTime: r[9],
  notify: isTrue(r[10]),
  sortOrder: Number(r[11]),
});
```

- [ ] **Step 4: Run (PASS)**

Run: `npm test -- --run tests/lib/adapter.test.ts`
Expected: tutti PASS.

- [ ] **Step 5: Lint + commit**

```bash
npm run lint
git add src/lib/google/adapter.ts tests/lib/adapter.test.ts
git commit -m "feat(adapter): template row serialization and round-trip"
```

### Task 3.3: Bootstrap dei nuovi sheet

**Files:**
- Modify: `src/lib/google/bootstrap.ts`

- [ ] **Step 1: Estendere `ensureHeaders` e `SHEET_NAMES`**

```ts
// src/lib/google/bootstrap.ts
import { createSpreadsheet, writeRange } from './sheets';
import { listCdbSheets } from './drive';
import { BOOKING_HEADERS, CLOSURE_HEADERS, PROMEMORIA_HEADERS, TASK_HEADERS, TEMPLATE_HEADERS } from './adapter';

export const SHEET_NAMES = ['prenotazioni','chiusure','promemoria','tasks','reminder_templates','impostazioni'];

const ensureHeaders = async (sid: string) => {
  await writeRange(sid, 'prenotazioni!A1', [ [...BOOKING_HEADERS] ]);
  await writeRange(sid, 'chiusure!A1', [ [...CLOSURE_HEADERS] ]);
  await writeRange(sid, 'promemoria!A1', [ [...PROMEMORIA_HEADERS] ]);
  await writeRange(sid, 'tasks!A1', [ [...TASK_HEADERS] ]);
  await writeRange(sid, 'reminder_templates!A1', [ [...TEMPLATE_HEADERS] ]);
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

**NOTA**: La writeRange per i sheet `tasks` / `reminder_templates` su un foglio già esistente che NON ha quei tab fallirà. Su sheet pre-esistenti, l'utente dovrà creare manualmente i due tab dal foglio Google. Nel task 3.5 aggiungeremo un workaround.

- [ ] **Step 2: Type check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: zero errori.

- [ ] **Step 3: Commit**

```bash
git add src/lib/google/bootstrap.ts
git commit -m "feat(bootstrap): add tasks and reminder_templates sheets"
```

### Task 3.4: Estendere `applyOp`, `fullPull`, `hydrateFromCache` in sync.ts

**Files:**
- Modify: `src/lib/sync.ts`

- [ ] **Step 1: Aggiornare il file**

```ts
// src/lib/sync.ts
import { readRange, writeRange, clearRange } from './google/sheets';
import { getFileMetadata } from './google/drive';
import { getOrCreateSheet } from './google/bootstrap';
import { warmupPeopleSearch } from './google/people';
import {
  bookingToRow, rowToBooking, closureToRow, rowToClosure,
  promemoriaToRow, rowToPromemoria,
  taskToRow, rowToTask, templateToRow, rowToTemplate,
} from './google/adapter';
import { useBookings } from '../store/bookings';
import { useClosures } from '../store/closures';
import { usePromemoria } from '../store/promemoria';
import { useTasks } from '../store/tasks';
import { useTemplates } from '../store/templates';
import { useAuth } from '../store/auth';
import { useSync } from '../store/sync';
import { idbGet, idbSet } from './idb';
import { uid } from './id';
import type { Prenotazione, Chiusura, Promemoria, BookingTask, ReminderTemplate, PendingOp } from '../types';

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

const applyOp = async (sid: string, op: PendingOp) => {
  if (op.kind.includes('booking')) {
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
  } else if (op.kind.includes('task')) {
    const items = useTasks.getState().items.map(taskToRow);
    await clearRange(sid, 'tasks!A2:Z');
    if (items.length) await writeRange(sid, 'tasks!A2', items);
  } else if (op.kind.includes('template')) {
    const items = useTemplates.getState().items.map(templateToRow);
    await clearRange(sid, 'reminder_templates!A2:Z');
    if (items.length) await writeRange(sid, 'reminder_templates!A2', items);
  }
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
    } catch {
      if (!navigator.onLine) useSync.getState().setStatus('offline');
      else useSync.getState().setStatus('error');
      return;
    }
  }
  useSync.getState().setStatus('idle');
};

export const fullPull = async () => {
  const { spreadsheetId } = useSync.getState();
  if (!spreadsheetId) return;
  useSync.getState().setStatus('syncing');
  try {
    const [b, c, p, tk, tp] = await Promise.all([
      readRange(spreadsheetId, 'prenotazioni!A2:Z'),
      readRange(spreadsheetId, 'chiusure!A2:Z'),
      readRange(spreadsheetId, 'promemoria!A2:Z'),
      readRange(spreadsheetId, 'tasks!A2:Z').catch(() => ({ values: [] as string[][] })),
      readRange(spreadsheetId, 'reminder_templates!A2:Z').catch(() => ({ values: [] as string[][] })),
    ]);
    const bookings = (b.values || []).filter(r => r[0]).map(rowToBooking);
    const closures = (c.values || []).filter(r => r[0]).map(rowToClosure);
    const promemoria = (p.values || []).filter(r => r[0]).map(rowToPromemoria);
    const tasks = (tk.values || []).filter(r => r[0]).map(rowToTask);
    const templates = (tp.values || []).filter(r => r[0]).map(rowToTemplate);
    useBookings.setState({ items: bookings });
    useClosures.setState({ items: closures });
    usePromemoria.setState({ items: promemoria });
    useTasks.setState({ items: tasks });
    if (templates.length > 0) useTemplates.setState({ items: templates });
    await Promise.all([
      idbSet('bookings', 'all', bookings),
      idbSet('closures', 'all', closures),
      idbSet('promemoria', 'all', promemoria),
      idbSet('tasks', 'all', tasks),
      idbSet('templates', 'all', templates),
    ]);
    useSync.getState().setStatus('idle');
  } catch {
    if (!navigator.onLine) useSync.getState().setStatus('offline');
    else useSync.getState().setStatus('error');
  }
};

export const hydrateFromCache = async () => {
  const [b, c, p, tk, tp] = await Promise.all([
    idbGet<Prenotazione[]>('bookings', 'all'),
    idbGet<Chiusura[]>('closures', 'all'),
    idbGet<Promemoria[]>('promemoria', 'all'),
    idbGet<BookingTask[]>('tasks', 'all'),
    idbGet<ReminderTemplate[]>('templates', 'all'),
  ]);
  if (b) useBookings.setState({ items: b });
  if (c) useClosures.setState({ items: c });
  if (p) usePromemoria.setState({ items: p });
  if (tk) useTasks.setState({ items: tk });
  if (tp && tp.length > 0) useTemplates.setState({ items: tp });
};

export const bootSync = async () => {
  await loadQueue();
  await hydrateFromCache();
  const sid = await getOrCreateSheet();
  useSync.getState().setSpreadsheetId(sid);
  const meta = await getFileMetadata(sid);
  useAuth.getState().setReadonly(!meta.capabilities.canEdit);
  await fullPull();
  void processQueue();
  void warmupPeopleSearch();
  setInterval(() => void fullPull(), 60_000);
  setInterval(() => void processQueue(), 3_000);
  window.addEventListener('online', () => { useSync.getState().setStatus('idle'); void processQueue(); });
  window.addEventListener('offline', () => useSync.getState().setStatus('offline'));
};
```

**NOTA**: `readRange` per i 2 nuovi sheet ha `.catch(() => ({ values: [] }))` perché su fogli esistenti senza i tab nuovi la chiamata fallirebbe. Questo è il workaround per fogli pre-esistenti.

- [ ] **Step 2: Run di tutti i test (devono ancora passare)**

Run: `npm test -- --run`
Expected: tutti PASS.

- [ ] **Step 3: Type check + lint + build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: zero errori.

- [ ] **Step 4: Commit**

```bash
git add src/lib/sync.ts
git commit -m "feat(sync): extend applyOp/fullPull/hydrate for tasks and templates"
```

### Task 3.5: Bottone "Genera promemoria per booking esistenti" in Impostazioni

**Files:**
- Create: `src/components/settings/GenerateRemindersButton.tsx`

**NOTA**: Non esiste ancora una pagina Impostazioni dedicata. In questa fase creiamo solo il componente isolato, sarà integrato nella nuova `TemplatesPage` in Phase 4 Task 4.4. Per testarlo manualmente subito, segui lo Step 2 opzionale.

- [ ] **Step 1: Creare il componente**

```tsx
// src/components/settings/GenerateRemindersButton.tsx
import { useState } from 'react';
import { useBookings } from '../../store/bookings';
import { useTemplates } from '../../store/templates';
import { useTasks } from '../../store/tasks';
import { materializeTasks } from '../../lib/reminders/materialize';

export const GenerateRemindersButton = () => {
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState<number | null>(null);

  const run = () => {
    setRunning(true);
    const bookings = useBookings.getState().items;
    const templates = useTemplates.getState().items;
    let count = 0;
    bookings.forEach(b => {
      const existing = useTasks.getState().byBooking(b.id);
      if (existing.length > 0) return; // skip se ha già task
      const tasks = materializeTasks(b, templates);
      useTasks.getState().addMany(tasks);
      count += tasks.length;
    });
    setDone(count);
    setRunning(false);
  };

  return (
    <div className="p-3 rounded-xl" style={{ background: 'var(--surface-2)' }}>
      <div className="text-sm mb-2">Materializza promemoria per i booking che ne sono privi.</div>
      <button className="btn btn-primary" disabled={running} onClick={run}>
        {running ? 'In corso...' : 'Genera promemoria per booking esistenti'}
      </button>
      {done !== null && (
        <div className="text-[12px] mt-2" style={{ color: 'var(--ink-soft)' }}>
          ✓ Generati {done} task.
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Type check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: zero errori (il componente è auto-contenuto, non importato da nessuno ancora).

- [ ] **Step 3: Commit**

```bash
git add src/components/settings/GenerateRemindersButton.tsx
git commit -m "feat(reminders): button to materialize tasks for existing bookings"
```

---

## Phase 4 — UI form, BookingCard, Impostazioni (6 task)

### Task 4.1: Componente `<TaskList>` riusabile + test

**Files:**
- Create: `src/components/common/TaskList.tsx`
- Test: `tests/components/TaskList.test.tsx`

- [ ] **Step 1: Scrivere il test**

```tsx
// tests/components/TaskList.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskList } from '../../src/components/common/TaskList';
import type { BookingTask } from '../../src/types';

const t = (over: Partial<BookingTask>): BookingTask => ({
  id: 'a', bookingId: 'b1', templateId: 'preparation',
  title: 'Prepara camera', dueAt: '2026-05-09T14:00:00.000Z',
  done: false, notify: true, notificationStatus: 'pending', isService: false,
  createdAt: '2026-05-04T10:00:00.000Z', updatedAt: '2026-05-04T10:00:00.000Z',
  ...over,
});

describe('TaskList', () => {
  it('non renderizza i task service nel modo "automatic"', () => {
    const tasks = [t({ id: '1', isService: false }), t({ id: '2', isService: true, title: 'Merenda' })];
    render(<TaskList tasks={tasks} mode="automatic" onToggleDone={() => {}} onEdit={() => {}} />);
    expect(screen.getByText('Prepara camera')).toBeTruthy();
    expect(screen.queryByText('Merenda')).toBeNull();
  });
  it('renderizza solo service nel modo "services"', () => {
    const tasks = [t({ id: '1', isService: false }), t({ id: '2', isService: true, title: 'Merenda' })];
    render(<TaskList tasks={tasks} mode="services" onToggleDone={() => {}} onEdit={() => {}} />);
    expect(screen.queryByText('Prepara camera')).toBeNull();
    expect(screen.getByText('Merenda')).toBeTruthy();
  });
  it('toggle done chiama onToggleDone con id', () => {
    let called = '';
    render(<TaskList tasks={[t({})]} mode="automatic" onToggleDone={(id) => { called = id; }} onEdit={() => {}} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(called).toBe('a');
  });
});
```

- [ ] **Step 2: Run del test (FAIL)**

Run: `npm test -- --run tests/components/TaskList.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implementare il componente**

```tsx
// src/components/common/TaskList.tsx
import type { BookingTask } from '../../types';
import { parseISO } from '../../lib/date';

const fmtDateTime = (iso: string) => {
  const d = parseISO(iso);
  return d.toLocaleString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

interface Props {
  tasks: BookingTask[];
  mode: 'automatic' | 'services' | 'all';
  onToggleDone: (id: string) => void;
  onEdit: (id: string) => void;
}

export const TaskList = ({ tasks, mode, onToggleDone, onEdit }: Props) => {
  const filtered = tasks.filter(t => {
    if (t.deletedAt) return false;
    if (mode === 'automatic') return !t.isService;
    if (mode === 'services') return t.isService;
    return true;
  });

  if (filtered.length === 0) {
    return <div className="text-[13px]" style={{ color: 'var(--ink-soft)' }}>Nessun promemoria.</div>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {filtered.map(t => (
        <li
          key={t.id}
          className="rounded-xl p-3 border flex items-start gap-3"
          style={{ borderColor: 'var(--line)', opacity: t.notify ? 1 : 0.5 }}
        >
          <input
            type="checkbox"
            checked={t.done}
            onChange={() => onToggleDone(t.id)}
            aria-label={`Segna ${t.title}`}
          />
          <div className="flex-1">
            <div className={`font-medium text-sm ${t.done ? 'line-through' : ''}`}>{t.title}</div>
            <div className="text-[12px]" style={{ color: 'var(--ink-soft)' }}>📅 {fmtDateTime(t.dueAt)}</div>
            {t.notes && <div className="text-[12px] italic mt-1" style={{ color: 'var(--ink-soft)' }}>« {t.notes} »</div>}
          </div>
          <button type="button" className="btn btn-ghost text-[12px]" onClick={() => onEdit(t.id)}>✏️</button>
        </li>
      ))}
    </ul>
  );
};
```

- [ ] **Step 4: Run del test (PASS)**

Run: `npm test -- --run tests/components/TaskList.test.tsx`
Expected: tutti PASS.

- [ ] **Step 5: Lint + commit**

```bash
npm run lint
git add src/components/common/TaskList.tsx tests/components/TaskList.test.tsx
git commit -m "feat(ui): TaskList reusable component"
```

### Task 4.2: Sezione "Promemoria e servizi" nel BookingForm

**Files:**
- Modify: `src/components/forms/BookingForm.tsx`

**NOTA**: Il `BookingForm` è già 238 righe. Aggiungiamo la sezione in fondo, ma se cresce troppo (>320 righe) considera estrarla in un componente separato `BookingFormReminders.tsx` per mantenere readability.

- [ ] **Step 1: Aggiungere stati e import**

In testa al componente, aggiungi:

```tsx
import { useTasks } from '../../store/tasks';
import { useTemplates } from '../../store/templates';
import { TaskList } from '../common/TaskList';
import { uid } from '../../lib/id';
import type { BookingTask } from '../../types';
```

Aggiungi nel componente, dopo la definizione di `pendingConfirm`:

```tsx
const tasksForBooking = useTasks(s => existing ? s.byBooking(existing.id) : []);
const updateTask = useTasks(s => s.update);
const toggleDoneTask = useTasks(s => s.toggleDone);
const addTask = useTasks(s => s.add);
const templates = useTemplates(s => s.items);

const [remindersOpen, setRemindersOpen] = useState(false);
const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
const [showAddCustom, setShowAddCustom] = useState(false);
const [customForm, setCustomForm] = useState({ title: '', dueAt: '', notes: '' });
```

- [ ] **Step 2: Aggiungere il blocco JSX prima dei pulsanti finali**

Sostituisci il blocco `{warn && ...}` con:

```tsx
{warn && <div className="p-3 rounded-lg mb-3" style={{
  background: warn.block ? 'var(--danger-bg)' : 'var(--banner-bg)',
  color: warn.block ? 'var(--danger-text)' : 'var(--banner-text)', fontSize: 13,
}}>{warn.msg}{!warn.block && ' · Salva di nuovo per confermare.'}</div>}

{existing && (
  <div className="mt-4 mb-3">
    <button
      type="button"
      className="w-full text-left px-3 py-2 rounded-lg flex items-center justify-between"
      style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}
      onClick={() => setRemindersOpen(o => !o)}
    >
      <span className="font-medium text-sm">
        Promemoria e servizi ({tasksForBooking.filter(t => t.notify && !t.done).length} attivi)
      </span>
      <span>{remindersOpen ? '▴' : '▾'}</span>
    </button>
    {remindersOpen && (
      <div className="mt-3 flex flex-col gap-3">
        <div>
          <div className="text-[11px] uppercase font-semibold mb-2" style={{ color: 'var(--ink-soft)' }}>Servizi opzionali</div>
          {tasksForBooking.filter(t => t.isService).map(t => (
            <div key={t.id} className="flex items-center gap-2 py-1">
              <input
                type="checkbox"
                checked={t.notify}
                onChange={(e) => updateTask(t.id, { notify: e.target.checked })}
              />
              <span className="text-sm flex-1">{templates.find(x => x.id === t.templateId)?.serviceLabel || t.title}</span>
              <input
                type="time"
                value={new Date(t.dueAt).toTimeString().slice(0, 5)}
                onChange={(e) => {
                  const d = new Date(t.dueAt);
                  const [hh, mm] = e.target.value.split(':').map(Number);
                  d.setHours(hh, mm, 0, 0);
                  updateTask(t.id, { dueAt: d.toISOString() });
                }}
              />
            </div>
          ))}
        </div>

        <div>
          <div className="text-[11px] uppercase font-semibold mb-2" style={{ color: 'var(--ink-soft)' }}>Promemoria automatici</div>
          <TaskList
            tasks={tasksForBooking}
            mode="automatic"
            onToggleDone={toggleDoneTask}
            onEdit={(id) => setEditingTaskId(id)}
          />
        </div>

        {!showAddCustom ? (
          <button
            type="button"
            className="btn btn-ghost w-full"
            onClick={() => {
              setCustomForm({
                title: '',
                dueAt: data.checkin ? `${data.checkin}T18:00` : '',
                notes: '',
              });
              setShowAddCustom(true);
            }}
          >
            + Aggiungi promemoria personalizzato
          </button>
        ) : (
          <div className="p-3 rounded-lg" style={{ background: 'var(--surface-2)' }}>
            <input
              type="text"
              placeholder="Titolo"
              value={customForm.title}
              onChange={(e) => setCustomForm(f => ({ ...f, title: e.target.value }))}
              className="w-full mb-2"
            />
            <input
              type="datetime-local"
              value={customForm.dueAt}
              onChange={(e) => setCustomForm(f => ({ ...f, dueAt: e.target.value }))}
              className="w-full mb-2"
            />
            <textarea
              placeholder="Note (opzionali)"
              value={customForm.notes}
              onChange={(e) => setCustomForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full mb-2"
            />
            <div className="flex gap-2 justify-end">
              <button type="button" className="btn btn-ghost" onClick={() => setShowAddCustom(false)}>Annulla</button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!customForm.title || !customForm.dueAt}
                onClick={() => {
                  if (!existing) return;
                  const now = new Date().toISOString();
                  const newTask: BookingTask = {
                    id: uid('tk'),
                    bookingId: existing.id,
                    templateId: null,
                    title: customForm.title,
                    dueAt: new Date(customForm.dueAt).toISOString(),
                    done: false,
                    notes: customForm.notes || undefined,
                    notify: true,
                    notificationStatus: 'pending',
                    isService: false,
                    createdAt: now,
                    updatedAt: now,
                  };
                  addTask(newTask);
                  setShowAddCustom(false);
                }}
              >
                Aggiungi
              </button>
            </div>
          </div>
        )}
      </div>
    )}
  </div>
)}

{editingTaskId && (() => {
  const task = tasksForBooking.find(t => t.id === editingTaskId);
  if (!task) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={() => setEditingTaskId(null)}>
      <div className="w-full max-w-md p-4 rounded-t-2xl bg-[var(--surface)]" onClick={e => e.stopPropagation()}>
        <h3 className="font-semibold mb-3">Modifica promemoria</h3>
        <input
          type="text"
          value={task.title}
          onChange={(e) => updateTask(task.id, { title: e.target.value })}
          className="w-full mb-2"
          aria-label="Titolo"
        />
        <input
          type="datetime-local"
          value={new Date(task.dueAt).toISOString().slice(0, 16)}
          onChange={(e) => updateTask(task.id, { dueAt: new Date(e.target.value).toISOString() })}
          className="w-full mb-2"
        />
        <textarea
          value={task.notes || ''}
          onChange={(e) => updateTask(task.id, { notes: e.target.value })}
          className="w-full mb-2"
          placeholder="Note"
        />
        <label className="flex items-center gap-2 text-sm mb-3">
          <input
            type="checkbox"
            checked={task.notify}
            onChange={(e) => updateTask(task.id, { notify: e.target.checked })}
          />
          Notifica abilitata
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-primary" onClick={() => setEditingTaskId(null)}>Chiudi</button>
        </div>
      </div>
    </div>
  );
})()}
```

- [ ] **Step 3: Type check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: zero errori.

- [ ] **Step 4: Smoke manuale**

Run: `npm run dev`
Apri il browser, crea un booking nuovo (verifica i task vengano creati), poi modificalo e verifica che la sezione "Promemoria e servizi" si apra e mostri i task.

- [ ] **Step 5: Commit**

```bash
git add src/components/forms/BookingForm.tsx
git commit -m "feat(form): add Promemoria e servizi section in BookingForm"
```

### Task 4.3: Task indicator nella BookingCard

**Files:**
- Modify: `src/components/common/BookingCard.tsx`

- [ ] **Step 1: Aggiornare il componente**

```tsx
// src/components/common/BookingCard.tsx (aggiungere subito dopo il blocco {b.contattoVia ...})
import { useTasks } from '../../store/tasks';
import { parseISO, nightsBetween } from '../../lib/date';

// dentro il componente, dopo le const phoneE164:
const tasks = useTasks(s => s.byBooking(b.id));
const totalActive = tasks.filter(t => t.notify);
const doneCount = totalActive.filter(t => t.done).length;
const upcoming = totalActive.filter(t => !t.done).sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0];
const allDone = totalActive.length > 0 && doneCount === totalActive.length;
const overdue = upcoming ? new Date(upcoming.dueAt).getTime() < Date.now() : false;
const indicatorColor = allDone ? '#22c55e' : (overdue ? '#f59e0b' : 'var(--ink-soft)');

// JSX: prima del </div> di chiusura della card, aggiungere:
{totalActive.length > 0 && (
  <div className="text-[11px] mt-1 flex items-center gap-1" style={{ color: indicatorColor }}>
    <span>●</span>
    <span>{doneCount}/{totalActive.length} fatti</span>
    {upcoming && !allDone && (
      <span style={{ color: 'var(--ink-soft)' }}>
        · prossimo: {new Date(upcoming.dueAt).toLocaleString('it-IT', { weekday: 'short', hour: '2-digit', minute: '2-digit' })} {upcoming.title.slice(0, 30)}{upcoming.title.length > 30 ? '…' : ''}
      </span>
    )}
  </div>
)}
```

(Inserire l'import di `useTasks` in cima e il blocco di calcolo prima del `return`.)

- [ ] **Step 2: Type check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: zero errori.

- [ ] **Step 3: Run all tests**

Run: `npm test -- --run`
Expected: tutti PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/common/BookingCard.tsx
git commit -m "feat(card): add task indicator to BookingCard"
```

### Task 4.4: Pagina Impostazioni `<TemplatesPage>`

**Files:**
- Create: `src/components/settings/TemplatesPage.tsx`
- Modify: `src/components/Home.tsx` (aggiungere link)

**NOTA**: Sostituisce la posizione provvisoria del bottone GenerateRemindersButton (era in Home, va spostato qui).

- [ ] **Step 1: Creare la pagina**

```tsx
// src/components/settings/TemplatesPage.tsx
import { useState } from 'react';
import { useTemplates } from '../../store/templates';
import { GenerateRemindersButton } from './GenerateRemindersButton';
import type { ReminderTemplate } from '../../types';

const previewTitle = (title: string) =>
  title.replace('{adulti}', '2').replace('{bambini}', '1').replace('{oraArrivo}', '15:30');

export const TemplatesPage = ({ onBack }: { onBack: () => void }) => {
  const items = useTemplates(s => s.items);
  const upsert = useTemplates(s => s.upsert);
  const remove = useTemplates(s => s.remove);
  const toggleEnabled = useTemplates(s => s.toggleEnabled);
  const [editing, setEditing] = useState<ReminderTemplate | null>(null);

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center mb-4">
        <button className="btn btn-ghost" onClick={onBack}>← Indietro</button>
        <h2 className="font-semibold flex-1 text-center">Promemoria e template</h2>
      </div>

      <ul className="flex flex-col gap-2 mb-4">
        {[...items].sort((a, b) => a.sortOrder - b.sortOrder).map(t => (
          <li key={t.id} className="p-3 rounded-xl border" style={{ borderColor: 'var(--line)', opacity: t.enabled ? 1 : 0.5 }}>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={t.enabled} onChange={() => toggleEnabled(t.id)} aria-label={`Abilita ${t.title}`} />
              <div className="flex-1">
                <div className="font-medium text-sm">{previewTitle(t.title)}</div>
                <div className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>
                  {t.anchor === 'check-in' ? 'Check-in' : 'Check-out'}{t.offsetDays > 0 ? ` +${t.offsetDays}` : t.offsetDays < 0 ? ` ${t.offsetDays}` : ''} · {t.defaultTime}
                  {t.isService && ' · servizio'}
                </div>
              </div>
              <button className="btn btn-ghost text-[12px]" onClick={() => setEditing(t)}>✏️</button>
              {!t.builtIn && (
                <button className="btn btn-ghost text-[12px]" onClick={() => remove(t.id)}>🗑️</button>
              )}
            </div>
          </li>
        ))}
      </ul>

      <button className="btn btn-primary mb-4" onClick={() => setEditing({
        id: 'custom_' + Date.now(), builtIn: false, enabled: true,
        title: '', isService: false, anchor: 'check-in', offsetDays: 0,
        defaultTime: '09:00', notify: true, sortOrder: 1000,
      })}>
        + Nuovo template
      </button>

      <GenerateRemindersButton />

      {editing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={() => setEditing(null)}>
          <div className="w-full max-w-md p-4 rounded-t-2xl bg-[var(--surface)]" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold mb-3">Modifica template</h3>
            <label className="field"><span>Titolo</span>
              <input type="text" value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} />
            </label>
            <div className="text-[11px] mb-2" style={{ color: 'var(--ink-soft)' }}>
              Anteprima: {previewTitle(editing.title)}
            </div>
            <label className="field"><span>Orario default</span>
              <input type="time" value={editing.defaultTime} onChange={e => setEditing({ ...editing, defaultTime: e.target.value })} />
            </label>
            {!editing.builtIn && (
              <>
                <label className="field"><span>Ancorato a</span>
                  <select value={editing.anchor} onChange={e => setEditing({ ...editing, anchor: e.target.value as 'check-in' | 'check-out' })}>
                    <option value="check-in">Check-in</option>
                    <option value="check-out">Check-out</option>
                  </select>
                </label>
                <label className="field"><span>Offset giorni</span>
                  <input type="number" value={editing.offsetDays} onChange={e => setEditing({ ...editing, offsetDays: Number(e.target.value) })} />
                </label>
              </>
            )}
            <label className="flex items-center gap-2 text-sm mb-2">
              <input type="checkbox" checked={editing.isService} onChange={e => setEditing({ ...editing, isService: e.target.checked })} />
              È un servizio (compare come checkbox nel form)
            </label>
            <label className="flex items-center gap-2 text-sm mb-3">
              <input type="checkbox" checked={editing.notify} onChange={e => setEditing({ ...editing, notify: e.target.checked })} />
              Genera notifica
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>Annulla</button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!editing.title}
                onClick={() => { upsert(editing); setEditing(null); }}
              >
                Salva
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Aggiungere navigazione in Home.tsx**

Modifica `src/components/Home.tsx` aggiungendo un quarto bottone nella griglia `home-buttons` che apre la TemplatesPage. La Home esistente esporta `Home` come named export e usa la griglia con classe `home-buttons`.

```tsx
// src/components/Home.tsx — versione finale
import { useState } from 'react';
import { useBookings } from '../store/bookings';
import { usePromemoria } from '../store/promemoria';
import { useUI } from '../store/ui';
import { ThemeToggle } from './ThemeToggle';
import { SyncIndicator } from './SyncIndicator';
import { parseISO, nightsBetween, iso } from '../lib/date';
import { TemplatesPage } from './settings/TemplatesPage';

export const Home = () => {
  const bookings = useBookings(s => s.items);
  const promemoria = usePromemoria(s => s.items);
  const { goCalendar, openSide } = useUI();
  const [showTemplates, setShowTemplates] = useState(false);

  if (showTemplates) return <TemplatesPage onBack={() => setShowTemplates(false)} />;

  const todoCount = bookings.filter(b => b.stato === 'proposta' || b.stato === 'anticipo_atteso').length
    + promemoria.filter(p => !p.done).length;
  const today = iso(new Date());
  const arriviCount = bookings.filter(b =>
    b.stato !== 'proposta' &&
    parseISO(b.checkin) >= parseISO(today) &&
    nightsBetween(today, b.checkin) <= 30
  ).length;

  const goDafare = () => { goCalendar(); openSide({ kind: 'todo' }); };
  const goArrivi = () => { goCalendar(); openSide({ kind: 'arrivi' }); };

  return (
    <section className="home">
      <ThemeToggle floating />
      <div style={{ position: 'absolute', top: 'calc(env(safe-area-inset-top) + 14px)', right: '66px' }}>
        <SyncIndicator />
      </div>
      <div className="home-hero">
        <div className="logo" style={{ background: 'linear-gradient(135deg,var(--lampone),var(--mirtillo))' }}>🏡</div>
        <h1>Cuore di Bosco</h1>
        <p>Cosa vuoi fare?</p>
      </div>
      <div className="home-buttons">
        <button className="home-btn" onClick={goDafare}>
          <span className={'badge warn' + (todoCount === 0 ? ' zero' : '')}>{todoCount}</span>
          <span className="icn">🔔</span>
          <span className="ttl">Da fare</span>
          <span className="sub">Promemoria, proposte in attesa, anticipi da ricevere</span>
        </button>
        <button className="home-btn" onClick={goCalendar}>
          <span className="icn">📅</span>
          <span className="ttl">Calendario</span>
          <span className="sub">Vista mese · trimestre · semestre · anno</span>
        </button>
        <button className="home-btn" onClick={goArrivi}>
          <span className={'badge neutral' + (arriviCount === 0 ? ' zero' : '')}>{arriviCount}</span>
          <span className="icn">🧳</span>
          <span className="ttl">Arrivi</span>
          <span className="sub">Chi sta per arrivare nei prossimi 30 giorni</span>
        </button>
        <button className="home-btn" onClick={() => setShowTemplates(true)}>
          <span className="icn">⚙️</span>
          <span className="ttl">Promemoria</span>
          <span className="sub">Template e impostazioni notifiche</span>
        </button>
      </div>
    </section>
  );
};
```

- [ ] **Step 3: Type check + lint + test**

Run: `npx tsc --noEmit && npm run lint && npm test -- --run`
Expected: zero errori.

- [ ] **Step 4: Commit**

```bash
git add src/components/settings/TemplatesPage.tsx src/components/Home.tsx
git commit -m "feat(settings): TemplatesPage to manage reminder templates globally"
```

### Task 4.5: Update di MEMORY.md alla fine della Phase 4

- [ ] **Step 1: Creare file di memoria**

Crea `C:/Users/Mara/.claude/projects/d--Workspace-CPP/memory/feature_pwa_reminders.md`:

```markdown
---
name: PWA Reminders feature
description: Promemoria locali per booking con template configurabili e notifiche programmate
type: project
---

PWA + Reminders feature implementata in 6 fasi (commit history su branch fix/eslint-errors).
- 9 template default seedati al boot (preparation, check-in-today, documents, receipt-issue, receipt-print, tourism-tax, istat-questura, merenda, cena)
- BookingTask materializzato all'apertura del booking, ricalcolato su cambio date/ospiti
- Sync via 2 nuovi sheet `tasks` e `reminder_templates`
- notificationStatus mantenuto solo locale (non sincronizzato)

**Why:** Workflow operativo del B&B richiede checklist ricorrente per ogni booking (preparazione camera, registrazione documenti, fiscale, ISTAT/questura, servizi). Ridondante farlo a memoria → reminders automatici.

**How to apply:** Quando si lavora su feature legate a booking, considerare se le modifiche debbano riflettersi sui task associati (es. nuovo campo booking → eventualmente nuovo placeholder template). Non modificare template builtIn senza confronto.
```

- [ ] **Step 2: Aggiungere riga in MEMORY.md**

Apri `C:/Users/Mara/.claude/projects/d--Workspace-CPP/memory/MEMORY.md` e aggiungi:

```markdown
- [PWA Reminders](feature_pwa_reminders.md) — Promemoria locali per booking con template configurabili
```

(Nessun commit git: la memory directory è esterna al repo.)

---

## Phase 5 — Notifiche foreground (3 task)

### Task 5.1: `permission.ts` (richiesta permesso + registra periodicSync)

**Files:**
- Create: `src/lib/notifications/permission.ts`
- Create: `src/store/notifications.ts`

- [ ] **Step 1: Creare lo store**

```ts
// src/store/notifications.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface State {
  permission: 'default' | 'granted' | 'denied';
  bannerDismissed: boolean;
  setPermission: (p: 'default' | 'granted' | 'denied') => void;
  dismissBanner: () => void;
}

export const useNotificationsStore = create<State>()(
  persist(
    (set) => ({
      permission: 'default',
      bannerDismissed: false,
      setPermission: (p) => set({ permission: p }),
      dismissBanner: () => set({ bannerDismissed: true }),
    }),
    { name: 'cdb_notifications' },
  ),
);
```

- [ ] **Step 2: Creare il modulo permission**

```ts
// src/lib/notifications/permission.ts
import { useNotificationsStore } from '../../store/notifications';

interface PeriodicSyncManager {
  register: (tag: string, opts?: { minInterval: number }) => Promise<void>;
}

interface RegistrationWithSync extends ServiceWorkerRegistration {
  periodicSync?: PeriodicSyncManager;
}

export const requestNotificationPermission = async (): Promise<'granted' | 'denied' | 'default'> => {
  if (!('Notification' in window)) return 'denied';
  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    useNotificationsStore.getState().setPermission(Notification.permission);
    return Notification.permission;
  }
  const result = await Notification.requestPermission();
  useNotificationsStore.getState().setPermission(result);
  if (result === 'granted') void registerPeriodicSync();
  return result;
};

export const registerPeriodicSync = async (): Promise<boolean> => {
  if (!('serviceWorker' in navigator)) return false;
  const reg = (await navigator.serviceWorker.ready) as RegistrationWithSync;
  if (!reg.periodicSync) return false;
  try {
    await reg.periodicSync.register('check-overdue-tasks', { minInterval: 6 * 60 * 60 * 1000 });
    return true;
  } catch (err) {
    console.warn('[notifications] periodicSync register failed', err);
    return false;
  }
};

export const isStandalone = (): boolean =>
  window.matchMedia('(display-mode: standalone)').matches ||
  // iOS Safari
  ('standalone' in window.navigator && (window.navigator as Navigator & { standalone?: boolean }).standalone === true);
```

- [ ] **Step 3: Type check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: zero errori.

- [ ] **Step 4: Commit**

```bash
git add src/lib/notifications/permission.ts src/store/notifications.ts
git commit -m "feat(notifications): permission flow and periodicSync registration"
```

### Task 5.2: Foreground scheduler + test

**Files:**
- Create: `src/lib/notifications/foregroundScheduler.ts`
- Test: `tests/lib/notifications/foregroundScheduler.test.ts`

- [ ] **Step 1: Scrivere il test**

```ts
// tests/lib/notifications/foregroundScheduler.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { scheduleTask, cancelAll, getActiveCount } from '../../../src/lib/notifications/foregroundScheduler';
import type { BookingTask } from '../../../src/types';

const t = (over: Partial<BookingTask>): BookingTask => ({
  id: 'a', bookingId: 'b1', templateId: 'preparation',
  title: 'X', dueAt: new Date(Date.now() + 1000).toISOString(),
  done: false, notify: true, notificationStatus: 'pending', isService: false,
  createdAt: '2026-05-04T10:00:00.000Z', updatedAt: '2026-05-04T10:00:00.000Z',
  ...over,
});

describe('foregroundScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    cancelAll();
    // mock di Notification
    (globalThis as unknown as { Notification: unknown }).Notification = vi.fn(function MockNotification() { /* noop */ });
    (globalThis as unknown as { Notification: { permission: string } }).Notification.permission = 'granted';
  });
  afterEach(() => {
    vi.useRealTimers();
    cancelAll();
  });

  it('schedula un timeout per un task entro 24h', () => {
    const task = t({ dueAt: new Date(Date.now() + 5000).toISOString() });
    const onShown = vi.fn();
    scheduleTask(task, onShown);
    expect(getActiveCount()).toBe(1);
  });
  it('NON schedula task oltre 24h', () => {
    const task = t({ dueAt: new Date(Date.now() + 25 * 3600 * 1000).toISOString() });
    scheduleTask(task, vi.fn());
    expect(getActiveCount()).toBe(0);
  });
  it('NON schedula task con notify=false', () => {
    scheduleTask(t({ notify: false }), vi.fn());
    expect(getActiveCount()).toBe(0);
  });
  it('NON schedula task done o gia mostrato', () => {
    scheduleTask(t({ done: true }), vi.fn());
    scheduleTask(t({ id: 'b', notificationStatus: 'shown' }), vi.fn());
    expect(getActiveCount()).toBe(0);
  });
  it('al timeout chiama onShown e crea Notification', () => {
    const task = t({ dueAt: new Date(Date.now() + 5000).toISOString() });
    const onShown = vi.fn();
    scheduleTask(task, onShown);
    vi.advanceTimersByTime(6000);
    expect(onShown).toHaveBeenCalledWith(task.id);
    expect((globalThis as unknown as { Notification: ReturnType<typeof vi.fn> }).Notification).toHaveBeenCalled();
  });
  it('cancelAll svuota i timeout', () => {
    scheduleTask(t({ dueAt: new Date(Date.now() + 5000).toISOString() }), vi.fn());
    cancelAll();
    expect(getActiveCount()).toBe(0);
  });
});
```

- [ ] **Step 2: Run del test (FAIL)**

Run: `npm test -- --run tests/lib/notifications/foregroundScheduler.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementare**

```ts
// src/lib/notifications/foregroundScheduler.ts
import type { BookingTask } from '../../types';

const MAX_AHEAD_MS = 24 * 60 * 60 * 1000;
const timers = new Map<string, ReturnType<typeof setTimeout>>();

export const scheduleTask = (task: BookingTask, onShown: (taskId: string) => void): void => {
  if (timers.has(task.id)) return; // already scheduled
  if (!task.notify || task.done || task.deletedAt) return;
  if (task.notificationStatus !== 'pending') return;
  const ms = new Date(task.dueAt).getTime() - Date.now();
  if (ms < 0 || ms > MAX_AHEAD_MS) return;
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

  const handle = setTimeout(() => {
    try {
      new Notification(task.title, {
        body: task.notes,
        tag: task.id,
        data: { bookingId: task.bookingId, taskId: task.id },
      });
      onShown(task.id);
    } catch (err) {
      console.warn('[fg-scheduler] notification failed', err);
    } finally {
      timers.delete(task.id);
    }
  }, ms);
  timers.set(task.id, handle);
};

export const cancelTask = (taskId: string): void => {
  const h = timers.get(taskId);
  if (h) {
    clearTimeout(h);
    timers.delete(taskId);
  }
};

export const cancelAll = (): void => {
  for (const h of timers.values()) clearTimeout(h);
  timers.clear();
};

export const getActiveCount = (): number => timers.size;
```

- [ ] **Step 4: Run del test (PASS)**

Run: `npm test -- --run tests/lib/notifications/foregroundScheduler.test.ts`
Expected: tutti PASS.

- [ ] **Step 5: Lint + commit**

```bash
npm run lint
git add src/lib/notifications/foregroundScheduler.ts tests/lib/notifications/foregroundScheduler.test.ts
git commit -m "feat(notifications): foreground scheduler with 24h horizon"
```

### Task 5.3: Hook nello store tasks per scheduler in App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Subscribe + cleanup**

```tsx
// src/App.tsx (aggiungere import e useEffect)
import { useEffect } from 'react';
import { useAuth } from './store/auth';
import { useUI } from './store/ui';
import { Home } from './components/Home';
import { CalendarPage } from './components/calendar/CalendarPage';
import { SignIn } from './components/SignIn';
import { InstallPrompt } from './components/InstallPrompt';
import { initAuth, startTokenAutoRefresh } from './lib/google/auth';
import { bootSync } from './lib/sync';
import { useTemplates } from './store/templates';
import { useTasks } from './store/tasks';
import { idbGet } from './lib/idb';
import type { BookingTask } from './types';
import { scheduleTask, cancelAll, cancelTask } from './lib/notifications/foregroundScheduler';

export default function App() {
  const user = useAuth(s => s.user);
  const page = useUI(s => s.page);

  useEffect(() => {
    void initAuth().then(startTokenAutoRefresh);
    useTemplates.getState().seedDefaults();
    void idbGet<BookingTask[]>('tasks', 'all').then(arr => {
      if (arr) useTasks.setState({ items: arr });
    });
  }, []);

  useEffect(() => {
    if (user) void bootSync();
  }, [user]);

  // foreground scheduler: re-schedule on tasks store updates
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

  if (!user) return <SignIn />;
  return (
    <>
      <InstallPrompt />
      {page === 'home' ? <Home /> : <CalendarPage />}
    </>
  );
}
```

- [ ] **Step 2: Type check + lint + test**

Run: `npx tsc --noEmit && npm run lint && npm test -- --run`
Expected: zero errori, tutti PASS.

- [ ] **Step 3: Smoke manuale**

Run: `npm run dev` → crea un booking con un task `dueAt` 30 secondi nel futuro → osserva la notifica.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat(notifications): foreground scheduler hook in App"
```

---

## Phase 6 — Notifiche background (5 task)

### Task 6.1: Estendere il SW con `periodicsync` handler

**Files:**
- Modify: `src/sw.ts`

- [ ] **Step 1: Aggiungere logica periodicsync e click**

```ts
// src/sw.ts
/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching';
import { openDB } from 'idb';
import type { BookingTask } from './types';
import { pickToNotify } from './lib/reminders/pickToNotify';

declare const self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('install', () => {
  void self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

const DB = 'cdb_cache';
const VERSION = 2;

const readTasks = async (): Promise<BookingTask[]> => {
  const db = await openDB(DB, VERSION);
  const arr = (await db.get('tasks', 'all')) as BookingTask[] | undefined;
  return arr || [];
};

const writeTasks = async (items: BookingTask[]) => {
  const db = await openDB(DB, VERSION);
  await db.put('tasks', items, 'all');
};

interface PeriodicSyncEvent extends ExtendableEvent {
  tag: string;
}

self.addEventListener('periodicsync', (event: Event) => {
  const e = event as PeriodicSyncEvent;
  if (e.tag !== 'check-overdue-tasks') return;
  e.waitUntil((async () => {
    const tasks = await readTasks();
    const overdue = pickToNotify(tasks, new Date());
    if (overdue.length === 0) return;
    const nowIso = new Date().toISOString();
    for (const t of overdue) {
      await self.registration.showNotification(t.title, {
        body: t.notes,
        tag: t.id,
        data: { bookingId: t.bookingId, taskId: t.id },
      });
    }
    const updated = tasks.map(t => {
      if (overdue.some(o => o.id === t.id)) {
        return { ...t, notificationStatus: 'shown' as const, notificationShownAt: nowIso };
      }
      return t;
    });
    await writeTasks(updated);
  })());
});

self.addEventListener('notificationclick', (event) => {
  const e = event as NotificationEvent;
  const data = e.notification.data as { bookingId?: string; taskId?: string } | undefined;
  e.notification.close();
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const url = `/CPP/?booking=${data?.bookingId ?? ''}&task=${data?.taskId ?? ''}`;
    const existing = wins.find(w => w.url.includes('/CPP/'));
    if (existing) {
      await existing.focus();
      existing.postMessage({ type: 'open-task', bookingId: data?.bookingId, taskId: data?.taskId });
    } else {
      await self.clients.openWindow(url);
    }
  })());
});
```

- [ ] **Step 2: Build di verifica**

Run: `npm run build`
Expected: PASS, sw.js generato senza errori.

- [ ] **Step 3: Commit**

```bash
git add src/sw.ts
git commit -m "feat(sw): periodicsync handler and notification click"
```

### Task 6.2: Bridge postMessage SW→client al boot

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Aggiungere subscribe a SW messages e re-hydrate da IDB**

Aggiungi nell'`useEffect` esistente che fa hydrate al boot:

```tsx
// src/App.tsx — aggiungere dentro il primo useEffect dopo idbGet('tasks', 'all').then(...)
useEffect(() => {
  void initAuth().then(startTokenAutoRefresh);
  useTemplates.getState().seedDefaults();
  void idbGet<BookingTask[]>('tasks', 'all').then(arr => {
    if (arr) useTasks.setState({ items: arr });
  });

  if ('serviceWorker' in navigator) {
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'open-task') {
        // Hook per aprire la modal del booking — implementare lookup via UI store
        const { bookingId } = e.data as { bookingId?: string };
        if (bookingId) useUI.getState().openModal({ kind: 'booking', id: bookingId });
        // Re-hydrate i task perché il SW potrebbe averli aggiornati
        void idbGet<BookingTask[]>('tasks', 'all').then(arr => {
          if (arr) useTasks.setState({ items: arr });
        });
      }
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }
}, []);
```

- [ ] **Step 2: Lookup query string al boot**

Subito dopo il primo useEffect, aggiungere:

```tsx
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const bookingId = params.get('booking');
  if (bookingId) {
    useUI.getState().openModal({ kind: 'booking', id: bookingId });
    window.history.replaceState({}, '', window.location.pathname);
  }
}, []);
```

(import `useUI` se non c'è già.)

- [ ] **Step 3: Type check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: zero errori.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat(notifications): SW message bridge and deep link from notification"
```

### Task 6.3: NotificationOnboarding banner

**Files:**
- Create: `src/components/NotificationOnboarding.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Creare il componente**

```tsx
// src/components/NotificationOnboarding.tsx
import { useBookings } from '../store/bookings';
import { useNotificationsStore } from '../store/notifications';
import { isStandalone, requestNotificationPermission } from '../lib/notifications/permission';

export const NotificationOnboarding = () => {
  const bookings = useBookings(s => s.items);
  const permission = useNotificationsStore(s => s.permission);
  const dismissed = useNotificationsStore(s => s.bannerDismissed);
  const dismiss = useNotificationsStore(s => s.dismissBanner);

  if (bookings.length === 0) return null;
  if (permission !== 'default') return null;
  if (dismissed) return null;
  if (!isStandalone()) return null;

  return (
    <div
      className="px-4 py-3 flex items-center gap-3"
      style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--line)' }}
    >
      <div className="text-sm flex-1">🔔 Vuoi attivare i promemoria sul telefono?</div>
      <button className="btn btn-ghost" onClick={dismiss}>Più tardi</button>
      <button
        className="btn btn-primary"
        onClick={() => { void requestNotificationPermission(); }}
      >
        Attiva
      </button>
    </div>
  );
};
```

- [ ] **Step 2: Inserirlo in App.tsx**

```tsx
// src/App.tsx (nel return, dopo InstallPrompt)
return (
  <>
    <InstallPrompt />
    <NotificationOnboarding />
    {page === 'home' ? <Home /> : <CalendarPage />}
  </>
);
```

(import del componente in cima)

- [ ] **Step 3: Type check + lint + test**

Run: `npx tsc --noEmit && npm run lint && npm test -- --run`
Expected: zero errori.

- [ ] **Step 4: Commit**

```bash
git add src/components/NotificationOnboarding.tsx src/App.tsx
git commit -m "feat(notifications): onboarding banner for permission grant"
```

### Task 6.4: Test handler `periodicsync`

**Files:**
- Test: `tests/lib/sw/periodicSync.test.ts` (test della logica isolata)

**NOTA**: Testiamo la logica del filtro pickToNotify integrata col mock di IndexedDB, non il handler vero (richiederebbe un workbox runtime). Il vero test è manuale in fase 6.5.

- [ ] **Step 1: Scrivere il test**

Crea `tests/lib/sw/periodicSync.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import type { BookingTask } from '../../../src/types';
import { pickToNotify } from '../../../src/lib/reminders/pickToNotify';

const t = (over: Partial<BookingTask>): BookingTask => ({
  id: 'a', bookingId: 'b1', templateId: 'preparation',
  title: 'X', dueAt: '2026-05-04T08:00:00.000Z',
  done: false, notify: true, notificationStatus: 'pending', isService: false,
  createdAt: '2026-05-01T00:00:00.000Z', updatedAt: '2026-05-01T00:00:00.000Z',
  ...over,
});

describe('SW periodicsync logic (integration with IDB)', () => {
  it('legge tasks da IDB e seleziona i due overdue notifiable', async () => {
    const db = await openDB('cdb_cache', 2, {
      upgrade(d) {
        if (!d.objectStoreNames.contains('tasks')) d.createObjectStore('tasks');
      },
    });
    const tasks: BookingTask[] = [
      t({ id: '1', dueAt: '2026-05-04T07:00:00.000Z' }),                  // overdue
      t({ id: '2', dueAt: '2026-05-04T07:30:00.000Z' }),                  // overdue
      t({ id: '3', dueAt: '2026-05-04T20:00:00.000Z' }),                  // future
      t({ id: '4', dueAt: '2026-05-04T07:00:00.000Z', done: true }),      // done
      t({ id: '5', dueAt: '2026-05-04T07:00:00.000Z', notificationStatus: 'shown' }), // already shown
    ];
    await db.put('tasks', tasks, 'all');

    const stored = (await db.get('tasks', 'all')) as BookingTask[];
    const overdue = pickToNotify(stored, new Date('2026-05-04T10:00:00.000Z'));
    expect(overdue.map(t => t.id)).toEqual(['1', '2']);

    // simulate SW marking shown
    const updated = stored.map(t => overdue.some(o => o.id === t.id) ? { ...t, notificationStatus: 'shown' as const } : t);
    await db.put('tasks', updated, 'all');

    const after = (await db.get('tasks', 'all')) as BookingTask[];
    expect(after.find(x => x.id === '1')!.notificationStatus).toBe('shown');
    expect(after.find(x => x.id === '3')!.notificationStatus).toBe('pending');
  });
});
```

- [ ] **Step 2: Run del test**

Run: `npm test -- --run tests/lib/sw/periodicSync.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/lib/sw/periodicSync.test.ts
git commit -m "test(sw): periodicsync logic integration with IDB"
```

### Task 6.5: Smoke E2E manuale su Android

**Files:** (nessuna modifica codice)

- [ ] **Step 1: Build production e deploy locale**

Run:
```bash
npm run build
npm run preview -- --host
```
Annota l'IP esposto (es. `http://192.168.1.x:4173`).

- [ ] **Step 2: Da Chrome Android**

1. Apri `http://<ip>:4173/CPP/` (stesso WiFi)
2. Menu Chrome → "Installa app"
3. Dopo l'installazione, apri l'app dall'icona home
4. Se appare il banner "Vuoi attivare i promemoria?" → tocca "Attiva"
5. Concedi il permesso notifiche
6. Crea un booking con check-in oggi
7. Modifica un task per portarlo a `dueAt: now + 30s`
8. Chiudi l'app (sweep da recents)
9. Aspetta — entro qualche minuto/ore (se PeriodicSync) o entro 30s (se foreground scheduler tornasse attivo)

**Nota**: PeriodicSync triggers sono a discrezione di Chrome (legati alla "site engagement"). Lo smoke realistico richiede ore. Per validazione veloce: testare il foreground scheduler (app aperta).

- [ ] **Step 3: Verificare**
- Notifica appare con titolo del task
- Tap sulla notifica apre l'app sul booking corretto
- `notificationStatus` passa a `'shown'` in IDB

- [ ] **Step 4: Aggiornare MEMORY.md**

Aggiungi nota nel file `feature_pwa_reminders.md` creato in Task 4.5:

```markdown
**Validazione manuale (2026-05-XX):** smoke test eseguito su Android Chrome — installazione PWA, permessi notifiche, foreground scheduler funzionante. Periodic sync da rivalutare in produzione (può richiedere giorni di engagement per attivarsi).
```

- [ ] **Step 5: Lint full + test full + build full (Definition of Done)**

Run:
```bash
npm run lint
npm test -- --run
npm run build
```
Expected: tutto verde.

- [ ] **Step 6: Commit finale (se ci sono modifiche di lint)**

```bash
git status
# se ci sono modifiche
git add -A
git commit -m "chore: final lint/build pass for PWA reminders feature"
```

---

## Riepilogo finale

Alla fine delle 6 fasi avrai:
- ~30 commit incrementali sul branch
- 9 template default seedati
- Sistema task end-to-end (form → store → IDB → Sheets → notifiche)
- Foreground scheduler funzionante in tutte le sessioni con permesso
- Background scheduler funzionante quando supportato dal browser
- Test totali: ~30 nuovi test (logica pura + store + componenti + integration IDB)

**Workflow di chiusura (regola di progetto):**

1. `npm run lint` — zero errori
2. `npm test -- --run` — tutti PASS
3. `npm run build` — succede
4. Smoke manuale su Android (Task 6.5)
5. Aggiornare `MEMORY.md` (regola Workflow #4)
6. Suggerire commit message finale all'utente
7. Chiedere conferma per push e merge su main
