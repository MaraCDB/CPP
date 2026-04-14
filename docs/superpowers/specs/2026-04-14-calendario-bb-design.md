# Calendario Cuore di Bosco — Design Document

**Data**: 2026-04-14
**Stato**: approvato dopo brainstorming + prototipo validato
**Prototipo**: [prototipo-calendario.html](../../../prototipo-calendario.html)

---

## 1. Obiettivo

Un'app web **mobile-first** per gestire le prenotazioni di un B&B a 2 camere (Lampone / Mirtillo). Standalone, visivamente efficace, usabile in 2 secondi durante una telefonata, condivisibile in sola lettura con la famiglia.

**Non-obiettivi**: fatturazione, statistiche, multi-struttura, email/notifiche automatiche, opzioni con scadenza (tutte rimandate a versioni successive).

---

## 2. Architettura

### Stack
| Livello | Tecnologia | Ragione |
|---|---|---|
| UI | **React + Vite + TypeScript** | Veloce, leggero, ottimo DX |
| Stile | **Tailwind CSS + CSS variables** | Mobile-first + temi |
| Storage | **Google Sheets API** (OAuth2) | Zero backend, condivisibile |
| Auth | **Google Identity Services (GSI)** | Un click, niente password |
| Cache offline | **IndexedDB** | Lettura offline, queue scrittura |
| PWA | **Manifest + Service Worker** | Installabile come app nativa |
| Hosting | **GitHub Pages** o Netlify | Gratis, deploy automatico su push |

### Principio
L'app è **100% client-side**. Il Foglio Google è il database. Nessun server custom da gestire. Tutto il tier gratuito di Google copre ampiamente i volumi di un B&B a 2 camere.

### Flusso dati
```
User (mobile/desktop)
  ↓ OAuth2
Google Identity
  ↓ access token
Google Sheets API  ←→  cdb-prenotazioni.xlsx (su Drive dell'utente)
  ↑
IndexedDB (cache locale, queue scrittura offline)
```

---

## 3. Modello dati

### 3.1 `Prenotazione`
```typescript
interface Prenotazione {
  id: string;              // UUID generato client-side
  camera: 'lampone' | 'mirtillo';
  checkin: string;         // ISO date YYYY-MM-DD
  checkout: string;        // ISO date YYYY-MM-DD (non incluso)
  stato: 'proposta' | 'anticipo_atteso' | 'confermato';
  nome: string;
  riferimento?: string;    // es. "#12", "Booking", "WA"
  numOspiti?: number;      // 1-4
  contattoVia?: 'telefono' | 'whatsapp' | 'mail' | 'ota';
  contattoValore?: string; // telefono o email
  prezzoTotale?: number;   // €
  anticipo?: {
    importo: number;       // € (default: prezzoTotale * 0.35)
    data?: string;         // ISO date — ricevuto o atteso
    tipo?: 'bonifico' | 'sito_bb' | 'ota';
  };
  note?: string;
  creatoIl: string;        // ISO datetime
  aggiornatoIl: string;    // ISO datetime
}
```

Notti = `checkout - checkin` (calcolato, mai salvato).

### 3.2 `Chiusura`
```typescript
interface Chiusura {
  id: string;
  start: string;           // ISO date (incluso)
  end: string;             // ISO date (incluso)
  note?: string;           // motivo (es. "Vacanza famiglia")
}
```

Copre sempre **entrambe le camere**. Non esiste chiusura per-camera.

### 3.3 `Promemoria`
```typescript
interface Promemoria {
  id: string;
  testo: string;           // nota libera
  createdAt: string;       // ISO datetime
  done: boolean;
}
```

Note manuali scrivibili al volo (es. durante una telefonata per richiesta preventivo).

### 3.4 `Impostazioni`
Chiave/valore, per estensibilità futura:
- `anticipo_default_pct` → `0.35`
- `camere` → `['lampone','mirtillo']` (hardcoded per v1, qui per estendibilità)

