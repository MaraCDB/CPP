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
