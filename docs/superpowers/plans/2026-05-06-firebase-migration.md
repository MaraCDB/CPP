# Firebase Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sostituire lo stack Google Identity Services + Drive + Sheets + sync layer custom con Firebase Auth + Firestore + Storage, mantenendo invariati UI, store Zustand e notifiche locali.

**Architecture:** Firebase Auth (provider Google) per sessione persistente; Firestore con `enableIndexedDbPersistence` per offline + realtime via `onSnapshot`; backup ZIP **solo on-demand su Google Drive** (Firebase Storage non è disponibile sul piano Spark per questo progetto, vedi nota in §"Adattamento setup"); People API mantenuta tramite OAuth credential dello stesso login Firebase. `cdb_cache` IDB rimane per il service worker (notifiche periodiche).

## Adattamento setup (decisione 2026-05-06)

Firebase Storage richiede l'upgrade al piano Blaze (carta di credito) per questo progetto. Decisione utente: **niente Blaze**. Conseguenze sul piano:

- Niente `lib/firebase/storage` import, niente `firebase/storage` SDK.
- Niente `storage.rules` e niente deploy Storage.
- Niente trigger automatico settimanale al boot.
- Backup è solo on-demand: bottone "Esporta su Drive" in Impostazioni → genera ZIP in memoria → upload via Drive API col `googleAccessToken` catturato al login Firebase (scope `drive.file` aggiunto al provider).
- Niente lista backup remota; opzionalmente la pagina mostra `lastBackupAt` letto da `localStorage` come reminder visivo.

**Tech Stack:** firebase ^11 (modular SDK), fflate ^0.8 (ZIP), TypeScript, Vitest, React 19, Zustand 5.

**Riferimento spec:** `docs/superpowers/specs/2026-05-06-firebase-migration-design.md`

**Branch:** `feat/firebase-migration` (da creare in fase 0).

---

## File Structure

### Nuovi file

- `app/src/lib/firebase/config.ts` — `initializeApp` + esporta `app`.
- `app/src/lib/firebase/auth.ts` — `signIn`, `signOut`, listener `onAuthStateChanged`, capture OAuth credential per People API.
- `app/src/lib/firebase/db.ts` — Firestore init + `enableIndexedDbPersistence` + helper tipizzati `subscribeCollection`, `upsertDoc`, `removeDoc`.
- `app/src/lib/firebase/backup.ts` — CSV serializer + `buildZipBytes` (pure, no SDK calls).
- `app/src/lib/google/driveBackup.ts` — `exportZipToDrive(uid, bytes)`, lista backup esistenti su Drive, marker `lastBackupAt` in localStorage.
- `app/src/hooks/useFirestoreSync.ts` — monta i 5 listener `onSnapshot` quando user diventa truthy.
- `app/src/hooks/useFirestoreStatus.ts` — stato di rete derivato (idle/syncing/offline) per il `SyncIndicator`.
- `app/tests/lib/firebase/auth.test.ts`
- `app/tests/lib/firebase/db.test.ts`
- `app/tests/lib/firebase/backup.test.ts`
- `app/tests/hooks/useFirestoreSync.test.ts`
- `firestore.rules` (radice repo)

### File modificati

- `app/src/store/auth.ts` — rimosso persist/accessToken/tokenExpiry/readonly/setSession/setReadonly. Aggiunto `googleAccessToken` (per People API).
- `app/src/App.tsx` — rimosso `initAuth/silentRefresh/startTokenAutoRefresh/bootSync`; aggiunto `onAuthStateChanged` + `useFirestoreSync`.
- `app/src/components/SignIn.tsx` — usa nuovo `signIn` Firebase.
- `app/src/components/SyncIndicator.tsx` — legge `useFirestoreStatus`, click forza `enableNetwork`.
- `app/src/store/bookings.ts` — sostituisce `enq` con `upsertDoc`/`removeDoc`; rimuove `set` locale (lo stato arriva dal listener).
- `app/src/store/closures.ts` — idem.
- `app/src/store/promemoria.ts` — idem.
- `app/src/store/tasks.ts` — idem; mantiene `idbSet('tasks','all', items)` per il SW.
- `app/src/store/templates.ts` — idem.
- `app/src/components/calendar/BottomBar.tsx`, `BookingForm.tsx`, `ClosureForm.tsx`, `DayDetailPanel.tsx`, `TodoPanel.tsx`, `ReadOnlyBanner.tsx` — rimuovono il branch `readonly`.
- `app/src/lib/google/people.ts` — legge `useAuth.getState().googleAccessToken` invece di `accessToken`.
- `app/src/components/forms/BookingForm.tsx` — invariato, ma `searchByPhone` userà il nuovo token (commit non ne tocca il sorgente, solo se serve).
- `app/src/components/settings/TemplatesPage.tsx` — aggiunge sezione "Backup".
- `app/package.json` — aggiunge `firebase`, `fflate`; rimuove eventuale dipendenza non usata.
- `app/tests/setup.ts` — aggiunge mock di `firebase/app`, `firebase/auth`, `firebase/firestore` se necessario.
- `app/.env.example` (creare se non esiste) — `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_APP_ID`.

### File rimossi (Fase 8)

- `app/src/lib/google/auth.ts`
- `app/src/lib/google/sheets.ts`
- `app/src/lib/google/drive.ts`
- `app/src/lib/google/bootstrap.ts`
- `app/src/lib/google/adapter.ts`
- `app/src/lib/sync.ts`
- `app/src/store/sync.ts`
- `app/src/components/ReadOnlyBanner.tsx` (se non più importato)
- `app/tests/lib/google/auth.test.ts`
- `app/tests/lib/adapter.test.ts`
- `app/tests/lib/conflicts.test.ts` SOLO se accoppiato a sync; conservare la parte sui conflitti reali.
- `app/tests/store/auth.test.ts` (sostituito da `firebase/auth.test.ts`)

### File NON toccati

- `app/src/sw.ts` (legge `cdb_cache` IDB, immutato).
- `app/src/lib/idb.ts`, `lib/reminders/*`, `lib/notifications/*`, `lib/date.ts`, `lib/id.ts`, `lib/conflicts.ts`, `lib/phone.ts`.
- Tutti i componenti UI calendar, panels, forms (eccetto rimozione `readonly`).
- `vite.config.ts` (la PWA setup non cambia).

---

## FASE 0 — Setup progetto (utente + branch)

### Task 0.1: Creazione progetto Firebase (manuale)

**Files:** nessuno (passo manuale lato utente). Documenta il risultato in `docs/superpowers/specs/2026-05-06-firebase-migration-design.md` se servono note (sezione "Note di setup").

- [ ] **Step 1: L'utente segue questi 6 passi sulla Firebase Console**

```text
1. https://console.firebase.google.com → "Crea progetto" → nome es. "cuore-di-bosco" → no Google Analytics.
2. ⚙ → Impostazioni progetto → I tuoi apps → "Aggiungi app" → Web → registra "cuore-di-bosco-web" → niente hosting.
3. Copia i valori di firebaseConfig.{apiKey, authDomain, projectId, storageBucket, appId} (servono dopo).
4. Authentication → Sign-in method → Google → Enable → seleziona email di support → Save.
5. Firestore Database → Crea database → start in production mode → regione "eur3 (europe-west)".
6. Storage → Get started → start in production mode → regione "eur3".
```

- [ ] **Step 2: Salva i valori in `app/.env.local` (NON committare)**

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_APP_ID=...
```

- [ ] **Step 3: Conferma all'utente che l'env locale è popolato e Firebase Auth ha Google IdP attivo**

Niente da committare in questo step.

### Task 0.2: Branch + dipendenze + env example

**Files:**
- Modify: `app/package.json`
- Create: `app/.env.example`

- [ ] **Step 1: Creare branch e installare dipendenze**

```bash
git checkout -b feat/firebase-migration
cd app
npm install firebase@^11 fflate@^0.8
```

- [ ] **Step 2: Creare `app/.env.example`**

```env
VITE_GOOGLE_CLIENT_ID=
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_APP_ID=
```

- [ ] **Step 3: Verificare che `app/.env.local` sia in `.gitignore`**

Run: `git check-ignore app/.env.local`
Expected: stampa `app/.env.local` (file ignorato).

- [ ] **Step 4: Tag pre-firebase su main (per rollback)**

```bash
git tag pre-firebase main
git push origin pre-firebase
```

- [ ] **Step 5: Commit**

```bash
git add app/package.json app/package-lock.json app/.env.example
git commit -m "chore(firebase): add firebase + fflate deps and env example"
```

---

## FASE 1 — Firebase config + Auth

### Task 1.1: `lib/firebase/config.ts`

**Files:**
- Create: `app/src/lib/firebase/config.ts`
- Test: nessuno (config statico).

- [ ] **Step 1: Scrivere il modulo config**

```ts
// app/src/lib/firebase/config.ts
import { initializeApp, type FirebaseApp } from 'firebase/app';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
};

