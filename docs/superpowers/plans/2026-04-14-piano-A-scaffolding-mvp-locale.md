# Piano A — Scaffolding + MVP Locale Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Portare il prototipo HTML a un'app React/TypeScript modulare e mantenibile, con tutti i flussi funzionanti su `localStorage` (no Google ancora). Risultato: `npm run dev` apre l'app identica al prototipo ma costruita correttamente.

**Architecture:** Vite + React + TypeScript + Tailwind. State con Zustand (persist localStorage). Componenti funzionali, hook standard. Logica pura testata con Vitest. UI portata dal prototipo (`prototipo-calendario.html`) sezione per sezione.

**Tech Stack:** Vite 5 · React 18 · TypeScript 5 · Tailwind 3 · Zustand 4 · Vitest 1 · React Testing Library

**Riferimento ground truth:** `prototipo-calendario.html` è la verità per UI/CSS/comportamento. Quando un task dice "porta dal prototipo X-Y", aprilo e riporta esattamente.

---

## File Structure

```
src/
├── main.tsx                          # Entry point
├── App.tsx                           # Router home/calendar
├── index.css                         # CSS tokens + Tailwind directives
├── types.ts                          # Tutte le interfacce
├── lib/
│   ├── date.ts                       # iso, parseISO, nightsBetween, ecc.
│   ├── conflicts.ts                  # checkConflicts() pura
│   └── id.ts                         # uid()
├── store/
│   ├── bookings.ts                   # Zustand + persist localStorage
│   ├── closures.ts                   # idem
│   ├── promemoria.ts                 # idem
│   ├── settings.ts                   # tema, anchor, view
│   └── ui.ts                         # side panel state
├── components/
│   ├── Home.tsx                      # Pagina iniziale 3 bottoni
│   ├── ThemeToggle.tsx
│   ├── common/
│   │   ├── Modal.tsx                 # base bottom-sheet mobile
│   │   ├── SidePanel.tsx             # slide-in destro
│   │   └── ChipGroup.tsx
│   ├── calendar/
│   │   ├── CalendarPage.tsx          # topbar + view + bottombar
│   │   ├── Topbar.tsx
│   │   ├── BottomBar.tsx
│   │   ├── MonthGoogleView.tsx       # vista Mese
│   │   ├── VerticalGanttView.tsx     # vista Trim/Sem/Anno
│   │   └── ViewSwitch.tsx
│   ├── forms/
│   │   ├── BookingForm.tsx
│   │   └── ClosureForm.tsx
│   └── panels/
│       ├── DayDetailPanel.tsx
│       ├── TodoPanel.tsx
│       └── ArrivalsPanel.tsx
└── data/
    └── mock.ts                       # MOCK_DATA / MOCK_CHIUSURE / MOCK_PROMEMORIA per dev
tests/
├── lib/
│   ├── date.test.ts
│   └── conflicts.test.ts
└── store/
    └── bookings.test.ts
```

**Convenzioni:**
- Un file per componente/responsabilità
- Tutti i tipi in `types.ts` (single source of truth)
- Logica pura in `lib/` (testabile senza React)
- Niente magic numbers: costanti in `lib/constants.ts` se servono

---

## Phase 0 — Scaffolding

### Task 0.1: Inizializzare progetto Vite

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`

- [ ] **Step 1: Creare progetto Vite con template React-TS**

```bash
cd d:/Workspace/CPP
npm create vite@latest app -- --template react-ts
cd app
npm install
```

- [ ] **Step 2: Verificare che parta**

```bash
npm run dev
```

Apri `http://localhost:5173` → vedi pagina Vite default.

- [ ] **Step 3: Commit**

```bash
git add app/
git commit -m "chore: scaffold Vite React TS"
```

### Task 0.2: Aggiungere Tailwind

**Files:**
- Create: `app/tailwind.config.js`, `app/postcss.config.js`
- Modify: `app/src/index.css`

- [ ] **Step 1: Installare Tailwind**

```bash
cd app
npm install -D tailwindcss@^3 postcss autoprefixer
npx tailwindcss init -p
```

- [ ] **Step 2: Configurare `tailwind.config.js`**

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
};
```

- [ ] **Step 3: Sostituire `src/index.css` con direttive Tailwind + reset**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html,body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;-webkit-tap-highlight-color:transparent}
```

- [ ] **Step 4: Verificare che funziona**

In `App.tsx` aggiungi `<div className="bg-green-500 text-white p-4">test</div>`. Avvia `npm run dev` → blocco verde visibile. Poi rimuovi.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: add Tailwind"
```

### Task 0.3: Aggiungere Zustand + Vitest

**Files:**
- Modify: `app/package.json`
- Create: `app/vitest.config.ts`

- [ ] **Step 1: Installare**

```bash
cd app
npm install zustand
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 2: Creare `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom', globals: true, setupFiles: ['./tests/setup.ts'] },
});
```

- [ ] **Step 3: Creare `tests/setup.ts`**

```ts
import '@testing-library/jest-dom';
```

- [ ] **Step 4: Aggiungere script test in `package.json`**

```json
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 5: Verifica**

```bash
npm run test
```

Expected: "No test files found" (non c'è ancora niente — è OK).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: add Zustand and Vitest"
```

---

## Phase 1 — Tipi e utility pure

### Task 1.1: Definire tutti i tipi in `types.ts`

**Files:**
- Create: `app/src/types.ts`

- [ ] **Step 1: Scrivere il file completo**

```ts
export type Camera = 'lampone' | 'mirtillo';
export type Stato = 'proposta' | 'anticipo_atteso' | 'confermato';
export type ContattoVia = 'telefono' | 'whatsapp' | 'mail' | 'ota';
export type AnticipoTipo = 'bonifico' | 'sito_bb' | 'ota';
export type Tema = 'light' | 'dark' | 'auto';
export type Vista = 'mese' | 'trim' | 'sem' | 'anno';

export interface Anticipo {
  importo: number;
  data?: string;        // ISO date YYYY-MM-DD
  tipo?: AnticipoTipo;
}

export interface Prenotazione {
  id: string;
  camera: Camera;
  checkin: string;      // ISO date
  checkout: string;     // ISO date (esclusivo)
  stato: Stato;
  nome: string;
  riferimento?: string;
  numOspiti?: number;
  contattoVia?: ContattoVia;
  contattoValore?: string;
  prezzoTotale?: number;
  anticipo?: Anticipo;
  note?: string;
  creatoIl: string;     // ISO datetime
  aggiornatoIl: string; // ISO datetime
}

export interface Chiusura {
  id: string;
  start: string;        // ISO date inclusivo
  end: string;          // ISO date inclusivo
  note?: string;
}

export interface Promemoria {
  id: string;
  testo: string;
  createdAt: string;    // ISO datetime
  done: boolean;
}

export interface Conflict {
  block: boolean;
  msg: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add app/src/types.ts
git commit -m "feat(types): define data model"
```

### Task 1.2: Date utils — TDD

**Files:**
- Create: `app/src/lib/date.ts`, `app/tests/lib/date.test.ts`

- [ ] **Step 1: Scrivere i test prima**

```ts
// tests/lib/date.test.ts
import { describe, it, expect } from 'vitest';
import { iso, parseISO, nightsBetween, addDays, isWeekend } from '../../src/lib/date';

describe('date utils', () => {
  it('iso() converte Date a YYYY-MM-DD', () => {
    expect(iso(new Date(2026, 3, 14))).toBe('2026-04-14');
  });
  it('parseISO() interpreta YYYY-MM-DD a Date locale', () => {
    const d = parseISO('2026-04-14');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(3);
    expect(d.getDate()).toBe(14);
  });
  it('nightsBetween() conta i giorni tra due date ISO', () => {
    expect(nightsBetween('2026-04-10', '2026-04-14')).toBe(4);
    expect(nightsBetween('2026-04-10', '2026-04-10')).toBe(0);
  });
  it('addDays() somma giorni (anche negativi)', () => {
    expect(iso(addDays(parseISO('2026-04-14'), 3))).toBe('2026-04-17');
    expect(iso(addDays(parseISO('2026-04-14'), -1))).toBe('2026-04-13');
  });
  it('isWeekend() identifica sab/dom', () => {
    expect(isWeekend(new Date(2026, 3, 18))).toBe(true);  // sabato
    expect(isWeekend(new Date(2026, 3, 19))).toBe(true);  // domenica
    expect(isWeekend(new Date(2026, 3, 20))).toBe(false); // lunedì
  });
});
```

- [ ] **Step 2: Eseguire — deve fallire**

```bash
cd app && npm run test
```

Expected: tutti i test rossi con "Cannot find module".

- [ ] **Step 3: Implementare `lib/date.ts`**

```ts
export const iso = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const parseISO = (s: string): Date => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const nightsBetween = (a: string, b: string): number =>
  Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86400000);

export const addDays = (d: Date, n: number): Date => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};

export const isWeekend = (d: Date): boolean => {
  const day = d.getDay();
  return day === 0 || day === 6;
};

export const MONTHS = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
export const MONTHS_SHORT = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];
export const WD = ['D','L','M','M','G','V','S'];
```

- [ ] **Step 4: Eseguire test — devono passare**

```bash
npm run test
```

Expected: 5 verdi.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/date.ts app/tests/lib/date.test.ts
git commit -m "feat(lib): date utils with tests"
```

### Task 1.3: ID generator

**Files:**
- Create: `app/src/lib/id.ts`

- [ ] **Step 1: Implementare**

```ts
export const uid = (prefix = 'b'): string =>
  `${prefix}${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
```