---

## 4. Google Sheets schema

Un singolo Google Sheet creato automaticamente al primo login (nome: `Cuore di Bosco - Prenotazioni`), con 4 tab:

### Tab `prenotazioni`
Colonne:
`id | camera | checkin | checkout | stato | nome | riferimento | num_ospiti | contatto_via | contatto_valore | prezzo_totale | anticipo_importo | anticipo_data | anticipo_tipo | note | creato_il | aggiornato_il`

### Tab `chiusure`
`id | start | end | note`

### Tab `promemoria`
`id | testo | created_at | done`

### Tab `impostazioni`
`chiave | valore`

**Condivisione**: l'utente condivide il foglio in **sola lettura** con gli indirizzi Gmail della famiglia tramite il dialog nativo di Drive. L'app rileva i permessi al login e disattiva i controlli di modifica per chi ha solo accesso in lettura.

---

## 5. Interfaccia utente

### 5.1 Navigazione — pagina Home all'avvio
All'apertura dell'app si vede una home con 3 bottoni grandi:

| Bottone | Funzione | Badge |
|---|---|---|
| **🔔 Da fare** | Apre pannello promemoria + proposte/anticipi aperti | Numero elementi aperti |
| **📅 Calendario** | Apre la vista calendario | — |
| **🧳 Arrivi** | Apre pannello prossimi arrivi (30 giorni) | Numero arrivi |

Toggle tema 🌓 in alto a destra. Logo tondo con gradient Lampone→Mirtillo.

### 5.2 Vista Calendario — 4 viste temporali

| Vista | Layout | Testo nelle barre |
|---|---|---|
| **Mese** (default) | Griglia tipo Google Calendar: 7 colonne Lun-Dom, celle con **Lampone sinistra / Mirtillo destra** affiancate | Nome + riferimento |
| **Trimestre** | Gantt verticale: colonne = mesi, righe = giorni, sottocolonne 🍇\|🫐 per camera | Nome + riferimento |
| **Semestre** | Stesso Gantt verticale, righe compresse | Solo colore |
| **Anno** | Stesso Gantt, righe minuscole (heatmap-like) | Solo colore |

**Navigazione temporale**: frecce ◀▶, bottone "Oggi", **swipe orizzontale** (solo vista Mese) per mese precedente/successivo.

### 5.3 Stati visivi delle prenotazioni
| Stato | Aspetto barra |
|---|---|
| **Confermato** | Pieno colorato (rosa Lampone / blu Mirtillo) |
| **Anticipo atteso** | Colore chiaro della camera + bordino giallo ⚠ |
| **Proposta** | Pattern tratteggiato grigio + bordino colore camera |

Nome e riferimento visibili nel Mese e Trimestre; nascosti nel Semestre/Anno (solo colori).

### 5.4 Chiusura struttura
- Sfondo **grigio tratteggiato** sulla riga-giorno (entrambe le camere)
- Bordino scuro sul primo e ultimo giorno del periodo
- Icona 🔒 su eventuali prenotazioni dentro periodo chiuso (ospiti famiglia/amici)
- Click su banner chiusura nel pannello giorno → modifica chiusura

### 5.5 Flussi di interazione

| Azione | Risultato |
|---|---|
| Click su giorno vuoto | Pannello "dettaglio giorno" con stato entrambe camere + bottone "Nuova per questo giorno" |
| Click su barra prenotazione | Modal di modifica |
| Click su cella in periodo chiuso | Pannello dettaglio con banner chiusura visibile |
| Bottone ➕ Nuova | Modal di creazione con data oggi |
| Bottone 🔒 Chiusura | Modal di chiusura (date + nota) |
| Bottone 🏠 in topbar | Torna alla home |

