import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Prenotazione } from '../types';
import { uid } from '../lib/id';

interface State {
  items: Prenotazione[];
  add: (b: Omit<Prenotazione, 'id' | 'creatoIl' | 'aggiornatoIl'>) => Prenotazione;
  update: (id: string, patch: Partial<Prenotazione>) => void;
  remove: (id: string) => void;
}

export const useBookings = create<State>()(persist((set, get) => ({
  items: [],
  add: (b) => {
    const now = new Date().toISOString();
    const item: Prenotazione = { ...b, id: uid('b'), creatoIl: now, aggiornatoIl: now };
    set({ items: [...get().items, item] });
    return item;
  },
  update: (id, patch) => set({
    items: get().items.map(b => b.id === id ? { ...b, ...patch, aggiornatoIl: new Date().toISOString() } : b),
  }),
  remove: (id) => set({ items: get().items.filter(b => b.id !== id) }),
}), { name: 'cdb_bookings_v1' }));
