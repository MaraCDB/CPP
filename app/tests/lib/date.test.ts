import { describe, it, expect } from 'vitest';
import { iso, parseISO, nightsBetween, addDays, isWeekend } from '../../src/lib/date';

describe('date utils', () => {
  it('iso() converte Date a YYYY-MM-DD', () => {
    expect(iso(new Date(2026, 3, 14))).toBe('2026-04-14');
  });
  it('parseISO() interpreta YYYY-MM-DD a Date locale', () => {
    const d = parseISO('2026-04-14');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(3);
    expect(d.getDate()).toBe(14);
  });
  it('nightsBetween() conta i giorni tra due date ISO', () => {
    expect(nightsBetween('2026-04-10', '2026-04-14')).toBe(4);
    expect(nightsBetween('2026-04-10', '2026-04-10')).toBe(0);
  });
  it('addDays() somma giorni (anche negativi)', () => {
    expect(iso(addDays(parseISO('2026-04-14'), 3))).toBe('2026-04-17');
    expect(iso(addDays(parseISO('2026-04-14'), -1))).toBe('2026-04-13');
  });
  it('isWeekend() identifica sab/dom', () => {
    expect(isWeekend(new Date(2026, 3, 18))).toBe(true);
    expect(isWeekend(new Date(2026, 3, 19))).toBe(true);
    expect(isWeekend(new Date(2026, 3, 20))).toBe(false);
  });
});
