# Design — Login email/password + registrazione pubblica

**Data**: 2026-08-06
**Stato**: spec approvata, in attesa di piano di implementazione
**Target**: PWA su Chrome desktop e Android Chrome (standalone)

## Sommario

Primo sotto-progetto di un percorso esplorativo verso una possibile distribuzione dell'app ad altri gestori (nessuna fretta implementativa — questo design/piano resta pronto per quando servirà). Sgancia l'identità di accesso (chi sei) dall'autorizzazione Google (backup Drive, rubrica contatti, sync Calendar): il login diventa email/password con registrazione pubblica aperta; Google diventa un collegamento opzionale per-account, attivabile da Impostazioni.

## Motivazione

- Login Google attuale chiede tutti gli scope (contatti, drive, calendar) insieme al primo accesso — troppo invasivo.
- Il token Google (`googleAccessToken`) non sopravvive al reload (si popola solo dentro `signIn()`), quindi le funzioni Google smettono di funzionare silenziosamente finché non si rifà login completo — friction percepita come "devo rifare login troppo spesso".
- In vista di un'eventuale distribuzione ad altri gestori, serve una via di accesso che non presupponga che ogni utente abbia/usi un account Google.

## Scope

- **Dentro**: login email/password, registrazione pubblica, reset password, migrazione dell'account esistente (stesso `uid`, stessi dati), scollegare l'acquisizione di `googleAccessToken` dal login rendendola un'azione "Connetti Google" separata in Impostazioni.
- **Fuori** (sotto-progetti futuri, solo accennati): onboarding nuovo gestore (camere/prezzi configurabili, oggi "Lampone"/"Mirtillo" sono hardcoded), sganciare il branding "Cuore di Bosco", verifica quote Firebase/Firestore con più utenti reali, eventuale rate-limiting sulla registrazione pubblica.

## Isolamento dati — nessun cambiamento necessario

Il modello dati esistente (`users/{uid}/bookings`, `/closures`, ecc., regole Firestore `request.auth.uid == userId`) **già isola i dati per account**. Ogni nuovo account registrato ottiene un `uid` nuovo e un albero Firestore vuoto — nessuna modifica alle regole o alla struttura dati serve per questo sotto-progetto.

## Architettura

### Provider

Firebase Auth Email/Password, da abilitare in console (azione manuale utente, una tantum, non nel piano).

### Token Google — disaccoppiato dal login

Oggi `googleAccessToken` (store `auth.ts`) è popolato solo da `signIn()` (popup Google usato come identità), e mai ripopolato da `onAuthStateChanged` al reload. Diventa popolato da una nuova azione indipendente **"Connetti Google"** in Impostazioni, che usa `linkWithPopup`/`reauthenticateWithPopup` su un `GoogleAuthProvider` con gli scope già esistenti (`contacts`, `drive.file`, `calendar.events`) — senza cambiare l'identità con cui si è loggati.

`lib/google/people.ts`, `lib/google/driveBackup.ts`, `lib/google/calendarSync.ts` **non cambiano**: leggono `googleAccessToken` da `useAuth.getState()` esattamente come oggi — beneficiano tutti e tre uniformemente del disaccoppiamento senza modifiche al loro codice.

### Migrazione dell'account esistente

L'account attuale (proprietaria) è oggi un utente Firebase con identità Google. Per non perdere dati: mentre è ancora loggata con Google, un'azione una tantum in Impostazioni ("Imposta email e password") collega una credenziale email/password allo **stesso** `uid` tramite `linkWithCredential`. Da quel momento l'accesso è possibile sia con Google sia con email/password sullo stesso account. Il bottone "Accedi con Google" viene rimosso dalla schermata di login pubblica (la credenziale Google resta tecnicamente collegata, semplicemente non più esposta come via d'accesso primaria).

Questa azione di migrazione è mostrata in `AccountSection.tsx` solo se l'utente corrente non ha già una credenziale email/password collegata (così non si ripropone a chi si è registrato direttamente con email/password).

## Componenti nuovi/modificati

- **`lib/firebase/auth.ts`**: aggiungere `signInEmail(email, password)`, `signUpEmail(email, password)`, `resetPassword(email)`, `linkGoogleAccount()` (collegamento Google separato dall'identità), `setPasswordCredential(email, password)` (migrazione account esistente via `linkWithCredential`). La funzione `signIn()` esistente (popup Google come identità primaria) resta nel codice ma non è più usata dalla UI di login pubblica.
- **`components/SignIn.tsx`**: form email/password (login), link "Registrati" (nuovo account via `signUpEmail`), link "Password dimenticata?" (reset via `resetPassword`, invio email Firebase).
- **`components/settings/AccountSection.tsx`**: aggiungere sezione "Connetti Google" (stato collegato/non collegato, azione `linkGoogleAccount()`/`reauthenticateWithPopup`) e, condizionalmente, l'azione di migrazione "Imposta email e password".
- **`types.ts`**: `GoogleUser` → generalizzare in `AppUser { email: string; name?: string; picture?: string }` (campi `name`/`picture` diventano opzionali — un utente email/password non li ha). Unico uso attuale nella UI è `user.email` in `AccountSection.tsx:16`, impatto minimo.

## Data flow

1. **Nuovo utente**: "Registrati" → `createUserWithEmailAndPassword` → nuovo `uid` → Firestore vuoto → (onboarding camere/prezzi è fuori scope: per ora vede comunque le camere hardcoded "Lampone"/"Mirtillo").
2. **Utente esistente (proprietaria)**: login email/password → stesso `uid` di sempre (grazie alla migrazione) → stessi dati.
3. **Chiunque, se vuole backup/contatti/calendar**: Impostazioni → "Connetti Google" → popup consenso Google → `googleAccessToken` popolato in `useAuth` → le funzioni esistenti funzionano invariate.

## Testing

- `lib/firebase/auth.ts`: nuove funzioni testate con Firebase Auth SDK mockato, stesso pattern di `tests/lib/firebase/auth.test.ts` esistente.
- `SignIn.tsx`: form email/password, validazione campi, stati di errore (credenziali sbagliate, email già registrata, password debole), flusso reset password.
- `AccountSection.tsx`: stato collegato/non collegato di Google, visibilità condizionale dell'azione di migrazione (solo se manca una credenziale email/password), esito collegamento Google (successo/errore).

## Rischi e limiti accettati

- Registrazione pubblica senza rate-limiting: chiunque trovi l'URL può creare un account (dati vuoti, isolati, nessun accesso ai dati altrui) — accettabile per questa fase esplorativa, da rivalutare nel sotto-progetto "sostenibilità infrastrutturale" prima di una distribuzione reale.
- Un nuovo utente registrato vede comunque le camere "Lampone"/"Mirtillo" hardcoded finché non esiste l'onboarding (sotto-progetto separato) — l'app non è ancora realmente utilizzabile da un gestore esterno, questo sotto-progetto pone solo le fondamenta di autenticazione.
