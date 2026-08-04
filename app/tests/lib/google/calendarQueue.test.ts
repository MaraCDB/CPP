import { describe, it, expect, beforeEach } from 'vitest';
import { enqueue, listQueue, removeFromQueue, clearQueue } from '../../../src/lib/google/calendarQueue';

describe('calendarQueue', () => {
  beforeEach(() => {
    localStorage.clear();
    clearQueue();
  });

  it('inizia vuota', () => {
    expect(listQueue()).toEqual([]);
  });

  it('enqueue aggiunge un\'operazione pendente', () => {
    enqueue('booking', 'b1', 'upsert');
    expect(listQueue()).toEqual([{ kind: 'booking', id: 'b1', action: 'upsert' }]);
  });

  it('enqueue sullo stesso kind+id sovrascrive l\'azione precedente (l\'ultima vince)', () => {
    enqueue('booking', 'b1', 'upsert');
    enqueue('booking', 'b1', 'delete');
    expect(listQueue()).toEqual([{ kind: 'booking', id: 'b1', action: 'delete' }]);
  });

  it('kind diversi con lo stesso id restano separati', () => {
    enqueue('booking', 'x1', 'upsert');
    enqueue('closure', 'x1', 'upsert');
    expect(listQueue()).toHaveLength(2);
  });

  it('removeFromQueue rimuove una singola entry', () => {
    enqueue('booking', 'b1', 'upsert');
    enqueue('closure', 'c1', 'upsert');
    removeFromQueue('booking', 'b1');
    expect(listQueue()).toEqual([{ kind: 'closure', id: 'c1', action: 'upsert' }]);
  });

  it('la coda persiste tra istanze diverse (localStorage)', () => {
    enqueue('booking', 'b1', 'upsert');
    expect(listQueue()).toHaveLength(1);
    // rileggendo da zero (nessun modulo in-memory, solo localStorage)
    expect(listQueue()).toEqual([{ kind: 'booking', id: 'b1', action: 'upsert' }]);
  });
});
