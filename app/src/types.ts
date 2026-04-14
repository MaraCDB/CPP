export type Camera = 'lampone' | 'mirtillo';
export type Stato = 'proposta' | 'anticipo_atteso' | 'confermato';
export type ContattoVia = 'telefono' | 'whatsapp' | 'mail' | 'ota';
export type AnticipoTipo = 'bonifico' | 'sito_bb' | 'ota';
export type Tema = 'light' | 'dark' | 'auto';
export type Vista = 'mese' | 'trim' | 'sem' | 'anno';

export interface Anticipo {
  importo: number;
  data?: string;
  tipo?: AnticipoTipo;
}

export interface Prenotazione {
  id: string;
  camera: Camera;
  checkin: string;
  checkout: string;
  stato: Stato;
  nome: string;
  riferimento?: string;
  numOspiti?: number;
  contattoVia?: ContattoVia;
  contattoValore?: string;
  prezzoTotale?: number;
  anticipo?: Anticipo;
  note?: string;
  creatoIl: string;
  aggiornatoIl: string;
}

export interface Chiusura {
  id: string;
  start: string;
  end: string;
  note?: string;
}

export interface Promemoria {
  id: string;
  testo: string;
  createdAt: string;
  done: boolean;
}

export interface Conflict {
  block: boolean;
  msg: string;
}