export const app: FirebaseApp = initializeApp(config);
```

- [ ] **Step 2: Verifica build**

Run: `cd app && npx tsc --noEmit`
Expected: zero errori.

- [ ] **Step 3: Commit**

```bash
git add app/src/lib/firebase/config.ts
git commit -m "feat(firebase): initialize firebase app from env"
```

### Task 1.2: `lib/firebase/auth.ts` con scope contacts

**Files:**
- Create: `app/src/lib/firebase/auth.ts`
- Test: `app/tests/lib/firebase/auth.test.ts`

- [ ] **Step 1: Scrivere test (vitest mock di firebase/auth)**

```ts
// app/tests/lib/firebase/auth.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSignInWithPopup = vi.fn();
const mockSignOut = vi.fn();
const mockOnAuthStateChanged = vi.fn();
const mockGetAuth = vi.fn(() => ({}));

vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: class {
    addScope = vi.fn();
    static credentialFromResult = vi.fn(() => ({ accessToken: 'token-xyz' }));
  },
  getAuth: mockGetAuth,
  signInWithPopup: mockSignInWithPopup,
  signOut: mockSignOut,
  onAuthStateChanged: mockOnAuthStateChanged,
  indexedDBLocalPersistence: 'indexedDBLocalPersistence',
  setPersistence: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../src/lib/firebase/config', () => ({ app: {} }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('firebase auth', () => {
  it('signIn calls signInWithPopup and stores google access token', async () => {
    mockSignInWithPopup.mockResolvedValueOnce({
      user: { uid: 'u1', email: 'a@b.com', displayName: 'A', photoURL: null },
    });
    const { signIn } = await import('../../../src/lib/firebase/auth');
    const { useAuth } = await import('../../../src/store/auth');
    await signIn();
    expect(mockSignInWithPopup).toHaveBeenCalled();
    expect(useAuth.getState().googleAccessToken).toBe('token-xyz');
  });

  it('signOut clears auth state', async () => {
    mockSignOut.mockResolvedValueOnce(undefined);
    const { signOut } = await import('../../../src/lib/firebase/auth');
    const { useAuth } = await import('../../../src/store/auth');
    useAuth.setState({
      user: { email: 'a', name: 'A' },
      googleAccessToken: 't',
    });
    await signOut();
    expect(useAuth.getState().user).toBeNull();
    expect(useAuth.getState().googleAccessToken).toBeNull();
  });

  it('initAuthListener wires onAuthStateChanged to store', async () => {
    let cb: ((user: unknown) => void) | null = null;
    mockOnAuthStateChanged.mockImplementation((_a, fn) => { cb = fn; return () => {}; });
    const { initAuthListener } = await import('../../../src/lib/firebase/auth');
    const { useAuth } = await import('../../../src/store/auth');
    initAuthListener();
    cb?.({ uid: 'u1', email: 'x@y.com', displayName: 'X', photoURL: 'p' });
    expect(useAuth.getState().user).toEqual({ email: 'x@y.com', name: 'X', picture: 'p' });
    cb?.(null);
    expect(useAuth.getState().user).toBeNull();
  });
});
```

- [ ] **Step 2: Run test, verifica fail**

Run: `cd app && npm test -- lib/firebase/auth.test.ts`
Expected: FAIL (modulo non esiste).

- [ ] **Step 3: Implementare `lib/firebase/auth.ts`**

```ts
// app/src/lib/firebase/auth.ts
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut as fbSignOut,
  onAuthStateChanged, setPersistence, indexedDBLocalPersistence,
  type User,
} from 'firebase/auth';
import { app } from './config';
import { useAuth } from '../../store/auth';

export const auth = getAuth(app);
void setPersistence(auth, indexedDBLocalPersistence);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/contacts');
provider.addScope('https://www.googleapis.com/auth/drive.file');

const userToStore = (u: User) => ({
  email: u.email ?? '',
  name: u.displayName ?? '',
  picture: u.photoURL ?? undefined,
});

export const signIn = async (): Promise<void> => {
  const result = await signInWithPopup(auth, provider);
  const cred = GoogleAuthProvider.credentialFromResult(result);
  useAuth.setState({
    user: userToStore(result.user),
    googleAccessToken: cred?.accessToken ?? null,
  });
};

export const signOut = async (): Promise<void> => {
  await fbSignOut(auth);
  useAuth.setState({ user: null, googleAccessToken: null });
};

export const initAuthListener = (): (() => void) =>
  onAuthStateChanged(auth, (u) => {
    if (u) {
      // Mantiene googleAccessToken se già presente (può essere null fino al prossimo sign-in).
      useAuth.setState({ user: userToStore(u) });
    } else {
      useAuth.setState({ user: null, googleAccessToken: null });
    }
  });
```

- [ ] **Step 4: Run test, verifica pass**

Run: `cd app && npm test -- lib/firebase/auth.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/firebase/auth.ts app/tests/lib/firebase/auth.test.ts
git commit -m "feat(firebase): add auth wrapper with google + contacts scope"
```

### Task 1.3: Refactor `store/auth.ts`

**Files:**
- Modify: `app/src/store/auth.ts`
- Modify: `app/tests/store/auth.test.ts` (o riscrivere)

- [ ] **Step 1: Aggiornare il test**

Apri `app/tests/store/auth.test.ts`. Rimpiazza il contenuto con:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useAuth } from '../../src/store/auth';

beforeEach(() => {
  useAuth.setState({ user: null, googleAccessToken: null });
});

describe('useAuth', () => {
  it('starts empty', () => {
    expect(useAuth.getState().user).toBeNull();
    expect(useAuth.getState().googleAccessToken).toBeNull();
  });

  it('stores user and googleAccessToken via setState', () => {
    useAuth.setState({
      user: { email: 'a@b.com', name: 'A' },
      googleAccessToken: 'tok',
    });
    expect(useAuth.getState().user?.email).toBe('a@b.com');
    expect(useAuth.getState().googleAccessToken).toBe('tok');
  });
});
```

- [ ] **Step 2: Run test, verifica fail**

Run: `cd app && npm test -- store/auth.test.ts`
Expected: FAIL (campo `googleAccessToken` non esiste, `setSession` ancora richiesto da `lib/google/auth.ts`).

- [ ] **Step 3: Riscrivere `store/auth.ts`**

```ts
// app/src/store/auth.ts
import { create } from 'zustand';
import type { GoogleUser } from '../types';

interface State {
  user: GoogleUser | null;
  googleAccessToken: string | null;
}

export const useAuth = create<State>(() => ({
  user: null,
  googleAccessToken: null,
}));
```

- [ ] **Step 4: Run test, verifica pass**

Run: `cd app && npm test -- store/auth.test.ts`
Expected: PASS.

NOTA: in questo punto `lib/google/auth.ts`, `lib/google/people.ts`, `lib/google/sheets.ts`, `lib/google/drive.ts`, `lib/sync.ts`, e i componenti che leggono `readonly` non compileranno. Sono tutti gestiti nei task seguenti — la build resta rotta finché non completi la Fase 5. È atteso.

- [ ] **Step 5: NIENTE commit ancora** — l'albero non compila. Procedi alla Task 1.4 prima di committare.

### Task 1.4: Aggiornare `App.tsx`

**Files:**
- Modify: `app/src/App.tsx`

- [ ] **Step 1: Riscrivere `App.tsx` rimuovendo Google OAuth e bootSync**

