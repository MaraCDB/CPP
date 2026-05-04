# Design — PWA + Promemoria locali per booking

**Data**: 2026-05-04
**Stato**: spec approvata, in attesa di piano di implementazione
**Target**: Android Chrome (PWA installata)

## Sommario

Trasformare l'app Cuore di Bosco in una PWA installabile con notifiche locali programmate per i promemoria operativi del B&B (preparare camera, registrare documenti, ISTAT/questura, check-in del giorno, servizi di merenda/cena). Le notifiche sono interamente locali — nessun backend, nessun web push remoto.

## Obiettivi

- L'app è installabile da Android Chrome come PWA standalone
- L'app funziona offline per le funzionalità già esistenti (booking CRUD locale)
- Per ogni booking vengono materializzati automaticamente alcuni promemoria, basati su template globali editabili
- I servizi opzionali (merenda, cena) sono campi del booking con orario, e generano un promemoria a parte
- L'utente può aggiungere promemoria personalizzati ad hoc su ogni booking
- L'utente riceve notifiche locali alla scadenza dei promemoria, anche con app chiusa (entro la precisione consentita da Periodic Background Sync)

## Non-obiettivi

- Web Push remoto (richiede backend, fuori scope)
- Compatibilità completa iOS Safari (la PWA gira ma le notifiche di background non sono garantite)
- Snooze, raggruppamento notifiche, suoni custom — YAGNI per la v1
- Migrazione retroattiva automatica dei booking pre-feature (gestita da bottone esplicito in Impostazioni)
- Sincronizzazione cross-device dello stato `notificationStatus` (rimane locale per device)

---

## 1. Architettura PWA

### Stato di partenza

- `vite-plugin-pwa` già installato (`devDependencies`)
- `vite.config.ts` già configura il manifest, le icone, il theme color e i denylist per Google APIs
- Le icone PWA (192, 512, maskable) esistono in `public/`
- Il Service Worker NON è ancora registrato dal client e non c'è UI di installazione

### Modifiche

**Registrazione Service Worker** in `src/main.tsx` via `virtual:pwa-register/react`:

- Hook `useRegisterSW({ onRegisteredSW, onNeedRefresh, onOfflineReady })`
- Toast `<UpdateToast />` per `needRefresh` ("Aggiornamento disponibile, ricarica") e `offlineReady` ("App pronta offline")

**Strategia di caching** (Workbox via vite-plugin-pwa):

- App shell (HTML/JS/CSS/icons): precache automatico (già configurato)
- Google APIs: già escluse via `navigateFallbackDenylist` — restano network-only
- Avatar/altre risorse statiche: `CacheFirst` con scadenza 30 giorni

**UI di installazione** — componente `<InstallPrompt />`:

- Intercetta `beforeinstallprompt` e lo memorizza
- Mostra un banner discreto "Installa app" se non è ancora installata
- Banner dismissibile con "Non più", flag salvato in localStorage

**Service Worker custom** — passaggio a modalità `injectManifest`:

- File `src/sw.ts` con logica custom
- Workbox precache `__WB_MANIFEST` per le risorse statiche
- Handler `periodicsync` per il check task scaduti
- Handler `notificationclick` per l'apertura mirata

**Compatibilità mirata**: Android Chrome con PWA installata. iOS/desktop funzionano ma senza notifiche di background.

---

## 2. Modello dati

### `ReminderTemplate` (configurazione globale)

```ts
type ReminderTemplate = {
  id: string;                       // 'preparation' | 'documents' | 'istat-questura' | 'check-in-today' | 'merenda' | 'cena' | <uuid>
  builtIn: boolean;                 // true per i 6 default seedati
  enabled: boolean;                 // se false, non viene applicato ai nuovi booking
  title: string;                    // "Prepara camera", supporta placeholder {adulti} {bambini} {oraArrivo}
  description?: string;             // opzionale, supporta placeholder
  isService: boolean;               // true → checkbox+orario nel form (merenda, cena)
  serviceLabel?: string;            // etichetta del checkbox (es. "Merenda")
  anchor: 'check-in' | 'check-out';
  offsetDays: number;               // -1 = giorno prima, 0 = stesso giorno, +2 = due giorni dopo
  defaultTime: string;              // 'HH:mm'
  notify: boolean;                  // se generare notifica (default true)
  sortOrder: number;
};
```

**6 template default** seedati al primo avvio:

| id | title | anchor | offsetDays | defaultTime | isService |
|---|---|---|---|---|---|
| `preparation` | "Prepara camera per {adulti}A {bambini}B" | check-in | -1 | 18:00 | no |
| `check-in-today` | "Check-in oggi alle {oraArrivo}" | check-in | 0 | 09:00 | no |
| `documents` | "Registra documenti Alloggiati Web" | check-in | 0 | 21:00 | no |
| `istat-questura` | "ISTAT + scarica ricevuta questura" | check-in | +2 | 10:00 | no |
| `merenda` | "Preparare merenda" | check-in | 0 | (per booking) | sì |
| `cena` | "Preparare cena" | check-in | 0 | (per booking) | sì |

