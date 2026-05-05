import { describe, it, expect } from 'vitest';
import { toE164 } from '../../src/lib/phone';

describe('toE164', () => {
  it('normalizza un numero IT con prefisso esplicito', () => {
    expect(toE164('+39 335 1234567')).toBe('+393351234567');
  });
  it('normalizza un numero IT senza prefisso (default IT)', () => {
    expect(toE164('335 1234567')).toBe('+393351234567');
  });
  it('rimuove spazi, trattini e punti', () => {
    expect(toE164('+39-335.123-4567')).toBe('+393351234567');
  });
  it('ritorna null su input non numerico', () => {
    expect(toE164('casa Mario')).toBeNull();
  });
  it('ritorna null su stringa vuota', () => {
    expect(toE164('')).toBeNull();
  });
  it('accetta numero internazionale non-IT', () => {
    expect(toE164('+44 20 7946 0958')).toBe('+442079460958');
  });
});