```tsx
// app/src/App.tsx
import { useEffect } from 'react';
import { useAuth } from './store/auth';
import { useUI } from './store/ui';
import { Home } from './components/Home';
import { CalendarPage } from './components/calendar/CalendarPage';
import { SignIn } from './components/SignIn';
import { InstallPrompt } from './components/InstallPrompt';
import { NotificationOnboarding } from './components/NotificationOnboarding';
import { initAuthListener } from './lib/firebase/auth';
import { useFirestoreSync } from './hooks/useFirestoreSync';
import { useTemplates } from './store/templates';
import { useTasks } from './store/tasks';
import { idbGet } from './lib/idb';
import type { BookingTask } from './types';
import { scheduleTask, cancelAll } from './lib/notifications/foregroundScheduler';

export default function App() {
  const user = useAuth(s => s.user);
  const page = useUI(s => s.page);

  useEffect(() => {
    const unsub = initAuthListener();
    useTemplates.getState().seedDefaults();
    void idbGet<BookingTask[]>('tasks', 'all').then(arr => {
      if (arr) useTasks.setState({ items: arr });
    });

    let removeMsgListener: (() => void) | undefined;
    if ('serviceWorker' in navigator) {
      const onMessage = (e: MessageEvent) => {
        if ((e.data as { type?: string } | undefined)?.type === 'open-task') {
          const { bookingId } = e.data as { bookingId?: string };
          if (bookingId) useUI.getState().openModal({ kind: 'booking', id: bookingId });
          void idbGet<BookingTask[]>('tasks', 'all').then(arr => {
            if (arr) useTasks.setState({ items: arr });
          });
        }
      };
      navigator.serviceWorker.addEventListener('message', onMessage);
      removeMsgListener = () => navigator.serviceWorker.removeEventListener('message', onMessage);
    }

    return () => {
      unsub();
      removeMsgListener?.();
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const bookingId = params.get('booking');
    if (bookingId) {
      useUI.getState().openModal({ kind: 'booking', id: bookingId });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  useFirestoreSync(user ? { uid: user.email } : null);
  // NOTE: il vero uid arriverà dal listener Firebase. La firma corretta del hook è `useFirestoreSync(uid: string | null)` — passeremo `auth.currentUser?.uid` in Task 3.1.

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
      <NotificationOnboarding />
      {page === 'home' ? <Home /> : <CalendarPage />}
    </>
  );
}
```

NOTA: il file importa `useFirestoreSync` che ancora non esiste. Lo creiamo in Task 3.1. Per ora la build resta rotta.

- [ ] **Step 2: NIENTE commit ancora** — completiamo prima fase 1 e 2 e committiamo a pacchetti coerenti dopo.

### Task 1.5: Riscrivere `SignIn.tsx`

**Files:**
- Modify: `app/src/components/SignIn.tsx`

- [ ] **Step 1: Sostituire l'import e l'handler**

```tsx
// app/src/components/SignIn.tsx
import { signIn } from '../lib/firebase/auth';

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
      <button className="btn btn-primary w-full" onClick={() => void signIn()}>Accedi con Google</button>
    </div>
  </section>
);
```

- [ ] **Step 2: NIENTE commit ancora.**

---

## FASE 2 — Firestore DB layer

### Task 2.1: `lib/firebase/db.ts` con persistenza IDB

**Files:**
- Create: `app/src/lib/firebase/db.ts`
- Test: `app/tests/lib/firebase/db.test.ts`

- [ ] **Step 1: Scrivere test**

```ts
// app/tests/lib/firebase/db.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockOnSnapshot = vi.fn();
const mockSetDoc = vi.fn();
const mockDeleteDoc = vi.fn();
const mockDoc = vi.fn((..._args) => ({ __ref: _args }));
const mockCollection = vi.fn((..._args) => ({ __ref: _args }));
const mockGetFirestore = vi.fn(() => ({}));
const mockEnablePersistence = vi.fn().mockResolvedValue(undefined);

vi.mock('firebase/firestore', () => ({
  getFirestore: mockGetFirestore,
  collection: mockCollection,
  doc: mockDoc,
  onSnapshot: mockOnSnapshot,
  setDoc: mockSetDoc,
  deleteDoc: mockDeleteDoc,
  enableIndexedDbPersistence: mockEnablePersistence,
  enableNetwork: vi.fn().mockResolvedValue(undefined),
  disableNetwork: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../src/lib/firebase/config', () => ({ app: {} }));

beforeEach(() => vi.clearAllMocks());

describe('firebase db', () => {
  it('subscribeCollection wires onSnapshot and decodes docs', async () => {
    const { subscribeCollection } = await import('../../../src/lib/firebase/db');
    const cb = vi.fn();
    let snapHandler: ((s: { docs: { data: () => unknown }[] }) => void) | null = null;
    mockOnSnapshot.mockImplementation((_ref, h) => { snapHandler = h; return () => {}; });
    subscribeCollection<{ id: string; v: number }>('u1', 'bookings', cb);
    snapHandler?.({ docs: [{ data: () => ({ id: 'a', v: 1 }) }] });
    expect(cb).toHaveBeenCalledWith([{ id: 'a', v: 1 }]);
  });

  it('upsertDoc writes via setDoc', async () => {
    const { upsertDoc } = await import('../../../src/lib/firebase/db');
    await upsertDoc('u1', 'bookings', 'b1', { id: 'b1' });
    expect(mockSetDoc).toHaveBeenCalled();
  });

  it('removeDoc calls deleteDoc', async () => {
    const { removeDoc } = await import('../../../src/lib/firebase/db');
    await removeDoc('u1', 'bookings', 'b1');
    expect(mockDeleteDoc).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test, verifica fail**

Run: `cd app && npm test -- lib/firebase/db.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementare `lib/firebase/db.ts`**

```ts
// app/src/lib/firebase/db.ts
import {
  getFirestore, collection, doc, onSnapshot, setDoc, deleteDoc,
  enableIndexedDbPersistence, enableNetwork, disableNetwork,
} from 'firebase/firestore';
import { app } from './config';

export const db = getFirestore(app);

export const initPersistence = async (): Promise<boolean> => {
  try {
    await enableIndexedDbPersistence(db);
    return true;
  } catch (err) {
    console.warn('Firestore persistence disabled:', err);
    return false;
  }
};

export type CollectionName =
  | 'bookings' | 'closures' | 'promemoria' | 'tasks' | 'templates';

export const subscribeCollection = <T>(
  uid: string,
  name: CollectionName,
  cb: (items: T[]) => void,
): (() => void) => {
  const ref = collection(db, 'users', uid, name);
  return onSnapshot(ref, snap => {
    cb(snap.docs.map(d => d.data() as T));
  });
};

export const upsertDoc = <T extends { id: string }>(
  uid: string, name: CollectionName, id: string, data: T,
): Promise<void> => setDoc(doc(db, 'users', uid, name, id), data);

export const removeDoc = (
  uid: string, name: CollectionName, id: string,
): Promise<void> => deleteDoc(doc(db, 'users', uid, name, id));

export const goOnline = (): Promise<void> => enableNetwork(db);
export const goOffline = (): Promise<void> => disableNetwork(db);
```

- [ ] **Step 4: Run test, verifica pass**

Run: `cd app && npm test -- lib/firebase/db.test.ts`
Expected: PASS.

- [ ] **Step 5: Inizializzare persistenza al mount in `App.tsx`**

Aggiungi all'inizio del primo `useEffect` di `App.tsx`:

```tsx
import { initPersistence } from './lib/firebase/db';
// dentro useEffect:
void initPersistence();
```

- [ ] **Step 6: NIENTE commit ancora.**

---

## FASE 3 — Listener-based stores

### Task 3.1: Hook `useFirestoreSync`

**Files:**
- Create: `app/src/hooks/useFirestoreSync.ts`
- Test: `app/tests/hooks/useFirestoreSync.test.ts`

- [ ] **Step 1: Scrivere test**

```ts
// app/tests/hooks/useFirestoreSync.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const subs: string[] = [];
vi.mock('../../src/lib/firebase/db', () => ({
  subscribeCollection: vi.fn((_uid, name, _cb) => {
    subs.push(name);
    return () => { subs.splice(subs.indexOf(name), 1); };
  }),
}));

beforeEach(() => { subs.length = 0; });

describe('useFirestoreSync', () => {
  it('subscribes 5 collections when uid is provided', async () => {
    const { useFirestoreSync } = await import('../../src/hooks/useFirestoreSync');
    renderHook(() => useFirestoreSync('u1'));
    expect(subs).toEqual(['bookings','closures','promemoria','tasks','templates']);
  });

  it('does nothing when uid is null', async () => {
    const { useFirestoreSync } = await import('../../src/hooks/useFirestoreSync');
    renderHook(() => useFirestoreSync(null));
    expect(subs).toEqual([]);
  });

  it('unsubscribes on uid change', async () => {
    const { useFirestoreSync } = await import('../../src/hooks/useFirestoreSync');
    const { rerender } = renderHook(({ uid }: { uid: string | null }) => useFirestoreSync(uid), {
      initialProps: { uid: 'u1' },
    });
    expect(subs.length).toBe(5);
    rerender({ uid: null });
    expect(subs.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run test, verifica fail**

Run: `cd app && npm test -- hooks/useFirestoreSync.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementare il hook**

