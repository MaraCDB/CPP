# Logout button — design

**Data:** 2026-05-08

## Problema

Dopo il sign-in con Google, se l'utente sceglie l'account sbagliato non c'è modo di uscire dall'app. La sessione persiste tramite `indexedDBLocalPersistence` di Firebase Auth e viene re-idratata ad ogni reload.

## Scope

Aggiungere un punto di accesso UI per fare logout. Niente nuova logica auth: `signOut()` è già esportato da [app/src/lib/firebase/auth.ts:31](../../../app/src/lib/firebase/auth.ts#L31) e fa `firebase.signOut` + reset di `useAuth`.

Esplicitamente fuori scope: revoca dello scope OAuth, cleanup di IndexedDB/Firestore cache, gestione di backup Drive (i backup esistenti restano sull'account che li ha caricati — comportamento corretto).

## Posizione UI

Nuova sezione `AccountSection` in fondo a `TemplatesPage`, sotto `BackupSection`. Coerente con il pattern esistente (`<section className="mt-6">` con `<h3>` heading).

## Contenuto e comportamento

```
Account
─────────────────────────
schintu.enrico@gmail.com
[ Esci ]
```

- Email da `useAuth(s => s.user?.email)`
- Click su "Esci" → `window.confirm("Vuoi davvero uscire? Tornerai alla schermata di accesso.")` → se confermato chiama `signOut()` di `lib/firebase/auth.ts`
- L'auth listener in `App.tsx:88` rileva `user === null` e mostra automaticamente `<SignIn />`. Nessun routing manuale.

## Test

Unit test `AccountSection.test.tsx`:
1. Renderizza l'email dello user dallo store `useAuth`
2. Click su "Esci" + conferma chiama `signOut` (mock)
3. Click su "Esci" + annulla NON chiama `signOut`

## File toccati

- `app/src/components/settings/AccountSection.tsx` (nuovo, ~30 righe)
- `app/src/components/settings/TemplatesPage.tsx` (1 riga: `<AccountSection />` dopo `<BackupSection />`)
- `app/tests/components/AccountSection.test.tsx` (nuovo)
