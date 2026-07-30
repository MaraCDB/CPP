# Notifiche consolidate — design

**Data:** 2026-07-30

## Problema

Le notifiche dei promemoria automatici (generati dai template per ogni prenotazione: prepara camera, check-in, documenti, ricevuta, ecc.) arrivano a raffica, spesso duplicate, e ricompaiono a distanza di giorni in blocco invece che quando servirebbe. Causa: due percorsi indipendenti generano una notifica OS **per ogni singolo task** scaduto:

- **Foreground** ([foregroundScheduler.ts](../../../app/src/lib/notifications/foregroundScheduler.ts) + [App.tsx:63-86](../../../app/src/App.tsx#L63-L86)): un `setTimeout` per task, con `cancelAll()` + reschedule totale a ogni mutazione dello store e a ogni cambio di visibilità della tab. Genera code di notifiche quando più task condividono lo stesso orario di default (es. più promemoria alle 21:00) e "tempesta" il proprio stato a ogni piccola modifica.
- **Background** ([sw.ts:37-60](../../../app/src/sw.ts#L37-L60)): il gestore `periodicsync` (tag `check-overdue-tasks`, `minInterval: 6h`) cicla su tutti i task scaduti e chiama `showNotification` una volta per ciascuno. Il `periodicSync` del browser non ha un orario garantito (specialmente su Android/Chrome con euristiche di engagement; su iOS Safari/Firefox non è supportato affatto) — quando finalmente scatta, può presentare in blocco tutti i task accumulati nelle ore/giorni precedenti.

Inoltre non esiste oggi nessuna vista che raggruppi i promemoria automatici scaduti across-booking: l'unico modo per vederli era la notifica stessa o aprire singolarmente ogni prenotazione ([BookingFormReminders.tsx](../../../app/src/components/forms/BookingFormReminders.tsx)).

## Scope

1. Consolidare la consegna in un'unica notifica OS di riepilogo, generata solo in background dal service worker.
2. Rimuovere del tutto le notifiche OS generate in foreground (ridondanti quando l'app è già aperta, e causa della "tempesta di reschedule").
3. Aggiungere una vista in-app (banner in Home + sezione nel pannello "Da fare") per vedere e spuntare i promemoria automatici scaduti, così l'utente non dipende dalla notifica per accorgersene.

Esplicitamente fuori scope: un vero backend di Web Push (risolverebbe l'inaffidabilità del `periodicSync` su iOS/Firefox, ma è un progetto a parte); cambi allo schema `BookingTask` o ai template dei promemoria; snooze/mute per singolo task.

## 1. Consegna in background (service worker)

In [sw.ts](../../../app/src/sw.ts), il gestore `periodicsync`:

- Legge i task, filtra gli scaduti-non-notificati con `pickToNotify` (invariato — il flip `pending → shown` è già il meccanismo di dedup: un task già mostrato non viene ripescato al giro successivo).
- Se la lista non è vuota, chiama **una sola** `showNotification`:
  - Titolo: `"N promemoria da controllare"` (singolare se N=1).
  - Corpo: elenco compatto (primi 2-3 titoli + "e altri N" se servono).
  - `tag: 'overdue-digest'` fisso — se per qualche motivo arrivano due notifiche vicine, la seconda sostituisce la prima invece di accumularsi in tray.
  - `data` senza `bookingId`/`taskId` (è un riepilogo, non un singolo task).
- Marca tutti i task inclusi come `notificationStatus: 'shown'`, come oggi.

`notificationclick` per il tag digest apre/porta in primo piano l'app sulla home semplice, senza deep-link a una prenotazione specifica.

## 2. Rimozione delle notifiche in foreground

- Rimosso [foregroundScheduler.ts](../../../app/src/lib/notifications/foregroundScheduler.ts) (intero modulo: `scheduleTask`/`cancelTask`/`cancelAll`/`getActiveCount`).
- Rimosso l'`useEffect` in [App.tsx:63-86](../../../app/src/App.tsx#L63-L86) che lo usa.

Effetto collaterale: `notificationStatus`/`notificationShownAt` sono scritti solo dal service worker (single writer), eliminando anche la race tra le due scritture concorrenti (main thread `mirrorAll` vs SW `writeTasks`) segnalata in fase di esplorazione.

## 3. Banner in Home + checklist "scaduti"

Nuovo helper condiviso, es. `app/src/lib/reminders/overdueTasks.ts`:

```ts
export const overdueTasks = (tasks: BookingTask[], now: Date): BookingTask[] =>
  tasks.filter(t => !t.done && !t.deletedAt && new Date(t.dueAt).getTime() <= now.getTime());
```

(Nota: non riusa `pickToNotify` perché quest'ultimo filtra anche su `notify`/`notificationStatus === 'pending'` — qui interessa il lavoro da fare, non lo stato della notifica push.)

**Home** ([Home.tsx](../../../app/src/components/Home.tsx)): sopra ai pulsanti principali, se `overdueTasks(items, now).length > 0`, appare una fascia cliccabile "⚠️ N promemoria scaduti" nello stesso stile discreto degli altri contatori. Click → `goCalendar(); openSide({ kind: 'todo' })` (stesso pattern già usato da `goArrivi`). Il conteggio si ricalcola ogni 60s con un piccolo `setInterval` locale, così resta corretto anche ad app aperta senza bisogno di notifiche OS.

**TodoPanel** ([TodoPanel.tsx](../../../app/src/components/panels/TodoPanel.tsx)): nuova sezione "⏰ Promemoria scaduti (N)" che elenca i task da `overdueTasks`, con titolo, nome ospite/camera della prenotazione collegata (lookup su `useBookings`), e checkbox che chiama `useTasks.getState().toggleDone(id)`.

**BottomBar** ([BottomBar.tsx](../../../app/src/components/calendar/BottomBar.tsx)): il badge del pulsante "Da fare" include anche il conteggio di `overdueTasks` (oggi conta solo note manuali + prenotazioni da confermare).

## Test

- [periodicSync.test.ts](../../../app/tests/lib/sw/periodicSync.test.ts): con N task scaduti, `showNotification` chiamato una sola volta con titolo/corpo aggregato e `tag: 'overdue-digest'`; tutti gli N task marcati `shown`.
- [foregroundScheduler.test.ts](../../../app/tests/lib/notifications/foregroundScheduler.test.ts): rimosso insieme al modulo.
- Nuovo `overdueTasks.test.ts`: casi base (task scaduto/non scaduto/done/deletedAt).
- Nuovo test minimo per `TodoPanel`: la sezione scaduti compare con i task giusti; click sulla checkbox chiama `toggleDone`.
- Nuovo test minimo per `Home`: banner assente con N=0, presente con N>0, click naviga+apre il pannello.
- Suite completa (`npx vitest run`) e `tsc --noEmit` verdi a fine lavoro.

## File toccati

- `app/src/sw.ts` (modifica)
- `app/src/lib/notifications/foregroundScheduler.ts` (rimosso)
- `app/src/App.tsx` (rimozione effect + import)
- `app/src/lib/reminders/overdueTasks.ts` (nuovo)
- `app/src/components/Home.tsx` (banner)
- `app/src/components/panels/TodoPanel.tsx` (nuova sezione)
- `app/src/components/calendar/BottomBar.tsx` (badge aggiornato)
- `app/tests/lib/sw/periodicSync.test.ts` (aggiornato)
- `app/tests/lib/notifications/foregroundScheduler.test.ts` (rimosso)
- `app/tests/lib/reminders/overdueTasks.test.ts` (nuovo)
- `app/tests/components/TodoPanel.test.tsx` (nuovo)
- `app/tests/components/Home.test.tsx` (esteso)
