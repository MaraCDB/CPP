# Design — Sync prenotazioni/chiusure su Google Calendar condiviso

**Data**: 2026-08-01
**Stato**: spec approvata, in attesa di piano di implementazione
**Target**: app web/PWA, stesso stack Firebase Auth + Firestore già in uso

## Sommario

Pushare automaticamente prenotazioni e chiusure verso un calendario Google esistente che la proprietaria condivide con il partner (es. calendario "Casa"), invece di un'esportazione ICS o di un sistema di inviti custom dentro l'app. Sync unidirezionale (app → Calendar): Firestore resta l'unica source of truth, il Calendar è una vista di sola lettura per il partner.

## Motivazione

Il partner non ha bisogno di installare o loggarsi nell'app: vede le prenotazioni nel suo Google Calendar nativo (telefono/PC/smartwatch), con le notifiche e l'UX che già conosce. Il push è realtime (secondi) invece delle 6-24h tipiche di un ICS subscription, e non richiede infrastruttura aggiuntiva (nessuna Cloud Function, nessun webhook).

## Scope

- **Incluse**: `Prenotazione` (bookings) e `Chiusura` (closures).
- **Escluse per ora**: `BookingTask` (promemoria) — possibile estensione futura, non in questo giro.
- **Fuori scope esplicitamente**: sync bidirezionale (modifiche fatte su Calendar non tornano in Firestore).

## Architettura

### 1. Scope OAuth

Aggiungere `https://www.googleapis.com/auth/calendar.events` al `GoogleAuthProvider` in `src/lib/firebase/auth.ts`, insieme a `contacts` e `drive.file` già presenti. Una sola schermata di consenso aggiuntiva al prossimo login.

### 2. Modulo `lib/google/calendarSync.ts`

Stesso pattern già consolidato in `lib/google/driveBackup.ts`:

- `token()` legge `googleAccessToken` da `useAuth.getState()`, lancia `CalendarScopeError` se assente.
- `CalendarScopeError` per risposte 401/403 (token scaduto o scope mancante) — l'utente deve ri-loggarsi, gestito dal flusso OAuth esistente.
- Fetch diretti a Calendar API v3 (`https://www.googleapis.com/calendar/v3/calendars/{calendarId}/events`), nessuna nuova dipendenza.

### 3. Idempotenza

Ogni evento porta `extendedProperties.private.cdb_id = <booking.id | closure.id>`. Su update/delete, l'evento esistente si trova con:

```
events.list?privateExtendedProperty=cdb_id=XXX
```

stesso principio già usato in `driveBackup.ts` con `appProperties.cdb_backup` per i file di backup.

### 4. Selezione calendario e toggle (Impostazioni)

Nuova sezione "Sync Google Calendar" in `TemplatesPage`, stessa card style di `AccountSection`/`BackupSection`:

- Bottone "Connetti calendario" → `calendarList.list` → dropdown dei calendari dell'utente → salva `calendarId` scelto in Firestore `users/{uid}.googleCalendarId`.
- Toggle enable/disable (`users/{uid}.calendarSyncEnabled`), disattivabile senza scollegare.
- Bottone "Disconnetti" che azzera `googleCalendarId`.
- Stato mostrato: "Non connesso" / "Connesso a «{nome calendario}»".

### 5. Hook nel ciclo di vita

In `store/bookings.ts` e `store/closures.ts`, dopo le chiamate esistenti a `upsertDoc`/`removeDoc`, fire-and-forget (non bloccante, non await-ato dal chiamante UI) verso:

- `syncBookingToCalendar(booking)` — create o update (decide in base a se l'evento con quel `cdb_id` esiste già).
- `syncClosureToCalendar(closure)` — idem.
- `deleteFromCalendar(id)` — su rimozione booking/chiusura, cerca l'evento per `cdb_id` e fa `events.delete` vero (nessun soft-delete: Calendar non ne ha uno pulito).

Tutte le chiamate sono no-op se `calendarSyncEnabled` è false o `googleCalendarId` non è impostato.

## Mapping eventi

### Prenotazione

- **summary**: `{camera} x{numOspiti} {nome}` — es. `Lampone x2 Rossi`. Se `numOspiti` è assente, si omette la parte `x{n}`: `Lampone Rossi`.
- **start.date / end.date**: `checkin` / `checkout` (evento all-day, come sono modellate le date in `Prenotazione`).
- **description**: minimale, solo campi essenziali per contattare l'ospite — niente prezzo/note (dato sensibile su un calendario condiviso):
  ```
  Stato: {stato}
  Contatto: {contattoValore} ({contattoVia})
  ```
  La riga `Contatto` si omette se `contattoValore` non è presente.
- **colorId**: nessuno, colore di default del calendario condiviso.

### Chiusura

- **summary**: `Chiusura {camera}`.
- **start.date / end.date**: `start` / `end` (all-day).
- **description**: `note`, se presente; altrimenti vuota.

## Error handling & retry

- **401/403** → `CalendarScopeError`. Nessun retry automatico: si risolve al prossimo login (lo scope è già richiesto dal provider OAuth).
- **Altri errori** (rete offline, 5xx, rate limit) → l'operazione pendente (`{id, tipo: 'booking'|'closure', azione: 'upsert'|'delete'}`) viene accodata in `localStorage` (chiave `cdb_calendar_queue`), stesso spirito minimale di `lastBackupAt` in `driveBackup.ts`. La coda è per-device (non sincronizzata tra dispositivi): accettabile perché il dato canonico resta in Firestore, solo il riflesso su Calendar è pending.
- La coda viene processata (best-effort, in ordine) al prossimo login e a ogni evento "torna online" (stesso hook usato da `goOnline` in `lib/firebase/db.ts`).

## Testing

- `calendarSync.ts`: helper puri di mapping (`buildBookingEvent(booking)`, `buildClosureEvent(closure)`) testati con Vitest senza mock di `fetch`, copertura di tutti i casi opzionali (numOspiti assente, contatto assente, note assenti).
- Le funzioni di sync (`syncBookingToCalendar` ecc.) testate con `fetch` mockato: create vs update, gestione 401/403, accodamento su errore di rete.
- Integrazione negli store (`bookings.ts`, `closures.ts`): test che verificano che `calendarSync` venga invocato su add/update/remove quando il sync è abilitato, e non invocato quando disabilitato — con `calendarSync` mockato.
- Manuale (non automatizzabile in CI): verifica cross-device che l'evento compaia realmente sul calendario condiviso dopo una modifica nell'app.

## Rischi e limiti accettati

- **Token TTL 1h**: se l'app resta aperta più di un'ora e si fa una modifica, il push può fallire finché non si ri-logga; finisce in coda e riparte al login successivo.
- **Cancellazione manuale dell'evento su Calendar**: se l'utente lo cancella da Calendar, alla successiva modifica dell'app l'evento verrà ricreato (comportamento accettato, non gestito come caso speciale).
- **Nessun sync di `BookingTask`** in questo giro (possibile estensione futura, stessa architettura).
