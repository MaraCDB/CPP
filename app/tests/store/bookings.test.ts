import { describe, it, expect, beforeEach } from 'vitest';
import { useBookings } from '../../src/store/bookings';

describe('bookings store', () => {
  beforeEach(() => {
    useBookings.setState({ items: [] });
    localStorage.clear();
  });
  it('inizia vuoto', () => {
    expect(useBookings.getState().items).toEqual([]);
  });
  it('add aggiunge una prenotazione con id e timestamps', () => {
    useBookings.getState().add({
      camera: 'lampone', checkin: '2026-04-10', checkout: '2026-04-14',
      stato: 'confermato', nome: 'Rossi',
    });
    const items = useBookings.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0].id).toBeDefined();
    expect(items[0].creatoIl).toBeDefined();
  });
  it('update modifica una prenotazione esistente', () => {
    useBookings.getState().add({ camera:'lampone', checkin:'2026-04-10', checkout:'2026-04-14', stato:'proposta', nome:'A' });
    const id = useBookings.getState().items[0].id;
    useBookings.getState().update(id, { stato: 'confermato' });
    expect(useBookings.getState().items[0].stato).toBe('confermato');
  });
  it('remove elimina', () => {
    useBookings.getState().add({ camera:'lampone', checkin:'2026-04-10', checkout:'2026-04-14', stato:'proposta', nome:'A' });
    const id = useBookings.getState().items[0].id;
    useBookings.getState().remove(id);
    expect(useBookings.getState().items).toHaveLength(0);
  });
});

describe('bookings store — contact link persistence', () => {
  it('update preserva contattoResourceName quando non incluso nella patch', () => {
    useBookings.setState({ items: [] });
    const b = useBookings.getState().add({
      camera: 'lampone', checkin: '2026-05-01', checkout: '2026-05-03',
      stato: 'confermato', nome: 'Test', numOspiti: 2,
      contattoVia: 'telefono', contattoValore: '+393351234567',
      contattoResourceName: 'people/c99', contattoEmail: 'a@b.it',
    });
    useBookings.getState().update(b.id, { note: 'ciao' });
    const updated = useBookings.getState().items.find(x => x.id === b.id);
    expect(updated?.contattoResourceName).toBe('people/c99');
    expect(updated?.contattoEmail).toBe('a@b.it');
  });
});
