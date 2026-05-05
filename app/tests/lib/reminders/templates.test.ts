import { describe, it, expect } from 'vitest';
import { DEFAULT_TEMPLATES } from '../../../src/lib/reminders/templates';

describe('DEFAULT_TEMPLATES', () => {
  it('contiene esattamente 9 template', () => {
    expect(DEFAULT_TEMPLATES).toHaveLength(9);
  });
  it('tutti i default hanno builtIn: true', () => {
    expect(DEFAULT_TEMPLATES.every(t => t.builtIn)).toBe(true);
  });
  it('contiene gli id attesi', () => {
    const ids = DEFAULT_TEMPLATES.map(t => t.id).sort();
    expect(ids).toEqual([
      'cena', 'check-in-today', 'documents', 'istat-questura',
      'merenda', 'preparation', 'receipt-issue', 'receipt-print', 'tourism-tax',
    ]);
  });
  it('preparation è -1 giorno alle 14:00', () => {
    const t = DEFAULT_TEMPLATES.find(t => t.id === 'preparation')!;
    expect(t.offsetDays).toBe(-1);
    expect(t.defaultTime).toBe('14:00');
  });
  it('check-in-today è offset 0 alle 00:00', () => {
    const t = DEFAULT_TEMPLATES.find(t => t.id === 'check-in-today')!;
    expect(t.offsetDays).toBe(0);
    expect(t.defaultTime).toBe('00:00');
  });
  it('merenda e cena sono service', () => {
    const merenda = DEFAULT_TEMPLATES.find(t => t.id === 'merenda')!;
    const cena = DEFAULT_TEMPLATES.find(t => t.id === 'cena')!;
    expect(merenda.isService).toBe(true);
    expect(cena.isService).toBe(true);
  });
  it('sortOrder è univoco e crescente', () => {
    const orders = DEFAULT_TEMPLATES.map(t => t.sortOrder).sort((a, b) => a - b);
    expect(new Set(orders).size).toBe(9);
  });
});
