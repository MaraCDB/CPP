import type { Prenotazione, Chiusura, Conflict } from '../types';
import { parseISO, addDays, iso } from './date';

export const overlaps = (a1: string, a2: string, b1: string, b2: string): boolean =>
  parseISO(a1) < parseISO(b2) && parseISO(b1) < parseISO(a2);

export const checkConflicts = (
  candidate: Prenotazione,
  bookings: Prenotazione[],
  chiusure: Chiusura[],
): Conflict | null => {
  const same = bookings.filter(b => b.id !== candidate.id && b.camera === candidate.camera);

  const blocking = same.filter(b =>
    (b.stato === 'confermato' || b.stato === 'anticipo_atteso') &&
    overlaps(candidate.checkin, candidate.checkout, b.checkin, b.checkout)
  );

  if (blocking.length && (candidate.stato === 'confermato' || candidate.stato === 'anticipo_atteso')) {
    return { block: true, msg: `🔴 Conflitto: la camera è già occupata da ${blocking.map(b => b.nome).join(', ')}.` };
  }
  if (blocking.length && candidate.stato === 'proposta') {
    return { block: false, msg: `🟡 Attenzione: stai proponendo date già occupate da ${blocking.map(b => b.nome).join(', ')}.` };
  }
  if (candidate.stato === 'confermato') {
    const others = same.filter(b =>
      b.stato === 'proposta' &&
      overlaps(candidate.checkin, candidate.checkout, b.checkin, b.checkout)
    );
    if (others.length) return {
      block: false,
      msg: `🟠 Ricordati di avvisare: ${others.map(b => b.nome).join(', ')} (proposte sulle stesse date).`,
    };
  }

  const chHit = chiusure.find(c =>
    overlaps(candidate.checkin, candidate.checkout, c.start, iso(addDays(parseISO(c.end), 1)))
  );
  if (chHit) {
    return { block: false, msg: `🔒 Attenzione: struttura chiusa in queste date${chHit.note ? ` (${chHit.note})` : ''}. Confermi comunque?` };
  }
  return null;
};