```ts
// app/src/hooks/useFirestoreSync.ts
import { useEffect } from 'react';
import { subscribeCollection } from '../lib/firebase/db';
import { useBookings } from '../store/bookings';
import { useClosures } from '../store/closures';
import { usePromemoria } from '../store/promemoria';
import { useTasks } from '../store/tasks';
import { useTemplates } from '../store/templates';
import { idbSet } from '../lib/idb';
import type { Prenotazione, Chiusura, Promemoria, BookingTask, ReminderTemplate } from '../types';

export const useFirestoreSync = (uid: string | null): void => {
  useEffect(() => {
    if (!uid) return;
    const unsubs = [
      subscribeCollection<Prenotazione>(uid, 'bookings', items => {
        useBookings.setState({ items });
      }),
      subscribeCollection<Chiusura>(uid, 'closures', items => {
        useClosures.setState({ items });
      }),
      subscribeCollection<Promemoria>(uid, 'promemoria', items => {
        usePromemoria.setState({ items });
      }),
      subscribeCollection<BookingTask>(uid, 'tasks', items => {
        useTasks.setState({ items });
        void idbSet('tasks', 'all', items); // mantiene cdb_cache per il SW
      }),
      subscribeCollection<ReminderTemplate>(uid, 'templates', items => {
        if (items.length > 0) useTemplates.setState({ items });
      }),
    ];
    return () => unsubs.forEach(u => u());
  }, [uid]);
};
```

- [ ] **Step 4: Run test, verifica pass**

Run: `cd app && npm test -- hooks/useFirestoreSync.test.ts`
Expected: PASS.

- [ ] **Step 5: Aggiornare `App.tsx` per passare il vero uid**

In `App.tsx`, sostituisci la chiamata `useFirestoreSync(user ? { uid: user.email } : null)` con:

```tsx
import { auth } from './lib/firebase/auth';
// ...
const uid = useAuth(s => s.user) ? auth.currentUser?.uid ?? null : null;
useFirestoreSync(uid);
```

- [ ] **Step 6: NIENTE commit ancora.**

### Task 3.2: Refactor `store/bookings.ts`

**Files:**
- Modify: `app/src/store/bookings.ts`
- Modify: `app/tests/store/bookings.test.ts`

- [ ] **Step 1: Aggiornare il test**

Apri `app/tests/store/bookings.test.ts` e adatta i test per riflettere la nuova API: `add` ora chiama `upsertDoc` invece di `enqueue`. Aggiungi mock:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/lib/firebase/db', () => ({
  upsertDoc: vi.fn().mockResolvedValue(undefined),
  removeDoc: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/lib/firebase/auth', () => ({
  auth: { currentUser: { uid: 'u1' } },
}));

beforeEach(() => {
  vi.clearAllMocks();
  // reset zustand stores
});

// Aggiungi un test "add() calls upsertDoc with item id" e mantieni i test esistenti
// di logica pura (es. side effect su tasks via onBookingCreated) modificandoli al
// nuovo flusso. Lasciamo i test di onBookingUpdated/onBookingRemoved se esistono;
// devono continuare a passare perché il flusso sui task è invariato.
```

(Adatta il file esistente: i test di onBookingCreated/Updated/Removed restano validi perché toccano `useTasks`, non Firestore.)

- [ ] **Step 2: Run test, verifica fail**

Run: `cd app && npm test -- store/bookings.test.ts`
Expected: FAIL su nuovi assert.

- [ ] **Step 3: Riscrivere `store/bookings.ts`**

```ts
// app/src/store/bookings.ts
import { create } from 'zustand';
import type { Prenotazione } from '../types';
import { uid } from '../lib/id';
import { upsertDoc, removeDoc } from '../lib/firebase/db';
import { auth } from '../lib/firebase/auth';

const getUid = (): string => {
  const u = auth.currentUser?.uid;
  if (!u) throw new Error('not authenticated');
  return u;
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
    void upsertDoc(getUid(), 'bookings', item.id, item);
    void onBookingCreated(item);
    return item;
  },
  update: (id, patch) => {
    const old = get().items.find(b => b.id === id);
    if (!old) return;
    const updated: Prenotazione = { ...old, ...patch, aggiornatoIl: new Date().toISOString() };
    void upsertDoc(getUid(), 'bookings', id, updated);
    void onBookingUpdated(old, updated);
  },
  remove: (id) => {
    void removeDoc(getUid(), 'bookings', id);
    void onBookingRemoved(id);
  },
}));
```

NOTA: niente `set` locale. Lo stato arriva dal listener `onSnapshot` montato in `useFirestoreSync`. Per i test, Zustand espone `setState` direttamente per simulare lo stato.

- [ ] **Step 4: Run test, verifica pass**

Run: `cd app && npm test -- store/bookings.test.ts`
Expected: PASS.

- [ ] **Step 5: NIENTE commit ancora.**

### Task 3.3: Refactor `store/closures.ts`

**Files:**
- Modify: `app/src/store/closures.ts`

- [ ] **Step 1: Riscrivere usando lo stesso pattern**

```ts
// app/src/store/closures.ts
import { create } from 'zustand';
import type { Chiusura } from '../types';
import { uid } from '../lib/id';
import { upsertDoc, removeDoc } from '../lib/firebase/db';
import { auth } from '../lib/firebase/auth';

const getUid = (): string => {
  const u = auth.currentUser?.uid;
  if (!u) throw new Error('not authenticated');
  return u;
};

interface State {
  items: Chiusura[];
  add: (c: Omit<Chiusura, 'id'>) => Chiusura;
  update: (id: string, patch: Partial<Chiusura>) => void;
  remove: (id: string) => void;
}

export const useClosures = create<State>((_set, get) => ({
  items: [],
  add: (c) => {
    const item: Chiusura = { ...c, id: uid('c') };
    void upsertDoc(getUid(), 'closures', item.id, item);
    return item;
  },
  update: (id, patch) => {
    const old = get().items.find(x => x.id === id);
    if (!old) return;
    const updated = { ...old, ...patch };
    void upsertDoc(getUid(), 'closures', id, updated);
  },
  remove: (id) => {
    void removeDoc(getUid(), 'closures', id);
  },
}));
```

- [ ] **Step 2: NIENTE commit ancora.**

### Task 3.4: Refactor `store/promemoria.ts`

**Files:**
- Modify: `app/src/store/promemoria.ts`

- [ ] **Step 1: Riscrivere**

```ts
// app/src/store/promemoria.ts
import { create } from 'zustand';
import type { Promemoria } from '../types';
import { uid } from '../lib/id';
import { upsertDoc, removeDoc } from '../lib/firebase/db';
import { auth } from '../lib/firebase/auth';

const getUid = (): string => {
  const u = auth.currentUser?.uid;
  if (!u) throw new Error('not authenticated');
  return u;
};

interface State {
  items: Promemoria[];
  add: (testo: string) => void;
  toggle: (id: string) => void;
  remove: (id: string) => void;
}

export const usePromemoria = create<State>((_set, get) => ({
  items: [],
  add: (testo) => {
    const item: Promemoria = { id: uid('p'), testo, createdAt: new Date().toISOString(), done: false };
    void upsertDoc(getUid(), 'promemoria', item.id, item);
  },
  toggle: (id) => {
    const old = get().items.find(p => p.id === id);
    if (!old) return;
    const updated = { ...old, done: !old.done };
    void upsertDoc(getUid(), 'promemoria', id, updated);
  },
  remove: (id) => {
    void removeDoc(getUid(), 'promemoria', id);
  },
}));
```

- [ ] **Step 2: NIENTE commit ancora.**

### Task 3.5: Refactor `store/tasks.ts`

**Files:**
- Modify: `app/src/store/tasks.ts`
- Modify: `app/tests/store/tasks.test.ts`

- [ ] **Step 1: Aggiornare i test**

In `app/tests/store/tasks.test.ts` aggiungi i mock di `firebase/db` e `firebase/auth` come per bookings. Mantieni gli assert su `idbSet` (mirrorAll è ancora chiamato perché il SW lo richiede) e cambia gli assert da `enqueue` a `upsertDoc`/`removeDoc`.

- [ ] **Step 2: Run test, verifica fail**

Run: `cd app && npm test -- store/tasks.test.ts`
Expected: FAIL.

- [ ] **Step 3: Riscrivere `store/tasks.ts`**

```ts
// app/src/store/tasks.ts
import { create } from 'zustand';
import type { BookingTask } from '../types';
import { idbSet } from '../lib/idb';
import { upsertDoc, removeDoc } from '../lib/firebase/db';
import { auth } from '../lib/firebase/auth';

