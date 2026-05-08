import { describe, it, expect, beforeEach } from 'vitest';
import { useSettings } from '../../src/store/settings';

beforeEach(() => {
  useSettings.setState({ anchor: '2026-05-01' });
});

describe('useSettings.shiftAnchor', () => {
  it('avanza di un mese', () => {
    useSettings.getState().shiftAnchor(1);
    expect(useSettings.getState().anchor).toBe('2026-06-01');
  });

  it('torna indietro di un mese', () => {
    useSettings.getState().shiftAnchor(-1);
    expect(useSettings.getState().anchor).toBe('2026-04-01');
  });

  it('avanza ripetutamente senza rimanere fermo', () => {
    useSettings.getState().shiftAnchor(1);
    useSettings.getState().shiftAnchor(1);
    useSettings.getState().shiftAnchor(1);
    expect(useSettings.getState().anchor).toBe('2026-08-01');
  });

  it('attraversa il confine di anno avanti', () => {
    useSettings.setState({ anchor: '2026-12-01' });
    useSettings.getState().shiftAnchor(1);
    expect(useSettings.getState().anchor).toBe('2027-01-01');
  });

  it('attraversa il confine di anno indietro', () => {
    useSettings.setState({ anchor: '2026-01-01' });
    useSettings.getState().shiftAnchor(-1);
    expect(useSettings.getState().anchor).toBe('2025-12-01');
  });

  it('shift di 3 mesi (vista trimestre)', () => {
    useSettings.getState().shiftAnchor(3);
    expect(useSettings.getState().anchor).toBe('2026-08-01');
  });

  it('shift di 12 mesi (vista anno)', () => {
    useSettings.getState().shiftAnchor(12);
    expect(useSettings.getState().anchor).toBe('2027-05-01');
  });
});

describe('useSettings.anchor iniziale', () => {
  it('è il primo del mese corrente in formato locale YYYY-MM-01', () => {
    const fresh = useSettings.getState().anchor;
    expect(fresh).toMatch(/^\d{4}-\d{2}-01$/);
  });
});
