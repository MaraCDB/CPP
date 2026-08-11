import { GoogleAuthError, googleFetch } from './token';

const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name';
const LIST   = 'https://www.googleapis.com/drive/v3/files?q=' +
  encodeURIComponent("appProperties has { key='cdb_backup' and value='1' } and trashed=false") +
  '&fields=' + encodeURIComponent('files(id,name,size,createdTime)') +
  '&orderBy=createdTime desc';
const APP_TAG = { cdb_backup: '1' };

export class DriveScopeError extends Error {
  constructor(msg = 'Missing Drive scope or token expired') { super(msg); this.name = 'DriveScopeError'; }
}

/** googleFetch gestisce token e retry; qui traduciamo solo l'errore di auth nel tipo del modulo. */
const driveFetch = async (url: string, init?: RequestInit): Promise<Response> => {
  try {
    return await googleFetch(url, init);
  } catch (e) {
    if (e instanceof GoogleAuthError) throw new DriveScopeError(e.message);
    throw e;
  }
};

export interface DriveBackupMeta {
  id: string;
  name: string;
  size: number;
  createdAt: string;
}

export const uploadToDrive = async (filename: string, bytes: Uint8Array): Promise<string> => {
  const meta = { name: filename, mimeType: 'application/zip', appProperties: APP_TAG };
  const boundary = '----cdbboundary' + Math.random().toString(36).slice(2);
  const enc = new TextEncoder();
  const head = enc.encode(
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify(meta) + `\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/zip\r\n\r\n`,
  );
  const tail = enc.encode(`\r\n--${boundary}--`);
  const body = new Uint8Array(head.length + bytes.length + tail.length);
  body.set(head, 0);
  body.set(bytes, head.length);
  body.set(tail, head.length + bytes.length);

  const res = await driveFetch(UPLOAD, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
  if (res.status === 401 || res.status === 403) throw new DriveScopeError();
  if (!res.ok) throw new Error(`Drive upload ${res.status}: ${await res.text()}`);
  const j = (await res.json()) as { id: string };
  return j.id;
};

export const listDriveBackups = async (): Promise<DriveBackupMeta[]> => {
  const res = await driveFetch(LIST);
  if (res.status === 401 || res.status === 403) throw new DriveScopeError();
  if (!res.ok) throw new Error(`Drive list ${res.status}: ${await res.text()}`);
  const j = (await res.json()) as { files: { id: string; name: string; size?: string; createdTime: string }[] };
  return j.files.map(f => ({
    id: f.id,
    name: f.name,
    size: Number(f.size ?? 0),
    createdAt: f.createdTime,
  }));
};

const LAST_BACKUP_KEY = 'cdb_last_backup';

export const markBackupNow = (): void => {
  localStorage.setItem(LAST_BACKUP_KEY, String(Date.now()));
};

export const lastBackupAt = (): number =>
  Number(localStorage.getItem(LAST_BACKUP_KEY) ?? 0);
