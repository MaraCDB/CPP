# Email/Password Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sganciare l'identità di accesso (email/password, con registrazione pubblica) dall'autorizzazione Google (backup Drive, rubrica contatti, sync Calendar), che diventa un collegamento opzionale per-account attivabile da Impostazioni.

**Architecture:** Firebase Auth Email/Password come provider di identità primario. `googleAccessToken` (store `auth.ts`) smette di essere popolato dal login e viene popolato da una nuova azione indipendente "Connetti Google" (`linkGoogleAccount`), che usa `linkWithPopup`/`reauthenticateWithPopup` sullo stesso `GoogleAuthProvider` già configurato con gli scope esistenti. L'account esistente della proprietaria viene migrato collegando una credenziale email/password allo stesso `uid` (`linkWithCredential`), senza perdere dati. `lib/google/people.ts`, `lib/google/driveBackup.ts`, `lib/google/calendarSync.ts` non cambiano: leggono `googleAccessToken` da `useAuth` esattamente come oggi.

**Tech Stack:** React 19 · TypeScript 6 · Firebase 11 (Auth) · Zustand 5 · Vitest 4 · React Testing Library.

**Spec di riferimento:** `docs/superpowers/specs/2026-08-06-email-password-auth-design.md`

**Working directory:** `d:\Workspace\CPP\app` (tutti i percorsi relativi a questa cartella salvo diversa indicazione)

## Global Constraints

- Tutti i test esistenti (`npx vitest run`) devono continuare a passare dopo ogni task.
- `npx tsc --noEmit` e `npx eslint .` puliti prima di ogni commit.
- Testo UI in italiano, coerente col resto dell'app.
- Commit Conventional Commits, un commit per task.
- Il modello dati Firestore (`users/{uid}/...`) e le sue regole di sicurezza NON cambiano in questo piano — l'isolamento dati per account esiste già.
- `lib/google/people.ts`, `lib/google/driveBackup.ts`, `lib/google/calendarSync.ts` non vanno modificati in questo piano (tranne `CalendarSyncSection.tsx` al Task 6, che è un componente UI, non uno di questi tre moduli lib).

---

## Task 1: Tipo `AppUser` (rinomina `GoogleUser`)

**Files:**
- Modify: `app/src/types.ts:53-57`
- Modify: `app/src/store/auth.ts`

**Interfaces:**
- Produces: `AppUser { email: string; name?: string; picture?: string }` — usato da Task 2 (`userToStore`) e da `store/auth.ts`.

- [ ] **Step 1: Rinomina il tipo in `types.ts`**

In `src/types.ts`, sostituisci:

```ts
export interface GoogleUser {
  email: string;
  name: string;
  picture?: string;
}
```

con:

```ts
export interface AppUser {
  email: string;
  name?: string;
  picture?: string;
}
```

- [ ] **Step 2: Aggiorna `store/auth.ts`**

In `src/store/auth.ts`, sostituisci `GoogleUser` con `AppUser` nell'import e nel tipo `State`:

```ts
import { create } from 'zustand';
import type { AppUser } from '../types';

interface State {
  user: AppUser | null;
  googleAccessToken: string | null;
}

export const useAuth = create<State>(() => ({
  user: null,
  googleAccessToken: null,
}));
```

- [ ] **Step 3: Verifica type-check e test suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS, nessun errore di tipo (nessun altro file nel progetto referenzia `GoogleUser`)

- [ ] **Step 4: Commit**

```bash
git add src/types.ts src/store/auth.ts
git commit -m "refactor(auth): rename GoogleUser to AppUser, make name/picture optional"
```

---

## Task 2: Identità email/password in `lib/firebase/auth.ts`

**Files:**
- Modify: `app/src/lib/firebase/auth.ts`
- Test: `app/tests/lib/firebase/auth.test.ts`

**Interfaces:**
- Consumes: `AppUser` (Task 1).
- Produces: `signUpEmail(email: string, password: string): Promise<void>`, `signInEmail(email: string, password: string): Promise<void>`, `resetPassword(email: string): Promise<void>` — usate da Task 4 (`SignIn.tsx`).

- [ ] **Step 1: Scrivi i test falliti**

