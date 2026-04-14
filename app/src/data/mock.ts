import type { Prenotazione, Chiusura, Promemoria } from '../types';

const NOW = new Date().toISOString();

export const MOCK_BOOKINGS: Prenotazione[] = [
  { id:'1', camera:'lampone', checkin:'2026-04-10', checkout:'2026-04-14', stato:'confermato', nome:'Rossi', riferimento:'#12', numOspiti:3, contattoVia:'mail', contattoValore:'rossi@mail.it', prezzoTotale:320, anticipo:{importo:112,data:'2026-03-20',tipo:'bonifico'}, note:'Arrivo ore 16', creatoIl: NOW, aggiornatoIl: NOW },
  { id:'2', camera:'mirtillo', checkin:'2026-04-11', checkout:'2026-04-13', stato:'anticipo_atteso', nome:'Bianchi', riferimento:'WA', numOspiti:2, contattoVia:'whatsapp', contattoValore:'+39 333...', prezzoTotale:180, anticipo:{importo:63,tipo:'bonifico'}, note:'', creatoIl: NOW, aggiornatoIl: NOW },
  { id:'3', camera:'lampone', checkin:'2026-04-18', checkout:'2026-04-20', stato:'proposta', nome:'Neri', riferimento:'tel', numOspiti:2, contattoVia:'telefono', prezzoTotale:160, note:'Attende conferma ven', creatoIl: NOW, aggiornatoIl: NOW },
  { id:'4', camera:'mirtillo', checkin:'2026-04-22', checkout:'2026-04-26', stato:'confermato', nome:'Colombo', riferimento:'APT', numOspiti:2, contattoVia:'ota', prezzoTotale:360, anticipo:{importo:126,data:'2026-03-28',tipo:'ota'}, note:'Key-box', creatoIl: NOW, aggiornatoIl: NOW },
  { id:'5', camera:'lampone', checkin:'2026-04-25', checkout:'2026-04-28', stato:'anticipo_atteso', nome:'Marchi', riferimento:'WA', numOspiti:3, contattoVia:'whatsapp', prezzoTotale:270, anticipo:{importo:95,tipo:'sito_bb'}, note:'', creatoIl: NOW, aggiornatoIl: NOW },
  { id:'6', camera:'mirtillo', checkin:'2026-05-01', checkout:'2026-05-04', stato:'confermato', nome:'Russo', riferimento:'#15', numOspiti:4, contattoVia:'mail', prezzoTotale:420, anticipo:{importo:147,data:'2026-04-01',tipo:'bonifico'}, note:'Ponte 1 maggio', creatoIl: NOW, aggiornatoIl: NOW },
  { id:'7', camera:'lampone', checkin:'2026-05-08', checkout:'2026-05-11', stato:'proposta', nome:'Gallo', riferimento:'mail', numOspiti:2, contattoVia:'mail', prezzoTotale:220, note:'', creatoIl: NOW, aggiornatoIl: NOW },
  { id:'8', camera:'mirtillo', checkin:'2026-05-15', checkout:'2026-05-18', stato:'confermato', nome:'Esposito', riferimento:'#16', numOspiti:2, contattoVia:'mail', prezzoTotale:240, anticipo:{importo:84,data:'2026-04-05',tipo:'bonifico'}, note:'', creatoIl: NOW, aggiornatoIl: NOW },
  { id:'9', camera:'lampone', checkin:'2026-06-05', checkout:'2026-06-12', stato:'confermato', nome:'Ferrari', riferimento:'#18', numOspiti:3, contattoVia:'mail', prezzoTotale:560, anticipo:{importo:196,data:'2026-04-10',tipo:'bonifico'}, note:'Settimana completa', creatoIl: NOW, aggiornatoIl: NOW },
  { id:'10', camera:'mirtillo', checkin:'2026-07-20', checkout:'2026-07-27', stato:'anticipo_atteso', nome:'Greco', riferimento:'#20', numOspiti:4, contattoVia:'whatsapp', prezzoTotale:700, anticipo:{importo:245,tipo:'bonifico'}, note:'Agosto pieno', creatoIl: NOW, aggiornatoIl: NOW },
];

export const MOCK_CLOSURES: Chiusura[] = [
  { id:'c1', start:'2026-06-20', end:'2026-06-28', note:'Vacanza famiglia in Sardegna' },
  { id:'c2', start:'2026-11-01', end:'2026-11-30', note:'Chiusura stagionale' },
];

export const MOCK_PROMEMORIA: Promemoria[] = [
  { id:'p1', testo:'Chiamare Verdi per conferma anticipo', createdAt:'2026-04-12T10:00:00', done:false },
  { id:'p2', testo:'Richiedere preventivo lavanderia', createdAt:'2026-04-13T15:20:00', done:true },
];
