import { readRange, writeRange, clearRange } from './google/sheets';
import { getFileMetadata } from './google/drive';
import { getOrCreateSheet } from './google/bootstrap';
import {
  bookingToRow, rowToBooking, closureToRow, rowToClosure, promemoriaToRow, rowToPromemoria,
} from './google/adapter';
import { useBookings } from '../store/bookings';
import { useClosures } from '../store/closures';
import { usePromemoria } from '../store/promemoria';
import { useAuth } from '../store/auth';
import { useSync } from '../store/sync';
import { idbGet, idbSet } from './idb';
import { uid } from './id';
import type { Prenotazione, Chiusura, Promemoria, PendingOp } from '../types';

const QUEUE_KEY = 'queue';

const loadQueue = async () => {
  const q = await idbGet<PendingOp[]>('settings', QUEUE_KEY);
  if (q) useSync.getState().setQueue(q);
};
const persistQueue = async () => idbSet('settings', QUEUE_KEY, useSync.getState().queue);

export const enqueue = async (kind: PendingOp['kind'], payload: unknown) => {
  const op: PendingOp = { id: uid('op'), kind, payload, createdAt: new Date().toISOString() };
  useSync.getState().enqueue(op);
  await persistQueue();
  void processQueue();
};

const applyOp = async (sid: string, op: PendingOp) => {
  if (op.kind.includes('booking')) {
    const items = useBookings.getState().items.map(bookingToRow);
    await clearRange(sid, 'prenotazioni!A2:Z');
    if (items.length) await writeRange(sid, 'prenotazioni!A2', items);
  } else if (op.kind.includes('closure')) {
    const items = useClosures.getState().items.map(closureToRow);
    await clearRange(sid, 'chiusure!A2:Z');
    if (items.length) await writeRange(sid, 'chiusure!A2', items);
  } else if (op.kind.includes('promemoria')) {
    const items = usePromemoria.getState().items.map(promemoriaToRow);
    await clearRange(sid, 'promemoria!A2:Z');
    if (items.length) await writeRange(sid, 'promemoria!A2', items);
  }
};

const processQueue = async () => {
  const { spreadsheetId, queue, status } = useSync.getState();
  if (!spreadsheetId || status === 'syncing' || status === 'offline' || status === 'unauth') return;
  if (queue.length === 0) { useSync.getState().setStatus('idle'); return; }

  useSync.getState().setStatus('syncing');
  for (const op of [...queue]) {
    try {
      await applyOp(spreadsheetId, op);
      useSync.getState().removeOp(op.id);
      await persistQueue();
    } catch {
      if (!navigator.onLine) useSync.getState().setStatus('offline');
      else useSync.getState().setStatus('error');
      return;
    }
  }
  useSync.getState().setStatus('idle');
};

export const fullPull = async () => {
  const { spreadsheetId } = useSync.getState();
  if (!spreadsheetId) return;
  useSync.getState().setStatus('syncing');
  try {
    const [b, c, p] = await Promise.all([
      readRange(spreadsheetId, 'prenotazioni!A2:Z'),
      readRange(spreadsheetId, 'chiusure!A2:Z'),
      readRange(spreadsheetId, 'promemoria!A2:Z'),
    ]);
    const bookings = (b.values || []).filter(r => r[0]).map(rowToBooking);
    const closures = (c.values || []).filter(r => r[0]).map(rowToClosure);
    const promemoria = (p.values || []).filter(r => r[0]).map(rowToPromemoria);
    useBookings.setState({ items: bookings });
    useClosures.setState({ items: closures });
    usePromemoria.setState({ items: promemoria });
    await Promise.all([
      idbSet('bookings', 'all', bookings),
      idbSet('closures', 'all', closures),
      idbSet('promemoria', 'all', promemoria),
    ]);
    useSync.getState().setStatus('idle');
  } catch {
    if (!navigator.onLine) useSync.getState().setStatus('offline');
    else useSync.getState().setStatus('error');
  }
};

export const hydrateFromCache = async () => {
  const [b, c, p] = await Promise.all([
    idbGet<Prenotazione[]>('bookings', 'all'),
    idbGet<Chiusura[]>('closures', 'all'),
    idbGet<Promemoria[]>('promemoria', 'all'),
  ]);
  if (b) useBookings.setState({ items: b });
  if (c) useClosures.setState({ items: c });
  if (p) usePromemoria.setState({ items: p });
};

export const bootSync = async () => {
  await loadQueue();
  await hydrateFromCache();
  const sid = await getOrCreateSheet();
  useSync.getState().setSpreadsheetId(sid);
  const meta = await getFileMetadata(sid);
  useAuth.getState().setReadonly(!meta.capabilities.canEdit);
  await fullPull();
  void processQueue();
  setInterval(() => void fullPull(), 60_000);
  setInterval(() => void processQueue(), 3_000);
  window.addEventListener('online', () => { useSync.getState().setStatus('idle'); void processQueue(); });
  window.addEventListener('offline', () => useSync.getState().setStatus('offline'));
};
