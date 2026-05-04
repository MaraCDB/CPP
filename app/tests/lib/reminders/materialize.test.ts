import { describe, it, expect } from 'vitest';
import { resolvePlaceholders } from '../../../src/lib/reminders/materialize';

describe('resolvePlaceholders', () => {
  it('sostituisce {adulti} con 2 e {bambini} con 1 dato numOspiti=3 senza dettaglio', () => {
    const out = resolvePlaceholders('Camera {adulti}A {bambini}B', { numOspiti: 3 });
    expect(out).toBe('Camera 3A 0B');
  });
  it('lascia placeholder sconosciuti invariati', () => {
    expect(resolvePlaceholders('foo {boh}', {})).toBe('foo {boh}');
  });
  it('sostituisce {oraArrivo} se presente nelle note', () => {
    expect(resolvePlaceholders('Check-in {oraArrivo}', { oraArrivo: '15:30' })).toBe('Check-in 15:30');
  });
  it('placeholder {oraArrivo} mancante diventa "—"', () => {
    expect(resolvePlaceholders('Check-in {oraArrivo}', {})).toBe('Check-in —');
  });
});
