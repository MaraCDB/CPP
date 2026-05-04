import { describe, it, expect } from 'vitest';
import { checkConflicts, overlaps } from '../../src/lib/conflicts';
import type { Prenotazione, Chiusura, Stato } from '../../src/types';

const mk = (id: string, camera: 'lampone'|'mirtillo', checkin: string, checkout: string, stato: Stato = 'confermato', nome = 'X'): Prenotazione => ({
  id, camera, checkin, checkout, stato, nome, creatoIl: '2026-01-01T00:00:00', aggiornatoIl: '2026-01-01T00:00:00',
});

describe('overlaps', () => {
  it('vero quando i range si toccano', () => {
    expect(overlaps('2026-04-10','2026-04-14','2026-04-12','2026-04-16')).toBe(true);
  });
  it('falso quando un check-out coincide col check-in successivo', () => {
    expect(overlaps('2026-04-10','2026-04-14','2026-04-14','2026-04-16')).toBe(false);
  });
});

describe('checkConflicts', () => {
  it('🔴 BLOCCA confermata sopra confermata stessa camera', () => {
    const existing = [mk('1','lampone','2026-04-10','2026-04-14','confermato','Rossi')];
    const candidate = mk('2','lampone','2026-04-12','2026-04-15','confermato','Bianchi');
    const res = checkConflicts(candidate, existing, []);
    expect(res?.block).toBe(true);
    expect(res?.msg).toContain('Rossi');
  });
  it('🟡 AVVISA proposta sopra confermata, non blocca', () => {
    const existing = [mk('1','lampone','2026-04-10','2026-04-14','confermato','Rossi')];
    const candidate = mk('2','lampone','2026-04-12','2026-04-15','proposta','Neri');
    const res = checkConflicts(candidate, existing, []);
    expect(res?.block).toBe(false);
    expect(res?.msg).toContain('proponendo');
  });
  it('⚪ NESSUN check tra due proposte sovrapposte', () => {
    const existing = [mk('1','lampone','2026-04-10','2026-04-14','proposta','A')];
    const candidate = mk('2','lampone','2026-04-12','2026-04-15','proposta','B');
    expect(checkConflicts(candidate, existing, [])).toBeNull();
  });
  it('🟠 RICORDA di avvisare quando confermi su proposte', () => {
    const existing = [mk('1','lampone','2026-04-10','2026-04-14','proposta','Verdi')];
    const candidate = mk('2','lampone','2026-04-12','2026-04-15','confermato','Rossi');
    const res = checkConflicts(candidate, existing, []);
    expect(res?.block).toBe(false);
    expect(res?.msg).toContain('Verdi');
  });
  it('🔒 AVVISA su chiusura struttura', () => {
    const ch: Chiusura[] = [{ id:'c1', start:'2026-06-20', end:'2026-06-28', note:'vac' }];
    const candidate = mk('2','lampone','2026-06-22','2026-06-25','confermato','famiglia');
    const res = checkConflicts(candidate, [], ch);
    expect(res?.block).toBe(false);
    expect(res?.msg).toContain('chiusa');
  });
  it('camere diverse non confliggono', () => {
    const existing = [mk('1','lampone','2026-04-10','2026-04-14','confermato','Rossi')];
    const candidate = mk('2','mirtillo','2026-04-12','2026-04-15','confermato','Bianchi');
    expect(checkConflicts(candidate, existing, [])).toBeNull();
  });
  it('escludersi da soli (modifica della stessa prenotazione)', () => {
    const existing = [mk('1','lampone','2026-04-10','2026-04-14','confermato','Rossi')];
    const candidate = mk('1','lampone','2026-04-10','2026-04-15','confermato','Rossi');
    expect(checkConflicts(candidate, existing, [])).toBeNull();
  });
});
