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
  contattoResourceName?: string;
  contattoEmail?: string;
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

export interface GoogleUser {
  email: string;
  name: string;
  picture?: string;
}

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error' | 'unauth';

export interface PendingOp {
  id: string;
  kind:
    | 'upsert_booking' | 'delete_booking'
    | 'upsert_closure' | 'delete_closure'
    | 'upsert_promemoria' | 'delete_promemoria'
    | 'upsert_task' | 'delete_task'
    | 'upsert_template' | 'delete_template';
  payload: unknown;
  createdAt: string;
}

export type TemplateAnchor = 'check-in' | 'check-out';

export interface ReminderTemplate {
  id: string;
  builtIn: boolean;
  enabled: boolean;
  title: string;
  description?: string;
  isService: boolean;
  serviceLabel?: string;
  anchor: TemplateAnchor;
  offsetDays: number;
  defaultTime: string; // 'HH:mm'
  notify: boolean;
  sortOrder: number;
}

export type NotificationStatus = 'pending' | 'shown' | 'dismissed' | 'failed';

export interface BookingTask {
  id: string;
  bookingId: string;
  templateId: string | null;
  title: string;
  description?: string;
  dueAt: string; // ISO local datetime
  done: boolean;
  doneAt?: string;
  notes?: string;
  notify: boolean;
  notificationStatus: NotificationStatus;
  notificationShownAt?: string;
  isService: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}
