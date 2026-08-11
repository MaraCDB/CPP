# CPP Project Memory

## Project: Contacts + Prenotazioni (CPP)

A web app (Vite + React + TypeScript + Zustand) for managing bookings with Google integrations (Sheets, Drive, People API).

App directory: `app/`

---

## Architecture

- `app/src/lib/google/` — Google API modules (auth, sheets, drive, people, adapter, bootstrap)
- `app/src/store/` — Zustand stores (auth, bookings, closures, promemoria, settings, sync, ui)
- `app/src/types.ts` — Shared TypeScript types
- `app/tests/` — Vitest unit tests mirroring `src/` structure

---

## Completed Tasks (People API plan)

### Tasks 3–6 (Apr 15 2026) — Foundation layer
- `Prenotazione` type extended with `contactResourceName?`, `contactDisplayName?`
- `app/src/lib/google/adapter.ts` — serialization updated for contact fields
- `app/src/lib/google/bootstrap.ts` — auto-migrates existing sheets with new columns
- `app/src/lib/google/auth.ts` — OAuth scope includes `contacts.readonly`
- Commits: c01c758, e5e250c, bdd3e0d, 59c7c0a

### Task 7 (Apr 15–16 2026) — People API client
- Created `app/src/lib/google/people.ts`
  - `searchByPhone(e164)` — queries `people:searchContacts`, matches on canonicalForm or toE164 normalization, prefers primary phone, returns `GoogleContact | null`
  - `createContact({ name, phoneE164 })` — POSTs to `people:createContact`
  - `getContact(resourceName)` — fetches single contact by resource name
  - `warmupPeopleSearch()` — fire-and-forget warmup call
  - `ScopeError` — thrown on 403 responses
- Created `app/tests/lib/google/people.test.ts` — 6 tests, all passing
- `toE164` from `app/src/lib/phone.ts` returns `string | null` (not `string`) — implementation handles this

### Tasks 8–9 (Apr 15 2026) — Boot warmup and confirmation modal
- Task 8: `app/src/lib/sync.ts`
  - Added import: `warmupPeopleSearch` from `./google/people`
  - Inside `bootSync()`: call `void warmupPeopleSearch()` after `void processQueue()` and before `setInterval` calls
  - Primes the People API search cache on app boot for faster first search
- Task 9: Created `app/src/components/common/ConfirmCreateContactModal.tsx`
  - Component accepts: `open`, `name`, `phoneE164`, `onConfirm`, `onSkip`
  - Uses `Modal` component with Italian UI: "Aggiungere a rubrica Gmail?"
  - Buttons: "No, salta" (onSkip) and "Aggiungi a Gmail" (onConfirm)
- Commits: 12732c4, 079c00e
- All tests passing (35 tests)
- TypeScript: zero errors

---

## Key Patterns

- All Google API calls go through internal `call<T>()` helper that injects Bearer token from `useAuth.getState().accessToken`
- Phone normalization: `toE164(raw)` from `libphonenumber-js`, default country 'IT', returns `string | null`
- Tests use `vi.stubGlobal('fetch', ...)` to mock fetch; `useAuth.setState(...)` to inject fake token
- Conventional Commits enforced via commitlint + husky

---

### Tasks 13–14 (Apr 15 2026) — Email refresh on demand + test

- Task 13: `app/src/components/common/BookingCard.tsx`
  - Added imports: `useBookings` from store, `getContact` from people lib
  - Added `updateBooking` state selector and `fetchEmail` async handler inside component
  - `fetchEmail` guards: skips if `contattoResourceName` missing or `contattoEmail` already present
  - Passed `onMissingEmail={fetchEmail}` to `<ContactMenu>` (prop already existed on ContactMenu)
  - Commit: 536aa43
- Task 14: `app/tests/store/bookings.test.ts`
  - Added describe block: 'bookings store — contact link persistence'
  - Test verifies `contattoResourceName` and `contattoEmail` survive a partial `update()` call
  - Commit: 8199b2f

---

## Test Suite Status

- 40 tests across 7 files, all passing (as of Tasks 13–14 completion)
- `npx tsc --noEmit` — zero errors

---

## Google Calendar sync — final fix wave (2026-08-05)

Fixed 5 findings from the whole-branch review of the Google Calendar sync feature
(11 tasks, already merged). See
`.superpowers/sdd/2026-08-01-google-calendar-sync/final-fix-report.md` for full detail.

- **Finding 1:** `calendarSync.ts`'s 4 orchestration functions (`syncBookingToCalendar`,
  `syncClosureToCalendar`, `deleteBookingFromCalendar`, `deleteClosureFromCalendar`) now
  enqueue unconditionally on ANY catch (previously suppressed enqueue for
  `CalendarScopeError`, silently dropping expired-token failures forever).