### `BookingTask` (task materializzato)

```ts
type BookingTask = {
  id: string;                       // uuid
  bookingId: string;                // FK al booking
  templateId: string | null;        // null = task custom
  title: string;                    // placeholder già risolti
  description?: string;
  dueAt: string;                    // ISO datetime locale
  done: boolean;
  doneAt?: string;
  notes?: string;
  notify: boolean;
  notificationStatus: 'pending' | 'shown' | 'dismissed' | 'failed';
  notificationShownAt?: string;
  isService: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
};
```

### Lifecycle

**Creazione booking:**
1. Per ogni `ReminderTemplate` con `enabled: true`: calcola `dueAt = (booking[anchor] + offsetDays) at defaultTime`
2. Risolve i placeholder con i dati del booking
3. Inserisce un `BookingTask` per ogni template
4. I template `isService: true` partono con `notify: false` finché l'utente non li attiva nel form

**Modifica booking:**
- Cambio data check-in/out → ricalcola `dueAt` di tutti i task con `templateId != null` e `done: false`
- Cambio adulti/bambini → ricalcola `title` dei task con placeholder corrispondenti
- Cambio orario di un servizio → ricalcola `dueAt` del task corrispondente

**Cancellazione booking:** soft-delete dei task (campo `deletedAt`); le notifiche schedulate vengono cancellate.

### Persistenza

- **Zustand store** con `persist` su localStorage (pattern dei booking)
- **IndexedDB mirror** scritto dal client a ogni mutazione, letto dal Service Worker (vedi sezione 3)

---

## 3. Sistema notifiche

### Tre canali, una stessa regola

Una sola regola decide se mostrare una notifica:
```
task.dueAt <= now &&
task.notify &&
!task.done &&
task.notificationStatus === 'pending' &&
!task.deletedAt
```

### Canale 1 — Foreground scheduler (app aperta)

**Modulo**: `src/lib/notifications/foregroundScheduler.ts`

- Quando l'app si apre o un task viene creato/modificato:
  1. Trova task con `dueAt` entro le prossime 24h e `notificationStatus: 'pending'`
  2. `setTimeout` calibrato a `dueAt - now`
  3. Allo scadere: `new Notification(title, { body, tag: task.id, data: { bookingId, taskId } })` + `notificationStatus: 'shown'`
- Subscribe agli store per re-schedule
- Cleanup su `pagehide` / `visibilitychange`

### Canale 2 — Periodic Background Sync (app chiusa)

**Modulo**: `src/sw.ts`

- Tag: `'check-overdue-tasks'`, `minInterval: 6 * 60 * 60 * 1000` (6h)
- Handler `periodicsync`:
  1. Apre IndexedDB
  2. Trova task che soddisfano la regola
  3. `self.registration.showNotification(title, { body, tag: task.id, data: { bookingId, taskId } })`
  4. Aggiorna `notificationStatus: 'shown'` e `notificationShownAt` in IndexedDB

**Bridge IndexedDB ↔ Zustand** (lib `idb`, già nelle dipendenze):

- Database `cdb-tasks`, object store `tasks`
- Middleware Zustand: a ogni mutazione di `tasks`, scrive il delta su IndexedDB
- Al boot, il client legge IndexedDB e riconcilia eventuali `notificationStatus` aggiornati dal SW

### Canale 3 — Notification click handler

```ts
self.addEventListener('notificationclick', (event) => {
  const { bookingId, taskId } = event.notification.data;
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(wins => {
      const url = `/CPP/?booking=${bookingId}&task=${taskId}`;
      const existing = wins.find(w => w.url.includes('/CPP/'));
      if (existing) {
        existing.focus();
        existing.postMessage({ type: 'open-task', bookingId, taskId });
      } else {
        clients.openWindow(url);
      }
    })
  );
});
```

L'app, ricevendo `open-task` o leggendo la query string al boot, apre la `BookingCard` del booking e mette in evidenza il task.

### Permission flow

Stato in store: `notificationsPermission: 'default' | 'granted' | 'denied'`.

1. Al primo booking creato dopo l'installazione, banner non-bloccante: "Vuoi attivare i promemoria?"
2. Click "Sì" → `Notification.requestPermission()`
3. Se `granted`:
   - Registra Periodic Background Sync con try/catch (su browser non supportati, fallback solo foreground)
   - Salva stato
4. Se `denied`: salva stato, banner non riappare. Riattivabile da Impostazioni.

### Anti-doppio-fire