In `tests/lib/firebase/auth.test.ts`, sostituisci il blocco `vi.mock('firebase/auth', ...)` esistente aggiungendo le nuove funzioni mockate. Il file diventa (in cima, prima di `vi.mock('../../../src/lib/firebase/config', ...)`):

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSignInWithPopup = vi.fn();
const mockSignOut = vi.fn();
const mockOnAuthStateChanged = vi.fn();
const mockGetAuth = vi.fn(() => ({}));
const mockCreateUser = vi.fn();
const mockSignInEmail = vi.fn();
const mockSendPasswordReset = vi.fn();

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
  createUserWithEmailAndPassword: mockCreateUser,
  signInWithEmailAndPassword: mockSignInEmail,
  sendPasswordResetEmail: mockSendPasswordReset,
}));

vi.mock('../../../src/lib/firebase/config', () => ({ app: {} }));

beforeEach(() => {
  vi.clearAllMocks();
});
```

Poi aggiungi in fondo al file, dentro `describe('firebase auth', ...)` (nuovi `it` accanto a quelli esistenti):

```ts
  it('signUpEmail crea l\'utente e salva AppUser nello store', async () => {
    mockCreateUser.mockResolvedValueOnce({
      user: { uid: 'u2', email: 'new@b.com', displayName: null, photoURL: null },
    });
    const { signUpEmail } = await import('../../../src/lib/firebase/auth');
    const { useAuth } = await import('../../../src/store/auth');
    await signUpEmail('new@b.com', 'password123');
    expect(mockCreateUser).toHaveBeenCalledWith(expect.anything(), 'new@b.com', 'password123');
    expect(useAuth.getState().user).toEqual({ email: 'new@b.com', name: undefined, picture: undefined });
  });

  it('signInEmail autentica e salva AppUser nello store', async () => {
    mockSignInEmail.mockResolvedValueOnce({
      user: { uid: 'u1', email: 'a@b.com', displayName: 'A', photoURL: null },
    });
    const { signInEmail } = await import('../../../src/lib/firebase/auth');
    const { useAuth } = await import('../../../src/store/auth');
    await signInEmail('a@b.com', 'password123');
    expect(mockSignInEmail).toHaveBeenCalledWith(expect.anything(), 'a@b.com', 'password123');
    expect(useAuth.getState().user).toEqual({ email: 'a@b.com', name: 'A', picture: undefined });
  });

  it('resetPassword invia l\'email di reset', async () => {
    mockSendPasswordReset.mockResolvedValueOnce(undefined);
    const { resetPassword } = await import('../../../src/lib/firebase/auth');
    await resetPassword('a@b.com');
    expect(mockSendPasswordReset).toHaveBeenCalledWith(expect.anything(), 'a@b.com');
  });
```

- [ ] **Step 2: Esegui i test per verificare che falliscano**

Run: `npx vitest run tests/lib/firebase/auth.test.ts`
Expected: FAIL con "signUpEmail is not a function" / "signInEmail is not a function" / "resetPassword is not a function"

- [ ] **Step 3: Implementa in `src/lib/firebase/auth.ts`**

Aggiorna l'import in cima al file:

```ts
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut as fbSignOut,
  onAuthStateChanged, setPersistence, indexedDBLocalPersistence,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail,
  type User,
} from 'firebase/auth';
import { app } from './config';
import { useAuth } from '../../store/auth';
import type { AppUser } from '../../types';
```

Aggiorna `userToStore` per riflettere `name`/`picture` opzionali:

```ts
const userToStore = (u: User): AppUser => ({
  email: u.email ?? '',
  name: u.displayName ?? undefined,
  picture: u.photoURL ?? undefined,
});
```

Aggiungi, dopo `signIn` esistente:

```ts
export const signUpEmail = async (email: string, password: string): Promise<void> => {
  const result = await createUserWithEmailAndPassword(auth, email, password);
  useAuth.setState({ user: userToStore(result.user) });
};

export const signInEmail = async (email: string, password: string): Promise<void> => {
  const result = await signInWithEmailAndPassword(auth, email, password);
  useAuth.setState({ user: userToStore(result.user) });
};

export const resetPassword = (email: string): Promise<void> =>
  sendPasswordResetEmail(auth, email);
```

- [ ] **Step 4: Esegui i test per verificare che passino**

Run: `npx vitest run tests/lib/firebase/auth.test.ts`
Expected: PASS (incluso il test esistente `signIn calls signInWithPopup...`, invariato)

- [ ] **Step 5: Type-check e suite completa**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/firebase/auth.ts tests/lib/firebase/auth.test.ts
git commit -m "feat(auth): add email/password sign-up, sign-in, and password reset"
```

---

## Task 3: Collegamento Google separato dall'identità