- **Finding 2:** Root cause is `googleAccessToken` is only set in `signIn()`, never restored
  on reload by `onAuthStateChanged` (out of scope to fix — shared with Drive/People API).
  Added a scoped workaround: `runCalendarSyncQueueNow()` exported from
  `useCalendarSyncQueue.ts`, and a "Riconnetti Google" button in `CalendarSyncSection.tsx`
  (visible whenever connected) that calls `signIn()` again + drains the queue.
- **Finding 3:** `useCalendarSyncQueue`'s effect now depends on `useCalendarSettings`'s
  `googleCalendarId`/`calendarSyncEnabled` read via the reactive selector-hook form (not
  `.getState()`), so it re-fires once Firestore's async `onSnapshot` hydration populates
  them post-mount — previously it only ran once at `[uid]`, always saw pre-hydration
  null/false, and silently never drained anything until an `online` event.
- **Finding 4:** `processCalendarQueue` no longer dequeues an `upsert` op when
  `getBooking`/`getClosure` returns `undefined` (entity not yet in store) — only dequeues on
  actual success (or unconditionally for `delete`, since a gone entity is a fine delete
  outcome). Relies on `calendarQueue.ts`'s existing `kind:id` dedup (last-write-wins,
  untouched) to avoid staleness if the entity is deleted later.
- **Finding 5:** Selecting a calendar in `CalendarSyncSection.tsx` now backfills — enqueues
  an upsert for every existing booking/closure and immediately calls
  `runCalendarSyncQueueNow()` — so pre-existing bookings appear on the shared calendar
  without needing individual edits.
- Constraint respected: `calendarSync.ts` still never imports `store/bookings.ts` /
  `store/closures.ts` (no circular import); Firebase Auth persistence architecture
  untouched.
- Full suite: 227/227 tests pass, `tsc --noEmit` clean, `eslint .` clean.
- One test-mock gotcha found while verifying: `CalendarSyncSection.test.tsx`'s mock of
  `lib/firebase/auth` must also export `auth: { currentUser: null }` — `calendarSettings.ts`
  reads `auth.currentUser` too, and a mock missing it throws inside the click handler,
  silently aborting the handler before reaching the new enqueue calls (looked like the
  fix wasn't working; was actually just an incomplete mock).

---

## Google access token — root cause fix (2026-08-11)

Finding 2 above (`googleAccessToken` mai ripristinato al reload) è stato risolto alla radice,
non più solo mitigato. Riguardava Calendar **e** Drive backup **e** People API.

- **Causa**: Firebase Auth non conserva né rinnova l'access token OAuth dei provider —
  `credentialFromResult()` lo espone solo al momento del popup. Al reload
  `onAuthStateChanged` ripristina l'utente ma non il token; inoltre il token scade dopo ~1h.
- **Fix**: nuovo `app/src/lib/google/token.ts` che usa Google Identity Services per il
  refresh silenzioso (`requestAccessToken({ prompt: '' })`, nessun popup: il consenso c'è già).
  Firebase Auth resta per identità/Firestore, GIS solo per i token delle Google API.
  `VITE_GOOGLE_CLIENT_ID` era già presente in `.env.local` e nei secret CI (residuo
  pre-Firebase): nessuna nuova configurazione richiesta.
- **API**: `getGoogleAccessToken()` (cache + skew 5 min + single-flight),
  `googleFetch()` (Authorization automatico + 1 retry su 401/403 con token fresco),
  `primeGoogleToken()` (chiamato da `initAuthListener` al ripristino sessione),
  `setGoogleToken()` / `clearGoogleToken()`.
- `calendarSync.ts`, `driveBackup.ts`, `people.ts` non leggono più lo store direttamente:
  passano da `googleFetch` e traducono `GoogleAuthError` nel proprio ScopeError.
- `useAuth` ha ora `googleTokenExpiresAt` (null = scadenza sconosciuta → token valido).
- `useCalendarSyncQueue` dipende anche da `googleAccessToken`: senza, la coda non parte
  quando il token arriva async dopo il mount.
- `CalendarSyncSection` mostra "Riconnetti Google" anche da stato non connesso, se
  `listCalendars` fallisce per sessione scaduta (prima era un vicolo cieco).
- **Gotcha test**: in jsdom lo script GIS non si carica mai (né `load` né `error`) → ogni
  refresh resterebbe appeso 10s. `tests/setup.ts` installa `stubGisFailure()` di default;
  i test che vogliono un refresh riuscito usano `stubGisToken()` da `tests/helpers/gis.ts`.
- Verificato: 273/273 test, `tsc --noEmit` pulito, `eslint .` pulito, `npm run build` OK.
- **Non verificato**: smoke test manuale su device reale (richiede origin GitHub Pages fra
  le *Authorized JavaScript origins* del client OAuth — molto probabilmente già a posto,
  dato che il vecchio stack GIS girava sullo stesso origin).
