import { createSpreadsheet, writeRange } from './sheets';
import { listCdbSheets } from './drive';
import { BOOKING_HEADERS, CLOSURE_HEADERS, PROMEMORIA_HEADERS } from './adapter';

export const SHEET_NAMES = ['prenotazioni','chiusure','promemoria','impostazioni'];

const ensureHeaders = async (sid: string) => {
  await writeRange(sid, 'prenotazioni!A1', [ [...BOOKING_HEADERS] ]);
  await writeRange(sid, 'chiusure!A1', [ [...CLOSURE_HEADERS] ]);
  await writeRange(sid, 'promemoria!A1', [ [...PROMEMORIA_HEADERS] ]);
};

export const getOrCreateSheet = async (): Promise<string> => {
  const existing = await listCdbSheets();
  if (existing.files?.length) {
    const sid = existing.files[0].id;
    await ensureHeaders(sid);
    return sid;
  }

  const res = await createSpreadsheet('Cuore di Bosco - Prenotazioni', SHEET_NAMES);
  await ensureHeaders(res.spreadsheetId);
  await writeRange(res.spreadsheetId, 'impostazioni!A1', [ ['chiave','valore'], ['anticipo_default_pct','0.35'] ]);
  return res.spreadsheetId;
};