- `tag: task.id` su tutte le `Notification` → il browser collassa duplicati sulla stessa tag
- Transizione di `notificationStatus` con write-then-show pattern atomico

### Compromessi accettati

- Notifiche del giorno stesso a orario specifico (es. merenda 16:30) con app chiusa: arrivano al prossimo tick di Periodic Sync, quindi entro qualche ora di ritardo
- Per i promemoria mattutini (camera, ISTAT, check-in oggi): `defaultTime: '00:00'` o `'08:00'` → arrivano la mattina al primo sblocco del telefono
- L'app DEVE essere installata come PWA per attivare Periodic Sync

---

## 4. UX

### BookingForm — sezione "Promemoria e servizi"

Aggiunta in fondo al form, dopo i campi attuali. Default: collassata con summary "X promemoria + servizi attivi".

**Sotto-blocco A — Servizi opzionali** (template `isService: true`)

```
☐ Merenda    [16:30]
☐ Cena       [19:30]
```

Checkbox + time picker nativo. La checkbox attiva/disattiva il servizio (`task.notify` true/false). Time picker pre-compilato con `defaultTime` del template, modificabile e salvato sul task.

**Sotto-blocco B — Promemoria automatici**

Lista di card per i task non-servizio:
```
┌─────────────────────────────────────────────┐
│ ☐ Prepara camera per 2A 1B                  │
│   📅 lun 5 mag · 18:00                      │
│   📝 Note (espandibile)                     │
│   ✏️  Modifica  ⓧ Disattiva                 │
└─────────────────────────────────────────────┘
```

- Click → form inline per editare titolo, `dueAt`, note, notify on/off
- "Disattiva" setta `notify: false` (card grigia, non eliminata)

**Sotto-blocco C — Aggiungi promemoria personalizzato**

```
[+ Aggiungi promemoria personalizzato]
```

Click → form in-place: titolo, data+ora (default oggi 18:00), note, notify (default sì). Conferma → crea `BookingTask` con `templateId: null`.

### BookingCard — Task indicator

Nuovo indicatore vicino agli altri (contact dot, ecc.):

```
●●● 3/5 task fatti  · prossimo: oggi 21:00 documenti
```

Colore: verde se tutti done, ambra se almeno uno scaduto non-done, neutro altrimenti. Tap → apre il dettaglio booking con sezione task espansa.

### BookingDetail — sezione "Promemoria"

Lista in sola lettura con check rapido:

```
Promemoria
─────────
☐ Prepara camera per 2A 1B          dom 18:00
☑ Documenti Alloggiati Web          lun 21:00 ✓
☐ ISTAT + ricevuta questura         mer 10:00
☑ Cena                              lun 19:30 ✓
[modifica]
```

- Tap checkbox → toggle `done` con `doneAt`
- "modifica" → riusa la UI di editing del form

### Pagina Impostazioni — "Promemoria e template"

- Lista dei 6 template default (anchor/offset read-only, ma editabili: title, defaultTime, enabled, notify, isService, serviceLabel)
- Bottone "+ Nuovo template" per template custom (editabile completamente)
- Toggle `enabled` per disattivare senza cancellare
- Editor con preview dei placeholder ("Prepara camera per 2A 1B")
- Bottone una-tantum "Genera promemoria per booking esistenti"
- I template editati NON sono retroattivi: solo i nuovi booking li usano

### NotificationOnboarding banner

Mini-banner non-modale in cima al calendario quando:
- ≥ 1 booking esiste
- `notificationsPermission === 'default'`
- L'app è installata (`matchMedia('(display-mode: standalone)')`)

Bottoni: "Attiva promemoria" / "Più tardi" / "Non chiedere più".

### Vincoli mobile-first

- `<input type="time">` nativo per i time picker
- Sezione "Promemoria e servizi" sempre full-width
- Lista task verticale, mai scroll orizzontale

---

## 5. Sync con Google Sheets

### Due nuovi sheet

**`tasks`**: una riga per `BookingTask`. Colonne:

| col | campo |
|---|---|
| A | id |
| B | bookingId |
| C | templateId |
| D | title |
| E | description |
| F | dueAt |
| G | done |
| H | doneAt |
| I | notes |
| J | notify |
| K | notificationStatus |
| L | notificationShownAt |
| M | isService |
| N | createdAt |
| O | updatedAt |
| P | deletedAt |

**`reminder_templates`**: una riga per `ReminderTemplate`. Colonne:

| col | campo |
|---|---|
| A | id |
| B | builtIn |
| C | enabled |
| D | title |
| E | description |
| F | isService |
| G | serviceLabel |
| H | anchor |
| I | offsetDays |
| J | defaultTime |
| K | notify |
| L | sortOrder |

### Pattern di sync identico all'esistente

