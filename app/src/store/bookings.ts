import { create } from 'zustand';
import type { Prenotazione } from '../types';
import { uid } from '../lib/id';

const enq = async (kind: 'upsert_booking' | 'delete_booking', payload: unknown) => {
  const { enqueue } = await import('../lib/sync');
  void enqueue(kind, payload);
};

interface State {
  items: Prenotazione[];
  add: (b: Omit<Prenotazione, 'id'|'creatoIl'|'aggiornatoIl'>) => Prenotazione;
  update: (id: string, patch: Partial<Prenotazione>) => void;
  remove: (id: string) => void;
}

export const useBookings = create<State>((set, get) => ({
  items: [],
  add: (b) => {
    const now = new Date().toISOString();
    const item: Prenotazione = { ...b, id: uid('b'), creatoIl: now, aggiornatoIl: now };
    set({ items: [...get().items, item] });
    void enq('upsert_booking', item);
    return item;
  },
  update: (id, patch) => {
    set({ items: get().items.map(b => b.id === id ? { ...b, ...patch, aggiornatoIl: new Date().toISOString() } : b) });
    const updated = get().items.find(b => b.id === id);
    if (updated) void enq('upsert_booking', updated);
  },
  remove: (id) => {
    set({ items: get().items.filter(b => b.id !== id) });
    void enq('delete_booking', { id });
  },
}));