### 5.6 Form prenotazione
Campi in una schermata unica (non wizard):
- Camera (chip group)
- Check-in / Check-out (conteggio notti auto)
- Nome ospite / Riferimento
- N° ospiti / Stato
- Come ti hanno contattato (chip: telefono/whatsapp/mail/OTA)
- Recapito (tel/email)
- Prezzo totale / Anticipo (auto-compilato a 35%, editabile)
- Data anticipo / Tipo anticipo (bonifico/sito_bb/ota)
- Note libere

Su mobile: modal **bottom-sheet** a tutta larghezza.

### 5.7 Logica sovrapposizioni
| Situazione | Comportamento |
|---|---|
| Due confermate (o confermato+anticipo_atteso) nella stessa camera si sovrappongono | 🔴 **BLOCCA** salvataggio |
| Proposta si sovrappone con confermata/anticipo_atteso | 🟡 **AVVISA** ma permette (doppia conferma) |
| Due proposte si sovrappongono | ⚪ **NESSUN CHECK** (per design: chi conferma per primo vince) |
| Promozione proposta→confermata con altre proposte sovrapposte | 🟠 **RICORDA** di avvisare gli altri (con elenco nomi) |
| Qualsiasi prenotazione in periodo chiuso | 🔒 **AVVISA** "struttura chiusa", permette con doppia conferma |

### 5.8 Pannello "Da fare"
Ordine dall'alto al basso:
1. **Input rapido** per aggiungere una nota libera (enter per salvare)
2. **📌 Note manuali aperte** (promemoria non ancora fatti)
3. **⏳ Da confermare / anticipi attesi** (derivati dalle prenotazioni)
4. **✓ Fatte** (storico promemoria completati)

Le note hanno checkbox per marcarle fatte e × per eliminarle.

### 5.9 Pannello "Arrivi"
Prossimi 10 arrivi confermati/anticipo-atteso entro 30 giorni, ordinati per data check-in.

---

## 6. Mobile-first

Target primario: **telefono in portrait, larghezza 360-430px**. Desktop è progressive enhancement.

- **Viewport**: `width=device-width, viewport-fit=cover`, safe-area insets (notch iPhone, home indicator)
- **Touch targets ≥ 40px** per bottoni, chip, checkbox
- **Input font-size ≥ 16px** per evitare auto-zoom iOS
- **Tap highlight** rimosso, overscroll contenuto
- **View switch** con etichette corte (M/T/S/A) sotto 640px
- **Bottom bar** con solo icone sotto 420px
- **Modal**: bottom-sheet a tutta larghezza su mobile
- **Swipe**: navigazione mese precedente/successivo in vista Mese
- **Colonne Gantt** strette su mobile (Trim 190px, Sem 120px, Anno 82px)

### Installazione PWA
- Manifest con icone 192/512
- Service worker con cache offline (app shell + dati letti recentemente)
- Banner "Aggiungi a schermata Home" al secondo uso
- A tutto schermo (`display: standalone`)
- Status bar tinta verde (`theme-color`)

### Sync e offline
- **Lettura**: da IndexedDB prima (istantanea), poi refresh da Sheets in background
- **Scrittura**: ottimistica su IndexedDB + queue di chiamate Sheets; se offline, si svuota al ritorno online
- **Indicatore stato** in topbar: 🟢 sincronizzato / 🟡 in corso / 🔴 offline (N in coda)
- **Pull-to-refresh** in home per forzare sync

---

## 7. Tema