const getUid = (): string => {
  const u = auth.currentUser?.uid;
  if (!u) throw new Error('not authenticated');
  return u;
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

export const useTasks = create<State>((_set, get) => ({
  items: [],
  add: (task) => {
    void upsertDoc(getUid(), 'tasks', task.id, task);
    mirrorAll([...get().items, task]);
  },
  addMany: (tasks) => {
    tasks.forEach(t => void upsertDoc(getUid(), 'tasks', t.id, t));
    mirrorAll([...get().items, ...tasks]);
  },
  update: (id, patch) => {
    const old = get().items.find(t => t.id === id);
    if (!old) return;
    const updated = { ...old, ...patch, updatedAt: new Date().toISOString() };
    void upsertDoc(getUid(), 'tasks', id, updated);
    mirrorAll(get().items.map(t => t.id === id ? updated : t));
  },
  toggleDone: (id) => {
    const old = get().items.find(t => t.id === id);
    if (!old) return;
    const now = new Date().toISOString();
    const updated = {
      ...old,
      done: !old.done,
      doneAt: !old.done ? now : undefined,
      updatedAt: now,
    };
    void upsertDoc(getUid(), 'tasks', id, updated);
    mirrorAll(get().items.map(t => t.id === id ? updated : t));
  },
  remove: (id) => {
    const old = get().items.find(t => t.id === id);
    if (!old) return;
    const now = new Date().toISOString();
    const soft: BookingTask = { ...old, deletedAt: now, updatedAt: now };
    void upsertDoc(getUid(), 'tasks', id, soft);
    mirrorAll(get().items.map(t => t.id === id ? soft : t));
  },
  removeByBooking: (bookingId) => {
    const now = new Date().toISOString();
    const updates = get().items
      .filter(t => t.bookingId === bookingId && !t.deletedAt)
      .map(t => ({ ...t, deletedAt: now, updatedAt: now }));
    updates.forEach(t => void upsertDoc(getUid(), 'tasks', t.id, t));
    mirrorAll(get().items.map(t => updates.find(u => u.id === t.id) ?? t));
  },
  byBooking: (bookingId) =>
    get().items.filter(t => t.bookingId === bookingId && !t.deletedAt),
}));
```

NOTA: `mirrorAll` è ridondante con il listener `onSnapshot` (che già fa `idbSet` in Task 3.1), ma teniamo entrambi per evitare gap mentre la scrittura è in volo. Costo trascurabile.

- [ ] **Step 4: Run test, verifica pass**

Run: `cd app && npm test -- store/tasks.test.ts`
Expected: PASS.

- [ ] **Step 5: NIENTE commit ancora.**

### Task 3.6: Refactor `store/templates.ts`

**Files:**
- Modify: `app/src/store/templates.ts`
- Modify: `app/tests/store/templates.test.ts` (aggiungi mock firebase)

- [ ] **Step 1: Aggiornare il test (mock firebase) e mantenere gli assert su seedDefaults/upsert/remove/toggleEnabled**

- [ ] **Step 2: Riscrivere `store/templates.ts`**

```ts
// app/src/store/templates.ts
import { create } from 'zustand';
import type { ReminderTemplate } from '../types';
import { DEFAULT_TEMPLATES } from '../lib/reminders/templates';
import { upsertDoc, removeDoc } from '../lib/firebase/db';
import { auth } from '../lib/firebase/auth';

const getUid = (): string => {
  const u = auth.currentUser?.uid;
  if (!u) throw new Error('not authenticated');
  return u;
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
    if (!auth.currentUser) return; // seed locale prima del login: il listener confermerà.
    DEFAULT_TEMPLATES.forEach(t => void upsertDoc(getUid(), 'templates', t.id, t));
  },
  upsert: (t) => {
    void upsertDoc(getUid(), 'templates', t.id, t);
  },
  remove: (id) => {
    void removeDoc(getUid(), 'templates', id);
  },
  toggleEnabled: (id) => {
    const old = get().items.find(t => t.id === id);
    if (!old) return;
    const updated = { ...old, enabled: !old.enabled };
    void upsertDoc(getUid(), 'templates', id, updated);
  },
}));
```

NOTA: `seedDefaults` ora preserva il set locale per il primo render pre-login (gli store sono vuoti finché il listener non parte).

- [ ] **Step 3: Run test, verifica pass**

Run: `cd app && npm test -- store/templates.test.ts`
Expected: PASS.

- [ ] **Step 4: NIENTE commit ancora.**

### Task 3.7: Commit di Fase 1+2+3 (build verde)

- [ ] **Step 1: Type-check**

Run: `cd app && npx tsc --noEmit`
Expected: dovrebbe ancora fallire perché `lib/google/{auth,sheets,drive,bootstrap,adapter}.ts`, `lib/sync.ts`, `store/sync.ts`, `lib/google/people.ts`, e i componenti che leggono `readonly` non compileranno. Procedi alla Fase 4-5 prima di committare.

---

## FASE 4 — Sync indicator & status

### Task 4.1: Hook `useFirestoreStatus`

**Files:**
- Create: `app/src/hooks/useFirestoreStatus.ts`

- [ ] **Step 1: Implementare**

```ts
// app/src/hooks/useFirestoreStatus.ts
import { useEffect, useState } from 'react';
import { useAuth } from '../store/auth';

export type FirestoreStatus = 'idle' | 'offline' | 'unauth';

export const useFirestoreStatus = (): FirestoreStatus => {
  const user = useAuth(s => s.user);
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  if (!user) return 'unauth';
  if (!online) return 'offline';
  return 'idle';
};
```

NOTA: derivato semplice. La SDK Firestore espone `metadata.hasPendingWrites` per granularità maggiore; lo aggiungiamo solo se l'indicator si rivela poco informativo.

- [ ] **Step 2: NIENTE commit ancora.**

### Task 4.2: Aggiornare `SyncIndicator.tsx`

**Files:**
- Modify: `app/src/components/SyncIndicator.tsx`

- [ ] **Step 1: Riscrivere**

```tsx
// app/src/components/SyncIndicator.tsx
import { useFirestoreStatus } from '../hooks/useFirestoreStatus';
import { goOnline } from '../lib/firebase/db';

const LABEL = {
  idle: { icon: '🟢', text: 'Sincronizzato' },
  offline: { icon: '🔴', text: 'Offline' },
  unauth: { icon: '🔒', text: 'Non connesso' },
} as const;

