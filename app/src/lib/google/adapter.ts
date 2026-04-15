import type { Prenotazione, Chiusura, Promemoria, Camera, Stato, ContattoVia, AnticipoTipo } from '../../types';

export const BOOKING_HEADERS = [
  'id','camera','checkin','checkout','stato','nome','riferimento','num_ospiti',
  'contatto_via','contatto_valore','prezzo_totale','anticipo_importo','anticipo_data','anticipo_tipo',
  'note','creato_il','aggiornato_il',
] as const;

export const CLOSURE_HEADERS = ['id','start','end','note'] as const;
export const PROMEMORIA_HEADERS = ['id','testo','created_at','done'] as const;

const opt = (s: string | undefined) => s ?? '';
const optN = (n: number | undefined) => n != null ? String(n) : '';

export const bookingToRow = (b: Prenotazione): string[] => [
  b.id, b.camera, b.checkin, b.checkout, b.stato, b.nome, opt(b.riferimento), optN(b.numOspiti),
  opt(b.contattoVia), opt(b.contattoValore), optN(b.prezzoTotale),
  optN(b.anticipo?.importo), opt(b.anticipo?.data), opt(b.anticipo?.tipo),
  opt(b.note), b.creatoIl, b.aggiornatoIl,
];

export const rowToBooking = (r: string[]): Prenotazione => {
  const anticipoImporto = r[11] ? Number(r[11]) : undefined;
  return {
    id: r[0], camera: r[1] as Camera, checkin: r[2], checkout: r[3],
    stato: r[4] as Stato, nome: r[5], riferimento: r[6] || undefined,
    numOspiti: r[7] ? Number(r[7]) : undefined,
    contattoVia: (r[8] || undefined) as ContattoVia | undefined,
    contattoValore: r[9] || undefined,
    prezzoTotale: r[10] ? Number(r[10]) : undefined,
    anticipo: anticipoImporto != null ? {
      importo: anticipoImporto,
      data: r[12] || undefined,
      tipo: (r[13] || undefined) as AnticipoTipo | undefined,
    } : undefined,
    note: r[14] || undefined,
    creatoIl: r[15], aggiornatoIl: r[16],
  };
};

export const closureToRow = (c: Chiusura): string[] => [c.id, c.start, c.end, opt(c.note)];
export const rowToClosure = (r: string[]): Chiusura => ({
  id: r[0], start: r[1], end: r[2], note: r[3] || undefined,
});

export const promemoriaToRow = (p: Promemoria): string[] => [p.id, p.testo, p.createdAt, p.done ? '1' : '0'];
export const rowToPromemoria = (r: string[]): Promemoria => ({
  id: r[0], testo: r[1], createdAt: r[2], done: r[3] === '1',
});