**Files:**
- Modify: `app/src/lib/firebase/auth.ts`
- Test: `app/tests/lib/firebase/auth.test.ts`

**Interfaces:**
- Produces: `getLinkedProviders(): string[]`, `linkGoogleAccount(): Promise<void>`, `setPasswordCredential(email: string, password: string): Promise<void>` — usate da Task 5 (`AccountSection.tsx`) e Task 6 (`CalendarSyncSection.tsx`).

- [ ] **Step 1: Scrivi i test falliti**

In `tests/lib/firebase/auth.test.ts`, estendi ulteriormente il blocco `vi.mock('firebase/auth', ...)` (aggiunto nel Task 2) aggiungendo altre 3 costanti mock in cima al file e altre 3 chiavi + `EmailAuthProvider` nella factory:

```ts
const mockLinkWithPopup = vi.fn();
const mockReauthenticateWithPopup = vi.fn();
const mockLinkWithCredential = vi.fn();
```

(da aggiungere subito dopo `const mockSendPasswordReset = vi.fn();`)

```ts
  linkWithPopup: mockLinkWithPopup,
  reauthenticateWithPopup: mockReauthenticateWithPopup,
  linkWithCredential: mockLinkWithCredential,
  EmailAuthProvider: { credential: vi.fn(() => ({ providerId: 'password' })) },
```

