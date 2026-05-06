# Design — Migrazione a Firebase (Auth + Firestore + Storage)

**Data**: 2026-05-06
**Stato**: spec approvata, in attesa di piano di implementazione
**Target**: PWA su Chrome desktop e Android Chrome (standalone)

## Sommario

Sostituire lo stack di persistenza attuale — Google Identity Services + Drive API + Sheets API + sync layer custom — con Firebase Auth (provider Google) + Firestore + Firebase Storage. Mantenere invariata l'interfaccia utente, gli store Zustand, e il sistema di notifiche locali.

## Motivazione

Lo stack attuale ha tre problemi strutturali:

1. **Login ricorrente.** Google Identity Services lato browser usa access token Google con TTL 1h. Il refresh silenzioso richiede una sessione Google attiva nel browser, che su PWA standalone (Android, modalità privata, riavvi) viene persa frequentemente. Risultato: l'utente vede il popup di consenso a ogni riapertura.
2. **Sync 60s polling + clear-and-replace.** `fullPull` rilegge tutto il foglio ogni 60s, e ogni `applyOp` cancella la tabella e la riscrive integralmente. Costoso, lento, fonte di una classe nota di bug (notifiche ripetute, race condition fra device, dati che spariscono).
3. **Codice di sync artigianale.** ~500 righe di adapter, queue, retry, hydrate-from-cache; ogni feature aggiuntiva paga questo costo.

## Obiettivi

- Login Google una volta sola; sessione persistente di mesi senza popup.
- Sync realtime PC↔mobile (1-2 secondi anziché 60).
- Eliminazione di `lib/sync.ts`, `lib/google/{sheets,drive,bootstrap,adapter}.ts`, `store/sync.ts`.
- Persistenza offline nativa (Firestore IndexedDB cache) con queue automatica per le scritture offline.
- Backup CSV settimanale automatico (Firebase Storage, gratis) + bottone "Esporta su Google Drive" on-demand.
- Restare nel free tier Firebase Spark (no carta di credito).

## Non-obiettivi

- Multi-tenancy / inviti / sharing tra utenti (rimandato).
- FCM (notifiche push server-driven). Le notifiche restano locali via `foregroundScheduler` + `periodicSync`.
- Cloud Functions (richiederebbero piano Blaze).
- Backup automatico su Google Drive (richiederebbe popup OAuth occasionali — Firebase Storage al loro posto).
- Migrazione di dati esistenti dallo Sheet (non popolato).

---

## 1. Architettura

### Stack rimosso

- `app/src/lib/google/auth.ts` → sostituito da Firebase Auth.
- `app/src/lib/google/sheets.ts`, `drive.ts`, `bootstrap.ts`, `adapter.ts` → sostituiti da Firestore SDK.
- `app/src/lib/sync.ts` → la logica di queue/retry/processQueue è interna alla persistence Firestore.
- `app/src/store/sync.ts` → status `idle/syncing/offline/error/unauth` derivato da listener Firestore.
- `app/src/lib/idb.ts` → **mantenuto**: il service worker legge `cdb_cache` IDB per la `periodicsync`, e gli store continueranno a fare `idbSet('tasks','all', items)` come oggi così il SW vede dati freschi anche offline. Firestore usa internamente un *altro* IndexedDB (gestito dalla SDK), separato da `cdb_cache`.

### Stack aggiunto

- `app/src/lib/firebase/config.ts` — `initializeApp` con `apiKey`, `projectId`. Le chiavi sono pubbliche per design Firebase; la sicurezza è nelle Security Rules.
- `app/src/lib/firebase/auth.ts` — `signInWithPopup(GoogleAuthProvider)`, `signOut`, `onAuthStateChanged` listener globale.
- `app/src/lib/firebase/db.ts` — wrapper su `collection`, `onSnapshot`, `setDoc`, `deleteDoc`. Espone API tipizzata per ciascuna collection.
- `app/src/lib/firebase/backup.ts` — dump-to-CSV, upload Firebase Storage, export Drive on-demand.

### Componenti invariati

- Tutti i componenti UI (`Home`, `CalendarPage`, `BookingForm`, ecc.).
- Tutti gli store Zustand (`bookings`, `promemoria`, `tasks`, `templates`, `closures`). Cambia solo come vengono *popolati*: invece di `bootSync` → `hydrateFromCache` → `fullPull`, vengono popolati da listener `onSnapshot` montati al primo login.
- Sistema notifiche locali (`foregroundScheduler` + service worker `periodicSync`).