- [ ] **Step 2: Commit**

```bash
git add app/src/lib/id.ts
git commit -m "feat(lib): uid generator"
```

### Task 1.4: Conflitti — TDD (logica critica)

**Files:**
- Create: `app/src/lib/conflicts.ts`, `app/tests/lib/conflicts.test.ts`

- [ ] **Step 1: Scrivere i test prima**

```ts
// tests/lib/conflicts.test.ts
import { describe, it, expect } from 'vitest';
import { checkConflicts, overlaps } from '../../src/lib/conflicts';
import type { Prenotazione, Chiusura } from '../../src/types';

const mk = (id: string, camera: 'lampone'|'mirtillo', checkin: string, checkout: string, stato: any = 'confermato', nome = 'X'): Prenotazione => ({
  id, camera, checkin, checkout, stato, nome, creatoIl: '2026-01-01T00:00:00', aggiornatoIl: '2026-01-01T00:00:00',
});

describe('overlaps', () => {
  it('vero quando i range si toccano', () => {
    expect(overlaps('2026-04-10','2026-04-14','2026-04-12','2026-04-16')).toBe(true);
  });
  it('falso quando un check-out coincide col check-in successivo', () => {
    expect(overlaps('2026-04-10','2026-04-14','2026-04-14','2026-04-16')).toBe(false);
  });
});

describe('checkConflicts', () => {
  it('🔴 BLOCCA confermata sopra confermata stessa camera', () => {
    const existing = [mk('1','lampone','2026-04-10','2026-04-14','confermato','Rossi')];
    const candidate = mk('2','lampone','2026-04-12','2026-04-15','confermato','Bianchi');
    const res = checkConflicts(candidate, existing, []);
    expect(res?.block).toBe(true);
    expect(res?.msg).toContain('Rossi');
  });
  it('🟡 AVVISA proposta sopra confermata, non blocca', () => {
    const existing = [mk('1','lampone','2026-04-10','2026-04-14','confermato','Rossi')];
    const candidate = mk('2','lampone','2026-04-12','2026-04-15','proposta','Neri');
    const res = checkConflicts(candidate, existing, []);
    expect(res?.block).toBe(false);
    expect(res?.msg).toContain('proponendo');
  });
  it('⚪ NESSUN check tra due proposte sovrapposte', () => {
    const existing = [mk('1','lampone','2026-04-10','2026-04-14','proposta','A')];
    const candidate = mk('2','lampone','2026-04-12','2026-04-15','proposta','B');
    expect(checkConflicts(candidate, existing, [])).toBeNull();
  });
  it('🟠 RICORDA di avvisare quando confermi su proposte', () => {
    const existing = [mk('1','lampone','2026-04-10','2026-04-14','proposta','Verdi')];
    const candidate = mk('2','lampone','2026-04-12','2026-04-15','confermato','Rossi');
    const res = checkConflicts(candidate, existing, []);
    expect(res?.block).toBe(false);
    expect(res?.msg).toContain('Verdi');
  });
  it('🔒 AVVISA su chiusura struttura', () => {
    const ch: Chiusura[] = [{ id:'c1', start:'2026-06-20', end:'2026-06-28', note:'vac' }];
    const candidate = mk('2','lampone','2026-06-22','2026-06-25','confermato','famiglia');
    const res = checkConflicts(candidate, [], ch);
    expect(res?.block).toBe(false);
    expect(res?.msg).toContain('chiusa');
  });
  it('camere diverse non confliggono', () => {
    const existing = [mk('1','lampone','2026-04-10','2026-04-14','confermato','Rossi')];
    const candidate = mk('2','mirtillo','2026-04-12','2026-04-15','confermato','Bianchi');
    expect(checkConflicts(candidate, existing, [])).toBeNull();
  });
  it('escludersi da soli (modifica della stessa prenotazione)', () => {
    const existing = [mk('1','lampone','2026-04-10','2026-04-14','confermato','Rossi')];
    const candidate = mk('1','lampone','2026-04-10','2026-04-15','confermato','Rossi');
    expect(checkConflicts(candidate, existing, [])).toBeNull();
  });
});
```

- [ ] **Step 2: Eseguire — devono fallire**

```bash
npm run test
```

- [ ] **Step 3: Implementare `lib/conflicts.ts`**

```ts
import type { Prenotazione, Chiusura, Conflict } from '../types';
import { parseISO, addDays, iso } from './date';

export const overlaps = (a1: string, a2: string, b1: string, b2: string): boolean =>
  parseISO(a1) < parseISO(b2) && parseISO(b1) < parseISO(a2);

export const checkConflicts = (
  candidate: Prenotazione,
  bookings: Prenotazione[],
  chiusure: Chiusura[],
): Conflict | null => {
  const same = bookings.filter(b => b.id !== candidate.id && b.camera === candidate.camera);

  const blocking = same.filter(b =>
    (b.stato === 'confermato' || b.stato === 'anticipo_atteso') &&
    overlaps(candidate.checkin, candidate.checkout, b.checkin, b.checkout)
  );

  if (blocking.length && (candidate.stato === 'confermato' || candidate.stato === 'anticipo_atteso')) {
    return { block: true, msg: `🔴 Conflitto: la camera è già occupata da ${blocking.map(b => b.nome).join(', ')}.` };
  }
  if (blocking.length && candidate.stato === 'proposta') {
    return { block: false, msg: `🟡 Attenzione: stai proponendo date già occupate da ${blocking.map(b => b.nome).join(', ')}.` };
  }
  if (candidate.stato === 'confermato') {
    const others = same.filter(b =>
      b.stato === 'proposta' &&
      overlaps(candidate.checkin, candidate.checkout, b.checkin, b.checkout)
    );
    if (others.length) return {
      block: false,
      msg: `🟠 Ricordati di avvisare: ${others.map(b => b.nome).join(', ')} (proposte sulle stesse date).`,
    };
  }

  // chiusura: end è inclusivo, quindi confronto con end+1 in formato esclusivo
  const chHit = chiusure.find(c =>
    overlaps(candidate.checkin, candidate.checkout, c.start, iso(addDays(parseISO(c.end), 1)))
  );
  if (chHit) {
    return { block: false, msg: `🔒 Attenzione: struttura chiusa in queste date${chHit.note ? ` (${chHit.note})` : ''}. Confermi comunque?` };
  }
  return null;
};
```

- [ ] **Step 4: Eseguire — devono passare tutti**

```bash
npm run test
```

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/conflicts.ts app/tests/lib/conflicts.test.ts
git commit -m "feat(lib): conflict detection with full TDD coverage"
```

---

## Phase 2 — Stores (Zustand + persist)

### Task 2.1: Store prenotazioni

**Files:**
- Create: `app/src/store/bookings.ts`, `app/tests/store/bookings.test.ts`

- [ ] **Step 1: Test store**

```ts
// tests/store/bookings.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useBookings } from '../../src/store/bookings';

