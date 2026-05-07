import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../src/store/bookings', () => ({ useBookings: { getState: () => ({ items: [] }) } }));
vi.mock('../../../src/store/closures', () => ({ useClosures: { getState: () => ({ items: [] }) } }));
vi.mock('../../../src/store/promemoria', () => ({ usePromemoria: { getState: () => ({ items: [] }) } }));
vi.mock('../../../src/store/tasks', () => ({ useTasks: { getState: () => ({ items: [] }) } }));
vi.mock('../../../src/store/templates', () => ({ useTemplates: { getState: () => ({ items: [] }) } }));

import { toCsv, buildZipBytes } from '../../../src/lib/firebase/backup';
import { unzipSync, strFromU8 } from 'fflate';

describe('toCsv', () => {
  it('escapes quotes, commas, newlines per RFC 4180', () => {
    const rows = [
      ['id', 'name', 'note'],
      ['1', 'Mario', 'tutto ok'],
      ['2', 'Anna, "la guida"', 'riga\ndue'],
    ];
    const csv = toCsv(rows);
    expect(csv).toContain('id,name,note\n');
    expect(csv).toContain('1,Mario,tutto ok\n');
    expect(csv).toContain('2,"Anna, ""la guida""","riga\ndue"\n');
  });

  it('returns empty string for empty array', () => {
    expect(toCsv([])).toBe('');
  });
});

describe('buildZipBytes', () => {
  it('creates a zip with 5 csv files', async () => {
    const bytes = await buildZipBytes();
    const out = unzipSync(bytes);
    expect(Object.keys(out).sort()).toEqual([
      'bookings.csv', 'closures.csv', 'promemoria.csv', 'tasks.csv', 'templates.csv',
    ]);
    expect(typeof strFromU8(out['bookings.csv'])).toBe('string');
  });
});
