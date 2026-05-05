import type { ReminderTemplate } from '../../types';

export const DEFAULT_TEMPLATES: ReminderTemplate[] = [
  {
    id: 'preparation', builtIn: true, enabled: true,
    title: 'Prepara camera per {adulti}A {bambini}B',
    isService: false, anchor: 'check-in', offsetDays: -1,
    defaultTime: '14:00', notify: true, sortOrder: 10,
  },
  {
    id: 'check-in-today', builtIn: true, enabled: true,
    title: 'Check-in oggi alle {oraArrivo}',
    isService: false, anchor: 'check-in', offsetDays: 0,
    defaultTime: '00:00', notify: true, sortOrder: 20,
  },
  {
    id: 'documents', builtIn: true, enabled: true,
    title: 'Registra documenti Alloggiati Web',
    isService: false, anchor: 'check-in', offsetDays: 0,
    defaultTime: '21:00', notify: true, sortOrder: 30,
  },
  {
    id: 'receipt-issue', builtIn: true, enabled: true,
    title: 'Emetti ricevuta',
    isService: false, anchor: 'check-in', offsetDays: 0,
    defaultTime: '21:00', notify: true, sortOrder: 31,
  },
  {
    id: 'receipt-print', builtIn: true, enabled: true,
    title: 'Stampa copia ricevuta',
    isService: false, anchor: 'check-in', offsetDays: 0,
    defaultTime: '21:00', notify: true, sortOrder: 32,
  },
  {
    id: 'tourism-tax', builtIn: true, enabled: true,
    title: 'Registro tassa di soggiorno',
    isService: false, anchor: 'check-in', offsetDays: 0,
    defaultTime: '21:00', notify: true, sortOrder: 33,
  },
  {
    id: 'istat-questura', builtIn: true, enabled: true,
    title: 'ISTAT + scarica ricevuta questura',
    isService: false, anchor: 'check-in', offsetDays: 2,
    defaultTime: '10:00', notify: true, sortOrder: 40,
  },
  {
    id: 'merenda', builtIn: true, enabled: true,
    title: 'Preparare merenda',
    isService: true, serviceLabel: 'Merenda',
    anchor: 'check-in', offsetDays: 0,
    defaultTime: '16:30', notify: true, sortOrder: 50,
  },
  {
    id: 'cena', builtIn: true, enabled: true,
    title: 'Preparare cena',
    isService: true, serviceLabel: 'Cena',
    anchor: 'check-in', offsetDays: 0,
    defaultTime: '19:30', notify: true, sortOrder: 60,
  },
];