### Brand colors
- **Brand principale**: verde bosco (#2E8F5C chiaro / #4BBF85 scuro) — bottoni primari, focus, "oggi"
- **Lampone** (camera): rosa/fucsia (#E8528B chiaro / #FF7AAF scuro)
- **Mirtillo** (camera): blu/viola (#5B6FD6 chiaro / #869AF0 scuro)

### Toggle
Cicla: **☀️ Chiaro → 🌙 Scuro → 🌓 Auto** (segue sistema). Preferenza in `localStorage`. In modalità auto, reagisce live a cambio sistema via `prefers-color-scheme`.

### Tokens CSS
Tutti i colori sono variabili CSS (`--brand`, `--card`, `--ink`, `--surface-2`, `--pill-conf-bg`, ecc.) con override `[data-theme="dark"]`. Nessun colore hard-coded nell'HTML.

---

## 8. Condivisione famiglia (read-only)

1. Utente (proprietaria) apre Drive → condivide `Cuore di Bosco - Prenotazioni` in **sola lettura** con email della famiglia
2. Utente manda il link dell'app su WhatsApp
3. Familiare apre l'app, login Google
4. App legge i permessi del foglio via Drive API
5. Se `role === 'reader'`: nasconde bottoni ➕, 🔒, × e disabilita il form. Stesso calendario visivo, ma read-only.

---

## 9. Architettura componenti (React)

```
src/
├── main.tsx
├── App.tsx
├── components/
│   ├── Home.tsx                    # pagina iniziale 3-bottoni
│   ├── Topbar.tsx                  # barra superiore calendario
│   ├── BottomBar.tsx               # barra inferiore calendario
│   ├── calendar/
│   │   ├── CalendarView.tsx        # router tra le 4 viste
│   │   ├── MonthGoogleView.tsx     # vista mese Google-style
│   │   └── VerticalGanttView.tsx   # vista Trim/Sem/Anno
│   ├── panels/
│   │   ├── DayDetailPanel.tsx      # dettaglio giorno
│   │   ├── TodoPanel.tsx           # Da fare
│   │   └── ArrivalsPanel.tsx       # Arrivi
│   ├── forms/
│   │   ├── BookingForm.tsx
│   │   └── ClosureForm.tsx
│   └── common/
│       ├── Sidebar.tsx             # slide-in destro
│       ├── Modal.tsx               # bottom-sheet mobile
│       └── ThemeToggle.tsx
├── store/
│   ├── bookings.ts                 # Zustand
│   ├── closures.ts
│   ├── promemoria.ts
│   └── settings.ts
├── lib/
│   ├── google-sheets.ts            # wrapper API
│   ├── google-auth.ts              # GSI
│   ├── indexeddb.ts                # cache
│   ├── sync.ts                     # orchestrazione sync + queue
│   ├── conflicts.ts                # logica sovrapposizioni
│   └── date.ts                     # helpers date ISO
├── types.ts                        # interfaces
└── sw.ts                           # service worker
```

---

## 10. Out of scope (v1)

Esplicitamente **non facciamo** in prima versione:
- Export CSV/PDF
- Statistiche / grafici occupazione
- Multi-lingua (solo italiano)
- Opzioni con scadenza (validità offerta)
- Fatture / ricevute
- Email / notifiche automatiche
- Più di 2 camere (hardcoded Lampone/Mirtillo, con hook in `impostazioni` per futuro)
- Drag-and-drop per spostare prenotazioni
- Ricerca/filtri (con 2 camere e poche centinaia di prenotazioni/anno non serve)

---

## 11. Criteri di successo

L'app è considerata pronta quando:
1. ✅ Utente può creare/modificare/eliminare prenotazioni in tutti e 3 gli stati
2. ✅ Utente può creare periodi di chiusura con avviso su booking in sovrapposizione
3. ✅ Sovrapposizioni confermate bloccate, proposte avvisate
4. ✅ Promemoria manuali rapidi funzionanti
5. ✅ Tutte le 4 viste (Mese/Trim/Sem/Anno) leggibili su 360px di larghezza
6. ✅ Tema chiaro/scuro/auto funzionante
7. ✅ Sync bidirezionale Google Sheets con cache offline
8. ✅ Installabile come PWA
9. ✅ Modalità read-only automatica per utenti con permesso `reader`
10. ✅ Deploy su GitHub Pages con dominio o subdomain scelto