export const SyncIndicator = () => {
  const status = useFirestoreStatus();
  const l = LABEL[status];
  return (
    <button
      className="btn btn-ghost !p-2 text-xs"
      title={l.text}
      onClick={() => void goOnline()}
    >
      {l.icon}
    </button>
  );
};
```

- [ ] **Step 2: NIENTE commit ancora.**

---

## FASE 5 — Cleanup readonly

### Task 5.1: Rimuovere `readonly` dai consumer

**Files:**
- Modify: `app/src/components/calendar/BottomBar.tsx`
- Modify: `app/src/components/forms/BookingForm.tsx`
- Modify: `app/src/components/forms/ClosureForm.tsx`
- Modify: `app/src/components/panels/DayDetailPanel.tsx`
- Modify: `app/src/components/panels/TodoPanel.tsx`
- Delete: `app/src/components/ReadOnlyBanner.tsx`

- [ ] **Step 1: In `BottomBar.tsx` rimuovere import `useAuth`, la riga `const readonly = useAuth(s => s.readonly);` e i wrapping `{!readonly && (...)}` (lascia il contenuto sempre visibile).**

- [ ] **Step 2: In `BookingForm.tsx` rimuovere import `useAuth`, riga `const readonly = useAuth(...)`, e il `if (readonly) return null;`.**

- [ ] **Step 3: In `ClosureForm.tsx` analogo a sopra.**

- [ ] **Step 4: In `DayDetailPanel.tsx` analogo, rimuovere wrap `{!readonly && (...)}`.**

- [ ] **Step 5: In `TodoPanel.tsx`:**
- Rimuovere import `useAuth`.
- Rimuovere `const readonly = useAuth(s => s.readonly);`.
- Rimuovere `disabled={readonly}`, sostituire `onChange={() => !readonly && toggle(p.id)}` con `onChange={() => toggle(p.id)}`.
- Rimuovere il wrap `{!readonly && ...}` del bottone delete e dell'input add.

- [ ] **Step 6: Cercare se `ReadOnlyBanner` è importato da qualche parte**

Run (Grep tool): pattern `ReadOnlyBanner` in `app/src/`.
Se non più usato, eliminare il file: `git rm app/src/components/ReadOnlyBanner.tsx`.

- [ ] **Step 7: NIENTE commit ancora.**

---

## FASE 6 — People API auth bridge

### Task 6.1: Adattare `lib/google/people.ts` al nuovo token

**Files:**
- Modify: `app/src/lib/google/people.ts`
- Modify: `app/tests/lib/google/people.test.ts`

- [ ] **Step 1: Cambiare il riferimento al token**

In `app/src/lib/google/people.ts`, sostituire:

```ts
const t = useAuth.getState().accessToken;
```

con:

```ts
const t = useAuth.getState().googleAccessToken;
```

(Stessa riga 19; nessun'altra modifica al file. Lo `ScopeError` continua a essere lanciato a 403 e i consumer in `BookingForm.tsx` e `BookingCard.tsx` lo gestiscono già.)

- [ ] **Step 2: Aggiornare `app/tests/lib/google/people.test.ts`**

Sostituire eventuali setState `accessToken: 'x'` con `googleAccessToken: 'x'`.

- [ ] **Step 3: Run test, verifica pass**

Run: `cd app && npm test -- lib/google/people.test.ts`
Expected: PASS.

- [ ] **Step 4: Rimuovere chiamata `warmupPeopleSearch()` da `lib/sync.ts`**

Nota: `lib/sync.ts` sarà rimosso interamente in Fase 8. Nessuna azione qui.

- [ ] **Step 5: NIENTE commit ancora.**

---

## FASE 7 — Backup (Drive-only, on-demand)

NOTA setup: Storage Firebase richiede Blaze su questo progetto, quindi il backup va solo su Drive (scope `drive.file` già aggiunto al provider in Task 1.2). `googleAccessToken` è in `useAuth`. Drive API ha TTL 1h sull'access token: se l'utente prova a fare backup oltre l'ora ci servirà un re-login (gestito mostrando un errore chiaro).

### Task 7.1: `lib/firebase/backup.ts` — CSV serializer + ZIP (puro)

**Files:**
- Create: `app/src/lib/firebase/backup.ts`
- Test: `app/tests/lib/firebase/backup.test.ts`

- [ ] **Step 1: Scrivere test su CSV + buildZipBytes**

```ts
// app/tests/lib/firebase/backup.test.ts
import { describe, it, expect } from 'vitest';
import { toCsv, buildZipBytes } from '../../../src/lib/firebase/backup';
import { unzipSync, strFromU8 } from 'fflate';

describe('toCsv', () => {
  it('escapes quotes, commas, newlines per RFC 4180', () => {
    const rows = [
      ['id', 'name', 'note'],
      ['1', 'Mario', 'tutto ok'],
      ['2', 'Anna, "la guida"', 'riga\ndue'],
    ];
    const csv = toCsv(rows);
    expect(csv).toContain('id,name,note\n');
    expect(csv).toContain('1,Mario,tutto ok\n');
    expect(csv).toContain('2,"Anna, ""la guida""","riga\ndue"\n');
  });

  it('returns empty string for empty array', () => {
    expect(toCsv([])).toBe('');
  });
});

describe('buildZipBytes', () => {
  it('creates a zip with 5 csv files', async () => {
    const bytes = await buildZipBytes();
    const out = unzipSync(bytes);
    expect(Object.keys(out).sort()).toEqual([
      'bookings.csv', 'closures.csv', 'promemoria.csv', 'tasks.csv', 'templates.csv',
    ]);
    // Content can be empty if no items, but file must exist:
    expect(typeof strFromU8(out['bookings.csv'])).toBe('string');
  });
});
```

- [ ] **Step 2: Run test, verifica fail**

Run: `cd app && npm test -- lib/firebase/backup.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementare `lib/firebase/backup.ts`**

```ts
// app/src/lib/firebase/backup.ts
import { zip } from 'fflate';
import { useBookings } from '../../store/bookings';
import { useClosures } from '../../store/closures';
import { usePromemoria } from '../../store/promemoria';
import { useTasks } from '../../store/tasks';
import { useTemplates } from '../../store/templates';

const escapeCell = (v: unknown): string => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const toCsv = (rows: unknown[][]): string =>
  rows.length === 0 ? '' : rows.map(r => r.map(escapeCell).join(',')).join('\n') + '\n';

const objectsToCsv = <T extends object>(items: T[]): string => {
  if (items.length === 0) return '';
  const keys = Object.keys(items[0]) as (keyof T)[];
  const rows: unknown[][] = [keys as unknown[], ...items.map(o => keys.map(k => o[k]))];
  return toCsv(rows);
};

export const buildZipBytes = async (): Promise<Uint8Array> => {
  const enc = new TextEncoder();
  const files: Record<string, Uint8Array> = {
    'bookings.csv':   enc.encode(objectsToCsv(useBookings.getState().items)),
    'closures.csv':   enc.encode(objectsToCsv(useClosures.getState().items)),
    'promemoria.csv': enc.encode(objectsToCsv(usePromemoria.getState().items)),
    'tasks.csv':      enc.encode(objectsToCsv(useTasks.getState().items)),
    'templates.csv':  enc.encode(objectsToCsv(useTemplates.getState().items)),
  };
  return new Promise((resolve, reject) => {
    zip(files, (err, data) => err ? reject(err) : resolve(data));
  });
};
```

- [ ] **Step 4: Run test, verifica pass**

Run: `cd app && npm test -- lib/firebase/backup.test.ts`
Expected: PASS.

- [ ] **Step 5: NIENTE commit ancora.**

### Task 7.2: `lib/google/driveBackup.ts` — upload Drive + lista

**Files:**
- Create: `app/src/lib/google/driveBackup.ts`
- Test: `app/tests/lib/google/driveBackup.test.ts`

- [ ] **Step 1: Scrivere test (mock fetch)**

```ts
// app/tests/lib/google/driveBackup.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

vi.mock('../../../src/store/auth', () => ({
  useAuth: { getState: () => ({ googleAccessToken: 'tok' }) },
}));

describe('driveBackup', () => {
  it('uploadToDrive issues multipart POST to upload endpoint', async () => {
    fetchMock.mockResolvedValueOnce(new Response(
      JSON.stringify({ id: 'driveFileId123', name: 'backup.zip' }),
      { status: 200 },
    ));
    const { uploadToDrive } = await import('../../../src/lib/google/driveBackup');
    const id = await uploadToDrive('backup-2026-05-06.zip', new Uint8Array([1,2,3]));
    expect(id).toBe('driveFileId123');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('upload/drive/v3/files'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('listDriveBackups queries Drive with appProperties filter', async () => {
    fetchMock.mockResolvedValueOnce(new Response(
      JSON.stringify({ files: [{ id: 'a', name: 'backup-2026-05-06.zip', size: '1234', createdTime: '2026-05-06T00:00:00Z' }] }),
      { status: 200 },
    ));
    const { listDriveBackups } = await import('../../../src/lib/google/driveBackup');
    const list = await listDriveBackups();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('backup-2026-05-06.zip');
  });

  it('throws ScopeError on 403', async () => {
    fetchMock.mockResolvedValueOnce(new Response('forbidden', { status: 403 }));
    const { uploadToDrive, DriveScopeError } = await import('../../../src/lib/google/driveBackup');
    await expect(uploadToDrive('x.zip', new Uint8Array())).rejects.toThrow(DriveScopeError);
  });
});
```

- [ ] **Step 2: Run test, verifica fail**

Run: `cd app && npm test -- lib/google/driveBackup.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementare `lib/google/driveBackup.ts`**

```ts
// app/src/lib/google/driveBackup.ts
import { useAuth } from '../../store/auth';

const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name';
const LIST   = 'https://www.googleapis.com/drive/v3/files?q=' +
  encodeURIComponent("appProperties has { key='cdb_backup' and value='1' } and trashed=false") +
  '&fields=' + encodeURIComponent('files(id,name,size,createdTime)') +
  '&orderBy=createdTime desc';