describe('bookings store', () => {
  beforeEach(() => {
    useBookings.setState({ items: [] });
    localStorage.clear();
  });
  it('inizia vuoto', () => {
    expect(useBookings.getState().items).toEqual([]);
  });
  it('add aggiunge una prenotazione con id e timestamps', () => {
    useBookings.getState().add({
      camera: 'lampone', checkin: '2026-04-10', checkout: '2026-04-14',
      stato: 'confermato', nome: 'Rossi',
    });
    const items = useBookings.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0].id).toBeDefined();
    expect(items[0].creatoIl).toBeDefined();
  });
  it('update modifica una prenotazione esistente', () => {
    useBookings.getState().add({ camera:'lampone', checkin:'2026-04-10', checkout:'2026-04-14', stato:'proposta', nome:'A' });
    const id = useBookings.getState().items[0].id;
    useBookings.getState().update(id, { stato: 'confermato' });
    expect(useBookings.getState().items[0].stato).toBe('confermato');
  });
  it('remove elimina', () => {
    useBookings.getState().add({ camera:'lampone', checkin:'2026-04-10', checkout:'2026-04-14', stato:'proposta', nome:'A' });
    const id = useBookings.getState().items[0].id;
    useBookings.getState().remove(id);
    expect(useBookings.getState().items).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Verificare fallimento**

```bash
npm run test
```

- [ ] **Step 3: Implementare**

```ts
// src/store/bookings.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Prenotazione } from '../types';
import { uid } from '../lib/id';

interface State {
  items: Prenotazione[];
  add: (b: Omit<Prenotazione, 'id'|'creatoIl'|'aggiornatoIl'>) => Prenotazione;
  update: (id: string, patch: Partial<Prenotazione>) => void;
  remove: (id: string) => void;
}

export const useBookings = create<State>()(persist((set, get) => ({
  items: [],
  add: (b) => {
    const now = new Date().toISOString();
    const item: Prenotazione = { ...b, id: uid('b'), creatoIl: now, aggiornatoIl: now };
    set({ items: [...get().items, item] });
    return item;
  },
  update: (id, patch) => set({
    items: get().items.map(b => b.id === id ? { ...b, ...patch, aggiornatoIl: new Date().toISOString() } : b),
  }),
  remove: (id) => set({ items: get().items.filter(b => b.id !== id) }),
}), { name: 'cdb_bookings_v1' }));
```

- [ ] **Step 4: Verificare passaggio test**

```bash
npm run test
```

- [ ] **Step 5: Commit**

```bash
git add app/src/store/bookings.ts app/tests/store/bookings.test.ts
git commit -m "feat(store): bookings with persist"
```

### Task 2.2: Store chiusure

**Files:**
- Create: `app/src/store/closures.ts`

- [ ] **Step 1: Implementare (analogo a bookings, modello più semplice)**

```ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Chiusura } from '../types';
import { uid } from '../lib/id';

interface State {
  items: Chiusura[];
  add: (c: Omit<Chiusura, 'id'>) => Chiusura;
  update: (id: string, patch: Partial<Chiusura>) => void;
  remove: (id: string) => void;
}

export const useClosures = create<State>()(persist((set, get) => ({
  items: [],
  add: (c) => {
    const item: Chiusura = { ...c, id: uid('c') };
    set({ items: [...get().items, item] });
    return item;
  },
  update: (id, patch) => set({ items: get().items.map(c => c.id === id ? { ...c, ...patch } : c) }),
  remove: (id) => set({ items: get().items.filter(c => c.id !== id) }),
}), { name: 'cdb_closures_v1' }));
```

- [ ] **Step 2: Commit**

```bash
git add app/src/store/closures.ts
git commit -m "feat(store): closures"
```

### Task 2.3: Store promemoria

**Files:**
- Create: `app/src/store/promemoria.ts`

- [ ] **Step 1: Implementare**

```ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Promemoria } from '../types';
import { uid } from '../lib/id';

interface State {
  items: Promemoria[];
  add: (testo: string) => void;
  toggle: (id: string) => void;
  remove: (id: string) => void;
}

export const usePromemoria = create<State>()(persist((set, get) => ({
  items: [],
  add: (testo) => set({
    items: [...get().items, { id: uid('p'), testo, createdAt: new Date().toISOString(), done: false }],
  }),
  toggle: (id) => set({ items: get().items.map(p => p.id === id ? { ...p, done: !p.done } : p) }),
  remove: (id) => set({ items: get().items.filter(p => p.id !== id) }),
}), { name: 'cdb_promemoria_v1' }));
```

- [ ] **Step 2: Commit**

```bash
git add app/src/store/promemoria.ts
git commit -m "feat(store): promemoria"
```

### Task 2.4: Store settings (tema, vista, anchor)

**Files:**
- Create: `app/src/store/settings.ts`

- [ ] **Step 1: Implementare**

```ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Tema, Vista } from '../types';

interface State {
  tema: Tema;
  setTema: (t: Tema) => void;
  vista: Vista;
  setVista: (v: Vista) => void;
  anchor: string;            // ISO date primo del mese
  setAnchor: (a: string) => void;
  shiftAnchor: (months: number) => void;
}

export const useSettings = create<State>()(persist((set, get) => ({
  tema: 'auto',
  setTema: (tema) => set({ tema }),
  vista: 'mese',
  setVista: (vista) => set({ vista }),
  anchor: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0,10),
  setAnchor: (anchor) => set({ anchor }),
  shiftAnchor: (months) => {
    const [y,m] = get().anchor.split('-').map(Number);
    const d = new Date(y, m - 1 + months, 1);
    set({ anchor: d.toISOString().slice(0,10) });
  },
}), { name: 'cdb_settings_v1' }));
```

- [ ] **Step 2: Commit**

```bash
git add app/src/store/settings.ts
git commit -m "feat(store): settings tema/vista/anchor"
```

### Task 2.5: Store UI (side panel, modali)

**Files:**
- Create: `app/src/store/ui.ts`

- [ ] **Step 1: Implementare (in-memory, non persist)**

```ts
import { create } from 'zustand';

type Side = null | { kind: 'todo' } | { kind: 'arrivi' } | { kind: 'day', date: string };
type Modal = null | { kind: 'booking', id?: string, prefillCheckin?: string } | { kind: 'closure', id?: string };

interface State {
  side: Side;
  modal: Modal;
  page: 'home' | 'calendar';
  openSide: (s: Side) => void;
  closeSide: () => void;
  openModal: (m: Modal) => void;
  closeModal: () => void;
  goHome: () => void;
  goCalendar: () => void;
}

export const useUI = create<State>((set) => ({
  side: null,
  modal: null,
  page: 'home',
  openSide: (side) => set({ side, modal: null }),
  closeSide: () => set({ side: null }),
  openModal: (modal) => set({ modal, side: null }),
  closeModal: () => set({ modal: null }),
  goHome: () => set({ page: 'home', side: null, modal: null }),
  goCalendar: () => set({ page: 'calendar' }),
}));
```

- [ ] **Step 2: Commit**

```bash
git add app/src/store/ui.ts
git commit -m "feat(store): ui state"
```

### Task 2.6: Mock data (per dev)

**Files:**
- Create: `app/src/data/mock.ts`

- [ ] **Step 1: Copiare i mock dal prototipo**

Apri `prototipo-calendario.html` e copia i tre array `MOCK_DATA`, `MOCK_CHIUSURE`, `MOCK_PROMEMORIA` esattamente come sono. Mettili in:

```ts
// src/data/mock.ts
import type { Prenotazione, Chiusura, Promemoria } from '../types';

const NOW = new Date().toISOString();

export const MOCK_BOOKINGS: Prenotazione[] = [
  // ... copia tutti gli oggetti del prototipo, aggiungendo creatoIl: NOW, aggiornatoIl: NOW se mancano
];

export const MOCK_CLOSURES: Chiusura[] = [
  { id:'c1', start:'2026-06-20', end:'2026-06-28', note:'Vacanza famiglia in Sardegna' },
  { id:'c2', start:'2026-11-01', end:'2026-11-30', note:'Chiusura stagionale' },
];

export const MOCK_PROMEMORIA: Promemoria[] = [
  { id:'p1', testo:'Chiamare Verdi per conferma anticipo', createdAt:'2026-04-12T10:00:00', done:false },
  { id:'p2', testo:'Richiedere preventivo lavanderia', createdAt:'2026-04-13T15:20:00', done:true },
];
```

- [ ] **Step 2: Aggiungere uno script di seed in `main.tsx` (solo se store vuoto)**

In `src/main.tsx`, prima di `ReactDOM.createRoot`:

```ts
import { useBookings } from './store/bookings';
import { useClosures } from './store/closures';
import { usePromemoria } from './store/promemoria';
import { MOCK_BOOKINGS, MOCK_CLOSURES, MOCK_PROMEMORIA } from './data/mock';

if (useBookings.getState().items.length === 0) {
  useBookings.setState({ items: MOCK_BOOKINGS });
}
if (useClosures.getState().items.length === 0) {
  useClosures.setState({ items: MOCK_CLOSURES });
}
if (usePromemoria.getState().items.length === 0) {
  usePromemoria.setState({ items: MOCK_PROMEMORIA });
}
```

- [ ] **Step 3: Commit**

```bash
git add app/src/data/mock.ts app/src/main.tsx
git commit -m "feat(data): mock seed data for dev"
```

---

## Phase 3 — CSS tokens e tema

### Task 3.1: CSS tokens da prototipo

**Files:**
- Modify: `app/src/index.css`

- [ ] **Step 1: Sostituire `index.css` con i tokens dal prototipo**

Apri `prototipo-calendario.html` e copia il blocco `:root{...}` e `[data-theme="dark"]{...}` dentro `app/src/index.css`, dopo le direttive Tailwind. Aggiungi anche tutto il CSS custom (gantt verticale, vista mese google, modali, side panel, bottombar, view-switch, home, quicknote, promemoria-card, ecc.) — l'intero blocco `<style>` del prototipo va portato qui.

**Riferimento:** `prototipo-calendario.html` linee da `:root{` fino a `</style>`.

- [ ] **Step 2: Aggiornare `body` per usare i tokens**

Sostituisci la regola `html,body{...}` precedente con:

```css
html,body{background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;-webkit-tap-highlight-color:transparent;overscroll-behavior-y:contain}
body{padding-bottom:env(safe-area-inset-bottom)}
button,.chip,input[type=checkbox]{touch-action:manipulation}
```

- [ ] **Step 3: Verifica build**

```bash
npm run build
```

Expected: build OK, nessun errore CSS.

- [ ] **Step 4: Commit**

```bash
git add app/src/index.css
git commit -m "feat(style): port CSS tokens and styles from prototype"
```

### Task 3.2: ThemeToggle component

**Files:**
- Create: `app/src/components/ThemeToggle.tsx`

- [ ] **Step 1: Implementare**

```tsx
import { useEffect } from 'react';
import { useSettings } from '../store/settings';
import type { Tema } from '../types';

const resolve = (t: Tema): 'light'|'dark' =>
  t === 'auto' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : t;

const icon = (t: Tema, resolved: 'light'|'dark') =>
  t === 'auto' ? '🌓' : resolved === 'dark' ? '🌙' : '☀️';

export const ThemeToggle = ({ floating = false }: { floating?: boolean }) => {
  const { tema, setTema } = useSettings();
  const resolved = resolve(tema);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolved);
  }, [resolved]);

  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const handler = () => { if (useSettings.getState().tema === 'auto') document.documentElement.setAttribute('data-theme', resolve('auto')); };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const cycle = () => {
    const next: Tema = tema === 'light' ? 'dark' : tema === 'dark' ? 'auto' : 'light';
    setTema(next);
  };

  const cls = floating
    ? 'absolute top-[calc(env(safe-area-inset-top)+14px)] right-[14px] w-10 h-10 rounded-full text-lg cursor-pointer'
    : 'btn btn-ghost !p-2';

  return (
    <button onClick={cycle} title="Tema" className={cls}
      style={floating ? { background: 'var(--card)', border: '1px solid var(--line)' } : {}}>
      {icon(tema, resolved)}
    </button>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add app/src/components/ThemeToggle.tsx
git commit -m "feat(theme): ThemeToggle with auto/light/dark cycle"
```

---

## Phase 4 — Componenti base

### Task 4.1: Modal (bottom-sheet mobile)

**Files:**
- Create: `app/src/components/common/Modal.tsx`

- [ ] **Step 1: Implementare**

```tsx
import { ReactNode, useEffect } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export const Modal = ({ open, onClose, title, children }: Props) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="modal open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box">
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--line)' }}>
          <h3 className="font-semibold text-lg">{title}</h3>
          <button className="btn btn-ghost !p-2" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add app/src/components/common/Modal.tsx
git commit -m "feat(ui): Modal base"
```

### Task 4.2: SidePanel (slide-in destro)

**Files:**
- Create: `app/src/components/common/SidePanel.tsx`

- [ ] **Step 1: Implementare**

```tsx
import { ReactNode } from 'react';

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export const SidePanel = ({ open, title, onClose, children }: Props) => (
  <aside className={'side' + (open ? ' open' : '')}>
    <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--line)' }}>
      <h2 className="font-semibold">{title}</h2>
      <button className="btn btn-ghost !p-2" onClick={onClose}>✕</button>
    </div>
    <div className="p-4">{children}</div>
  </aside>
);
```

- [ ] **Step 2: Commit**

```bash
git add app/src/components/common/SidePanel.tsx
git commit -m "feat(ui): SidePanel"
```

### Task 4.3: ChipGroup (selettore a chip)

**Files:**
- Create: `app/src/components/common/ChipGroup.tsx`

- [ ] **Step 1: Implementare**

```tsx
interface Props<T extends string> {
  options: { value: T; label: string }[];
  value: T | undefined;
  onChange: (v: T) => void;
}

export const ChipGroup = <T extends string>({ options, value, onChange }: Props<T>) => (
  <div className="chip-group">
    {options.map(o => (
      <button
        key={o.value}
        type="button"
        className={'chip' + (value === o.value ? ' active' : '')}
        onClick={() => onChange(o.value)}
      >{o.label}</button>
    ))}
  </div>
);
```

- [ ] **Step 2: Commit**

```bash
git add app/src/components/common/ChipGroup.tsx
git commit -m "feat(ui): ChipGroup"
```

---

## Phase 5 — Home + App skeleton

### Task 5.1: Home component

**Files:**
- Create: `app/src/components/Home.tsx`

- [ ] **Step 1: Implementare**

```tsx
import { useBookings } from '../store/bookings';
import { usePromemoria } from '../store/promemoria';
import { useUI } from '../store/ui';
import { useSettings } from '../store/settings';
import { ThemeToggle } from './ThemeToggle';
import { parseISO, nightsBetween, iso } from '../lib/date';

export const Home = () => {
  const bookings = useBookings(s => s.items);
  const promemoria = usePromemoria(s => s.items);
  const { goCalendar, openSide } = useUI();

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
      </div>
    </section>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add app/src/components/Home.tsx
git commit -m "feat(home): Home page with 3 buttons and badges"
```

### Task 5.2: App router (Home ↔ CalendarPage)

**Files:**
- Modify: `app/src/App.tsx`

- [ ] **Step 1: Sostituire `App.tsx` con**

```tsx
import { useUI } from './store/ui';
import { Home } from './components/Home';
import { CalendarPage } from './components/calendar/CalendarPage';

export default function App() {
  const page = useUI(s => s.page);
  return page === 'home' ? <Home /> : <CalendarPage />;
}
```

- [ ] **Step 2: Stub temporaneo CalendarPage** (creiamo il vero nelle prossime task)

```tsx
// src/components/calendar/CalendarPage.tsx
export const CalendarPage = () => <div className="p-4">TODO calendar</div>;
```

- [ ] **Step 3: Verifica visiva**

```bash
npm run dev
```

Apri browser → vedi la home con 3 bottoni stilizzati. Click su "Calendario" → "TODO calendar".

- [ ] **Step 4: Commit**

```bash
git add app/src/App.tsx app/src/components/calendar/CalendarPage.tsx
git commit -m "feat(app): page router home/calendar"
```

---

## Phase 6 — Calendar page (topbar + viste)

### Task 6.1: Topbar

**Files:**
- Create: `app/src/components/calendar/Topbar.tsx`, `app/src/components/calendar/ViewSwitch.tsx`

- [ ] **Step 1: Creare ViewSwitch**

```tsx
// ViewSwitch.tsx
import type { Vista } from '../../types';
const VIEWS: { v: Vista; full: string; short: string }[] = [
  { v: 'mese', full: 'Mese', short: 'M' },
  { v: 'trim', full: 'Trim', short: 'T' },
  { v: 'sem',  full: 'Sem',  short: 'S' },
  { v: 'anno', full: 'Anno', short: 'A' },
];
export const ViewSwitch = ({ value, onChange }: { value: Vista; onChange: (v: Vista) => void }) => (
  <div className="view-switch">
    {VIEWS.map(({v, full, short}) => (
      <button key={v} className={value === v ? 'active' : ''} onClick={() => onChange(v)}>
        <span className="full">{full}</span><span className="short">{short}</span>
      </button>
    ))}
  </div>
);
```

- [ ] **Step 2: Creare Topbar**

```tsx
// Topbar.tsx
import { useSettings } from '../../store/settings';
import { useUI } from '../../store/ui';
import { ViewSwitch } from './ViewSwitch';
import { ThemeToggle } from '../ThemeToggle';
import { MONTHS, MONTHS_SHORT, parseISO, iso } from '../../lib/date';

const MONTHS_COUNT = { mese: 1, trim: 3, sem: 6, anno: 12 } as const;

export const Topbar = () => {
  const { vista, setVista, anchor, setAnchor, shiftAnchor } = useSettings();
  const goHome = useUI(s => s.goHome);
  const a = parseISO(anchor);
  const y = a.getFullYear(), m = a.getMonth();
  const count = MONTHS_COUNT[vista];
  const label = vista === 'mese'
    ? `${MONTHS[m]} ${y}`
    : vista === 'anno'
      ? String(y)
      : `${MONTHS_SHORT[m]} → ${MONTHS_SHORT[(m + count - 1) % 12]} ${new Date(y, m + count - 1, 1).getFullYear()}`;
  const today = () => setAnchor(iso(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));

  return (
    <header id="topbar" className="flex items-center justify-between px-4 py-3 border-b flex-wrap gap-2"
      style={{ background: 'var(--card)', borderColor: 'var(--line)' }}>
      <div className="flex items-center gap-2">
        <button className="btn btn-ghost !p-2" onClick={goHome} title="Home">🏠</button>
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold"
             style={{ background: 'linear-gradient(135deg,var(--lampone),var(--mirtillo))' }}>🏡</div>
        <div>
          <div className="font-semibold text-sm leading-tight">Cuore di Bosco</div>
          <div className="text-[11px]" style={{ color: 'var(--ink-soft)' }}>Calendario prenotazioni</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <ViewSwitch value={vista} onChange={setVista} />
        <button className="btn btn-ghost !p-2" onClick={() => shiftAnchor(-MONTHS_COUNT[vista])}>◀</button>
        <div className="text-sm font-semibold min-w-[90px] text-center">{label}</div>
        <button className="btn btn-ghost !p-2" onClick={() => shiftAnchor(MONTHS_COUNT[vista])}>▶</button>
        <button className="btn btn-ghost hidden sm:inline-block" onClick={today}>Oggi</button>
        <ThemeToggle />
      </div>
    </header>
  );
};
```

- [ ] **Step 3: Commit**

```bash
git add app/src/components/calendar/Topbar.tsx app/src/components/calendar/ViewSwitch.tsx
git commit -m "feat(calendar): Topbar and ViewSwitch"
```

### Task 6.2: BottomBar

**Files:**
- Create: `app/src/components/calendar/BottomBar.tsx`

- [ ] **Step 1: Implementare**

```tsx
import { useBookings } from '../../store/bookings';
import { usePromemoria } from '../../store/promemoria';
import { useUI } from '../../store/ui';
import { parseISO, nightsBetween, iso } from '../../lib/date';

export const BottomBar = () => {
  const bookings = useBookings(s => s.items);
  const promemoria = usePromemoria(s => s.items);
  const { openSide, openModal } = useUI();

  const today = iso(new Date());
  const todoCount = bookings.filter(b => b.stato === 'proposta' || b.stato === 'anticipo_atteso').length
    + promemoria.filter(p => !p.done).length;
  const arriviCount = bookings.filter(b =>
    b.stato !== 'proposta' &&
    parseISO(b.checkin) >= parseISO(today) &&
    nightsBetween(today, b.checkin) <= 30
  ).length;

  return (
    <footer className="bottombar sticky bottom-0">
      <button className="counter warn" onClick={() => openSide({ kind: 'todo' })}>
        🔔<span className="lbl"> Da fare</span> <span className="badge">{todoCount}</span>
      </button>
      <button className="counter" onClick={() => openSide({ kind: 'arrivi' })}>
        🧳<span className="lbl"> Arrivi</span> <span className="badge">{arriviCount}</span>
      </button>
      <button className="btn btn-ghost" title="Chiusura" onClick={() => openModal({ kind: 'closure' })}>🔒</button>
      <button className="btn btn-primary" onClick={() => openModal({ kind: 'booking', prefillCheckin: today })}>
        ➕ <span className="lbl">Nuova</span>
      </button>
    </footer>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add app/src/components/calendar/BottomBar.tsx
git commit -m "feat(calendar): BottomBar with counters"
```

### Task 6.3: CalendarPage (orchestratore)

**Files:**
- Modify: `app/src/components/calendar/CalendarPage.tsx`

- [ ] **Step 1: Sostituire stub con**

```tsx
import { useSettings } from '../../store/settings';
import { useUI } from '../../store/ui';
import { Topbar } from './Topbar';
import { BottomBar } from './BottomBar';
import { MonthGoogleView } from './MonthGoogleView';
import { VerticalGanttView } from './VerticalGanttView';
import { DayDetailPanel } from '../panels/DayDetailPanel';
import { TodoPanel } from '../panels/TodoPanel';
import { ArrivalsPanel } from '../panels/ArrivalsPanel';
import { BookingForm } from '../forms/BookingForm';
import { ClosureForm } from '../forms/ClosureForm';

export const CalendarPage = () => {
  const vista = useSettings(s => s.vista);
  const { side, modal, closeSide, closeModal } = useUI();

  return (
    <>
      <Topbar />
      <div className="px-4 py-2 text-[12px]" style={{ background: 'var(--banner-bg)', color: 'var(--banner-text)', borderBottom: '1px solid var(--banner-border)' }}>
        🎨 <b>App locale</b> · dati in localStorage · Google Sheets in arrivo (Piano B)
      </div>
      <main className="p-3 md:p-5">
        {vista === 'mese' ? <MonthGoogleView /> : <VerticalGanttView />}
      </main>
      <BottomBar />

      {side?.kind === 'todo' && <TodoPanel onClose={closeSide} />}
      {side?.kind === 'arrivi' && <ArrivalsPanel onClose={closeSide} />}
      {side?.kind === 'day' && <DayDetailPanel date={side.date} onClose={closeSide} />}

      {modal?.kind === 'booking' && <BookingForm id={modal.id} prefillCheckin={modal.prefillCheckin} onClose={closeModal} />}
      {modal?.kind === 'closure' && <ClosureForm id={modal.id} onClose={closeModal} />}
    </>
  );
};
```

- [ ] **Step 2: Stub temporanei per i componenti che ancora non esistono**

```tsx
// MonthGoogleView.tsx, VerticalGanttView.tsx, panels/*, forms/*
// Crea file con: export const X = (...args: any) => null;
```

- [ ] **Step 3: Verifica build**

```bash
npm run dev
```

Click "Calendario" → vedi topbar + bottombar + banner. Aree centrali vuote (stub).

- [ ] **Step 4: Commit**

```bash
git add app/src/components/
git commit -m "feat(calendar): CalendarPage orchestrator with stubs"
```

---

## Phase 7 — Vista Mese (Google Calendar style)

### Task 7.1: MonthGoogleView

**Files:**
- Modify: `app/src/components/calendar/MonthGoogleView.tsx`

- [ ] **Step 1: Implementare** (porta dalla `renderMonthGoogle()` del prototipo, linee da `function renderMonthGoogle` a fine funzione)

```tsx
import { useBookings } from '../../store/bookings';
import { useClosures } from '../../store/closures';
import { useSettings } from '../../store/settings';
import { useUI } from '../../store/ui';
import { parseISO, iso, addDays, MONTHS } from '../../lib/date';
import type { Camera, Prenotazione, Chiusura } from '../../types';

const findBooking = (date: string, camera: Camera, items: Prenotazione[]): Prenotazione | null => {
  const d = parseISO(date);
  const matches = items.filter(b => b.camera === camera && parseISO(b.checkin) <= d && parseISO(b.checkout) > d);
  if (!matches.length) return null;
  const priority = { confermato: 0, anticipo_atteso: 1, proposta: 2 } as const;
  matches.sort((a, b) => priority[a.stato] - priority[b.stato]);
  return matches[0];
};

const findClosure = (date: string, items: Chiusura[]): Chiusura | undefined => {
  const d = parseISO(date);
  return items.find(c => parseISO(c.start) <= d && d <= parseISO(c.end));
};

export const MonthGoogleView = () => {
  const bookings = useBookings(s => s.items);
  const closures = useClosures(s => s.items);
  const anchor = useSettings(s => s.anchor);
  const { openSide, openModal } = useUI();
  const TODAY = iso(new Date());

  const a = parseISO(anchor);
  const y = a.getFullYear(), m = a.getMonth();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const first = new Date(y, m, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;

  const cells = [];
  for (let i = 0; i < totalCells; i++) {
    const dayOffset = i - startOffset;
    if (dayOffset < 0 || dayOffset >= daysInMonth) {
      cells.push(<div key={i} className="mg-cell out" />);
      continue;
    }
    const dt = new Date(y, m, dayOffset + 1);
    const dStr = iso(dt);
    const dow = dt.getDay();
    const isWE = dow === 0 || dow === 6;
    const isToday = dStr === TODAY;
    const ch = findClosure(dStr, closures);
    const closureFirst = ch?.start === dStr;
    const closureLast = ch?.end === dStr;

    const cellClasses = [
      'mg-cell',
      isWE ? 'we' : '',
      isToday ? 'today' : '',
      ch ? 'chiusura' : '',
      closureFirst ? 'closure-first' : '',
      closureLast ? 'closure-last' : '',
    ].filter(Boolean).join(' ');

    const renderRoom = (camera: Camera) => {
      const b = findBooking(dStr, camera, bookings);
      if (!b) return <div key={camera} className="mg-slot empty" />;
      const isFirst = b.checkin === dStr;
      const weekStart = dow === 1;
      return (
        <div key={camera}
          className={`mg-slot ${camera} ${b.stato}${ch ? ' closed-lock' : ''}`}
          title={`${b.nome}${b.riferimento ? ' (' + b.riferimento + ')' : ''}`}
          onClick={(e) => { e.stopPropagation(); openModal({ kind: 'booking', id: b.id }); }}>
          {(isFirst || weekStart) && <>
            <span>{b.nome}</span>
            {b.riferimento && <span className="ref">{b.riferimento}</span>}
          </>}
        </div>
      );
    };

    cells.push(
      <div key={i} className={cellClasses}
        title={ch ? `🔒 ${ch.note || 'Struttura chiusa'}` : ''}
        onClick={() => openSide({ kind: 'day', date: dStr })}>
        <div className="mg-day">{dayOffset + 1}</div>
        <div className="mg-rooms">
          {renderRoom('lampone')}
          {renderRoom('mirtillo')}
        </div>
      </div>
    );
  }

  return (
    <div className="mg">
      <div className="mg-head">
        {['Lun','Mar','Mer','Gio','Ven','Sab','Dom'].map(d => <div key={d}>{d}</div>)}
      </div>
      <div className="mg-grid">{cells}</div>
    </div>
  );
};
```

- [ ] **Step 2: Verifica visiva**

```bash
npm run dev
```

Apri "Calendario" → vista Mese mostra il mese corrente con prenotazioni mock visibili.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/calendar/MonthGoogleView.tsx
git commit -m "feat(calendar): MonthGoogleView ported from prototype"
```

---

## Phase 8 — Vista Gantt verticale

### Task 8.1: VerticalGanttView

**Files:**
- Modify: `app/src/components/calendar/VerticalGanttView.tsx`

- [ ] **Step 1: Implementare** (porta da `renderMonth()` + `renderCalendar()` non-mese del prototipo)

```tsx
import { useBookings } from '../../store/bookings';
import { useClosures } from '../../store/closures';
import { useSettings } from '../../store/settings';
import { useUI } from '../../store/ui';
import { parseISO, iso, MONTHS, MONTHS_SHORT, WD } from '../../lib/date';
import type { Camera, Prenotazione, Chiusura, Vista } from '../../types';

const MONTHS_COUNT: Record<Vista, number> = { mese: 1, trim: 3, sem: 6, anno: 12 };

const findBooking = (date: string, camera: Camera, items: Prenotazione[]): Prenotazione | null => {
  const d = parseISO(date);
  const matches = items.filter(b => b.camera === camera && parseISO(b.checkin) <= d && parseISO(b.checkout) > d);
  if (!matches.length) return null;
  const priority = { confermato: 0, anticipo_atteso: 1, proposta: 2 } as const;
  matches.sort((a, b) => priority[a.stato] - priority[b.stato]);
  return matches[0];
};
const findClosure = (date: string, items: Chiusura[]) => {
  const d = parseISO(date);
  return items.find(c => parseISO(c.start) <= d && d <= parseISO(c.end));
};

const MonthCol = ({ year, month }: { year: number; month: number }) => {
  const bookings = useBookings(s => s.items);
  const closures = useClosures(s => s.items);
  const vista = useSettings(s => s.vista);
  const { openSide, openModal } = useUI();
  const TODAY = iso(new Date());
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const headLabel = (vista === 'anno' || vista === 'sem') ? MONTHS_SHORT[month] : `${MONTHS[month]} ${year}`;

  const rows = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(year, month, d);
    const dStr = iso(dt);
    const dow = dt.getDay();
    const ch = findClosure(dStr, closures);
    const isToday = dStr === TODAY;
    const cls = [
      'day-row',
      (dow === 0 || dow === 6) ? 'we' : '',
      isToday ? 'today' : '',
      ch ? 'chiusura' : '',
      ch?.start === dStr ? 'closure-first' : '',
      ch?.end === dStr ? 'closure-last' : '',
    ].filter(Boolean).join(' ');

    const renderRoom = (camera: Camera) => {
      const b = findBooking(dStr, camera, bookings);
      const baseCls = `room-cell ${b ? `booked ${camera} ${b.stato}` : ''}`;
      if (!b) return <div key={camera} className={baseCls} onClick={() => openSide({ kind: 'day', date: dStr })} />;
      const isFirst = b.checkin === dStr;
      const checkoutPrev = iso(new Date(parseISO(b.checkout).getTime() - 86400000));
      const isLast = checkoutPrev === dStr;
      const showLabel = isFirst && vista !== 'sem' && vista !== 'anno';
      return (
        <div key={camera}
          className={`${baseCls}${isFirst ? ' first-of-booking' : ''}${isLast ? ' last-of-booking' : ''}`}
          title={`${b.nome}${b.riferimento ? ' (' + b.riferimento + ')' : ''}`}
          onClick={(e) => { e.stopPropagation(); openModal({ kind: 'booking', id: b.id }); }}>
          {showLabel && (
            <div className="label">
              <span>{b.nome}</span>
              {b.riferimento && <span className="ref">{b.riferimento}</span>}
            </div>
          )}
        </div>
      );
    };

    rows.push(
      <div key={d} className={cls}>
        <div className="day-num">
          <div className="dn">{d}</div>
          <div className="dw">{WD[dow]}</div>
        </div>
        {renderRoom('lampone')}
        {renderRoom('mirtillo')}
      </div>
    );
  }

  return (
    <div className="month-col">
      <div className="month-head">{headLabel}</div>
      <div className="month-sub-head"><div></div><div>🍇 L</div><div>🫐 M</div></div>
      <div className="month-grid">{rows}</div>
    </div>
  );
};

export const VerticalGanttView = () => {
  const vista = useSettings(s => s.vista);
  const anchor = useSettings(s => s.anchor);
  const a = parseISO(anchor);
  const yStart = a.getFullYear();
  const mStart = vista === 'anno' ? 0 : a.getMonth();
  const count = MONTHS_COUNT[vista];

  const cols = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(yStart, mStart + i, 1);
    cols.push(<MonthCol key={i} year={d.getFullYear()} month={d.getMonth()} />);
  }
  return <div className={`months-wrap wrap-${vista}`}>{cols}</div>;
};
```

- [ ] **Step 2: Verifica visiva**

```bash
npm run dev
```

Cambia vista in Trim/Sem/Anno → visualizzazione corretta.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/calendar/VerticalGanttView.tsx
git commit -m "feat(calendar): VerticalGanttView for trim/sem/anno"
```

