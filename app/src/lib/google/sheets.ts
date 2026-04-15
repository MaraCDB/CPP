import { useAuth } from '../../store/auth';

const BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

const tokenOrThrow = () => {
  const t = useAuth.getState().accessToken;
  if (!t) throw new Error('No access token');
  return t;
};

const call = async <T = unknown>(url: string, init: RequestInit = {}): Promise<T> => {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${tokenOrThrow()}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`Sheets API ${res.status}: ${await res.text()}`);
  return res.json();
};

export interface SheetCreateResponse {
  spreadsheetId: string;
  spreadsheetUrl: string;
}

export const createSpreadsheet = (title: string, sheetTitles: string[]) =>
  call<SheetCreateResponse>(BASE, {
    method: 'POST',
    body: JSON.stringify({
      properties: { title },
      sheets: sheetTitles.map(t => ({ properties: { title: t } })),
    }),
  });

export const readRange = (spreadsheetId: string, range: string) =>
  call<{ values?: string[][] }>(`${BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}`);

export const writeRange = (spreadsheetId: string, range: string, values: unknown[][]) =>
  call(`${BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values }),
  });

export const appendRow = (spreadsheetId: string, range: string, values: unknown[][]) =>
  call(`${BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
    method: 'POST',
    body: JSON.stringify({ values }),
  });

export const clearRange = (spreadsheetId: string, range: string) =>
  call(`${BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}:clear`, { method: 'POST' });