const APP_TAG = { cdb_backup: '1' };

export class DriveScopeError extends Error {
  constructor(msg = 'Missing Drive scope or token expired') { super(msg); this.name = 'DriveScopeError'; }
}

const token = (): string => {
  const t = useAuth.getState().googleAccessToken;
  if (!t) throw new DriveScopeError('Not authenticated for Drive');
  return t;
};

export interface DriveBackupMeta {
  id: string;
  name: string;
  size: number;
  createdAt: string;
}

export const uploadToDrive = async (filename: string, bytes: Uint8Array): Promise<string> => {
  const meta = { name: filename, mimeType: 'application/zip', appProperties: APP_TAG };
  const boundary = '----cdbboundary' + Math.random().toString(36).slice(2);
  const enc = new TextEncoder();
  const head = enc.encode(
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify(meta) + `\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/zip\r\n\r\n`,
  );
  const tail = enc.encode(`\r\n--${boundary}--`);
  const body = new Uint8Array(head.length + bytes.length + tail.length);
  body.set(head, 0);
  body.set(bytes, head.length);
  body.set(tail, head.length + bytes.length);

  const res = await fetch(UPLOAD, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token()}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  if (res.status === 401 || res.status === 403) throw new DriveScopeError();
  if (!res.ok) throw new Error(`Drive upload ${res.status}: ${await res.text()}`);
  const j = (await res.json()) as { id: string };
  return j.id;
};

export const listDriveBackups = async (): Promise<DriveBackupMeta[]> => {
  const res = await fetch(LIST, { headers: { Authorization: `Bearer ${token()}` } });
  if (res.status === 401 || res.status === 403) throw new DriveScopeError();
  if (!res.ok) throw new Error(`Drive list ${res.status}: ${await res.text()}`);
  const j = (await res.json()) as { files: { id: string; name: string; size?: string; createdTime: string }[] };
  return j.files.map(f => ({
    id: f.id,
    name: f.name,
    size: Number(f.size ?? 0),
    createdAt: f.createdTime,
  }));
};

const LAST_BACKUP_KEY = 'cdb_last_backup';

export const markBackupNow = (): void => {
  localStorage.setItem(LAST_BACKUP_KEY, String(Date.now()));
};

export const lastBackupAt = (): number =>
  Number(localStorage.getItem(LAST_BACKUP_KEY) ?? 0);
```

NOTA: `appProperties: { cdb_backup: '1' }` taggano i file come backup di questa app, così `listDriveBackups` non confonde con altri PDF/zip nel Drive dell'utente.

- [ ] **Step 4: Run test, verifica pass**

Run: `cd app && npm test -- lib/google/driveBackup.test.ts`
Expected: PASS.

- [ ] **Step 5: NIENTE commit ancora.**

### Task 7.3: UI sezione Backup in `TemplatesPage`

**Files:**
- Modify: `app/src/components/settings/TemplatesPage.tsx`

- [ ] **Step 1: Aggiungere il componente `BackupSection`**

In `app/src/components/settings/TemplatesPage.tsx`:

1. Aggiungi gli import all'inizio del file:

```tsx
import { useEffect, useState } from 'react';
import { buildZipBytes } from '../../lib/firebase/backup';
import {
  uploadToDrive, listDriveBackups, markBackupNow, lastBackupAt,
  DriveScopeError, type DriveBackupMeta,
} from '../../lib/google/driveBackup';
```

2. Subito dopo `<GenerateRemindersButton />` nel JSX, aggiungi:

```tsx
<BackupSection />
```

3. In fondo al file, aggiungi:

```tsx
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