---

## Phase 9 — Form

### Task 9.1: BookingForm

**Files:**
- Modify: `app/src/components/forms/BookingForm.tsx`

- [ ] **Step 1: Implementare** (porta dal prototipo `<form id="form">` + handler `submit`)

```tsx
import { useState, useEffect, useRef, FormEvent } from 'react';
import { useBookings } from '../../store/bookings';
import { useClosures } from '../../store/closures';
import { Modal } from '../common/Modal';
import { ChipGroup } from '../common/ChipGroup';
import { checkConflicts } from '../../lib/conflicts';
import { nightsBetween } from '../../lib/date';
import type { Prenotazione, Camera, Stato, ContattoVia, AnticipoTipo } from '../../types';

interface Props { id?: string; prefillCheckin?: string; onClose: () => void; }

const empty = (prefillCheckin?: string): Partial<Prenotazione> => ({
  camera: 'lampone', checkin: prefillCheckin || '', checkout: '',
  nome: '', stato: 'proposta', numOspiti: 2,
});

export const BookingForm = ({ id, prefillCheckin, onClose }: Props) => {
  const { items, add, update, remove } = useBookings();
  const closures = useClosures(s => s.items);
  const existing = id ? items.find(b => b.id === id) : undefined;
  const [data, setData] = useState<Partial<Prenotazione>>(existing || empty(prefillCheckin));
  const [warn, setWarn] = useState<{ msg: string; block: boolean } | null>(null);
  const ackRef = useRef(false);  // true dopo il primo submit con warning non-bloccante
  const [antTouched, setAntTouched] = useState(!!existing?.anticipo?.importo);

  // se l'utente cambia data/camera/stato, resetto l'ack (il warning va riconsiderato)
  useEffect(() => { ackRef.current = false; setWarn(null); },
    [data.camera, data.checkin, data.checkout, data.stato]);

  useEffect(() => {
    if (data.prezzoTotale && !antTouched) {
      setData(d => ({ ...d, anticipo: { ...(d.anticipo || { tipo: undefined }), importo: Math.round((data.prezzoTotale || 0) * 0.35) } as any }));
    }
  }, [data.prezzoTotale, antTouched]);

  const set = <K extends keyof Prenotazione>(k: K, v: Prenotazione[K]) => setData(d => ({ ...d, [k]: v }));
  const setAnticipo = (patch: Partial<NonNullable<Prenotazione['anticipo']>>) =>
    setData(d => ({ ...d, anticipo: { ...(d.anticipo || { importo: 0 }), ...patch } } as any));

  const nights = data.checkin && data.checkout && data.checkout > data.checkin ? nightsBetween(data.checkin, data.checkout) : 0;

  const onSubmit = (e: FormEvent) => {
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
    };
    const conf = checkConflicts(candidate, items, closures);
    if (conf?.block) { setWarn(conf); ackRef.current = false; return; }
    if (conf && !ackRef.current) { setWarn(conf); ackRef.current = true; return; }

    const { id: _, creatoIl: __, aggiornatoIl: ___, ...rest } = candidate;
    if (existing) update(existing.id, rest);
    else add(rest);
    onClose();
  };

  const onDelete = () => {
    if (!existing) return;
    if (!confirm(`Eliminare la prenotazione di "${existing.nome}"?`)) return;
    remove(existing.id);
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={existing ? 'Modifica prenotazione' : 'Nuova prenotazione'}>
      <form onSubmit={onSubmit} className="p-4">
        <label className="field">
          <span>Camera</span>
          <ChipGroup<Camera>
            options={[{value:'lampone',label:'🍇 Lampone'},{value:'mirtillo',label:'🫐 Mirtillo'}]}
            value={data.camera} onChange={(v) => set('camera', v)} />
        </label>
        <div className="row2">
          <label className="field"><span>Check-in</span>
            <input type="date" required value={data.checkin || ''} onChange={(e) => set('checkin', e.target.value)} /></label>
          <label className="field"><span>Check-out</span>
            <input type="date" required value={data.checkout || ''} onChange={(e) => set('checkout', e.target.value)} /></label>
        </div>
        {nights > 0 && <div className="text-[12px] -mt-2 mb-3" style={{ color: 'var(--ink-soft)' }}>{nights} notti</div>}
        <div className="row2">
          <label className="field"><span>Nome ospite</span>
            <input type="text" required value={data.nome || ''} onChange={(e) => set('nome', e.target.value)} placeholder="es. Rossi" /></label>
          <label className="field"><span>Riferimento</span>
            <input type="text" value={data.riferimento || ''} onChange={(e) => set('riferimento', e.target.value)} placeholder="es. #12 / Booking" /></label>
        </div>
        <div className="row2">
          <label className="field"><span>N° ospiti</span>
            <input type="number" min={1} max={4} value={data.numOspiti || 2} onChange={(e) => set('numOspiti', Number(e.target.value))} /></label>
          <label className="field"><span>Stato</span>
            <select value={data.stato || 'proposta'} onChange={(e) => set('stato', e.target.value as Stato)}>
              <option value="proposta">Proposta</option>
              <option value="anticipo_atteso">Anticipo atteso</option>
              <option value="confermato">Confermato</option>
            </select></label>
        </div>
        <label className="field"><span>Come ti hanno contattato</span>
          <ChipGroup<ContattoVia>
            options={[
              {value:'telefono',label:'📞 Telefono'},
              {value:'whatsapp',label:'💬 WhatsApp'},
              {value:'mail',label:'✉️ Mail'},
              {value:'ota',label:'🌐 OTA'},
            ]}
            value={data.contattoVia} onChange={(v) => set('contattoVia', v)} />
        </label>
        <label className="field"><span>Recapito (tel / email)</span>
          <input type="text" value={data.contattoValore || ''} onChange={(e) => set('contattoValore', e.target.value)} placeholder="+39..." /></label>
        <div className="row2">
          <label className="field"><span>Prezzo totale (€)</span>
            <input type="number" min={0} step={1} value={data.prezzoTotale || ''} onChange={(e) => set('prezzoTotale', Number(e.target.value) || undefined as any)} placeholder="0" /></label>
          <label className="field"><span>Anticipo 35% (€)</span>
            <input type="number" min={0} step={1} value={data.anticipo?.importo || ''} onChange={(e) => { setAntTouched(true); setAnticipo({ importo: Number(e.target.value) || 0 }); }} placeholder="auto" /></label>
        </div>
        <div className="row2">
          <label className="field"><span>Data anticipo</span>
            <input type="date" value={data.anticipo?.data || ''} onChange={(e) => setAnticipo({ data: e.target.value })} /></label>
          <label className="field"><span>Tipo anticipo</span>
            <select value={data.anticipo?.tipo || ''} onChange={(e) => setAnticipo({ tipo: (e.target.value || undefined) as AnticipoTipo })}>
              <option value="">—</option>
              <option value="bonifico">Bonifico</option>
              <option value="sito_bb">Sito B&B</option>
              <option value="ota">OTA (Booking/Airbnb)</option>
            </select></label>
        </div>
        <label className="field"><span>Note</span>
          <textarea value={data.note || ''} onChange={(e) => set('note', e.target.value)} placeholder="Allergie, orario arrivo, richieste..." /></label>
        {warn && <div className="p-3 rounded-lg mb-3" style={{
          background: warn.block ? 'var(--danger-bg)' : 'var(--banner-bg)',
          color: warn.block ? 'var(--danger-text)' : 'var(--banner-text)', fontSize: 13,
        }}>{warn.msg}{!warn.block && ' · Salva di nuovo per confermare.'}</div>}
        <div className="flex justify-between items-center mt-4">
          {existing ? <button type="button" className="btn btn-danger" onClick={onDelete}>Elimina</button> : <span />}
          <div className="ml-auto flex gap-2">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Annulla</button>
            <button type="submit" className="btn btn-primary">Salva</button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
```