- Nuovi `kind` in `PendingOp`: `'upsert_task' | 'delete_task' | 'upsert_template' | 'delete_template'`
- In `applyOp` (`src/lib/sync.ts`): nuovi rami che fanno `clearRange` + `writeRange` sui due sheet
- Adapter (`src/lib/google/adapter.ts`): `taskToRow` / `rowToTask` / `templateToRow` / `rowToTemplate`

### Bootstrap

- `bootstrap.ts` esteso per creare automaticamente i due sheet con headers se mancanti (idempotente)
- Al primo flush, i 6 default seed di `useTemplates` vanno su `reminder_templates`

### Conflitti

Last-write-wins sul range completo (full-replace), coerente col pattern esistente.

### Cosa NON sincronizziamo

`notificationStatus` rimane locale per device. `taskToRow` lo serializza sempre come `'pending'`, `rowToTask` lo legge sempre come `'pending'`. Lo stato vero vive solo in IndexedDB locale.

---

## 6. Testing e fasi di rollout

### Strategia di testing

**Logica pura (Vitest)**:
- `materializeTasks(booking, templates)` → array di `BookingTask`
- `recalculateDueAt(task, booking, template)` su modifica booking
- `resolvePlaceholders(template, booking)`
- `pickTasksToNotify(tasks, now)` (la regola del SW)
- `taskToRow` / `rowToTask` round-trip
- `templateToRow` / `rowToTemplate` round-trip
- Default template seeding

**Stores (Vitest)**:
- Slice `tasks` e `templates`: CRUD + enqueue al sync
- Hook bookings ↔ tasks: creare/modificare/cancellare booking → riflesso sui task

**Service Worker (Vitest + jsdom + `fake-indexeddb`)**:
- Handler `periodicsync` con mock `self.registration`
- Handler `notificationclick` con mock `clients`
- Lock anti-doppio-fire

**UI (RTL)**:
- BookingForm sezione "Promemoria e servizi"
- BookingDetail sezione "Promemoria"
- Pagina Impostazioni
- Banner `NotificationOnboarding`

**E2E manuale** (non automatizzato in v1):
1. Installa PWA da Android Chrome
2. Concedi permesso notifiche
3. Crea booking con merenda + cena
4. Chiudi app
5. Verifica notifiche al rilascio nei giorni vicini

Periodic Background Sync non è automatizzato in Playwright per la complessità di trigger affidabile.

### Fasi di rollout

Ogni fase è autonomamente rilasciabile e ha test propri.

**Fase 1 — PWA base attiva**
- Registrazione SW in `main.tsx` con `useRegisterSW`
- `<UpdateToast />` per `needRefresh` / `offlineReady`
- `<InstallPrompt />` con `beforeinstallprompt`
- Switch a `injectManifest` con `src/sw.ts` minimale (solo Workbox precache)
- Test: lighthouse PWA, smoke offline

**Fase 2 — Modello dati e store**
- Tipi `BookingTask`, `ReminderTemplate` in `src/types.ts`
- Slice `useTasks`, `useTemplates`
- IndexedDB mirror via middleware Zustand
- Seed dei 6 template default
- Logica pura (`materializeTasks`, `recalculateDueAt`, `resolvePlaceholders`)
- Test: unit Vitest

**Fase 3 — Sync Google Sheets per task e template**
- Adapter (4 funzioni)
- Estensione `applyOp` per i nuovi `kind`
- Estensione `bootstrap` per i nuovi sheet
- Bottone "Genera promemoria per booking esistenti" in Impostazioni
- Test: round-trip adapter, integration enqueue→applyOp

**Fase 4 — UI: form, dettaglio, indicator, impostazioni**
- Sezione "Promemoria e servizi" in `BookingForm`
- Sezione "Promemoria" in `BookingDetail`
- Task indicator in `BookingCard`
- Pagina Impostazioni "Promemoria e template"
- Test: RTL sui componenti

**Fase 5 — Notifiche foreground**
- `src/lib/notifications/foregroundScheduler.ts`
- Hook in `App.tsx` per attivarlo all'avvio
- Subscribe agli store per re-schedule
- Cleanup su `pagehide` / `visibilitychange`
- Test: unit con mock `Notification` e `setTimeout`

**Fase 6 — Notifiche background**
- Handler `periodicsync` in `src/sw.ts`
- Handler `notificationclick`
- `<NotificationOnboarding />`
- Registrazione `periodicSync` dopo permission grant
- Bridge `postMessage` per riconciliare lo store al rientro
- Test: unit con `fake-indexeddb` + mock SW. Smoke manuale finale su Android.

### Definition of done

- Tutti i test passano (`npm test`)
- ESLint zero errori (`npm run lint`)
- Build production ok (`npm run build`)
- Smoke manuale: install su Android, permesso concesso, almeno una notifica vista da app chiusa
- `MEMORY.md` aggiornato (regola progetto Workflow #4)
