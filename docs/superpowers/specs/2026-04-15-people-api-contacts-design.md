# People API — Collegamento contatti Gmail alle prenotazioni

**Data:** 2026-04-15
**Stato:** Design approvato, pronto per planning

## Obiettivo

Collegare il numero di telefono di ogni prenotazione al contatto Gmail corrispondente, tramite Google People API. Al salvataggio di una prenotazione:
- se il numero esiste già in rubrica → collega il contatto
- se non esiste → propone di aggiungerlo alla rubrica Gmail

Sulla card prenotazione, il numero diventa cliccabile e apre un popover con scorciatoie a **WhatsApp**, **Chiamata**, **Email** (quest'ultima solo se il contatto collegato ha un'email).

## Requisiti

1. Match esclusivamente per numero di telefono, normalizzato in formato E.164.
2. Lookup al salvataggio della prenotazione (non al blur del form).
3. Se numero non trovato in rubrica → modale "Aggiungi a Gmail?" con possibilità di saltare.
4. Popover sulla card con azioni WhatsApp / Chiamata / Email / Apri in Gmail (le ultime due condizionali).
5. Retroattivo: prenotazioni esistenti non vengono toccate finché non vengono modificate.
6. Funziona offline: in assenza di rete, il link al contatto viene accodato e risolto al ritorno online.

## Approccio scelto

People API diretta, estendendo lo scope OAuth esistente con `https://www.googleapis.com/auth/contacts`. Nessuna nuova infrastruttura di auth; sfrutta l'`authFetch` di `src/lib/google/auth.ts`. Unica dipendenza nuova: `libphonenumber-js` per la normalizzazione E.164.

Approccio scartato: deep-link a `contacts.google.com` senza API. Scartato perché non permette lookup né lettura di email, quindi non soddisfa i requisiti.

## Modello dati

### `src/types.ts`

Estendere `Prenotazione` con due campi opzionali:

```ts
export interface Prenotazione {
  // ...campi esistenti
  contattoResourceName?: string;  // es. "people/c1234567890"
  contattoEmail?: string;         // cache dell'email dal contatto Google
}
```

- `contattoResourceName` è l'unico campo "vincolante" per il collegamento.
- `contattoEmail` è cache; se manca viene rilettura on-demand quando l'utente apre il popover.
- I campi esistenti `contattoVia` e `contattoValore` non vengono toccati: il numero grezzo inserito dall'utente rimane in `contattoValore`.

### Nuovo tipo in `src/lib/google/people.ts`

```ts
export interface GoogleContact {
  resourceName: string;
  displayName: string;
  phoneE164: string;
  email?: string;
}
```

## Moduli nuovi

### `src/lib/phone.ts`

Utility di normalizzazione basata su `libphonenumber-js`.

```ts
toE164(raw: string, defaultCountry?: 'IT'): string | null
```

Ritorna `null` se il numero non è normalizzabile (es. "casa Mario"). Default country `IT`.

### `src/lib/google/people.ts`

Tre funzioni pubbliche, stesso stile di `sheets.ts` / `drive.ts`:

```ts
searchByPhone(e164: string): Promise<GoogleContact | null>
createContact(input: { name: string; phoneE164: string }): Promise<GoogleContact>
getContact(resourceName: string): Promise<GoogleContact | null>
```

**Implementazione:**
- `searchByPhone`: usa `people.searchContacts?query=<numero>&readMask=names,phoneNumbers,emailAddresses`. Normalizza ogni `phoneNumbers[].value` e confronta con l'input E.164. Se più match, preferisce `primary=true`, altrimenti il primo.
- `createContact`: `POST people:createContact` con `names[0].givenName` e `phoneNumbers[0].value`.
- `getContact`: `people.get` con stesso `readMask`.
- Tutte usano `authFetch` esistente (gestione 401/refresh token già implementata).
- Su 403 (scope mancante) lancia `ScopeError` tipizzato per permettere alla UI di mostrare il re-consent.

**Warmup:** `people.searchContacts` richiede una prima call a vuoto per popolare la cache server-side. Viene chiamata fire-and-forget dopo il bootstrap al login.

### `src/components/common/ContactMenu.tsx`

Popover aperto al click sul numero nella `BookingCard`. Contenuto:

- **📱 WhatsApp** → `https://wa.me/<E164 senza +>` (target `_blank`)
- **📞 Chiama** → `tel:<E164>`
- **✉️ Email** → `mailto:<contattoEmail>` — solo se `contattoEmail` presente
- Separator
- **👤 Apri contatto in Gmail** → `https://contacts.google.com/person/<resourceName-id>` — solo se `contattoResourceName` presente

**Refresh email on-demand:** se `contattoResourceName` esiste ma `contattoEmail` no, al primo render del popover parte un `getContact` in background (con debounce per evitare duplicati); se trovato, aggiorna la booking.

**Accessibilità:** chiusura con Esc, focus trap, posizionamento con Floating UI se già presente nel progetto, fallback CSS absolute altrimenti.

### `src/components/common/ConfirmCreateContactModal.tsx`

Modale di conferma al salvataggio quando il numero non è in rubrica.

- Mostra: nome prenotazione, numero normalizzato E.164.
- Bottoni: **"Aggiungi a Gmail"** / **"No, salta"**.
- Checkbox opzionale: "Non chiedermelo più per questa sessione" (flag non persistente in `store/ui.ts`).