(da aggiungere dentro l'oggetto ritornato da `vi.mock('firebase/auth', () => ({ ... }))`, dopo `sendPasswordResetEmail: mockSendPasswordReset,`)

Poi aggiungi in fondo al file, dentro `describe('firebase auth', ...)`:

```ts
  it('getLinkedProviders legge providerData dell\'utente corrente', async () => {
    const { auth, getLinkedProviders } = await import('../../../src/lib/firebase/auth');
    (auth as unknown as { currentUser: unknown }).currentUser = {
      providerData: [{ providerId: 'google.com' }, { providerId: 'password' }],
    };
    expect(getLinkedProviders()).toEqual(['google.com', 'password']);
  });

  it('getLinkedProviders ritorna array vuoto se non loggato', async () => {
    const { auth, getLinkedProviders } = await import('../../../src/lib/firebase/auth');
    (auth as unknown as { currentUser: unknown }).currentUser = null;
    expect(getLinkedProviders()).toEqual([]);
  });

  it('linkGoogleAccount usa linkWithPopup se Google non è ancora collegato', async () => {
    const { auth, linkGoogleAccount } = await import('../../../src/lib/firebase/auth');
    const { useAuth } = await import('../../../src/store/auth');
    (auth as unknown as { currentUser: unknown }).currentUser = { providerData: [{ providerId: 'password' }] };
    mockLinkWithPopup.mockResolvedValueOnce({ user: {} });
    await linkGoogleAccount();
    expect(mockLinkWithPopup).toHaveBeenCalled();
    expect(mockReauthenticateWithPopup).not.toHaveBeenCalled();
    expect(useAuth.getState().googleAccessToken).toBe('token-xyz');
  });

  it('linkGoogleAccount usa reauthenticateWithPopup se Google è già collegato', async () => {
    const { auth, linkGoogleAccount } = await import('../../../src/lib/firebase/auth');
    (auth as unknown as { currentUser: unknown }).currentUser = { providerData: [{ providerId: 'google.com' }] };
    mockReauthenticateWithPopup.mockResolvedValueOnce({ user: {} });
    await linkGoogleAccount();
    expect(mockReauthenticateWithPopup).toHaveBeenCalled();
    expect(mockLinkWithPopup).not.toHaveBeenCalled();
  });

  it('linkGoogleAccount lancia un errore se non loggato', async () => {
    const { auth, linkGoogleAccount } = await import('../../../src/lib/firebase/auth');
    (auth as unknown as { currentUser: unknown }).currentUser = null;
    await expect(linkGoogleAccount()).rejects.toThrow();
  });

  it('setPasswordCredential collega una credenziale email/password all\'utente corrente', async () => {
    const { auth, setPasswordCredential } = await import('../../../src/lib/firebase/auth');
    (auth as unknown as { currentUser: unknown }).currentUser = { providerData: [{ providerId: 'google.com' }] };
    mockLinkWithCredential.mockResolvedValueOnce({ user: {} });
    await setPasswordCredential('a@b.com', 'password123');
    expect(mockLinkWithCredential).toHaveBeenCalled();
  });

  it('setPasswordCredential lancia un errore se non loggato', async () => {
    const { auth, setPasswordCredential } = await import('../../../src/lib/firebase/auth');
    (auth as unknown as { currentUser: unknown }).currentUser = null;
    await expect(setPasswordCredential('a@b.com', 'password123')).rejects.toThrow();
  });
```

- [ ] **Step 2: Esegui i test per verificare che falliscano**

Run: `npx vitest run tests/lib/firebase/auth.test.ts`
Expected: FAIL con "getLinkedProviders is not a function" / "linkGoogleAccount is not a function" / "setPasswordCredential is not a function"

- [ ] **Step 3: Implementa in `src/lib/firebase/auth.ts`**

Aggiorna l'import in cima al file aggiungendo alle importazioni da `firebase/auth` già presenti:

```ts
  linkWithPopup, reauthenticateWithPopup, linkWithCredential, EmailAuthProvider,
```

Aggiungi in fondo al file:

```ts
export const getLinkedProviders = (): string[] =>
  auth.currentUser?.providerData.map(p => p.providerId) ?? [];

export const linkGoogleAccount = async (): Promise<void> => {
  const current = auth.currentUser;
  if (!current) throw new Error('Not signed in');
  const alreadyLinked = current.providerData.some(p => p.providerId === 'google.com');
  const result = alreadyLinked
    ? await reauthenticateWithPopup(current, provider)
    : await linkWithPopup(current, provider);
  const cred = GoogleAuthProvider.credentialFromResult(result);
  useAuth.setState({ googleAccessToken: cred?.accessToken ?? null });
};

export const setPasswordCredential = async (email: string, password: string): Promise<void> => {
  const current = auth.currentUser;
  if (!current) throw new Error('Not signed in');
  const credential = EmailAuthProvider.credential(email, password);
  await linkWithCredential(current, credential);
};
```

Nota: `provider` è il `GoogleAuthProvider` già istanziato in cima al file (con i tre scope `contacts`/`drive.file`/`calendar.events`) — riusalo, non crearne uno nuovo.

- [ ] **Step 4: Esegui i test per verificare che passino**

Run: `npx vitest run tests/lib/firebase/auth.test.ts`
Expected: PASS

- [ ] **Step 5: Type-check e suite completa**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/firebase/auth.ts tests/lib/firebase/auth.test.ts
git commit -m "feat(auth): add Google account linking decoupled from sign-in identity"
```

---

## Task 4: Schermata di login email/password

**Files:**
- Modify: `app/src/components/SignIn.tsx`
- Test: `app/tests/components/SignIn.test.tsx`

**Interfaces:**
- Consumes: `signInEmail`, `signUpEmail`, `resetPassword` da `lib/firebase/auth.ts` (Task 2).

- [ ] **Step 1: Scrivi i test falliti**

Crea `tests/components/SignIn.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const { mockSignInEmail, mockSignUpEmail, mockResetPassword } = vi.hoisted(() => ({
  mockSignInEmail: vi.fn(),
  mockSignUpEmail: vi.fn(),
  mockResetPassword: vi.fn(),
}));
vi.mock('../../src/lib/firebase/auth', () => ({
  signInEmail: mockSignInEmail,
  signUpEmail: mockSignUpEmail,
  resetPassword: mockResetPassword,
}));

import { SignIn } from '../../src/components/SignIn';

beforeEach(() => {
  mockSignInEmail.mockReset();
  mockSignUpEmail.mockReset();
  mockResetPassword.mockReset();
});

describe('SignIn', () => {
  it('modalità login: submit chiama signInEmail con email e password', async () => {
    mockSignInEmail.mockResolvedValueOnce(undefined);
    render(<SignIn />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByText('Accedi'));
    await waitFor(() => expect(mockSignInEmail).toHaveBeenCalledWith('a@b.com', 'password123'));
  });

  it('mostra un messaggio di errore se signInEmail fallisce', async () => {
    mockSignInEmail.mockRejectedValueOnce({ code: 'auth/invalid-credential' });
    render(<SignIn />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByText('Accedi'));
    await waitFor(() => expect(screen.getByText('Email o password errati.')).toBeInTheDocument());
  });

  it('passa a modalità registrazione e chiama signUpEmail', async () => {
    mockSignUpEmail.mockResolvedValueOnce(undefined);
    render(<SignIn />);
    fireEvent.click(screen.getByText('Crea un account'));
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@b.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByText('Registrati'));
    await waitFor(() => expect(mockSignUpEmail).toHaveBeenCalledWith('new@b.com', 'password123'));
  });

  it('mostra un messaggio se l\'email è già registrata', async () => {
    mockSignUpEmail.mockRejectedValueOnce({ code: 'auth/email-already-in-use' });
    render(<SignIn />);
    fireEvent.click(screen.getByText('Crea un account'));
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@b.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByText('Registrati'));
    await waitFor(() => expect(screen.getByText('Esiste già un account con questa email.')).toBeInTheDocument());
  });

  it('passa a modalità reset password, chiama resetPassword e mostra conferma', async () => {
    mockResetPassword.mockResolvedValueOnce(undefined);
    render(<SignIn />);
    fireEvent.click(screen.getByText('Password dimenticata?'));
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.com' } });
    fireEvent.click(screen.getByText('Invia email di reset'));
    await waitFor(() => expect(mockResetPassword).toHaveBeenCalledWith('a@b.com'));
    expect(screen.getByText('Email di reset inviata, controlla la posta.')).toBeInTheDocument();
  });

  it('"Torna al login" riporta in modalità login', () => {
    render(<SignIn />);
    fireEvent.click(screen.getByText('Crea un account'));
    fireEvent.click(screen.getByText('Torna al login'));
    expect(screen.getByText('Accedi')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Esegui i test per verificare che falliscano**

Run: `npx vitest run tests/components/SignIn.test.tsx`
Expected: FAIL — il componente attuale ha solo un bottone "Accedi con Google", nessuno degli elementi cercati esiste

- [ ] **Step 3: Riscrivi `src/components/SignIn.tsx`**

```tsx
import { useState, type FormEvent } from 'react';
import { signInEmail, signUpEmail, resetPassword } from '../lib/firebase/auth';

type Mode = 'login' | 'register' | 'reset';

const ERROR_MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'Email o password errati.',
  'auth/email-already-in-use': 'Esiste già un account con questa email.',
  'auth/weak-password': 'Password troppo debole (minimo 6 caratteri).',
  'auth/invalid-email': 'Email non valida.',
};

const errorMessage = (e: unknown): string => {
  const code = (e as { code?: string } | null)?.code;
  return (code && ERROR_MESSAGES[code]) || 'Si è verificato un errore. Riprova.';
};

export const SignIn = () => {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  const switchMode = (m: Mode) => {
    setMode(m);
    setErr(null);
    setResetSent(false);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      if (mode === 'login') await signInEmail(email, password);
      else if (mode === 'register') await signUpEmail(email, password);
      else {
        await resetPassword(email);
        setResetSent(true);
      }
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="home" style={{ textAlign: 'center' }}>
      <div className="home-hero">
        <div className="logo" style={{ background: 'linear-gradient(135deg,var(--lampone),var(--mirtillo))' }}>🏡</div>
        <h1>Cuore di Bosco</h1>
        <p>Calendario prenotazioni</p>
      </div>
      <form onSubmit={(e) => { void onSubmit(e); }} style={{ maxWidth: 360, margin: '0 auto', textAlign: 'left' }}>
        <label className="field"><span>Email</span>
          <input type="email" required value={email} onChange={e => setEmail(e.target.value)} />
        </label>
        {mode !== 'reset' && (
          <label className="field"><span>Password</span>
            <input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} />
          </label>
        )}
        {err && <div className="text-xs mb-2" style={{ color: 'crimson' }}>{err}</div>}
        {resetSent && (
          <div className="text-xs mb-2" style={{ color: 'var(--ink-soft)' }}>
            Email di reset inviata, controlla la posta.
          </div>
        )}
        <button type="submit" className="btn btn-primary w-full mb-2" disabled={busy}>
          {mode === 'login' ? 'Accedi' : mode === 'register' ? 'Registrati' : 'Invia email di reset'}
        </button>
      </form>
      <div style={{ maxWidth: 360, margin: '0 auto' }} className="text-sm">
        {mode === 'login' && (
          <>
            <button type="button" className="btn btn-ghost" onClick={() => switchMode('register')}>Crea un account</button>
            <button type="button" className="btn btn-ghost" onClick={() => switchMode('reset')}>Password dimenticata?</button>
          </>
        )}
        {mode !== 'login' && (
          <button type="button" className="btn btn-ghost" onClick={() => switchMode('login')}>Torna al login</button>
        )}
      </div>
    </section>
  );
};
```

- [ ] **Step 4: Esegui i test per verificare che passino**

Run: `npx vitest run tests/components/SignIn.test.tsx`
Expected: PASS

- [ ] **Step 5: Type-check e suite completa**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/SignIn.tsx tests/components/SignIn.test.tsx
git commit -m "feat(auth): replace Google sign-in screen with email/password login, registration and password reset"
```

---

## Task 5: "Connetti Google" e migrazione account in Impostazioni

**Files:**
- Modify: `app/src/components/settings/AccountSection.tsx`
- Modify: `app/tests/components/AccountSection.test.tsx`

**Interfaces:**
- Consumes: `getLinkedProviders`, `linkGoogleAccount`, `setPasswordCredential` da `lib/firebase/auth.ts` (Task 3).

- [ ] **Step 1: Scrivi i test falliti**

In `tests/components/AccountSection.test.tsx`, sostituisci il mock esistente e l'import di `@testing-library/react` in cima al file:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const { signOutMock, mockGetLinkedProviders, mockLinkGoogleAccount, mockSetPasswordCredential } = vi.hoisted(() => ({
  signOutMock: vi.fn(() => Promise.resolve()),
  mockGetLinkedProviders: vi.fn(() => [] as string[]),
  mockLinkGoogleAccount: vi.fn(),
  mockSetPasswordCredential: vi.fn(),
}));
vi.mock('../../src/lib/firebase/auth', () => ({
  signOut: () => signOutMock(),
  getLinkedProviders: () => mockGetLinkedProviders(),
  linkGoogleAccount: () => mockLinkGoogleAccount(),
  setPasswordCredential: (email: string, password: string) => mockSetPasswordCredential(email, password),
}));

import { AccountSection } from '../../src/components/settings/AccountSection';
import { useAuth } from '../../src/store/auth';

beforeEach(() => {
  signOutMock.mockClear();
  mockGetLinkedProviders.mockReset().mockReturnValue([]);
  mockLinkGoogleAccount.mockReset();
  mockSetPasswordCredential.mockReset();
  useAuth.setState({
    user: { email: 'test@example.com', name: 'Test User' },
    googleAccessToken: null,
  });
});
```

(i 4 `it` esistenti — email visibile, logout con/senza conferma, nessun render senza utente — restano invariati sotto)

Aggiungi in fondo al file, dentro lo stesso `describe('AccountSection', ...)`:

```tsx
  it('mostra "non collegato" e il bottone "Connetti Google" se Google non è collegato', () => {
    mockGetLinkedProviders.mockReturnValue(['password']);
    render(<AccountSection />);
    expect(screen.getByText(/non collegato/)).toBeInTheDocument();
    expect(screen.getByText('Connetti Google')).toBeInTheDocument();
  });

  it('mostra "collegato" e nasconde il bottone se Google è già collegato', () => {
    mockGetLinkedProviders.mockReturnValue(['google.com', 'password']);
    render(<AccountSection />);
    expect(screen.getByText(/collegato/)).toBeInTheDocument();
    expect(screen.queryByText('Connetti Google')).toBeNull();
  });

  it('"Connetti Google" chiama linkGoogleAccount e aggiorna lo stato mostrato', async () => {
    mockGetLinkedProviders
      .mockReturnValueOnce(['password'])
      .mockReturnValueOnce(['password', 'google.com']);
    mockLinkGoogleAccount.mockResolvedValueOnce(undefined);
    render(<AccountSection />);
    fireEvent.click(screen.getByText('Connetti Google'));
    await waitFor(() => expect(mockLinkGoogleAccount).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText('Connetti Google')).toBeNull());
  });

  it('mostra "Imposta email e password" solo se manca una credenziale password', () => {
    mockGetLinkedProviders.mockReturnValue(['google.com']);
    render(<AccountSection />);
    expect(screen.getByText('Imposta email e password')).toBeInTheDocument();
  });

  it('non mostra "Imposta email e password" se già presente', () => {
    mockGetLinkedProviders.mockReturnValue(['google.com', 'password']);
    render(<AccountSection />);
    expect(screen.queryByText('Imposta email e password')).toBeNull();
  });

  it('il form di migrazione chiama setPasswordCredential con email e password', async () => {
    mockGetLinkedProviders
      .mockReturnValueOnce(['google.com'])
      .mockReturnValueOnce(['google.com', 'password']);
    mockSetPasswordCredential.mockResolvedValueOnce(undefined);
    render(<AccountSection />);
    fireEvent.click(screen.getByText('Imposta email e password'));
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByText('Salva'));
    await waitFor(() => expect(mockSetPasswordCredential).toHaveBeenCalledWith('a@b.com', 'password123'));
  });
```

- [ ] **Step 2: Esegui i test per verificare che falliscano**

Run: `npx vitest run tests/components/AccountSection.test.tsx`
Expected: FAIL — nessuno degli elementi "Connetti Google"/"Imposta email e password" esiste ancora

- [ ] **Step 3: Implementa in `src/components/settings/AccountSection.tsx`**

```tsx
import { useState, type FormEvent } from 'react';
import { useAuth } from '../../store/auth';
import { signOut, getLinkedProviders, linkGoogleAccount, setPasswordCredential } from '../../lib/firebase/auth';

export const AccountSection = () => {
  const user = useAuth(s => s.user);
  const [providers, setProviders] = useState<string[]>(getLinkedProviders());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [migrating, setMigrating] = useState(false);
  const [migrateEmail, setMigrateEmail] = useState('');
  const [migratePassword, setMigratePassword] = useState('');

  if (!user) return null;

  const hasGoogle = providers.includes('google.com');
  const hasPassword = providers.includes('password');

  const onLogout = () => {
    if (!window.confirm('Vuoi davvero uscire? Tornerai alla schermata di accesso.')) return;
    void signOut();
  };

  const onConnectGoogle = async () => {
    setErr(null);
    setBusy(true);
    try {
      await linkGoogleAccount();
      setProviders(getLinkedProviders());
    } catch {
      setErr('Impossibile collegare Google. Riprova.');
    } finally {
      setBusy(false);
    }
  };

  const onMigrate = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await setPasswordCredential(migrateEmail, migratePassword);
      setProviders(getLinkedProviders());
      setMigrating(false);
    } catch {
      setErr('Impossibile impostare email e password. Riprova.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-6">
      <h3 className="font-semibold mb-2">Account</h3>
      <div className="text-sm mb-2">{user.email}</div>

      <div className="text-sm mb-2">Google: {hasGoogle ? 'collegato' : 'non collegato'}</div>
      {!hasGoogle && (
        <button className="btn btn-ghost mb-2" disabled={busy} onClick={() => void onConnectGoogle()}>
          Connetti Google
        </button>
      )}

      {!hasPassword && !migrating && (
        <button className="btn btn-ghost mb-2" onClick={() => setMigrating(true)}>
          Imposta email e password
        </button>
      )}
      {!hasPassword && migrating && (
        <form onSubmit={(e) => { void onMigrate(e); }} className="mb-2">
          <label className="field"><span>Email</span>
            <input type="email" required value={migrateEmail} onChange={e => setMigrateEmail(e.target.value)} />
          </label>
          <label className="field"><span>Password</span>
            <input type="password" required minLength={6} value={migratePassword} onChange={e => setMigratePassword(e.target.value)} />
          </label>
          <button type="submit" className="btn btn-primary" disabled={busy}>Salva</button>
        </form>
      )}

      {err && <div className="text-xs mb-2" style={{ color: 'crimson' }}>{err}</div>}

      <button className="btn btn-ghost" onClick={onLogout}>Esci</button>
    </section>
  );
};
```

- [ ] **Step 4: Esegui i test per verificare che passino**

Run: `npx vitest run tests/components/AccountSection.test.tsx`
Expected: PASS

- [ ] **Step 5: Type-check e suite completa**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/settings/AccountSection.tsx tests/components/AccountSection.test.tsx
git commit -m "feat(auth): add Google connect action and password-credential migration to AccountSection"
```

---

## Task 6: Allinea "Riconnetti Google" nel sync Calendar al nuovo modello

**Files:**
- Modify: `app/src/components/settings/CalendarSyncSection.tsx`
- Modify: `app/tests/components/CalendarSyncSection.test.tsx`

**Interfaces:**
- Consumes: `linkGoogleAccount` da `lib/firebase/auth.ts` (Task 3), al posto di `signIn`.

**Perché**: `CalendarSyncSection`'s "Riconnetti Google" chiama oggi `signIn()`, che è la funzione di login-come-identità originale. Con l'identità primaria ora su email/password, chiamare `signIn()` proverebbe a cambiare l'utente loggato (accedendo COME l'account Google) invece di limitarsi a rinfrescare il token per le API — esattamente il caso d'uso di `linkGoogleAccount` (Task 3), che riautentica/collega Google senza toccare l'identità corrente.

- [ ] **Step 1: Aggiorna il test esistente**

In `tests/components/CalendarSyncSection.test.tsx`, sostituisci `mockSignIn` con `mockLinkGoogleAccount` ovunque compare:

```ts
const { mockListCalendars, mockLinkGoogleAccount, mockEnqueue, mockRunQueueNow } = vi.hoisted(() => ({
  mockListCalendars: vi.fn(),
  mockLinkGoogleAccount: vi.fn().mockResolvedValue(undefined),
  mockEnqueue: vi.fn(),
  mockRunQueueNow: vi.fn(),
}));
vi.mock('../../src/lib/google/calendarSync', () => ({
  listCalendars: mockListCalendars,
  CalendarScopeError: class CalendarScopeError extends Error {},
}));
vi.mock('../../src/lib/firebase/auth', () => ({
  linkGoogleAccount: mockLinkGoogleAccount,
}));
```

(rimuovi `auth: { currentUser: null }` dal mock — non più necessario, `CalendarSyncSection` non legge `auth` direttamente)

Nel `beforeEach`, sostituisci `mockSignIn.mockClear();` con `mockLinkGoogleAccount.mockClear();`.

Nell'ultimo test del file, sostituisci:

```ts
  it('"Riconnetti Google" è visibile quando connesso e rifà il login e svuota la coda', async () => {
    useCalendarSettings.setState({ googleCalendarId: 'cal1', googleCalendarName: 'Casa', calendarSyncEnabled: true });
    render(<CalendarSyncSection />);
    fireEvent.click(screen.getByText(/Riconnetti Google/i));
    await waitFor(() => expect(mockLinkGoogleAccount).toHaveBeenCalledTimes(1));
    expect(mockRunQueueNow).toHaveBeenCalledTimes(1);
  });
```

- [ ] **Step 2: Esegui il test per verificare che fallisca**

Run: `npx vitest run tests/components/CalendarSyncSection.test.tsx`
Expected: FAIL — `linkGoogleAccount` non è ancora usato dal componente, il mock module non esporta più `signIn` (import rotto)

- [ ] **Step 3: Aggiorna `src/components/settings/CalendarSyncSection.tsx`**

Sostituisci l'import:

```ts
import { linkGoogleAccount } from '../../lib/firebase/auth';
```

E in `onReconnect`, sostituisci `await signIn();` con `await linkGoogleAccount();`:

```ts
  const onReconnect = async () => {
    setErr(null);
    try {
      await linkGoogleAccount();
      runCalendarSyncQueueNow();
    } catch {
      setErr('Impossibile riconnettere l’account Google.');
    }
  };
```

- [ ] **Step 4: Esegui il test per verificare che passi**

Run: `npx vitest run tests/components/CalendarSyncSection.test.tsx`
Expected: PASS

- [ ] **Step 5: Type-check e suite completa**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/settings/CalendarSyncSection.tsx tests/components/CalendarSyncSection.test.tsx
git commit -m "fix(auth): use linkGoogleAccount instead of signIn for Calendar reconnect flow"
```

---

## Task 7: Verifica finale

**Files:** nessuno (solo comandi di verifica)

- [ ] **Step 1: Suite di test completa**

Run: `npx vitest run`
Expected: tutti i test passano (esistenti + i nuovi di questo piano)

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: nessun errore

- [ ] **Step 3: Lint**

Run: `npx eslint .`
Expected: nessun errore

- [ ] **Step 4: Verifica manuale (non automatizzabile in CI)**

Annota nel report finale che restano da fare manualmente, prima di considerare il sotto-progetto pronto per un uso reale:
- Abilitare il provider Email/Password in Firebase Console (azione manuale, non nel codice).
- Login con l'account esistente (Google) → Impostazioni → "Imposta email e password" → verificare che da quel momento il login con email/password funzioni sullo stesso account (stessi dati).
- Registrazione di un nuovo account → verificare che parta con dati vuoti, isolato dall'account esistente.
- "Password dimenticata?" → verificare la ricezione reale dell'email di reset Firebase.
- Da un account già loggato con email/password, "Connetti Google" in Impostazioni → verificare che backup Drive, rubrica contatti e sync Calendar tornino a funzionare.
- Rimuovere/nascondere il bottone "Accedi con Google" dalla UI pubblica è già coperto dal Task 4 (il nuovo `SignIn.tsx` non lo mostra più) — verificare visivamente che non compaia.
