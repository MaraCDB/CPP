import { useAuth } from '../../store/auth';

const DRIVE = 'https://www.googleapis.com/drive/v3';

const call = async <T = unknown>(url: string, init: RequestInit = {}): Promise<T> => {
  const t = useAuth.getState().accessToken;
  if (!t) throw new Error('No access token');
  const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json', ...(init.headers || {}) } });
  if (!res.ok) throw new Error(`Drive API ${res.status}: ${await res.text()}`);
  return res.json();
};

export const getFileMetadata = (fileId: string) =>
  call<{ id: string; name: string; capabilities: { canEdit: boolean } }>(`${DRIVE}/files/${fileId}?fields=id,name,capabilities(canEdit)`);

export const listCdbSheets = () =>
  call<{ files: { id: string; name: string }[] }>(`${DRIVE}/files?q=${encodeURIComponent("name='Cuore di Bosco - Prenotazioni' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false")}&fields=files(id,name)`);
