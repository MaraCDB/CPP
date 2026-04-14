import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Chiusura } from '../types';
import { uid } from '../lib/id';

interface State {
  items: Chiusura[];
  add: (c: Omit<Chiusura, 'id'>) => Chiusura;
  update: (id: string, patch: Partial<Chiusura>) => void;
  remove: (id: string) => void;
}

export const useClosures = create<State>()(persist((set, get) => ({
  items: [],
  add: (c) => {
    const item: Chiusura = { ...c, id: uid('c') };
    set({ items: [...get().items, item] });
    return item;
  },
  update: (id, patch) => set({ items: get().items.map(c => c.id === id ? { ...c, ...patch } : c) }),
  remove: (id) => set({ items: get().items.filter(c => c.id !== id) }),
}), { name: 'cdb_closures_v1' }));