const BackupSection = () => {
  const [items, setItems] = useState<DriveBackupMeta[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const last = lastBackupAt();
  const stale = !last || Date.now() - last > SEVEN_DAYS;

  const refresh = async () => {
    try { setItems(await listDriveBackups()); setErr(null); }
    catch (e) {
      if (e instanceof DriveScopeError) setErr('Riconnetti l’account Google per accedere al Drive (sessione scaduta).');
      else setErr('Impossibile leggere la lista backup.');
    }
  };

  useEffect(() => { void refresh(); }, []);

  const onCreate = async () => {
    setBusy(true); setErr(null);
    try {
      const bytes = await buildZipBytes();
      const today = new Date().toISOString().slice(0, 10);
      await uploadToDrive(`cdb-backup-${today}.zip`, bytes);
      markBackupNow();
      await refresh();
    } catch (e) {
      if (e instanceof DriveScopeError) setErr('Riconnetti l’account Google: serve il consenso Drive per il backup.');
      else setErr('Backup fallito. Riprova.');
    } finally { setBusy(false); }
  };

  const onOpen = (id: string) => {
    window.open(`https://drive.google.com/file/d/${id}/view`, '_blank');
  };

  return (
    <section className="mt-6">
      <h3 className="font-semibold mb-2">Backup su Google Drive</h3>
      {stale && (
        <div className="text-xs mb-2" style={{ color: 'var(--ink-soft)' }}>
          {last ? 'L’ultimo backup risale a oltre 7 giorni fa.' : 'Nessun backup ancora creato.'}
        </div>
      )}
      <button className="btn btn-primary mb-2" disabled={busy} onClick={() => void onCreate()}>
        {busy ? 'Esportazione…' : 'Esporta backup ora'}
      </button>
      {err && <div className="text-xs mb-2" style={{ color: 'crimson' }}>{err}</div>}
      <ul className="flex flex-col gap-1 text-sm">
        {items.map(m => (
          <li key={m.id} className="flex items-center gap-2">
            <span className="flex-1">{m.name}</span>
            <span className="text-xs" style={{ color: 'var(--ink-soft)' }}>
              {(m.size / 1024).toFixed(1)} kB
            </span>
            <button className="btn btn-ghost text-xs" onClick={() => onOpen(m.id)}>Apri</button>
          </li>
        ))}
        {items.length === 0 && !err && (
          <li className="text-xs" style={{ color: 'var(--ink-soft)' }}>Nessun backup su Drive.</li>
        )}
      </ul>
    </section>
  );
};
```

- [ ] **Step 2: NIENTE commit ancora.**

NOTA: niente trigger automatico al boot. Il banner "Nessun backup / oltre 7 giorni fa" funge da reminder visivo.

---

## FASE 8 — Rimozione codice vecchio

### Task 8.1: Cancellare i file Google sync

**Files:**
- Delete: `app/src/lib/google/auth.ts`
- Delete: `app/src/lib/google/sheets.ts`
- Delete: `app/src/lib/google/drive.ts`
- Delete: `app/src/lib/google/bootstrap.ts`
- Delete: `app/src/lib/google/adapter.ts`
- Delete: `app/src/lib/sync.ts`
- Delete: `app/src/store/sync.ts`

- [ ] **Step 1: Cancellare i file**

```bash
git rm app/src/lib/google/auth.ts app/src/lib/google/sheets.ts \
       app/src/lib/google/drive.ts app/src/lib/google/bootstrap.ts \
       app/src/lib/google/adapter.ts app/src/lib/sync.ts \
       app/src/store/sync.ts
```

- [ ] **Step 2: Cancellare i test obsoleti**

```bash
git rm app/tests/lib/google/auth.test.ts app/tests/lib/adapter.test.ts
```

NOTA: NON rimuovere `app/tests/lib/conflicts.test.ts` né `app/tests/store/auth.test.ts` (riscritto in Task 1.3).

- [ ] **Step 3: Verificare che `index.html` non carichi più `https://accounts.google.com/gsi/client`**

Apri `app/index.html` e rimuovi lo `<script src="https://accounts.google.com/gsi/client" async defer></script>` se presente.

### Task 8.2: Type check + lint completo

- [ ] **Step 1: Type check**

Run: `cd app && npx tsc --noEmit`
Expected: zero errori. Se ce ne sono, è probabile sia rimasto un `import` orfano da uno dei file rimossi — sistema.

- [ ] **Step 2: Lint**

Run: `cd app && npm run lint`
Expected: zero errori (ESLint è BLOCKING per project rules).

- [ ] **Step 3: Test completo**

Run: `cd app && npm test`
Expected: tutti i test passano.

- [ ] **Step 4: Build di prova**

Run: `cd app && npm run build`
Expected: build OK, output in `app/dist/`.

- [ ] **Step 5: Commit Fase 1-8 (cumulativo)**

```bash
git add -A
git commit -m "feat(firebase): migrate auth + sync to firebase auth/firestore

- replace google identity services + sheets/drive sync with firebase auth + firestore
- add firestore onSnapshot listeners for realtime PC<->mobile sync
- enable indexeddb persistence for offline writes
- add on-demand backup export to google drive (zip with 5 csv)
- preserve cdb_cache idb for service worker periodicsync
- bridge people api via google credential captured at firebase sign-in
- remove legacy lib/google/{auth,sheets,drive,bootstrap,adapter}.ts
- remove lib/sync.ts and store/sync.ts"
```

---

## FASE 9 — Security rules + smoke E2E + deploy

### Task 9.1: Security rules

**Files:**
- Create: `firestore.rules`
- Create: `firebase.json`

- [ ] **Step 1: Scrivere `firestore.rules`**

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

- [ ] **Step 2: Scrivere `firebase.json`**

```json
{
  "firestore": { "rules": "firestore.rules" }
}
```

- [ ] **Step 3: Installare Firebase CLI (utente, una volta)**

```bash
npm i -g firebase-tools
firebase login
```

- [ ] **Step 4: Deploy delle rules**

```bash
firebase use --add  # collega progetto
firebase deploy --only firestore:rules
```

- [ ] **Step 6: Commit**

```bash
git add firestore.rules storage.rules firebase.json
git commit -m "chore(firebase): add firestore + storage security rules"
```

### Task 9.2: Smoke E2E manuale

- [ ] **Step 1: Avvia dev server**

Run: `cd app && npm run dev`

- [ ] **Step 2: Sul desktop**

1. Apri `http://localhost:5173/CPP/`.
2. Click "Accedi con Google", completa login.
3. Crea una prenotazione di test in camera lampone.
4. Verifica che compaia in calendario.
5. Verifica che `Promemoria` ne abbia generati alcuni.

- [ ] **Step 3: Su mobile (stessa rete o tunnel)**

1. Su Android Chrome apri lo stesso URL (con `--host` in dev oppure tramite tunnel).
2. Login Google.
3. Verifica che la prenotazione del PC appaia entro 2 secondi.
4. Toggle done su un task → verifica che il PC lo veda entro 2 secondi.

- [ ] **Step 4: Test offline**

1. Su Chrome desktop, DevTools → Network → "Offline".
2. Crea un nuovo booking.
3. Riattiva rete → verifica che il booking sincronizzi senza intervento.

- [ ] **Step 5: Test PWA standalone (mobile)**

1. Installa la PWA via "Aggiungi a schermata Home".
2. Apri standalone, login.
3. Chiudi e riapri dopo 1 ora → niente popup di consenso.
4. Verifica che la sessione persista anche dopo riavvio del telefono (test 24h o ridotto a verifica che `auth.currentUser` resti popolato dopo restart browser).

- [ ] **Step 6: Test backup Drive**

1. Vai a Impostazioni → sezione "Backup su Google Drive".
2. Click "Esporta backup ora".
3. Verifica che compaia nella lista. Click "Apri" → si apre Drive con il file `cdb-backup-YYYY-MM-DD.zip`.
4. Scarica il ZIP da Drive, aprilo, controlla che 5 CSV abbiano contenuto.
5. Se appare "Riconnetti l'account Google" → il token è scaduto (>1h dal login), fai logout/login e riprova.

### Task 9.3: Memory + deploy

- [ ] **Step 1: Aggiornare MEMORY.md** (regola CLAUDE.md #4 BLOCKING)

Aggiungere/aggiornare entry "feature_firebase_migration.md" che descrive: branch mergeato, cosa è cambiato (auth + sync + backup), SW invariato, People API legata al credential di login Firebase.

- [ ] **Step 2: Aggiornare claude-mem** (regola CLAUDE.md #4 BLOCKING)

Salvare osservazione di tipo ✅change con titolo "Firebase migration completata".

- [ ] **Step 3: Push branch + PR**

```bash
git push -u origin feat/firebase-migration
gh pr create --title "feat: migrate to firebase (auth + firestore + storage)" --body "..."
```

(Body contiene riepilogo, link allo spec, e checklist degli smoke test.)

- [ ] **Step 4: Merge dopo review utente** — non auto-merge, regola CLAUDE.md #5 BLOCKING.

---

## Self-Review: spec coverage

| §spec | Task plan |
|---|---|
| §1 Architettura, stack rimosso/aggiunto | Task 0.2 (deps), Task 1.1 (config), Task 1.2 (auth), Task 2.1 (db), Task 8.1 (rimozione) |
| §2 Modello dati Firestore | Task 2.1 (`subscribeCollection<T>` + path `users/{uid}/{name}/{id}`) |
| §3 Security rules | Task 9.1 (solo Firestore: Storage non disponibile su Spark) |
| §4 Auth flow | Task 1.2, Task 1.3, Task 1.4, Task 1.5 |
| §5 Sync flow (listener, scritture, offline) | Task 2.1 (`enableIndexedDbPersistence`), Task 3.1 (listener), Task 3.2-3.6 (scritture via `upsertDoc`) |
| §5 Sync indicator | Task 4.1, Task 4.2 |
| §6 Notifiche locali (immutate) | `sw.ts` non toccato; `useFirestoreSync` mantiene `idbSet('tasks','all',...)` per `cdb_cache`; mirroring locale anche in `tasks.ts` (Task 3.5) |
| §7 Backup (CSV+ZIP) | Task 7.1 (CSV+ZIP puro), Task 7.2 (Drive upload), Task 7.3 (UI) |
| §7 Storage Firebase + retention 4 + trigger settimanale | Sostituiti con Drive-only on-demand (Storage richiede Blaze) |
| §8 Configurazione utente | Task 0.1, Task 0.2 |
| §9 Costi (no azione codice) | n/a |
| §10 Rollout | Task 0.2 (branch + tag), Task 9.3 (push+PR) |
| §10 Test | Task 1.2, 2.1, 3.1-3.6, 6.1, 7.1, 9.2 |
| §10 Rimozione post-merge | Task 8.1 |
| §11 Rischi | `enableIndexedDbPersistence` con try/catch (Task 2.1); listener cleanup (Task 3.1) |
| §12 Effort 10h | Distribuibile su 3-4 sessioni |
| Domanda aperta People API | Task 6.1 (mantenuta tramite `googleAccessToken` da credential Firebase) |
| Domanda aperta SyncIndicator | Task 4.1 risolto con stato semplice idle/offline/unauth |
| Domanda aperta ordine rimozione | Risolto: Fase 8 dopo Fase 1-7 verificate funzionanti |

**Placeholder scan:** nessuno. Tutti gli step contengono codice o comandi.

**Type consistency check:**
- `useAuth` schema: `{ user, googleAccessToken }` consistente in Task 1.2, 1.3, 6.1.
- `subscribeCollection<T>(uid, name, cb)` definito in Task 2.1, usato in Task 3.1 con tipi `Prenotazione`, `Chiusura`, `Promemoria`, `BookingTask`, `ReminderTemplate`.
- `upsertDoc(uid, name, id, data)` / `removeDoc(uid, name, id)` consistenti tra Task 2.1 e Task 3.2-3.6.
- `BackupMeta` condiviso tra Task 7.1 e Task 7.3.
- `auth.currentUser?.uid` usato come fonte uid in Task 3.1, 3.2-3.6, 7.2; `useAuth.user` per gating UI.

---

## Note esecutive

- **Build rotta tra Task 1.3 e Task 8.2.** È atteso: la migrazione tocca 20+ file e committarli a passi più piccoli costringerebbe a versioni intermedie dello shim difficili da manutenere. Il commit unico in Task 8.2 garantisce build verde a ogni hash committato.
- **Test isolati passano in ogni task.** Il `npm test -- <pattern>` di ogni task usa mock di Firebase e gira indipendentemente dalla compilazione globale.
- **`auth.currentUser?.uid`** può essere `undefined` durante il bootstrap. Tutti i wrapper lo proteggono con `getUid()` che throwa, e i listener si montano solo quando `user` truthy.
- **People API token TTL 1h.** Quando scade, `searchByPhone` returna 401/403 → `ScopeError` già gestito a UI. L'utente perde solo l'autocomplete contatti finché non rifà login. Trade-off accettabile (feature secondaria).
- **Niente migrazione dati.** Lo Sheet vecchio è vuoto/non popolato (per design). Cutover hard.
