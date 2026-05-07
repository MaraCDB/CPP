import { zip } from 'fflate';
import { useBookings } from '../../store/bookings';
import { useClosures } from '../../store/closures';
import { usePromemoria } from '../../store/promemoria';
import { useTasks } from '../../store/tasks';
import { useTemplates } from '../../store/templates';

const escapeCell = (v: unknown): string => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const toCsv = (rows: unknown[][]): string =>
  rows.length === 0 ? '' : rows.map(r => r.map(escapeCell).join(',')).join('\n') + '\n';

const objectsToCsv = <T extends object>(items: T[]): string => {
  if (items.length === 0) return '';
  const keys = Object.keys(items[0]) as (keyof T)[];
  const rows: unknown[][] = [keys as unknown[], ...items.map(o => keys.map(k => o[k]))];
  return toCsv(rows);
};

// fflate's `instanceof Uint8Array` check can fail across jsdom realms.
// Re-wrapping through the current realm's Uint8Array constructor copies the buffer
// and guarantees the right class. Works in both browser and jsdom.
const toBytes = (csv: string): Uint8Array => {
  const encoded = new TextEncoder().encode(csv.length > 0 ? csv : '\n');
  return new Uint8Array(encoded);
};

export const buildZipBytes = async (): Promise<Uint8Array> => {
  const files: Record<string, Uint8Array> = {
    'bookings.csv':   toBytes(objectsToCsv(useBookings.getState().items)),
    'closures.csv':   toBytes(objectsToCsv(useClosures.getState().items)),
    'promemoria.csv': toBytes(objectsToCsv(usePromemoria.getState().items)),
    'tasks.csv':      toBytes(objectsToCsv(useTasks.getState().items)),
    'templates.csv':  toBytes(objectsToCsv(useTemplates.getState().items)),
  };
  return new Promise((resolve, reject) => {
    zip(files, (err, data) => err ? reject(err) : resolve(data));
  });
};