### Diagramma

```
┌─────────────────────────────────────────────────┐
│                  Browser PWA                    │
│  ┌──────────────────────────────────────────┐   │
│  │  React UI ←→ Zustand stores              │   │
│  │              ↑                           │   │
│  │              │ onSnapshot                │   │
│  │              ↓                           │   │
│  │  Firebase SDK (Auth + Firestore + Stor.) │   │
│  │              ↑                           │   │
│  │              │ persist offline           │   │
│  │              ↓                           │   │
│  │  IndexedDB (gestita da SDK)              │   │
│  └──────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────┘
                     │
                     ↓
        ┌────────────────────────┐
        │   Firebase (Spark)     │
        │  - Auth (Google IdP)   │
        │  - Firestore           │
        │  - Storage             │
        └────────────────────────┘
```

---

## 2. Modello dati Firestore

```
users/{uid}/
├── bookings/{id}      → Prenotazione
├── promemoria/{id}    → Promemoria
├── tasks/{id}         → BookingTask
├── templates/{id}     → ReminderTemplate
└── closures/{id}      → Chiusura
```

### Document IDs

Riusiamo l'`id` generato da `lib/id.ts` (`uid('b')`, `uid('p')`, ecc.) come Firestore document ID. Questo permette:
- `setDoc(doc(db, ..., id), data)` per upsert idempotente
- `deleteDoc(doc(db, ..., id))` per cancellazione
- ID prevedibili lato client (per ottimismo locale)

### Type mapping

I tipi TypeScript di `app/src/types.ts` (`Prenotazione`, `Chiusura`, `Promemoria`, `BookingTask`, `ReminderTemplate`) si serializzano direttamente come documenti Firestore. Campo `id` rimane nel documento per simmetria con il pattern Zustand attuale.

### Date

Firestore preferisce `Timestamp`. Manteniamo le date come stringhe ISO (come oggi) per minimizzare il diff e perché tutta la business logic in `lib/date.ts` lavora con stringhe `YYYY-MM-DD` e ISO.

---

## 3. Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

Storage Rules:

```javascript
service firebase.storage {
  match /b/{bucket}/o {
    match /users/{userId}/backups/{file=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

Ogni utente accede solo ai propri dati. Conferma anti-tampering anche se le chiavi del client fossero esposte.

---

## 4. Auth flow

### Boot

1. `App.tsx` registra `onAuthStateChanged` listener al mount.
2. Se Firebase ha sessione persistita → callback con `User` → `useAuth.setState({ user, ... })` → render Home/Calendar.
3. Se nessuna sessione → callback con `null` → render `<SignIn />`.
4. Click "Accedi con Google" → `signInWithPopup(provider)` → al successo, callback `onAuthStateChanged` riempie lo store.

### Persistenza

Firebase Auth usa `indexedDBLocalPersistence` di default in browser: la sessione sopravvive a reload, riavvio del browser, ri-apertura della PWA standalone. Il refresh dell'ID token avviene silenziosamente (Firebase lo gestisce internamente, niente popup).

### Sign-out

`signOut()` Firebase → `onAuthStateChanged` callback con `null` → `useAuth.signOut()` → render SignIn. Tutti i listener `onSnapshot` si auto-detachano (vedi §5).

### Migrazione del codice attuale

- `lib/google/auth.ts` rimosso interamente.
- `App.tsx`: rimosso `initAuth/silentRefresh/startTokenAutoRefresh`. Aggiunto `onAuthStateChanged` listener nel `useEffect` di mount.
- `store/auth.ts`: rimosso il middleware `persist` (Firebase persiste già). Rimangono `user`, `signOut`. Rimossi `accessToken`, `tokenExpiry` (Firebase gestisce internamente). Rimosso `readonly` (per ora non c'è più capabilities check; i security rules sostituiscono il concetto).
- `components/SignIn.tsx`: il bottone chiama il nuovo `signIn()` Firebase.

---

## 5. Sync flow

### Listener registration

Quando `useAuth.user` diventa truthy, monto 5 listener `onSnapshot` in `App.tsx` (o in un hook dedicato `useFirestoreSync`):

```ts
const subs = [
  onSnapshot(collection(db, 'users', uid, 'bookings'), snap => {
    useBookings.setState({ items: snap.docs.map(d => d.data() as Prenotazione) });
  }),
  onSnapshot(collection(db, 'users', uid, 'promemoria'), snap => {
    usePromemoria.setState({ items: snap.docs.map(d => d.data() as Promemoria) });
  }),
  // ... tasks, templates, closures
];
return () => subs.forEach(unsub => unsub());
```

### Scritture

Ogni store Zustand mantiene la stessa API (`add`, `update`, `remove`) ma internamente:

```ts
add: async (b) => {
  const item = { ...b, id: uid('b'), creatoIl: ..., aggiornatoIl: ... };
  await setDoc(doc(db, 'users', uid, 'bookings', item.id), item);
  // niente set locale: il listener onSnapshot ricever il nuovo documento e aggiornerà lo store
}
```

L'optimistic update è implicito: con `enableIndexedDbPersistence` Firestore **applica subito** la scrittura alla cache locale e *triggera* `onSnapshot` con `metadata.hasPendingWrites=true`. Quando arriva la conferma server, ri-triggera senza il flag. UX: nessun flicker.

### Offline

`enableIndexedDbPersistence(db)` durante l'init. Firestore SDK:
- Cache automatica in IndexedDB (`firestore` DB managed dalla lib).
- Scritture offline accodate, ritentate al ritorno online.
- `onSnapshot` continua a servire dalla cache locale.

Niente più queue manuale, niente `processQueue`, niente `enqueue`.

### Sync indicator

Il componente `SyncIndicator` esistente continua a esistere ma legge da `useFirestoreStatus` (nuovo hook che osserva `enableNetwork/disableNetwork` + `navigator.onLine` + presenza di `hasPendingWrites` nei snapshot più recenti).

---

## 6. Notifiche locali

Invariate. Il service worker (`app/src/sw.ts`) continua a usare `cdb_cache` IDB per leggere i task in `periodicsync`. Il foregroundScheduler in app continua a leggere da `useTasks`.

L'unica differenza: oggi `useTasks` viene popolato da `idbGet('tasks', 'all')` al boot e poi da `fullPull`. Domani sarà popolato dal listener `onSnapshot` su `users/{uid}/tasks/`. Il SW continua a usare `cdb_cache` IDB perché *quel* IDB è popolato dalle scritture lato app: per mantenere la compatibilità, lo store `useTasks` continuerà a fare `idbSet('tasks', 'all', items)` ad ogni cambio (è già il pattern attuale, basta non rimuoverlo).

---

## 7. Backup

### Strategia

- Trigger: al boot, se `lastBackupAt < now - 7d` → esegui in background.
- Output: ZIP contenente 5 CSV (`bookings.csv`, `promemoria.csv`, `tasks.csv`, `templates.csv`, `closures.csv`).
- Destinazione: Firebase Storage `users/{uid}/backups/backup-YYYY-MM-DD.zip`.
- Retention: rolling, ultimi 4 backup. I più vecchi vengono cancellati dopo l'upload del nuovo.

### Implementazione

`app/src/lib/firebase/backup.ts`:

```ts
async function runBackup(uid: string): Promise<void>
async function listBackups(uid: string): Promise<BackupMeta[]>
async function downloadBackup(meta: BackupMeta): Promise<Blob>
async function exportToDrive(meta: BackupMeta): Promise<void> // on-demand, scope drive.file
```

CSV: serializzazione triviale con escape RFC 4180 (virgolette intorno a campi con virgola/newline/quote, raddoppiamento delle virgolette). Niente librerie esterne: ~30 righe.

ZIP: una libreria piccola tipo `fflate` o `jszip` (`fflate` ~15kB gzipped, raccomandata).

### UI

Nuova sezione "Backup" dentro la pagina Impostazioni (l'attuale `TemplatesPage`):

- Data ultimo backup automatico.
- Lista degli ultimi 4 backup con data + dimensione.
- Bottone "Scarica adesso" — download URL Firebase Storage (signed URL).
- Bottone "Esporta su Google Drive" — apre popup OAuth (scope `drive.file`), carica il file via Drive API. Solo questo bottone usa OAuth Drive; tutto il resto è gestito da Firebase Auth.

### Trade-off accettato

Il bottone "Esporta su Google Drive" è l'unico residuo del problema OAuth-Drive: occasionalmente potrà richiedere un mini-popup di consenso. Ma è esplicito e on-demand, non più una condizione di funzionamento dell'app.

---

## 8. Configurazione utente

Setup one-time guidato (lo facciamo insieme):

1. https://console.firebase.google.com → "Crea progetto" → nome a scelta → no Google Analytics.
2. "Aggiungi app" → web → registrazione → copio `apiKey` e `projectId` nelle variabili d'ambiente Vite (`VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_PROJECT_ID`).
3. Authentication → Sign-in method → Google → Enable.
4. Firestore Database → Crea → modalità test (poi rules definitive). Regione: `eur3` (Europa).
5. Storage → Get started → modalità test (rules definitive subito dopo).
6. Le rules vengono deployate via `firebase deploy --only firestore:rules,storage` (CLI Firebase, gratuita).

Niente carta di credito, niente Blaze plan.

---

## 9. Costi (Spark plan)

| Servizio | Limite gratuito | Stima reale uso famiglia |
|---|---|---|
| Auth | Illimitato | n/a |
| Firestore reads | 50.000/giorno | 100-300/giorno |
| Firestore writes | 20.000/giorno | 10-30/giorno |
| Firestore storage | 1 GiB | < 10 MB |
| Storage upload | 5 GiB totali / 1 GB/giorno bandwidth | 4 ZIP × ~100 kB = 400 kB |

Si rimane 2-3 ordini di grandezza sotto i limiti free per anni di uso normale.

---

## 10. Rollout

### Branch & deploy

- Branch: `feat/firebase-migration`.
- Tag pre-merge: `pre-firebase` su `main`, per rollback rapido.
- Deploy: merge → CI build → GitHub Pages.
- Cutover: hard, single deploy. Nessuna feature flag (lo Sheet vecchio non è popolato; non c'è dato da migrare).

### Test

- Unit: ogni modulo in `lib/firebase/*` con `@firebase/rules-unit-testing` + `firebase-functions-test` (emulatore Firestore).
- Mantenuti tutti i test esistenti su componenti e business logic (`lib/reminders/*`, `store/*` rimanenti, `components/*`).
- Smoke E2E manuale prima del merge: login → crea booking → verifica appare sull'altro device entro 2s.

### Rimosso post-merge

I file dello stack vecchio rimossi nel merge:

- `app/src/lib/google/auth.ts`
- `app/src/lib/google/sheets.ts`
- `app/src/lib/google/drive.ts`
- `app/src/lib/google/bootstrap.ts`
- `app/src/lib/google/adapter.ts`
- `app/src/lib/sync.ts`
- `app/src/store/sync.ts`
- `app/tests/lib/google/auth.test.ts` (sostituito da test Firebase)
- `app/tests/lib/google/people.test.ts` (mantenuto se People API è ancora usata per ricerca contatti — verificare in fase di plan)
- `app/tests/lib/conflicts.test.ts` (la logica conflitti booking resta, ma test del sync layer no)

I file `lib/google/people.ts` e relativi possono rimanere se la ricerca contatti continua a usare People API direttamente; verifichiamo durante il plan dettagliato.

---

## 11. Rischi e mitigazioni

| Rischio | Probabilità | Impatto | Mitigazione |
|---|---|---|---|
| Firebase abusa il free tier in futuro | Bassa | Medio | Postgres self-hosted come piano B; il modello dati è semplice |
| Listener `onSnapshot` non si detachano e accumulano | Media | Medio | Cleanup esplicito in unmount dei componenti owners; test con HMR |
| Read costi schizzano per bug (loop di scritture) | Bassa | Basso | Spark plan è hard-limited: l'app smette di funzionare ma niente fattura |
| `enableIndexedDbPersistence` fallisce su PWA standalone | Bassa | Alto | Try/catch + warning utente; modalità online-only fallback |
| Dipendenza vendor lock-in NoSQL | Bassa | Basso | Schema documenti corrisponde 1:1 ai TS types: export → JSON → re-import altrove fattibile |

---

## 12. Stima effort

- §1–§3 architettura, modello dati, rules: ~1h
- §4 auth flow: ~1.5h
- §5 sync flow + rimozione codice vecchio: ~3h
- §6 notifiche (verifiche, niente codice nuovo): ~0.5h
- §7 backup: ~2h
- §8 setup utente + env vars: ~0.5h
- §10 test + rollout: ~1.5h

**Totale: ~10h**, distribuibili su 3-4 sessioni.

---

## Domande aperte (da chiudere nel plan)

- Mantenere `app/src/lib/google/people.ts` per la ricerca contatti? Sì, se ancora in uso (verificare consumatori).
- Strategia esatta per il sync indicator (`SyncIndicator`): leggere da `metadata.hasPendingWrites` di un solo snapshot rappresentativo, o aggregare?
- Ordine esatto di rimozione dei file vecchi: prima aggiungere il nuovo flusso e validarlo end-to-end, poi rimuovere il vecchio. Eventualmente in due commit separati.