- [ ] **Step 2: Verifica**

`npm run dev` → click "+ Nuova" → modal si apre. Crea, modifica, elimina.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/forms/BookingForm.tsx
git commit -m "feat(forms): BookingForm with conflict warnings"
```

### Task 9.2: ClosureForm

**Files:**
- Modify: `app/src/components/forms/ClosureForm.tsx`

- [ ] **Step 1: Implementare**

```tsx
import { useState, FormEvent } from 'react';
import { useClosures } from '../../store/closures';
import { Modal } from '../common/Modal';

interface Props { id?: string; onClose: () => void; }

export const ClosureForm = ({ id, onClose }: Props) => {
  const { items, add, update, remove } = useClosures();
  const existing = id ? items.find(c => c.id === id) : undefined;
  const [start, setStart] = useState(existing?.start || '');
  const [end, setEnd] = useState(existing?.end || '');
  const [note, setNote] = useState(existing?.note || '');

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (end < start) { alert('La data di fine deve essere uguale o successiva a quella di inizio'); return; }
    const payload = { start, end, note: note.trim() || undefined };
    if (existing) update(existing.id, payload);
    else add(payload);
    onClose();
  };

  const onDelete = () => {
    if (!existing) return;
    if (!confirm('Eliminare questo periodo di chiusura?')) return;
    remove(existing.id);
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={existing ? '🔒 Modifica chiusura' : '🔒 Nuovo periodo di chiusura'}>
      <form onSubmit={onSubmit} className="p-4">
        <div className="text-[13px] mb-3 p-3 rounded-lg" style={{ background: 'var(--surface-2)', color: 'var(--ink-soft)' }}>
          La struttura resta chiusa in queste date. Puoi comunque salvare prenotazioni (es. famiglia/amici) ricevendo un avviso.
        </div>
        <div className="row2">
          <label className="field"><span>Da</span><input type="date" required value={start} onChange={(e) => setStart(e.target.value)} /></label>
          <label className="field"><span>A (incluso)</span><input type="date" required value={end} onChange={(e) => setEnd(e.target.value)} /></label>
        </div>
        <label className="field"><span>Nota (motivo)</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="es. Vacanza famiglia, Lavori..." /></label>
        <div className="flex justify-between items-center mt-4">
          {existing ? <button type="button" className="btn btn-danger" onClick={onDelete}>Elimina</button> : <span />}
          <div className="ml-auto flex gap-2">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Annulla</button>
            <button type="submit" className="btn btn-primary">Salva</button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add app/src/components/forms/ClosureForm.tsx
git commit -m "feat(forms): ClosureForm"
```

---

## Phase 10 — Pannelli laterali

### Task 10.1: BookingCard component condiviso

**Files:**
- Create: `app/src/components/common/BookingCard.tsx`

- [ ] **Step 1: Implementare** (porta dalla function `bookingCard()` del prototipo)

```tsx
import { useUI } from '../../store/ui';
import { parseISO, nightsBetween } from '../../lib/date';
import type { Prenotazione } from '../../types';

const STATE_LABEL = { proposta: 'Proposta', anticipo_atteso: 'Anticipo atteso', confermato: 'Confermato' };
const CONTACT_ICON: Record<string, string> = { telefono: '📞', whatsapp: '💬', mail: '✉️', ota: '🌐' };

const fmt = (d: Date) => d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });

