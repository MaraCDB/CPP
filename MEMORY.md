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

---

## Key Patterns

- All Google API calls go through internal `call<T>()` helper that injects Bearer token from `useAuth.getState().accessToken`
- Phone normalization: `toE164(raw)` from `libphonenumber-js`, default country 'IT', returns `string | null`
- Tests use `vi.stubGlobal('fetch', ...)` to mock fetch; `useAuth.setState(...)` to inject fake token
- Conventional Commits enforced via commitlint + husky

---

## Test Suite Status

- 35 tests across 6 files, all passing (as of Task 7 completion)
- `npx tsc --noEmit` — zero errors
