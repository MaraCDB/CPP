import { createSpreadsheet, writeRange } from './sheets';
import { listCdbSheets } from './drive';
import { BOOKING_HEADERS, CLOSURE_HEADERS, PROMEMORIA_HEADERS } from './adapter';

export const SHEET_NAMES = ['prenotazioni','chiusure','promemoria','impostazioni'];

export const getOrCreateSheet = async (): Promise<string> => {
  const existing = await listCdbSheets();
  if (existing.files?.length) return existing.files[0].id;

  const res = await createSpreadsheet('Cuore di Bosco - Prenotazioni', SHEET_NAMES);
  await writeRange(res.spreadsheetId, 'prenotazioni!A1', [ [...BOOKING_HEADERS] ]);
  await writeRange(res.spreadsheetId, 'chiusure!A1', [ [...CLOSURE_HEADERS] ]);
  await writeRange(res.spreadsheetId, 'promemoria!A1', [ [...PROMEMORIA_HEADERS] ]);
  await writeRange(res.spreadsheetId, 'impostazioni!A1', [ ['chiave','valore'], ['anticipo_default_pct','0.35'] ]);
  return res.spreadsheetId;
};