export const BookingCard = ({ b }: { b: Prenotazione }) => {
  const openModal = useUI(s => s.openModal);
  const ci = parseISO(b.checkin), co = parseISO(b.checkout);
  const nights = nightsBetween(b.checkin, b.checkout);
  const emoji = b.camera === 'lampone' ? '🍇' : '🫐';

  return (
    <div className="rounded-xl p-3 mb-2 border cursor-pointer hover:bg-gray-50"
      style={{ borderColor: 'var(--line)' }}
      onClick={() => openModal({ kind: 'booking', id: b.id })}>
      <div className="flex items-center justify-between mb-1">
        <div className="font-semibold">{emoji} {b.nome}{b.riferimento && <span className="text-[11px] ml-1" style={{ color: 'var(--ink-soft)' }}>({b.riferimento})</span>}</div>
        <span className={`pill ${b.stato}`}>{STATE_LABEL[b.stato]}</span>
      </div>
      <div className="text-[13px]" style={{ color: 'var(--ink-soft)' }}>
        {fmt(ci)} → {fmt(co)} · {nights} nott{nights === 1 ? 'e' : 'i'}{b.prezzoTotale ? ` · €${b.prezzoTotale}` : ''}
      </div>
      {b.contattoVia && <div className="text-[12px]" style={{ color: 'var(--ink-soft)' }}>
        {CONTACT_ICON[b.contattoVia]} {b.contattoValore || ''}
      </div>}
      {b.anticipo && <div className="text-[12px]" style={{ color: 'var(--ink-soft)' }}>
        Anticipo: €{b.anticipo.importo}{b.anticipo.tipo ? ' · ' + b.anticipo.tipo.replace('_', ' ') : ''}{b.anticipo.data ? ' · ' + fmt(parseISO(b.anticipo.data)) : ''}
      </div>}
      {b.note && <div className="text-[12px] italic mt-1" style={{ color: 'var(--ink-soft)' }}>« {b.note} »</div>}
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add app/src/components/common/BookingCard.tsx
git commit -m "feat(ui): BookingCard component"
```

### Task 10.2: TodoPanel

**Files:**
- Modify: `app/src/components/panels/TodoPanel.tsx`

- [ ] **Step 1: Implementare**

```tsx
import { useState, FormEvent } from 'react';
import { useBookings } from '../../store/bookings';
import { usePromemoria } from '../../store/promemoria';
import { SidePanel } from '../common/SidePanel';
import { BookingCard } from '../common/BookingCard';

export const TodoPanel = ({ onClose }: { onClose: () => void }) => {
  const bookings = useBookings(s => s.items);
  const { items: promemoria, add, toggle, remove } = usePromemoria();
  const [text, setText] = useState('');

  const open = promemoria.filter(p => !p.done).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const done = promemoria.filter(p => p.done).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const auto = bookings.filter(b => b.stato === 'proposta' || b.stato === 'anticipo_atteso')
    .sort((a, b) => a.checkin.localeCompare(b.checkin));

  const onAdd = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    add(text.trim()); setText('');
  };

  const PromemoriaCard = ({ p }: { p: typeof promemoria[number] }) => {
    const dt = new Date(p.createdAt);
    const when = dt.toLocaleDateString('it-IT',{day:'numeric',month:'short'}) + ' ' + dt.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});
    return (
      <div className={`promemoria-card${p.done ? ' done' : ''}`}>
        <input type="checkbox" checked={p.done} onChange={() => toggle(p.id)} />
        <div className="txt">{p.testo}<div className="meta">{when}</div></div>
        <button className="del" onClick={() => { if (confirm('Eliminare questa nota?')) remove(p.id); }} title="Elimina">✕</button>
      </div>
    );
  };

  return (
    <SidePanel open title="🔔 Da fare" onClose={onClose}>
      <form className="quicknote" onSubmit={onAdd}>
        <input type="text" value={text} onChange={(e) => setText(e.target.value)}
          placeholder="Aggiungi nota rapida (enter per salvare)…" autoComplete="off" autoFocus />
        <button type="submit" className="btn btn-primary">➕</button>
      </form>
      {open.length > 0 && <>
        <div className="section-title">📌 Note ({open.length})</div>
        {open.map(p => <PromemoriaCard key={p.id} p={p} />)}
      </>}
      {auto.length > 0 && <>
        <div className="section-title">⏳ Da confermare / anticipi attesi ({auto.length})</div>
        {auto.map(b => <BookingCard key={b.id} b={b} />)}
      </>}
      {done.length > 0 && <>
        <div className="section-title">✓ Fatte ({done.length})</div>
        {done.map(p => <PromemoriaCard key={p.id} p={p} />)}
      </>}
      {open.length + auto.length + done.length === 0 && (
        <div className="text-center py-8 text-sm" style={{ color: 'var(--ink-soft)' }}>
          Tutto a posto! ✨<br /><span className="text-[11px]">Puoi comunque aggiungere una nota qui sopra.</span>
        </div>
      )}
    </SidePanel>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add app/src/components/panels/TodoPanel.tsx
git commit -m "feat(panels): TodoPanel with quick note input"
```

### Task 10.3: ArrivalsPanel

**Files:**
- Modify: `app/src/components/panels/ArrivalsPanel.tsx`

- [ ] **Step 1: Implementare**

```tsx
import { useBookings } from '../../store/bookings';
import { SidePanel } from '../common/SidePanel';
import { BookingCard } from '../common/BookingCard';
import { parseISO, iso } from '../../lib/date';

export const ArrivalsPanel = ({ onClose }: { onClose: () => void }) => {
  const items = useBookings(s => s.items);
  const TODAY = iso(new Date());
  const arrivi = items
    .filter(b => b.stato !== 'proposta' && parseISO(b.checkin) >= parseISO(TODAY))
    .sort((a, b) => a.checkin.localeCompare(b.checkin))
    .slice(0, 10);
  return (
    <SidePanel open title="📅 Prossimi arrivi" onClose={onClose}>
      {arrivi.length === 0
        ? <div className="text-center py-8 text-sm" style={{ color: 'var(--ink-soft)' }}>Nessun arrivo in programma</div>
        : arrivi.map(b => <BookingCard key={b.id} b={b} />)}
    </SidePanel>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add app/src/components/panels/ArrivalsPanel.tsx
git commit -m "feat(panels): ArrivalsPanel"
```

### Task 10.4: DayDetailPanel

**Files:**
- Modify: `app/src/components/panels/DayDetailPanel.tsx`

- [ ] **Step 1: Implementare**

```tsx
import { useBookings } from '../../store/bookings';
import { useClosures } from '../../store/closures';
import { useUI } from '../../store/ui';
import { SidePanel } from '../common/SidePanel';
import { BookingCard } from '../common/BookingCard';
import { parseISO } from '../../lib/date';

const fmt = (d: Date) => d.toLocaleDateString('it-IT',{ day:'numeric', month:'short' });

export const DayDetailPanel = ({ date, onClose }: { date: string; onClose: () => void }) => {
  const bookings = useBookings(s => s.items);
  const closures = useClosures(s => s.items);
  const { openModal } = useUI();
  const d = parseISO(date);
  const lampone = bookings.filter(b => b.camera === 'lampone' && parseISO(b.checkin) <= d && parseISO(b.checkout) > d);
  const mirtillo = bookings.filter(b => b.camera === 'mirtillo' && parseISO(b.checkin) <= d && parseISO(b.checkout) > d);
  const ch = closures.find(c => parseISO(c.start) <= d && d <= parseISO(c.end));

  const title = d.toLocaleDateString('it-IT',{ weekday:'long', day:'numeric', month:'long', year:'numeric' });

  return (
    <SidePanel open title={title.charAt(0).toUpperCase()+title.slice(1)} onClose={onClose}>
      {ch && (
        <div className="mb-4 p-3 rounded-xl cursor-pointer hover:opacity-90"
          style={{ background:'repeating-linear-gradient(45deg,var(--chiusura-b),var(--chiusura-b) 6px,var(--surface-2) 6px,var(--surface-2) 12px)', border:'1px solid var(--line-strong)' }}
          onClick={() => openModal({ kind: 'closure', id: ch.id })}>
          <div className="font-semibold mb-1">🔒 Struttura chiusa</div>
          <div className="text-[12px]" style={{ color: 'var(--ink-soft)' }}>{fmt(parseISO(ch.start))} → {fmt(parseISO(ch.end))}</div>
          {ch.note && <div className="text-[12px] italic mt-1" style={{ color: 'var(--ink-soft)' }}>« {ch.note} »</div>}
        </div>
      )}
      {(['lampone','mirtillo'] as const).map(c => {
        const items = c === 'lampone' ? lampone : mirtillo;
        const emoji = c === 'lampone' ? '🍇' : '🫐';
        const name = c === 'lampone' ? 'Lampone' : 'Mirtillo';
        return (
          <div key={c} className="mb-4">
            <div className="text-[11px] uppercase font-semibold mb-2" style={{ color:'var(--ink-soft)', letterSpacing:'.05em' }}>{emoji} {name}</div>
            {items.length
              ? items.map(b => <BookingCard key={b.id} b={b} />)
              : <div className="text-[13px] p-3 rounded-lg" style={{ background:'var(--surface-2)', color:'var(--ink-soft)' }}>{ch ? 'Libera (struttura chiusa)' : 'Libera'}</div>}
          </div>
        );
      })}
      <button className="btn btn-primary w-full mt-2" onClick={() => openModal({ kind: 'booking', prefillCheckin: date })}>
        ➕ Nuova prenotazione per questo giorno
      </button>
    </SidePanel>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add app/src/components/panels/DayDetailPanel.tsx
git commit -m "feat(panels): DayDetailPanel"
```

---

## Phase 11 — Polish mobile & finiture

### Task 11.1: Swipe orizzontale tra mesi (vista Mese)

**Files:**
- Modify: `app/src/components/calendar/MonthGoogleView.tsx`

- [ ] **Step 1: Aggiungere ref + handlers touchStart/touchEnd**

In cima al componente:

```tsx
import { useRef } from 'react';
import { useSettings } from '../../store/settings';
// ...
const wrapRef = useRef<HTMLDivElement>(null);
const touchRef = useRef<{ x: number; y: number } | null>(null);
const shiftAnchor = useSettings(s => s.shiftAnchor);

const onTouchStart = (e: React.TouchEvent) => {
  if (e.touches.length !== 1) return;
  touchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
};
const onTouchEnd = (e: React.TouchEvent) => {
  if (!touchRef.current) return;
  const dx = e.changedTouches[0].clientX - touchRef.current.x;
  const dy = e.changedTouches[0].clientY - touchRef.current.y;
  touchRef.current = null;
  if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.3) return;
  shiftAnchor(dx < 0 ? 1 : -1);
};
```

E sul wrapper esterno:

```tsx
return (
  <div ref={wrapRef} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
    <div className="mg">...</div>
  </div>
);
```

- [ ] **Step 2: Verifica su mobile (ridimensiona browser)**

- [ ] **Step 3: Commit**

```bash
git add app/src/components/calendar/MonthGoogleView.tsx
git commit -m "feat(mobile): swipe horizontal to navigate months"
```

### Task 11.2: Meta viewport e PWA-ready meta

**Files:**
- Modify: `app/index.html`

- [ ] **Step 1: Sostituire `<head>` con**

```html
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
  <meta name="theme-color" content="#2E8F5C" media="(prefers-color-scheme: light)" />
  <meta name="theme-color" content="#1B4F34" media="(prefers-color-scheme: dark)" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="default" />
  <link rel="icon" type="image/svg+xml" href="/vite.svg" />
  <title>Cuore di Bosco · Calendario</title>
</head>
```

- [ ] **Step 2: Commit**

```bash
git add app/index.html
git commit -m "chore: PWA-ready meta tags"
```

---

## Phase 12 — Verifica finale e cleanup

### Task 12.1: Eseguire test suite completo

- [ ] **Step 1: Run tests**

```bash
cd app && npm run test
```

Expected: tutti verdi (date 5, conflicts 7, bookings 4 = 16 test).

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```

Expected: 0 errori.

- [ ] **Step 3: Build**

```bash
npm run build
```

Expected: build OK, output in `dist/`.

### Task 12.2: Smoke test manuale (golden path)

- [ ] **Step 1: `npm run dev`**

- [ ] **Step 2: Validare i flussi**

Procedi nell'ordine:
1. Home: 3 bottoni visibili, badge "Da fare" mostra numero
2. Click Calendario → vista Mese carica con prenotazioni mock
3. Cambia vista Trim → Sem → Anno: tutte renderizzate
4. Click su una barra → si apre BookingForm in modifica
5. Modifica nome → Salva → la barra mostra nuovo nome
6. Click su un giorno vuoto → si apre DayDetailPanel
7. Click "+ Nuova" → BookingForm vuoto, salva una nuova
8. Click 🔒 Chiusura → ClosureForm, crea una chiusura
9. Verifica che la chiusura appaia grigia in calendario
10. Crea una prenotazione dentro chiusura → avviso 🔒, salva una seconda volta
11. Apri Da fare → quick note, scrivi "test", invio → appare
12. Toggle theme → ciclo light/dark/auto funziona
13. Tab indietro nel browser → home → calendar mantiene stato
14. Reload pagina → dati persistiti

- [ ] **Step 3: Tag versione**

```bash
git tag v0.1.0-piano-A
```

### Task 12.3: README minimo

**Files:**
- Create: `app/README.md`

- [ ] **Step 1: Scrivere**

```markdown
# Cuore di Bosco — Calendario prenotazioni

App React mobile-first per gestire le prenotazioni di un B&B a 2 camere.

## Stato
- ✅ Piano A: scaffolding + UI completa con localStorage
- ⏳ Piano B: integrazione Google Sheets + sync
- ⏳ Piano C: PWA + deploy

## Sviluppo
\`\`\`bash
npm install
npm run dev      # http://localhost:5173
npm run test     # Vitest
npm run build    # produce dist/
\`\`\`

## Riferimenti
- Design: [docs/superpowers/specs/2026-04-14-calendario-bb-design.md](../docs/superpowers/specs/2026-04-14-calendario-bb-design.md)
- Prototipo HTML originale: [prototipo-calendario.html](../prototipo-calendario.html)
```

- [ ] **Step 2: Commit finale**

```bash
git add app/README.md
git commit -m "docs: README for Piano A milestone"
```

---

## Definition of Done — Piano A

✅ `npm run dev` apre app funzionante con tutti i flussi del prototipo
✅ `npm run test` verde (16 test)
✅ `npx tsc --noEmit` 0 errori
✅ `npm run build` produce `dist/` deployabile
✅ Mobile-first verificato a 360px width
✅ Tema chiaro/scuro/auto funzionante
✅ Persistenza localStorage tra reload
✅ Tag git `v0.1.0-piano-A` presente

**Cosa NON è ancora fatto** (passa al Piano B):
- Sincronizzazione tra dispositivi
- Auth Google
- Modalità read-only per famiglia
- Cache offline IndexedDB

**Cosa NON è ancora fatto** (passa al Piano C):
- PWA installabile
- Service worker
- Deploy pubblico