## Modifiche a moduli esistenti

### `src/lib/google/auth.ts`

Aggiungere allo scope OAuth:

```
https://www.googleapis.com/auth/contacts
```

Scope `contacts` (non `contacts.readonly`) perché serve anche creare.

Il proprietario dovrà ri-consentire una volta al prossimo login. Gestire il caso in cui lo scope manca lanciando `ScopeError` dalle funzioni `people.ts`; la UI mostra un toast "Serve ri-autorizzare l'accesso ai contatti" con bottone per il re-consent.

### `src/lib/google/adapter.ts`

Aggiungere due colonne allo schema prenotazioni: `contattoResourceName`, `contattoEmail`. Aggiornare `bookingToRow` e `rowToBooking`.

### `src/lib/google/bootstrap.ts`

Migrazione idempotente: se il sheet esiste e ha già l'header vecchio, appendere le nuove colonne in coda. Se viene creato da zero, usare già lo schema nuovo.

### `src/store/bookings.ts`

Modificare l'action `upsertBooking` (o equivalente submit path). Pseudocodice:

```
1. Valida form (come oggi)
2. Se contattoVia === 'telefono' && contattoValore non vuoto:
     e164 = toE164(contattoValore)
     se e164 è valido E diverso dal numero già salvato:
       try:
         match = await people.searchByPhone(e164)
         se match:
           booking.contattoResourceName = match.resourceName
           booking.contattoEmail = match.email
         altrimenti:
           apri ConfirmCreateContactModal
           se conferma:
             nuovo = await people.createContact({ name: booking.nome, phoneE164: e164 })
             booking.contattoResourceName = nuovo.resourceName
           se annulla: lascia vuoto
       catch offline/network:
         accoda PendingOp { kind: 'people_link', payload: { bookingId, e164 } }
       catch ScopeError:
         toast re-consent, salva senza link
3. Salva booking (IndexedDB + sync queue come oggi)
```

**Casi edge:**
- Numero cambiato in edit → invalida `contattoResourceName` e `contattoEmail`, rifà lookup.
- Numero non normalizzabile → skip silenzioso.
- Read-only mode → skip tutto.

### `src/components/forms/BookingForm.tsx`

Hook nel submit per orchestrare lookup/modale prima di chiamare `upsertBooking`.

### `src/components/common/BookingCard.tsx`

Il `contattoValore` diventa un bottone che apre `ContactMenu`. Accanto al numero: pallino verde se `contattoResourceName` presente, nulla altrimenti.

### `src/store/sync.ts`

Aggiungere nuovo kind a `PendingOp`:

```ts
kind: ... | 'people_link'
payload: { bookingId: string; e164: string }
```

Handler al ritorno online: chiama `searchByPhone`, se trova aggiorna la booking; se no, ignora (niente modale retroattiva).

## Sincronizzazione Google Sheets

I due nuovi campi seguono il normale flusso di `adapter.ts`. Compatibilità retroattiva garantita dalla migrazione in `bootstrap.ts` e dal fatto che i campi sono opzionali.

## Test

Nuovi file in `tests/`:

- `tests/lib/phone.test.ts` — normalizzazione E.164: numeri IT con/senza prefisso, spazi, formati OTA, input non-numerici.
- `tests/lib/google/people.test.ts` — mock di `authFetch`: `searchByPhone` match con normalizzazione, preferenza primary, nessun match, payload di `createContact`, `ScopeError` su 403.
- `tests/store/bookings.test.ts` — esteso: upsert con telefono chiama lookup, numero invariato non ri-chiama API, offline accoda `people_link`, read-only mode non chiama nulla.
- `tests/components/ContactMenu.test.tsx` — rendering condizionale di Email (senza `contattoEmail` assente) e Apri-in-Gmail (senza `contattoResourceName` assente).

## Struttura file finale

```
Nuovi:
  src/lib/phone.ts
  src/lib/google/people.ts
  src/components/common/ContactMenu.tsx
  src/components/common/ConfirmCreateContactModal.tsx
  tests/lib/phone.test.ts
  tests/lib/google/people.test.ts
  tests/components/ContactMenu.test.tsx

Modificati:
  src/types.ts                          (+ 2 campi Prenotazione)
  src/lib/google/auth.ts                (+ scope contacts)
  src/lib/google/adapter.ts             (+ 2 colonne)
  src/lib/google/bootstrap.ts           (migrazione colonne)
  src/store/bookings.ts                 (lookup in upsert)
  src/store/sync.ts                     (+ PendingOp kind 'people_link')
  src/components/forms/BookingForm.tsx  (submit → modale)
  src/components/common/BookingCard.tsx (numero → ContactMenu)
  tests/store/bookings.test.ts          (nuovi casi)
  package.json                          (+ libphonenumber-js)
```

## Fuori scope

- Gestione di contatti multipli che condividono lo stesso numero (si prende il primo match con preferenza `primary`).
- Sincronizzazione bidirezionale: modifiche al contatto in Gmail non si propagano alla booking (solo lettura on-demand di `contattoEmail`).
- Ricerca per email o nome.
- Popolamento retroattivo massivo delle prenotazioni esistenti (solo alla prossima modifica della singola booking).
